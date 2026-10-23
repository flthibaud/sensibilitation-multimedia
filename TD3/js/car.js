import * as THREE from 'three'
import { MercatorCoordinate } from 'maplibre-gl'

const MAX_SPEED = 20 // m/s (72 km/h)
const MAX_REVERSE = 5 // m/s
const ACCEL = 8 // m/s²
const BRAKE = 15 // m/s²
const FRICTION = 3 // m/s², décélération quand on lâche tout
const TURN_RATE = 90 // °/s à pleine vitesse de braquage
const METERS_PER_DEG_LAT = 111320

// heading : cap en degrés, 0 = nord, sens horaire (comme le bearing de MapLibre)
export function createCar(lng, lat, heading) {
  return { lng, lat, heading, speed: 0 }
}

// modèle "arcade" : pas de vraie physique, juste de quoi rendre la conduite agréable
export function updateCar(car, { throttle, steer }, dt) {
  if (throttle > 0) car.speed += (car.speed < 0 ? BRAKE : ACCEL) * dt
  else if (throttle < 0) car.speed -= (car.speed > 0 ? BRAKE : ACCEL) * dt
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), FRICTION * dt)
  car.speed = THREE.MathUtils.clamp(car.speed, -MAX_REVERSE, MAX_SPEED)

  // on ne tourne pas à l'arrêt, et le volant s'inverse en marche arrière
  const grip = THREE.MathUtils.clamp(car.speed / 5, -1, 1)
  car.heading = (car.heading + steer * TURN_RATE * grip * dt + 360) % 360

  const rad = THREE.MathUtils.degToRad(car.heading)
  const east = Math.sin(rad) * car.speed * dt
  const north = Math.cos(rad) * car.speed * dt
  car.lat += north / METERS_PER_DEG_LAT
  car.lng += east / (METERS_PER_DEG_LAT * Math.cos(THREE.MathUtils.degToRad(car.lat)))
}

// voiture low-poly en cubes, en mètres, l'avant vers -z (convention Three.js)
// shortcut: modèle fait main, à remplacer par un glTF (étape 5 du cadrage)
function buildCarMesh() {
  const car = new THREE.Group()
  const box = (w, h, d, color, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }))
    mesh.position.set(x, y, z)
    car.add(mesh)
  }
  box(1.8, 0.6, 4.2, 0xd62828, 0, 0.6, 0) // carrosserie
  box(1.6, 0.5, 2, 0x222222, 0, 1.15, 0.3) // habitacle
  for (const x of [-0.9, 0.9]) {
    for (const z of [-1.3, 1.3]) box(0.3, 0.6, 0.6, 0x111111, x, 0.3, z) // roues
  }
  return car
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
      scene.add(buildCarMesh())

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
      renderer.resetState()
      renderer.render(scene, camera)
    },
  }
}
