import * as maplibregl from 'maplibre-gl'
import { getInput } from './controls.js'
import { createCar, updateCar, createCarObject, animateWheels, MAX_SPEED } from './car.js'
import { updateEngine } from './engine.js'
import { createThreeLayer } from './three-layer.js'
import { createMonuments, hideMonumentBuildings } from './monuments.js'
import { setupAmbiance } from './ambiance.js'

// départ : sur la ligne des Champs-Élysées à la sortie du rond-point, face à l'Arc de Triomphe
// (doit être sur une ligne de route, sinon la voiture est bloquée dès le départ)
const START = [2.309576, 48.869157, 296]
const car = createCar(...START)

const CAMERA = { zoom: 20, pitch: 75 }
const CAMERA_LAG = 4 // plus c'est petit, plus la caméra met du temps à suivre les virages
const ZOOM_OUT = 0.7 // dézoom à vitesse max, pour voir plus loin quand on va vite
const ROAD_MARGIN = 8 // m, environ deux voies de chaque côté de la ligne

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty', // gratuit, sans clé, bâtiments 3D inclus
  center: [car.lng, car.lat],
  bearing: car.heading,
  maxPitch: 85,
  ...CAMERA,
  interactive: false, // c'est la voiture qui pilote la caméra
  // crédits des modèles 3D (obligatoire pour l'Arc de Triomphe, sous CC BY 4.0)
  attributionControl: {
    customAttribution: [
      'Arc de Triomphe : Microsoft, <a href="https://commons.wikimedia.org/wiki/File:Arc_de_Triomphe.stl">Wikimedia Commons</a> (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>)',
      'Tour Eiffel : <a href="https://conic.openstreetmap.de/model/4">3DMR</a> (CC0)',
      'Voiture : <a href="https://kenney.nl/assets/car-kit">Kenney</a> (CC0)',
    ],
  },
})

// décale le point visé vers le bas de l'écran pour voir plus loin devant la voiture
map.setPadding({ top: innerHeight * 0.4 })

map.on('load', () => {
  const carObject = createCarObject()
  map.addLayer(createThreeLayer('modeles-3d', [{ object: carObject, pose: car }, ...createMonuments()]))
  hideMonumentBuildings(map)
  setupAmbiance(map, carObject)

  // routes carrossables du style liberty (sans chemins piétons ni rails), tunnels exclus car invisibles
  const roadLayers = map
    .getStyle()
    .layers.filter((l) => l.type === 'line' && /^(road|bridge)_/.test(l.id) && !/path|rail/.test(l.id))
    .map((l) => l.id)
  // queryRenderedFeatures ne voit que ce qui est affiché, mais la voiture est toujours à l'écran
  // une route est dessinée comme une ligne fine au milieu de la chaussée : on accepte tout ce qui est
  // à moins de ROAD_MARGIN mètres d'une ligne. La marge est en mètres au sol, pas en pixels, car avec
  // la vue inclinée un pixel ne représente pas la même distance en largeur et en profondeur
  const isOnRoad = (lng, lat) => {
    const dLat = ROAD_MARGIN / 111320
    const dLng = dLat / Math.cos((lat * Math.PI) / 180)
    const corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([i, j]) => map.project([lng + i * dLng, lat + j * dLat]))
    const xs = corners.map((p) => p.x)
    const ys = corners.map((p) => p.y)
    const box = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]]
    return map.queryRenderedFeatures(box, { layers: roadLayers }).length > 0
  }

  const speedometer = document.getElementById('vitesse')
  let cameraBearing = car.heading
  let last
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1) // borne si l'onglet était en arrière-plan
    last = now
    const input = getInput()
    if (input.reset) {
      Object.assign(car, createCar(...START))
      cameraBearing = car.heading
    }
    updateCar(car, input, dt, isOnRoad)
    animateWheels(carObject, car)
    updateEngine(car.speed, input.throttle)
    speedometer.textContent = `${Math.round(Math.abs(car.speed) * 3.6)} km/h`

    // la caméra rattrape le cap de la voiture par le plus court chemin (de 350° à 10°, on passe par 0°)
    const diff = ((car.heading - cameraBearing + 540) % 360) - 180
    cameraBearing += diff * Math.min(1, CAMERA_LAG * dt)
    // jumpTo redessine la carte, donc aussi la couche de la voiture
    map.jumpTo({
      center: [car.lng, car.lat],
      bearing: cameraBearing,
      pitch: CAMERA.pitch,
      zoom: CAMERA.zoom - (ZOOM_OUT * Math.abs(car.speed)) / MAX_SPEED,
    })
    requestAnimationFrame(frame)
  }

  // "idle" = toutes les tuiles visibles sont chargées : avant, les routes ne sont pas encore
  // connues et la voiture ne pourrait pas rouler correctement
  map.once('idle', () => {
    document.getElementById('chargement').classList.add('cache')
    last = performance.now()
    requestAnimationFrame(frame)
  })
})
