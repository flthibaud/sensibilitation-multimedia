import * as THREE from 'three'
import { MercatorCoordinate } from 'maplibre-gl'

// couche MapLibre qui dessine des objets Three.js posés sur la carte, dans le même contexte WebGL
// items : [{ object, pose }] où pose = { lng, lat, heading } (lu à chaque image, donc peut bouger)
// chaque objet est en mètres, y vers le haut, l'avant vers -z
export function createThreeLayer(id, items) {
  let renderer
  const camera = new THREE.Camera()
  const scenes = items.map(({ object }) => {
    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 1.5))
    const sun = new THREE.DirectionalLight(0xffffff, 2)
    sun.position.set(30, 100, 50)
    scene.add(sun, object)
    return scene
  })

  return {
    id,
    type: 'custom',
    renderingMode: '3d', // partage le depth buffer : les objets passent derrière les bâtiments

    onAdd(map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
      renderer.autoClear = false // sinon Three.js efface la carte
    },

    // mainMatrix travaille en coordonnées Mercator [0, 1] (modelViewProjectionMatrix, elle, est en pixels monde)
    render(gl, { defaultProjectionData }) {
      const mapMatrix = new THREE.Matrix4().fromArray(defaultProjectionData.mainMatrix)
      renderer.resetState()
      // une origine par objet : des coordonnées locales petites évitent les erreurs d'arrondi du GPU
      items.forEach(({ pose }, i) => {
        camera.projectionMatrix = mapMatrix.clone().multiply(modelMatrix(pose))
        renderer.render(scenes[i], camera)
      })
    },
  }
}

// repère Three.js (mètres, y vers le haut) -> repère Mercator (y vers le sud, z vers le haut)
function modelMatrix({ lng, lat, heading }) {
  const origin = MercatorCoordinate.fromLngLat([lng, lat], 0)
  const s = origin.meterInMercatorCoordinateUnits()
  return new THREE.Matrix4()
    .makeTranslation(origin.x, origin.y, origin.z)
    .scale(new THREE.Vector3(s, -s, s))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new THREE.Matrix4().makeRotationY(-THREE.MathUtils.degToRad(heading)))
}
