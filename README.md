# Initiation Multimédia – TD Cartographie

Exercices de TD autour de la géolocalisation dans le navigateur et de la cartographie avec [Leaflet](https://leafletjs.com/).

## Structure

```
.
├── index.html          # Page d'accueil listant les exercices
├── main.go             # Petit serveur de fichiers statiques pour le dev
├── go.mod
└── CartoTD1/
    ├── Exo1/           # API Geolocation : getCurrentPosition() et watchPosition()
    └── Exo2/           # Carte Leaflet : fonds de carte, marqueurs, polygone, distance
```

## Lancer le serveur de dev

Prérequis : [Go](https://go.dev/dl/) 1.25 ou plus.

Depuis la racine du projet :

```bash
go run .
```

Le site est alors servi sur <http://localhost:8090>. Chaque requête est affichée dans le terminal.

> Le serveur sert le dossier courant : lance-le bien depuis la racine du projet.

## Notes

- L'API de géolocalisation ne fonctionne que dans un contexte sécurisé (HTTPS ou `localhost`). Il faut donc ouvrir les pages via le serveur, pas en `file://`.
- Le navigateur demande l'autorisation d'accéder à la position au premier chargement.
