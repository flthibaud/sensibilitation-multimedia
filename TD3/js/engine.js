import { MAX_SPEED } from './car.js'

// son de moteur synthétisé : une onde en dents de scie, adoucie par un filtre passe-bas,
// dont la fréquence monte avec la vitesse
const IDLE_FREQ = 40 // Hz au ralenti
const MAX_FREQ = 160 // Hz à vitesse max
const VOLUME = 0.15

let ctx, osc, gain
let muted = false

// le navigateur n'autorise le son qu'après une action de l'utilisateur : on le crée au premier appui
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') muted = !muted
  if (ctx) return
  ctx = new AudioContext()
  osc = new OscillatorNode(ctx, { type: 'sawtooth', frequency: IDLE_FREQ })
  gain = new GainNode(ctx, { gain: 0 })
  osc.connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 400 })).connect(gain).connect(ctx.destination)
  osc.start()
})

// onglet caché : la boucle d'animation s'arrête, le son doit s'arrêter aussi
document.addEventListener('visibilitychange', () => ctx && (document.hidden ? ctx.suspend() : ctx.resume()))

export function updateEngine(speed, throttle) {
  if (!ctx) return
  const now = ctx.currentTime
  // setTargetAtTime glisse vers la valeur en ~0,1 s : pas de "clic" quand elle change
  osc.frequency.setTargetAtTime(IDLE_FREQ + ((MAX_FREQ - IDLE_FREQ) * Math.abs(speed)) / MAX_SPEED, now, 0.1)
  // plus fort quand on accélère
  gain.gain.setTargetAtTime(muted ? 0 : VOLUME * (throttle > 0 ? 1 : 0.6), now, 0.1)
}
