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

// --- Capteurs du smartphone ---

const button = document.getElementById( 'sensors' );
const info = document.getElementById( 'info' );

let sensorsOn = false;
let reference = null;                     // orientation de départ (calibrage)
const target = { x: 0, y: 0, z: 0 };      // rotation visée pour la tourelle
let jump = 0;                             // vitesse verticale du saut (secousse)

// Ramène un angle en degrés dans [-180, 180]
function wrap( deg ) {
  return ( ( deg + 540 ) % 360 ) - 180;
}

// DeviceOrientation : l'inclinaison du téléphone fait pivoter la tourelle
function onOrientation( event ) {
  if ( event.alpha === null ) return;

  if ( !reference ) reference = { alpha: event.alpha, beta: event.beta, gamma: event.gamma };

  target.y = THREE.MathUtils.degToRad( wrap( event.alpha - reference.alpha ) );  // rotation sur soi
  target.x = THREE.MathUtils.degToRad( wrap( event.beta - reference.beta ) );    // avant / arrière
  target.z = THREE.MathUtils.degToRad( -( event.gamma - reference.gamma ) );     // gauche / droite

  info.textContent = `alpha ${ event.alpha.toFixed( 0 ) }°  beta ${ event.beta.toFixed( 0 ) }°  gamma ${ event.gamma.toFixed( 0 ) }°`;
}

// DeviceMotion : une secousse fait sauter la tourelle
function onMotion( event ) {
  const a = event.acceleration;
  if ( !a || a.x === null ) return;

  const force = Math.hypot( a.x, a.y, a.z );
  if ( force > 15 && jump === 0 && turret ) jump = 0.15;
}

async function enableSensors() {
  // Certains navigateurs demandent une autorisation, déclenchée obligatoirement par un clic
  if ( typeof DeviceOrientationEvent?.requestPermission === 'function' ) {
    // Les deux demandes partent ensemble, sinon la 2e n'est plus liée au clic
    const [ orientation, motion ] = await Promise.all( [
      DeviceOrientationEvent.requestPermission().catch( ( e ) => e.name ),
      DeviceMotionEvent.requestPermission?.().catch( ( e ) => e.name ) ?? 'granted',
    ] );
    if ( orientation !== 'granted' ) {
      info.textContent = `Accès aux capteurs refusé (orientation : ${ orientation }, mouvement : ${ motion })`;
      return;
    }
  }

  if ( !sensorsOn ) {
    window.addEventListener( 'deviceorientation', onOrientation );
    window.addEventListener( 'devicemotion', onMotion );
    sensorsOn = true;
  }

  reference = null;  // un nouveau clic recalibre la position "neutre"
  button.textContent = 'Recalibrer';
  info.textContent = 'En attente des capteurs…';
}

button.addEventListener( 'click', enableSensors );

if ( !window.isSecureContext ) {
  info.textContent = 'Les capteurs nécessitent HTTPS (ou localhost)';
}

function animate( time ) {
  cube.rotation.x = time / 2000;
  cube.rotation.y = time / 1000;

  if ( turret ) {
    if ( sensorsOn ) {
      // Lissage : la tourelle rattrape progressivement la rotation visée
      turret.rotation.x += ( target.x - turret.rotation.x ) * 0.15;
      turret.rotation.y += ( target.y - turret.rotation.y ) * 0.15;
      turret.rotation.z += ( target.z - turret.rotation.z ) * 0.15;
    } else {
      turret.rotation.y = time / 1500;
    }

    // Saut avec gravité
    if ( jump !== 0 || turret.position.y > -1 ) {
      turret.position.y += jump;
      jump -= 0.01;
      if ( turret.position.y <= -1 ) {
        turret.position.y = -1;
        jump = 0;
      }
    }
  }

  renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );
