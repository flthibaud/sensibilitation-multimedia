// event.code désigne la position physique de la touche : "KeyW" est le Z d'un clavier AZERTY
// et le W d'un QWERTY, donc ZQSD et WASD marchent tous les deux
const pressed = new Set()
// R est mémorisé à l'appui : un appui très bref pourrait sinon tomber entre deux images
let resetRequested = false

addEventListener('keydown', (e) => {
  pressed.add(e.code)
  if (e.code === 'KeyR') resetRequested = true
})
addEventListener('keyup', (e) => pressed.delete(e.code))
addEventListener('blur', () => pressed.clear()) // évite une touche "collée" si on change de fenêtre

const isDown = (...codes) => codes.some((c) => pressed.has(c))

// throttle : 1 avancer, -1 freiner/reculer ; steer : -1 gauche, 1 droite ; reset : revenir au départ
export function getInput() {
  const reset = resetRequested
  resetRequested = false
  return {
    throttle: isDown('KeyW', 'ArrowUp') - isDown('KeyS', 'ArrowDown'),
    steer: isDown('KeyD', 'ArrowRight') - isDown('KeyA', 'ArrowLeft'),
    reset,
  }
}
