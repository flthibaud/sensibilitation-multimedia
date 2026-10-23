import * as maplibregl from 'maplibre-gl'
import { getInput } from './controls.js'
import { createCar, updateCar, createCarLayer } from './car.js'

// départ : rond-point des Champs-Élysées, face à l'Arc de Triomphe
const car = createCar(2.3095, 48.8691, 296)

const CAMERA = { zoom: 20, pitch: 75 }

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty', // gratuit, sans clé, bâtiments 3D inclus
  center: [car.lng, car.lat],
  bearing: car.heading,
  maxPitch: 85,
  ...CAMERA,
  interactive: false, // c'est la voiture qui pilote la caméra
})

// décale le point visé vers le bas de l'écran pour voir plus loin devant la voiture
map.setPadding({ top: innerHeight * 0.4 })

map.on('load', () => {
  map.addLayer(createCarLayer(car))

  let last = performance.now()
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1) // borne si l'onglet était en arrière-plan
    last = now
    updateCar(car, getInput(), dt)
    // jumpTo redessine la carte, donc aussi la couche de la voiture
    map.jumpTo({ center: [car.lng, car.lat], bearing: car.heading, ...CAMERA })
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
})
