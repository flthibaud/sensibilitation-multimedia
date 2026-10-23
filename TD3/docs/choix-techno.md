# Choix technique : MapLibre, Three.js, ou les deux ?

## Le besoin

1. Afficher une **vraie ville en 3D** (bâtiments, routes).
2. Une **voiture** pilotable au clavier.
3. Une **caméra 3e personne** qui suit la voiture.
4. Rester **sur la route** (au moins en bonus).

## Options comparées

| Critère | MapLibre seul | Three.js seul | **MapLibre + Three.js (custom layer)** |
|---|---|---|---|
| Ville 3D réelle | ✅ gratuite via tuiles vectorielles (`fill-extrusion`) | ❌ à construire soi-même (Overpass API → extrusion des polygones) | ✅ fournie par MapLibre |
| Modèle 3D de voiture | ⚠️ pas de support natif des modèles glTF | ✅ `GLTFLoader` | ✅ `GLTFLoader` dans une couche custom |
| Caméra 3e personne | ✅ `jumpTo({ center, bearing, pitch })` à chaque frame | ✅ contrôle total | ✅ caméra MapLibre |
| Rester sur la route | ⚠️ `queryRenderedFeatures` sur les couches route | ✅ si on construit le graphe des routes | ⚠️ `queryRenderedFeatures` |
| Quantité de code | faible | **élevée** (projection, chargement des données, géométrie, LOD) | faible à moyenne |
| N'importe quelle ville | ✅ | ⚠️ limité par la taille de la requête Overpass | ✅ |
| Réutilise le TD2 | non | oui (Three.js) | oui (Three.js) |

## Décision : MapLibre GL JS + Three.js dans une couche custom

- **MapLibre** s'occupe de tout ce qui est carto : tuiles, bâtiments extrudés, routes, caméra.
- **Three.js** affiche uniquement la voiture, via une [couche custom](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-using-threejs/) (exemple officiel « Add a 3D model using three.js ») qui partage le contexte WebGL de la carte.
- **Tuiles** : [OpenFreeMap](https://openfreemap.org/), style `liberty` : gratuit, **sans clé API** (pas de secret à injecter dans le workflow GitHub Pages, contrairement au TD2), et il inclut déjà les bâtiments en 3D avec leur hauteur.

Pourquoi pas Three.js seul : il faudrait réécrire ce que MapLibre fait déjà (télécharger les données OSM, projeter lat/lng en mètres, trianguler les bâtiments, gérer le niveau de détail). C'est la plus grosse part du travail et ça n'apporte rien de visible au rendu.

On passerait à Three.js seul **uniquement** si on voulait une vraie physique (collisions précises, Rapier/cannon-es) ou un rendu très stylisé (shaders sur les bâtiments). Hors périmètre ici.

## Contraintes connues de MapLibre

- **Pitch limité** (85° historiquement, plus élevé dans les versions récentes : à vérifier dans la version choisie). En 3e personne, un pitch de 70 à 80° suffit.
- La caméra « regarde » toujours le `center` : il suffit de mettre la voiture au centre et `bearing` = cap de la voiture pour être derrière elle.
- **MapLibre 6** est livré uniquement en module ES (`maplibre-gl.mjs`) : on l'importe avec `import * as maplibregl from 'maplibre-gl'` via l'importmap.
- Dans `render()` de la couche custom, il faut utiliser `defaultProjectionData.mainMatrix`, qui travaille en coordonnées Mercator [0, 1]. `modelViewProjectionMatrix`, elle, travaille en pixels monde : avec elle, la voiture n'apparaît pas.
- Une couche custom Three.js doit convertir les mètres en unités Mercator : `MercatorCoordinate.fromLngLat()` et `meterInMercatorCoordinateUnits()`.
- `queryRenderedFeatures` ne voit que ce qui est **rendu à l'écran** : la position de la voiture l'est toujours, donc ça marche pour tester « suis-je sur une route ».
