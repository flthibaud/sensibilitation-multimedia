# TD3 : Balade en voiture dans une ville 3D

## Objectif

Une page web qui affiche une vraie ville en 3D et dans laquelle on conduit une voiture au clavier, vue en 3e personne.

Choix technique détaillé : [choix-techno.md](choix-techno.md). En résumé : **MapLibre GL JS** pour la ville + **Three.js** pour la voiture.

## Périmètre

### MVP (à livrer)

Ville : **Paris**, départ au rond-point des Champs-Élysées, face à l'Arc de Triomphe.

- [x] Carte MapLibre centrée sur Paris, bâtiments en 3D (OpenFreeMap `liberty`).
- [x] Voiture visible : `sedan.glb` du [Car Kit de Kenney](https://kenney.nl/assets/car-kit) (licence CC0).
- [x] Conduite au clavier : `Z`/`↑` avancer, `S`/`↓` freiner/reculer, `Q`/`←` et `D`/`→` tourner.
- [x] Caméra 3e personne : la carte suit la voiture et tourne avec elle.
- [x] Déployé sur GitHub Pages avec le reste du dépôt.

### Bonus (si le temps le permet, dans cet ordre)

1. ✅ Rester sur la route : la voiture s'arrête si elle allait s'éloigner de plus de 8 m (`ROAD_MARGIN`) de toute ligne `road_*` ou `bridge_*` (chemins piétons et rails exclus). Limites : une seule marge pour toutes les routes, donc c'est trop large pour une petite rue et trop étroit pour une très grande avenue. Et on ne « glisse » pas le long du bord : il faut reculer.
2. Compteur de vitesse (HUD en HTML par-dessus la carte).
3. Choix de la ville de départ (liste ou géolocalisation, réutilise le TD1).
4. Cycle jour/nuit (couleurs du style + lumière Three.js).

### Hors périmètre

Physique réaliste, collisions avec les bâtiments, multijoueur, trafic, mobile/tactile, son.

## Architecture

Même approche que le TD2 : pas de bundler, modules ES + `importmap` vers jsDelivr, servi par `go run .`.

```
TD3/
├── docs/
├── index.html        # carte plein écran + importmap (maplibre-gl, three)
├── js/
│   ├── main.js       # création de la carte, boucle d'animation
│   ├── car.js        # état de la voiture (position, cap, vitesse) + modèle Three.js (custom layer)
│   └── controls.js   # clavier → accélération / direction
└── assets/
    └── car.glb       # modèle libre de droits (ex : Kenney Car Kit, CC0)
```

### Boucle d'une frame

1. `controls` donne l'état des touches.
2. `car` met à jour vitesse et cap (modèle arcade : accélération, frottement, braquage proportionnel à la vitesse).
3. Déplacement en mètres converti en lng/lat :
   `dLat = dy / 111320`, `dLng = dx / (111320 * cos(lat))`.
4. `map.jumpTo({ center: voiture, bearing: cap, pitch: 75, zoom: 19 })`.
5. La couche custom redessine la voiture à sa position, orientée selon le cap.

## Étapes

| # | Étape | Fini quand… |
|---|---|---|
| 1 | Carte 3D | la ville s'affiche avec les bâtiments en relief |
| 2 | Couche custom Three.js | un cube est posé sur la route à une coordonnée fixe |
| 3 | Déplacement | le cube bouge au clavier |
| 4 | Caméra | la carte suit le cube, vue de derrière |
| 5 | Modèle glTF | le cube est remplacé par la voiture |
| 6 | Déploiement | ça tourne sur GitHub Pages |
| 7+ | Bonus | voir liste ci-dessus |

Chaque étape = un commit qui marche.

## Risques

| Risque | Parade |
|---|---|
| La voiture « flotte » ou est mal orientée | Vérifier l'échelle Mercator et l'axe avant du modèle dès l'étape 2 avec un cube |
| `jumpTo` à chaque frame saccade | Le faire dans `requestAnimationFrame`, désactiver les interactions souris de la carte |
| Les noms des couches route changent selon le style | Les lister avec `map.getStyle().layers` avant de coder le bonus 1 |
| Tuiles lentes à charger à zoom 19 | Limiter la vitesse max ; accepter un léger chargement |

## Travail avec l'IA

Garder une trace de ce qui a été demandé à l'IA et de ce qui a été corrigé à la main : utile pour le rendu et pour expliquer le code à l'oral.
