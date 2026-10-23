// ciel, couleur des immeubles et mode nuit (touche N)

const DAY_SKY = {
  'sky-color': '#7fb8f0',
  'horizon-color': '#e4eef7',
  'fog-color': '#e4eef7',
  'sky-horizon-blend': 0.6,
  'horizon-fog-blend': 0.6,
}
const NIGHT_SKY = {
  'sky-color': '#0a1030',
  'horizon-color': '#3a3f66',
  'fog-color': '#3a3f66',
  'sky-horizon-blend': 0.6,
  'horizon-fog-blend': 0.6,
}
const STONE = '#e6dccb' // pierre de taille beige des immeubles haussmanniens

// au-delà des tuiles chargées, rien n'est dessiné sous l'horizon : sans fond, on verrait
// une bande blanche entre le ciel et la ville. On peint donc le fond de la couleur de l'horizon
function setSky(map, sky) {
  map.setSky(sky)
  map.getContainer().style.background = sky['horizon-color']
}

export function setupAmbiance(map, carObject) {
  setSky(map, DAY_SKY)
  map.setPaintProperty('building-3d', 'fill-extrusion-color', STONE)

  let night = false
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyN') return
    night = !night
    setSky(map, night ? NIGHT_SKY : DAY_SKY)
    // shortcut: la nuit assombrit tout le canvas avec un filtre CSS (voir index.html) au lieu de
    // recolorer chaque couche du style ; passer à un style sombre si on veut des rues éclairées
    document.body.classList.toggle('nuit', night)
    carObject.getObjectByName('phares').visible = night
  })
}
