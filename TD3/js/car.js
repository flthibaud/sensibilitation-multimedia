import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MercatorCoordinate } from 'maplibre-gl'

export const MAX_SPEED = 20 // m/s (72 km/h)
const MAX_REVERSE = 5 // m/s
const ACCEL = 8 // m/s²
const BRAKE = 15 // m/s²
const FRICTION = 3 // m/s², décélération quand on lâche tout
const TURN_RATE = 90 // °/s à pleine vitesse de braquage
const METERS_PER_DEG_LAT = 111320
const MODEL_SCALE = 1.7 // le modèle fait environ 2,6 unités de long -> environ 4,4 m
const WHEEL_RADIUS = 0.3 * MODEL_SCALE // m
const MAX_WHEEL_ANGLE = THREE.MathUtils.degToRad(25)
const WHEELS = ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right']

// heading : cap en degrés, 0 = nord, sens horaire (comme le bearing de MapLibre)
// steer : braquage affiché des roues avant (-1 à 1) ; wheelSpin : rotation des roues (rad)
export function createCar(lng, lat, heading) {
  return { lng, lat, heading, speed: 0, steer: 0, wheelSpin: 0 }
}

// angles essayés, du plus petit au plus grand, pour longer le bord de la route au lieu de s'arrêter
const SLIDE_ANGLES = [15, -15, 30, -30, 45, -45, 60, -60]

// modèle "arcade" : pas de vraie physique, juste de quoi rendre la conduite agréable
// isOnRoad(lng, lat) : on empêche seulement de QUITTER la route
// (hors route, la voiture reste libre, sinon elle serait bloquée dès qu'elle démarre à côté d'une ligne)
export function updateCar(car, { throttle, steer }, dt, isOnRoad) {
  if (throttle > 0) car.speed += (car.speed < 0 ? BRAKE : ACCEL) * dt
  else if (throttle < 0) car.speed -= (car.speed > 0 ? BRAKE : ACCEL) * dt
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), FRICTION * dt)
  car.speed = THREE.MathUtils.clamp(car.speed, -MAX_REVERSE, MAX_SPEED)

  // on ne tourne pas à l'arrêt, et le volant s'inverse en marche arrière
  const grip = THREE.MathUtils.clamp(car.speed / 5, -1, 1)
  car.heading = (car.heading + steer * TURN_RATE * grip * dt + 360) % 360
  car.steer += (steer - car.steer) * Math.min(1, 10 * dt) // le volant ne tourne pas instantanément

  // position atteinte en roulant dans la direction "heading" pendant dt
  const step = (heading) => {
    const rad = THREE.MathUtils.degToRad(heading)
    const east = Math.sin(rad) * car.speed * dt
    const north = Math.cos(rad) * car.speed * dt
    return [
      car.lng + east / (METERS_PER_DEG_LAT * Math.cos(THREE.MathUtils.degToRad(car.lat))),
      car.lat + north / METERS_PER_DEG_LAT,
    ]
  }

  let next = step(car.heading)
  if (car.speed !== 0 && !isOnRoad(...next) && isOnRoad(car.lng, car.lat)) {
    // on longe le bord : direction la plus proche du cap qui reste sur la route
    const angle = SLIDE_ANGLES.find((a) => isOnRoad(...step(car.heading + a)))
    if (angle === undefined) {
      car.speed = 0 // face au bord : seule la marche arrière permet de repartir
      return
    }
    next = step(car.heading + angle)
    // la voiture s'aligne progressivement sur le bord (sinon la caméra sauterait de 15° d'un coup)
    car.heading = (car.heading + angle * Math.min(1, 5 * dt) + 360) % 360
    // frotter le bord freine, d'autant plus que l'angle est fort
    car.speed -= Math.sign(car.speed) * BRAKE * dt * (Math.abs(angle) / 60)
  }
  ;[car.lng, car.lat] = next
  // une roue qui roule sans glisser tourne de (distance / rayon) radians
  car.wheelSpin += (car.speed * dt) / WHEEL_RADIUS
}

// Sedan du Car Kit de Kenney (CC0), l'avant vers +z, roues = nœuds séparés nommés WHEELS
function loadCarModel(scene) {
  new GLTFLoader().load(new URL('../assets/car.glb', import.meta.url).href, ({ scene: model }) => {
    model.scale.setScalar(MODEL_SCALE)
    model.rotation.y = Math.PI // l'avant vers -z, la convention utilisée par la couche
    for (const name of WHEELS) model.getObjectByName(name).rotation.order = 'YXZ' // rouler, puis braquer
    scene.add(model)
  })
}

// dans le repère du modèle : rouler en avant = rotation +x, braquer à droite = rotation -y
function animateWheels(scene, car) {
  for (const name of WHEELS) {
    const wheel = scene.getObjectByName(name)
    if (!wheel) return // modèle pas encore chargé
    wheel.rotation.x = car.wheelSpin
    wheel.rotation.y = name.includes('front') ? -car.steer * MAX_WHEEL_ANGLE : 0
  }
}

// couche MapLibre qui dessine la voiture avec Three.js dans le même contexte WebGL que la carte
export function createCarLayer(car) {
  let renderer, scene, camera

  return {
    id: 'car',
    type: 'custom',
    renderingMode: '3d', // partage le depth buffer : la voiture passe derrière les bâtiments

    onAdd(map, gl) {
      camera = new THREE.Camera()
      scene = new THREE.Scene()
      scene.add(new THREE.AmbientLight(0xffffff, 1.5))
      const sun = new THREE.DirectionalLight(0xffffff, 2)
      sun.position.set(30, 100, 50)
      scene.add(sun)
      loadCarModel(scene)

      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
      renderer.autoClear = false // sinon Three.js efface la carte
    },

    // mainMatrix travaille en coordonnées Mercator [0, 1] (modelViewProjectionMatrix, elle, est en pixels monde)
    render(gl, { defaultProjectionData }) {
      const origin = MercatorCoordinate.fromLngLat([car.lng, car.lat], 0)
      const s = origin.meterInMercatorCoordinateUnits()

      // repère Three.js (mètres, y vers le haut) -> repère Mercator (y vers le sud, z vers le haut)
      const model = new THREE.Matrix4()
        .makeTranslation(origin.x, origin.y, origin.z)
        .scale(new THREE.Vector3(s, -s, s))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new THREE.Matrix4().makeRotationY(-THREE.MathUtils.degToRad(car.heading)))

      camera.projectionMatrix = new THREE.Matrix4().fromArray(defaultProjectionData.mainMatrix).multiply(model)
      animateWheels(scene, car)
      renderer.resetState()
      renderer.render(scene, camera)
    },
  }
}
