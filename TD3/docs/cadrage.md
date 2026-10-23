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

### Améliorations (dans cet ordre)

Objectif : passer d'une démo technique à un projet agréable à utiliser.

**Déjà fait**

- [x] Rester sur la route : la voiture ne peut pas s'éloigner de plus de 8 m (`ROAD_MARGIN`) d'une ligne `road_*` ou `bridge_*` (chemins piétons et rails exclus). Limite : une seule marge pour toutes les routes, donc c'est trop large pour une petite rue et trop étroit pour une très grande avenue.

**Partie 1 : corriger ce qui frustre**

- [x] Glisser le long du bord : au contact, on essaie des directions proches du cap (±15°, ±30°, ±45°, ±60°). La voiture suit la première qui reste sur la route, s'aligne progressivement dessus et ralentit d'autant plus que l'angle est fort. Arrêt net seulement face au bord.
- [x] `R` : retour au point de départ. L'appui est mémorisé, donc même un appui très bref compte.
- [x] Écran de chargement : la conduite ne démarre qu'une fois les tuiles chargées (événement `idle`), sinon les routes ne sont pas encore connues.

**Partie 2 : sensation de conduite**

- [x] Caméra lissée : elle rattrape le cap de la voiture par le plus court chemin (`CAMERA_LAG`), et dézoome de 0,7 niveau à vitesse max (`ZOOM_OUT`).
- [x] Roues qui tournent (distance / rayon) et roues avant qui braquent jusqu'à 25°, en animant les nœuds `wheel-*` du modèle (ordre de rotation `YXZ` : rouler, puis braquer).
- [x] Compteur de vitesse en km/h en bas à gauche.
- [x] Son du moteur ([engine.js](../js/engine.js)) : onde en dents de scie filtrée, de 40 Hz au ralenti à 160 Hz à vitesse max, plus forte quand on accélère. Il démarre au premier appui sur une touche (règle des navigateurs), `M` coupe le son, et il se met en pause quand l'onglet est caché.

**Partie 3 : donner un but**

- [ ] Parcours de monuments (Arc de Triomphe, Concorde, Louvre, Tour Eiffel) : points de passage, chrono, flèche vers le prochain.
- [ ] Mini-carte vue du dessus (deuxième carte MapLibre) avec la position de la voiture.

**Partie 4 : ambiance**

- [x] Ciel (`map.setSky`), et le fond de la carte peint de la couleur de l'horizon : sinon une bande blanche apparaît au-delà des tuiles chargées. Immeubles couleur pierre de taille (`#e6dccb`).
- [x] Mode nuit (`N`) : ciel sombre, carte assombrie par un filtre CSS (`brightness`), phares simulés par une tache lumineuse au sol devant la voiture. Limite : la carte n'est pas éclairée par Three.js, donc les phares n'éclairent pas les immeubles, et les rues ne sont pas éclairées.
- [x] Vrais modèles 3D des monuments ([monuments.js](../js/monuments.js)), dessinés par la même couche Three.js que la voiture ([three-layer.js](../js/three-layer.js)). Les blocs gris OSM qui les représentaient sont masqués par un filtre de distance (`["distance", point] > hideRadius`) : 70 m autour de la tour, 30 m autour de l'Arc. Un premier essai par identifiants ne marchait pas : la tour est découpée en un bloc par étage, et les identifiants changent d'une tuile à l'autre.
  - Tour Eiffel : [3D Model Repository d'OSM](https://conic.openstreetmap.de/model/4), CC0, texturée, à l'échelle réelle (10,7 Mo).
  - Arc de Triomphe : [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Arc_de_Triomphe.stl), par Microsoft, CC BY 4.0 (crédit affiché dans les mentions de la carte). Fichier STL sans texture, teinté pierre, mis à l'échelle à 50 m de haut.
- [ ] Autres monuments (Notre-Dame, Louvre, Sacré-Cœur, obélisque de la Concorde…) : aucun modèle libre trouvé sur ces deux sources. Pistes : Sketchfab (filtre « Downloadable » + licence CC, nécessite un compte pour télécharger), ou modèle simple fait dans Three.js (obélisque, pyramide du Louvre).

**Partie 5 : rendu du TD**

- [ ] `TD3/README.md` : lancement, commandes, crédits (OpenFreeMap, OpenStreetMap, Kenney), lien GitHub Pages.
- [ ] Journal de travail avec l'IA (voir la dernière section).

**Plus tard, si le temps le permet**

- [ ] Choix de la ville de départ (liste, ou géolocalisation en réutilisant le TD1).

### Hors périmètre

Physique réaliste, collisions précises avec les bâtiments, multijoueur, trafic, mobile/tactile.

## Architecture

Même approche que le TD2 : pas de bundler, modules ES + `importmap` vers jsDelivr, servi par `go run .`.

```
TD3/
├── docs/
├── index.html        # carte plein écran + importmap (maplibre-gl, three)
├── js/
│   ├── main.js         # création de la carte, boucle d'animation
│   ├── car.js          # état et conduite de la voiture, son modèle 3D, ses phares
│   ├── three-layer.js  # couche MapLibre qui dessine des objets Three.js placés en lng/lat
│   ├── monuments.js    # modèles 3D des monuments + masquage des blocs OSM
│   ├── ambiance.js     # ciel, couleur des immeubles, mode nuit
│   ├── controls.js     # clavier → accélération / direction / retour au départ
│   └── engine.js       # son du moteur (Web Audio API)
└── assets/
    ├── car.glb         # Kenney Car Kit (CC0)
    ├── Textures/       # texture utilisée par car.glb, à garder à côté
    └── monuments/      # tour-eiffel.glb (CC0), arc-de-triomphe.stl (CC BY 4.0)
```

### Boucle d'une frame

1. `controls` donne l'état des touches (`R` remet la voiture au départ).
2. `car` met à jour vitesse et cap (modèle arcade : accélération, frottement, braquage proportionnel à la vitesse).
3. Déplacement en mètres converti en lng/lat :
   `dLat = dy / 111320`, `dLng = dx / (111320 * cos(lat))`.
   Si la position suivante quitte la route, la voiture glisse le long du bord (voir Partie 1).
4. `map.jumpTo({ center: voiture, bearing: cap lissé, pitch: 75, zoom: 20 − dézoom selon la vitesse })`, mise à jour du son et du compteur.
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
