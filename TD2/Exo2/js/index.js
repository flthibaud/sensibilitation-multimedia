// ThreeJS and Third-party deps
import * as THREE from 'three'
import * as dat from 'dat.gui'
import * as satellite from 'satellite.js'
import Stats from "three/examples/jsm/libs/stats.module.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

// Core boilerplate code deps
import { createCamera, createRenderer, runApp, updateLoadingProgressBar } from "./core-utils.js"

// Other deps
import { loadTexture } from "./common-utils.js"

// Sans bundler, on ne peut pas "importer" des images ou des .glsl :
// on construit leurs URL relativement à ce fichier, et on récupère les shaders avec fetch
const assetUrl = (path) => new URL(path, import.meta.url).href
const Albedo = assetUrl("../assets/Albedo.jpg")
const Bump = assetUrl("../assets/Bump.jpg")
const Clouds = assetUrl("../assets/Clouds.png")
const Ocean = assetUrl("../assets/Ocean.png")
const NightLights = assetUrl("../assets/night_lights_modified.png")
const GaiaSky = assetUrl("../assets/Gaia_EDR3_darkened.png")
const vertexShader = await fetch(assetUrl("../shaders/vertex.glsl")).then((res) => res.text())
const fragmentShader = await fetch(assetUrl("../shaders/fragment.glsl")).then((res) => res.text())

window.THREE = THREE
// previously this feature is .legacyMode = false, see https://www.donmccurdy.com/2020/06/17/color-management-in-threejs/
// turning this on has the benefit of doing certain automatic conversions (for hexadecimal and CSS colors from sRGB to linear-sRGB)
THREE.ColorManagement.enabled = true

/**************************************************
 * 0. Tweakable parameters for the scene
 *************************************************/
const params = {
  // general scene params
  sunIntensity: 1.3, // brightness of the sun
  speedFactor: 2.0, // rotation speed of the earth
  metalness: 0.1,
  atmOpacity: { value: 0.7 },
  atmPowFactor: { value: 4.1 },
  atmMultiplier: { value: 9.5 },
  realTime: true, // synchronise le jour/nuit avec l'heure réelle
  showFlags: true, // affiche les drapeaux des pays sur le globe
  showISS: true, // affiche la station spatiale et son orbite
}

/**************************************************
 * Station spatiale internationale (ISS)
 * On récupère ses éléments orbitaux (TLE) sur CelesTrak, puis satellite.js calcule
 * sa position exacte à n'importe quel instant : pas besoin d'appeler une API à chaque image.
 *************************************************/
const EARTH_RADIUS_KM = 6371
const EARTH_RADIUS_SCENE = 10 // rayon de la SphereGeometry de la Terre
const TLE_CACHE_KEY = "iss-tle"
const TLE_CACHE_DURATION = 12 * 3600 * 1000 // CelesTrak demande de ne pas recharger un TLE plus d'une fois toutes les 2h

/**
 * Récupère le TLE de l'ISS (n° NORAD 25544), avec cache localStorage
 * @returns {Promise<object>} le satrec satellite.js prêt à être propagé
 */
const fetchISSSatrec = async () => {
  let lines = null
  try {
    const cached = JSON.parse(localStorage.getItem(TLE_CACHE_KEY))
    if (cached && Date.now() - cached.date < TLE_CACHE_DURATION) lines = cached.lines
  } catch (e) { /* pas de cache */ }

  if (!lines) {
    const res = await fetch("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE")
    if (!res.ok) throw new Error(`CelesTrak : ${res.status}`)
    // format : 1 ligne de nom puis les 2 lignes du TLE
    lines = (await res.text()).trim().split("\n").map((line) => line.trim()).slice(1, 3)
    try {
      localStorage.setItem(TLE_CACHE_KEY, JSON.stringify({ date: Date.now(), lines }))
    } catch (e) { /* localStorage indisponible */ }
  }
  return satellite.twoline2satrec(lines[0], lines[1])
}

/**
 * Position de l'ISS à une date donnée, dans le repère local de la Terre
 * @returns {THREE.Vector3 | null}
 */
const getISSLocalPosition = (satrec, date) => {
  const posVel = satellite.propagate(satrec, date)
  if (!posVel || !posVel.position) return null
  // ECI (repère inertiel) -> latitude/longitude/altitude, grâce au temps sidéral de Greenwich
  const geo = satellite.eciToGeodetic(posVel.position, satellite.gstime(date))
  const radius = EARTH_RADIUS_SCENE * (EARTH_RADIUS_KM + geo.height) / EARTH_RADIUS_KM
  return latLonToLocalDirection(geo.latitude, geo.longitude).multiplyScalar(radius)
}

/**
 * Modèle simplifié de l'ISS construit avec des primitives.
 * Orientation : +Z = sens de déplacement, +Y = vers l'espace (opposé à la Terre).
 * Taille très exagérée : à l'échelle réelle (109 m), l'ISS serait invisible.
 */
const createISSModel = () => {
  const iss = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.6, roughness: 0.4 })
  const panel = new THREE.MeshStandardMaterial({ color: 0x2a3d7a, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide })
  const radiator = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8, side: THREE.DoubleSide })

  // poutre principale, perpendiculaire au déplacement
  const truss = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.03), metal)
  iss.add(truss)

  // modules pressurisés, alignés dans le sens du déplacement
  const modules = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 12), metal)
  modules.rotation.x = Math.PI / 2
  modules.position.y = -0.04
  iss.add(modules)

  // 4 paires de panneaux solaires aux extrémités de la poutre
  const panelGeo = new THREE.PlaneGeometry(0.08, 0.35)
  for (const x of [-0.46, -0.36, 0.36, 0.46]) {
    for (const z of [-0.2, 0.2]) {
      const mesh = new THREE.Mesh(panelGeo, panel)
      mesh.rotation.x = -Math.PI / 2 // à plat, face vers l'espace
      mesh.position.set(x, 0, z)
      iss.add(mesh)
    }
  }

  // radiateurs près du centre
  for (const x of [-0.15, 0.15]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.18), radiator)
    mesh.position.set(x, 0, -0.12)
    iss.add(mesh)
  }

  iss.scale.setScalar(0.5)
  return iss
}

/**
 * Trace de l'orbite autour de l'instant présent (± une demi-orbite, ~46 min).
 * Calculée dans le repère de la Terre : elle ne se referme pas, car la Terre tourne sous l'ISS.
 */
const computeISSOrbitPoints = (satrec, date) => {
  const points = []
  const halfOrbitMs = 46 * 60 * 1000
  for (let t = -halfOrbitMs; t <= halfOrbitMs; t += 20 * 1000) {
    const pos = getISSLocalPosition(satrec, new Date(date.getTime() + t))
    if (pos) points.push(pos)
  }
  return points
}

/**************************************************
 * Drapeaux des pays (API REST Countries v5)
 * La v3.1 (/v3.1/all) a été désactivée : la v5 exige une clé API gratuite.
 * La clé n'est pas dans ce fichier : le serveur Go la lit dans le .env et relaie
 * les requêtes via /api/countries (voir main.go), elle ne passe donc jamais par le navigateur.
 *************************************************/
const COUNTRIES_CACHE_KEY = "restcountries-v5-flags"
const COUNTRIES_CACHE_DURATION = 7 * 24 * 3600 * 1000 // 7 jours : le plan gratuit est limité à 1000 requêtes/mois

/**
 * Récupère tous les pays (nom, code, coordonnées, drapeau).
 * La v5 est paginée (100 pays max par requête en gratuit), donc on enchaîne les pages.
 * Le résultat est mis en cache dans le localStorage pour économiser le quota.
 * @returns {Promise<Array<{ name: string, code: string, lat: number, lng: number, flagUrl: string }>>}
 */
const fetchCountries = async () => {
  try {
    const cached = JSON.parse(localStorage.getItem(COUNTRIES_CACHE_KEY))
    if (cached && Date.now() - cached.date < COUNTRIES_CACHE_DURATION) return cached.countries
  } catch (e) { /* cache absent ou illisible : on refait la requête */ }

  const countries = []
  const limit = 100
  for (let offset = 0; ; offset += limit) {
    // proxy du serveur Go, qui ajoute la clé API avant d'appeler api.restcountries.com/countries/v5
    const url = "/api/countries"
      + `?limit=${limit}&offset=${offset}`
      + "&response_fields=names.common,codes.alpha_2,coordinates,flag.url_png"
    const res = await fetch(url)
    const json = await res.json()
    if (!res.ok || !json.data) {
      throw new Error(`REST Countries : ${json.errors?.[0]?.message ?? res.status}`)
    }

    for (const country of json.data.objects) {
      if (!country.coordinates || !country.flag?.url_png) continue
      countries.push({
        name: country.names.common,
        code: country.codes.alpha_2,
        lat: country.coordinates.lat,
        lng: country.coordinates.lng,
        // l'API renvoie la version 640px, 160px suffit largement pour un petit drapeau
        flagUrl: country.flag.url_png.replace("/w640/", "/w160/"),
      })
    }
    if (json.data.objects.length < limit) break
  }

  try {
    localStorage.setItem(COUNTRIES_CACHE_KEY, JSON.stringify({ date: Date.now(), countries }))
  } catch (e) { /* localStorage indisponible : tant pis pour le cache */ }
  return countries
}

/**
 * Crée un sprite (image toujours tournée vers la caméra) par pays, posé à sa latitude/longitude
 * @param {THREE.Object3D} parent objet auquel attacher les drapeaux (la Terre, pour qu'ils tournent avec elle)
 * @param {number} radius distance au centre de la Terre
 */
const addFlags = async (parent, radius) => {
  const countries = await fetchCountries()
  const textureLoader = new THREE.TextureLoader()
  const flagHeight = 0.3

  for (const country of countries) {
    textureLoader.load(country.flagUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }))
      // on garde les proportions du drapeau (la Suisse est carrée, le Qatar très allongé...)
      const aspect = texture.image.width / texture.image.height
      sprite.scale.set(flagHeight * aspect, flagHeight, 1)
      sprite.position.copy(
        latLonToLocalDirection(country.lat * Math.PI / 180, country.lng * Math.PI / 180).multiplyScalar(radius)
      )
      sprite.name = country.name
      parent.add(sprite)
    })
  }
}

/**
 * Calcule le point subsolaire (là où le soleil est au zénith) pour une date donnée.
 * Formules approchées de l'almanach astronomique, précises à ~1°.
 * @param {Date} date
 * @returns {{ lat: number, lon: number }} latitude et longitude en radians
 */
const getSubsolarPoint = (date) => {
  const rad = Math.PI / 180
  // nombre de jours depuis J2000 (1er janvier 2000, 12h UTC)
  const d = (date.getTime() - 946728000000) / 86400000

  const meanLon = 280.460 + 0.9856474 * d
  const meanAnomaly = (357.528 + 0.9856003 * d) * rad
  const eclipticLon = (meanLon + 1.915 * Math.sin(meanAnomaly) + 0.020 * Math.sin(2 * meanAnomaly)) * rad
  const obliquity = (23.439 - 0.0000004 * d) * rad

  // coordonnées équatoriales du soleil
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLon))
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLon), Math.cos(eclipticLon))

  // temps sidéral de Greenwich : orientation de la Terre par rapport aux étoiles
  const gmst = (280.46061837 + 360.98564736629 * d) * rad

  return { lat: declination, lon: rightAscension - gmst }
}

/**
 * Convertit une latitude/longitude en direction dans le repère local de la SphereGeometry de three.js
 * (la longitude 0 tombe sur +X, la longitude 90°E sur -Z, compte tenu du mapping UV de la sphère)
 */
const latLonToLocalDirection = (lat, lon) => new THREE.Vector3(
  Math.cos(lat) * Math.cos(lon),
  Math.sin(lat),
  -Math.cos(lat) * Math.sin(lon)
)


/**************************************************
 * 1. Initialize core threejs components
 *************************************************/
// Create the scene
let scene = new THREE.Scene()

// Create the renderer via 'createRenderer',
// 1st param receives additional WebGLRenderer properties
// 2nd param receives a custom callback to further configure the renderer
let renderer = createRenderer({ antialias: true }, (_renderer) => {
  // best practice: ensure output colorspace is in sRGB, see Color Management documentation:
  // https://threejs.org/docs/#manual/en/introduction/Color-management
  _renderer.outputColorSpace = THREE.SRGBColorSpace
})

// Create the camera
// Pass in fov, near, far and camera position respectively
let camera = createCamera(45, 1, 1000, { x: 0, y: 0, z: 30 })


/**************************************************
 * 2. Build your scene in this threejs app
 * This app object needs to consist of at least the async initScene() function (it is async so the animate function can wait for initScene() to finish before being called)
 * initScene() is called after a basic threejs environment has been set up, you can add objects/lighting to you scene in initScene()
 * if your app needs to animate things(i.e. not static), include a updateScene(interval, elapsed) function in the app as well
 *************************************************/
let app = {
  async initScene() {
    // OrbitControls
    this.controls = new OrbitControls(camera, renderer.domElement)
    this.controls.enableDamping = true

    // adding a virtual sun using directional light
    this.dirLight = new THREE.DirectionalLight(0xffffff, params.sunIntensity)
    this.dirLight.position.set(-50, 0, 30)
    scene.add(this.dirLight)

    // updates the progress bar to 10% on the loading UI
    await updateLoadingProgressBar(0.1)

    // loads earth's color map, the basis of how our earth looks like
    const albedoMap = await loadTexture(Albedo)
    albedoMap.colorSpace = THREE.SRGBColorSpace
    await updateLoadingProgressBar(0.2)

    const bumpMap = await loadTexture(Bump)
    await updateLoadingProgressBar(0.3)
    
    const cloudsMap = await loadTexture(Clouds)
    await updateLoadingProgressBar(0.4)

    const oceanMap = await loadTexture(Ocean)
    await updateLoadingProgressBar(0.5)

    const lightsMap = await loadTexture(NightLights)
    await updateLoadingProgressBar(0.6)

    const envMap = await loadTexture(GaiaSky)
    envMap.mapping = THREE.EquirectangularReflectionMapping
    await updateLoadingProgressBar(0.7)
    
    scene.background = envMap

    // create group for easier manipulation of objects(ie later with clouds and atmosphere added)
    this.group = new THREE.Group()
    // earth's axial tilt is 23.5 degrees
    this.group.rotation.z = 23.5 / 360 * 2 * Math.PI
    
    let earthGeo = new THREE.SphereGeometry(10, 64, 64)
    let earthMat = new THREE.MeshStandardMaterial({
      map: albedoMap,
      bumpMap: bumpMap,
      bumpScale: 0.03, // must be really small, if too high even bumps on the back side got lit up
      roughnessMap: oceanMap, // will get reversed in the shaders
      metalness: params.metalness, // gets multiplied with the texture values from metalness map
      metalnessMap: oceanMap,
      emissiveMap: lightsMap,
      emissive: new THREE.Color(0xffff88),
    })
    this.earth = new THREE.Mesh(earthGeo, earthMat)
    this.group.add(this.earth)
    
    let cloudGeo = new THREE.SphereGeometry(10.05, 64, 64)
    let cloudsMat = new THREE.MeshStandardMaterial({
      alphaMap: cloudsMap,
      transparent: true,
    })
    this.clouds = new THREE.Mesh(cloudGeo, cloudsMat)
    this.group.add(this.clouds)
    
    // set initial rotational position of earth to get a good initial angle
    this.earth.rotateY(-0.3)
    this.clouds.rotateY(-0.3)

    let atmosGeo = new THREE.SphereGeometry(12.5, 64, 64)
    let atmosMat = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: {
        atmOpacity: params.atmOpacity,
        atmPowFactor: params.atmPowFactor,
        atmMultiplier: params.atmMultiplier
      },
      // notice that by default, Three.js uses NormalBlending, where if your opacity of the output color gets lower, the displayed color might get whiter
      blending: THREE.AdditiveBlending, // works better than setting transparent: true, because it avoids a weird dark edge around the earth
      side: THREE.BackSide // such that it does not overlays on top of the earth; this points the normal in opposite direction in vertex shader
    })
    this.atmos = new THREE.Mesh(atmosGeo, atmosMat)
    this.group.add(this.atmos)

    scene.add(this.group)

    // meshphysical.glsl.js is the shader used by MeshStandardMaterial: https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderLib/meshphysical.glsl.js
    // shadowing of clouds, from https://discourse.threejs.org/t/how-to-cast-shadows-from-an-outer-sphere-to-an-inner-sphere/53732/6
    // some notes of the negative light map done on the earth material to simulate shadows casted by clouds
    // we need uv_xOffset so as to act as a means to calibrate the offset of the clouds shadows on earth(especially when earth and cloud rotate at different speeds)
    // the way I need to use fracts here is to get a correct calculated result of the cloud texture offset as it moves,
    // arrived at current method by doing the enumeration of cases (writing them down truly helps, don't keep everything in your head!)
    earthMat.onBeforeCompile = function( shader ) {
      shader.uniforms.tClouds = { value: cloudsMap }
      shader.uniforms.tClouds.value.wrapS = THREE.RepeatWrapping;
      shader.uniforms.uv_xOffset = { value: 0 }
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
        #include <common>
        uniform sampler2D tClouds;
        uniform float uv_xOffset;
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;

        #ifdef USE_ROUGHNESSMAP

          vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
          // reversing the black and white values because we provide the ocean map
          texelRoughness = vec4(1.0) - texelRoughness;

          // reads channel G, compatible with a combined OcclusionRoughnessMetallic (RGB) texture
          roughnessFactor *= clamp(texelRoughness.g, 0.5, 1.0);

        #endif
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
        #ifdef USE_EMISSIVEMAP

          vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );

          // Methodology of showing night lights only:
          //
          // going through the shader calculations in the meshphysical shader chunks (mostly on the vertex side),
          // we can confirm that geometryNormal is the normalized normal in view space,
          // for the night side of the earth, the dot product between geometryNormal and the directional light would be negative
          // since the direction vector actually points from target to position of the DirectionalLight,
          // for lit side of the earth, the reverse happens thus emissiveColor would be multiplied with 0.
          // The smoothstep is to smoothen the change between night and day
          
          emissiveColor *= 1.0 - smoothstep(-0.02, 0.0, dot(nonPerturbedNormal, directionalLights[0].direction));
          
          totalEmissiveRadiance *= emissiveColor.rgb;

        #endif

        // Methodology explanation:
        //
        // Our goal here is to use a “negative light map” approach to cast cloud shadows,
        // the idea is on any uv point on earth map(Point X),
        // we find the corresponding uv point(Point Y) on clouds map that is directly above Point X,
        // then we extract color value at Point Y.
        // We then darken the color value at Point X depending on the color value at Point Y,
        // that is the intensity of the clouds at Point Y.
        //
        // Since the clouds are made to spin twice as fast as the earth,
        // in order to get the correct shadows(clouds) position in this earth's fragment shader
        // we need to minus earth's UV.x coordinate by uv_xOffset,
        // which is calculated and explained in the updateScene()
        // after minus by uv_xOffset, the result would be in the range of -1 to 1,
        // we need to set RepeatWrapping for wrapS of the clouds texture so that texture2D still works for -1 to 0

        float cloudsMapValue = texture2D(tClouds, vec2(vMapUv.x - uv_xOffset, vMapUv.y)).r;
        
        // The shadow should be more intense where the clouds are more intense,
        // thus we do 1.0 minus cloudsMapValue to obtain the shadowValue, which is multiplied to diffuseColor
        // we also clamp the shadowValue to a minimum of 0.2 so it doesn't get too dark
        
        diffuseColor.rgb *= max(1.0 - cloudsMapValue, 0.2 );

        // adding small amount of atmospheric coloring to make it more realistic
        // fine tune the first constant for stronger or weaker effect
        float intensity = 1.4 - dot( nonPerturbedNormal, vec3( 0.0, 0.0, 1.0 ) );
        vec3 atmosphere = vec3( 0.3, 0.6, 1.0 ) * pow(intensity, 5.0);
        diffuseColor.rgb += atmosphere;
      `)

      // need save to userData.shader in order to enable our code to update values in the shader uniforms,
      // reference from https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_modified.html
      earthMat.userData.shader = shader
    }

    // Drapeaux : attachés à la Terre pour suivre sa rotation, juste au-dessus des nuages (rayon 10.05).
    // Pas de await : le globe s'affiche sans attendre l'API, les drapeaux apparaissent au fur et à mesure.
    this.flags = new THREE.Group()
    this.flags.visible = params.showFlags
    this.earth.add(this.flags)
    addFlags(this.flags, 10.3).catch((error) => console.warn("Impossible de charger les drapeaux :", error))

    // ISS : attachée à la Terre, car satellite.js donne sa position en latitude/longitude
    this.issGroup = new THREE.Group()
    this.issGroup.visible = params.showISS
    this.earth.add(this.issGroup)
    this.iss = createISSModel()
    this.iss.visible = false // cachée tant que le TLE n'est pas chargé
    this.issGroup.add(this.iss)
    this.issOrbit = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.5 })
    )
    this.issGroup.add(this.issOrbit)
    this.issOrbitUpdatedAt = 0
    fetchISSSatrec()
      .then((satrec) => { this.issSatrec = satrec })
      .catch((error) => console.warn("Impossible de charger l'orbite de l'ISS :", error))

    // GUI controls
    const gui = new dat.GUI()
    gui.add(params, "showFlags").onChange((val) => {
      this.flags.visible = val
    }).name("Afficher les drapeaux")
    gui.add(params, "showISS").onChange((val) => {
      this.issGroup.visible = val
    }).name("Afficher l'ISS")

    // Stats - show fps
    this.stats1 = new Stats()
    this.stats1.showPanel(0) // Panel 0 = fps
    this.stats1.domElement.style.cssText = "position:absolute;top:0px;left:0px;"
    // this.container is the parent DOM element of the threejs canvas element
    this.container.appendChild(this.stats1.domElement)

    await updateLoadingProgressBar(1.0, 100)
  },
  updateISS() {
    const now = new Date()
    const pos = getISSLocalPosition(this.issSatrec, now)
    // position 1 s plus tard, pour connaître la direction de déplacement
    const next = getISSLocalPosition(this.issSatrec, new Date(now.getTime() + 1000))
    if (!pos || !next) return

    this.iss.visible = true
    this.iss.position.copy(pos)

    // orientation : Y vers l'espace, Z dans le sens du déplacement
    const up = pos.clone().normalize()
    const forward = next.sub(pos).normalize()
    const right = new THREE.Vector3().crossVectors(up, forward).normalize()
    forward.crossVectors(right, up) // on ré-orthogonalise
    this.iss.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward))

    // la trace de l'orbite ne bouge que lentement : on la recalcule toutes les 10 s
    if (now.getTime() - this.issOrbitUpdatedAt > 10000) {
      this.issOrbit.geometry.setFromPoints(computeISSOrbitPoints(this.issSatrec, now))
      this.issOrbitUpdatedAt = now.getTime()
    }
  },
  // @param {number} interval - time elapsed between 2 frames
  // @param {number} elapsed - total time elapsed since app start
  updateScene(interval, elapsed) {
    this.controls.update()
    this.stats1.update()

    // en temps réel la Terre ne tourne qu'un tour par jour (imperceptible) : on la laisse fixe
    // et c'est le soleil qui se place selon l'heure. Les nuages, eux, continuent de dériver.
    const earthDelta = params.realTime ? 0 : interval * 0.005 * params.speedFactor
    const cloudsDelta = params.realTime ? interval * 0.005 * params.speedFactor : interval * 0.01 * params.speedFactor

    // use rotateY instead of rotation.y so as to rotate by axis Y local to each mesh
    this.earth.rotateY(earthDelta)
    this.clouds.rotateY(cloudsDelta)

    if (params.realTime) {
      // direction du soleil dans le repère de la Terre, convertie dans le repère du monde
      // (prend en compte l'inclinaison de l'axe et la rotation actuelle de la Terre)
      const { lat, lon } = getSubsolarPoint(new Date())
      const sunDir = latLonToLocalDirection(lat, lon).transformDirection(this.earth.matrixWorld)
      this.dirLight.position.copy(sunDir.multiplyScalar(50))
    }

    if (this.issSatrec) this.updateISS()

    const shader = this.earth.material.userData.shader
    if ( shader ) {
      // As for each n radians Point X has rotated, Point Y would have rotated 2n radians.
      // Thus uv.x of Point Y would always be = uv.x of Point X - n / 2π.
      // Dividing n by 2π is to convert from radians(i.e. 0 to 2π) into the uv space(i.e. 0 to 1).
      // The offset n / 2π would be passed into the shader program via the uniform variable: uv_xOffset.
      // We do offset % 1 because the value of 1 for uv.x means full circle,
      // whenever uv_xOffset is larger than one, offsetting 2π radians is like no offset at all.
      // (généralisé : c'est la rotation des nuages *relative* à la Terre qui compte)
      let offset = (cloudsDelta - earthDelta) / (2 * Math.PI)
      shader.uniforms.uv_xOffset.value += offset % 1
    }
  }
}

/**************************************************
 * 3. Run the app
 * 'runApp' will do most of the boilerplate setup code for you:
 * e.g. HTML container, window resize listener, mouse move/touch listener for shader uniforms, THREE.Clock() for animation
 * Executing this line puts everything together and runs the app
 * ps. if you don't use custom shaders, pass undefined to the 'uniforms'(2nd-last) param
 * ps. if you don't use post-processing, pass undefined to the 'composer'(last) param
 *************************************************/
runApp(app, scene, renderer, camera, true, undefined, undefined)