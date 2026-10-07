import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const texture = new THREE.TextureLoader().load( './textures/companion-cube.jpg' );
texture.colorSpace = THREE.SRGBColorSpace;
const material = new THREE.MeshBasicMaterial( { map: texture } );
const cube = new THREE.Mesh( geometry, material );
cube.position.x = -1.5;
scene.add( cube );

// Lumières (nécessaires pour les matériaux du modèle glTF)
scene.add( new THREE.AmbientLight( 0xffffff, 1 ) );
const light = new THREE.DirectionalLight( 0xffffff, 2 );
light.position.set( 2, 3, 4 );
scene.add( light );

// Modèle 3D de la tourelle
let turret;
new GLTFLoader().load( './model/portal_turret.glb', ( gltf ) => {
  turret = gltf.scene;
  turret.position.set( 1.5, -1, 0 );
  turret.scale.setScalar( 1.5 );
  scene.add( turret );
} );

camera.position.z = 5;

function animate( time ) {
  cube.rotation.x = time / 2000;
  cube.rotation.y = time / 1000;
  if ( turret ) turret.rotation.y = time / 1500;
  renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );
