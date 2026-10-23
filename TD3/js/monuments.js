import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

const asset = (file) => new URL(`../assets/monuments/${file}`, import.meta.url).href

// heading : orientation du modèle, en degrés depuis le nord (sens horaire)
// hideRadius : les blocs OpenStreetMap à moins de ce rayon (m) sont masqués, sinon ils se superposent
// au modèle. On filtre par distance et pas par identifiant : les identifiants changent d'une tuile à l'autre
export const MONUMENTS = [
  {
    name: 'Tour Eiffel',
    // 3D Model Repository d'OSM, modèle n°4 (CC0), déjà en mètres et à l'échelle (300 m)
    load: (object) => new GLTFLoader().load(asset('tour-eiffel.glb'), ({ scene }) => object.add(scene)),
    pose: { lng: 2.294481, lat: 48.858370, heading: 133.6 }, // côtés alignés sur l'axe Trocadéro / Champ-de-Mars
    hideRadius: 70, // base de 125 m de côté, découpée en plusieurs blocs (un par étage)
  },
  {
    name: 'Arc de Triomphe',
    // Wikimedia Commons, "Arc de Triomphe.stl" par Microsoft (CC BY 4.0) : sans texture, axe z vers le haut
    load: (object) =>
      new STLLoader().load(asset('arc-de-triomphe.stl'), (geometry) => {
        geometry.rotateX(-Math.PI / 2) // z vers le haut -> y vers le haut
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.9 }))
        mesh.scale.setScalar(50 / 22.6) // le modèle fait 22,6 unités de haut, le vrai 50 m
        object.add(mesh)
      }),
    pose: { lng: 2.295028, lat: 48.873792, heading: 296 }, // les grandes arches dans l'axe des Champs-Élysées
    hideRadius: 30, // 45 × 22 m au sol, les premiers immeubles de l'Étoile sont à plus de 100 m
  },
]

// masque dans le style les blocs gris qui représentent déjà ces monuments
// (["distance", point] = distance en mètres entre le bâtiment et le point, 0 si le point est dedans)
export function hideMonumentBuildings(map) {
  map.setFilter('building-3d', [
    'all',
    ...MONUMENTS.map(({ pose, hideRadius }) => [
      '>',
      ['distance', { type: 'Point', coordinates: [pose.lng, pose.lat] }],
      hideRadius,
    ]),
  ])
}

// objets à donner à la couche Three.js ; les modèles s'y ajoutent une fois téléchargés
export function createMonuments() {
  return MONUMENTS.map(({ load, pose }) => {
    const object = new THREE.Group()
    load(object)
    return { object, pose }
  })
}
