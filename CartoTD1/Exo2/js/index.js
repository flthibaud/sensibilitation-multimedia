const NICE = [43.7102, 7.262];
const MARSEILLE = [43.2965, 5.3698];
const BERMUDES = [
  [25.7617, -80.1918], // Miami
  [32.3078, -64.7505], // Bermudes
  [18.4655, -66.1057], // San Juan (Porto Rico)
];

const STADIA_TOKEN = "eed6a6b4-d171-43e4-8215-e5f8490b4245";

const map = L.map("map").setView(NICE, 13);

const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const stamenAttribution =
  '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const toner = L.tileLayer(
  `https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png?api_key=${STADIA_TOKEN}`,
  { maxZoom: 20, attribution: stamenAttribution }
);

const watercolor = L.tileLayer(
  `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${STADIA_TOKEN}`,
  { maxZoom: 16, attribution: stamenAttribution }
);

const layersControl = L.control
  .layers({ OpenStreetMap: osm, "Stamen Toner": toner, "Stamen Watercolor": watercolor })
  .addTo(map);

// Marqueur sur Nice
L.marker(NICE).addTo(map).bindPopup("Nice (centre ville)");

// Triangle des Bermudes en rouge
L.polygon(BERMUDES, { color: "red" }).addTo(map).bindPopup("Triangle des Bermudes");

// Segment Marseille - Nice
L.marker(MARSEILLE).addTo(map).bindPopup("Marseille");
L.polyline([MARSEILLE, NICE], { color: "blue" }).addTo(map);

// Distance du grand cercle (formule de haversine), en mètres
const distance = ([lat1, lon1], [lat2, lon2]) => {
  const R = 6371e3;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Données GeoJSON : contours des communes des Alpes-Maritimes (geo.api.gouv.fr)
fetch("https://geo.api.gouv.fr/departements/06/communes?format=geojson&geometry=contour")
  .then((response) => response.json())
  .then((data) => {
    const communes = L.geoJSON(data, {
      style: { color: "green", weight: 1, fillOpacity: 0.05 },
      onEachFeature: (feature, layer) => layer.bindPopup(feature.properties.nom),
    });
    layersControl.addOverlay(communes, "Communes (06)");
  })
  .catch((error) => console.error("GeoJSON :", error));

// Trajet en voiture entre deux points avec OSRM
const displayRoute = (from, to) => {
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
    .then((response) => response.json())
    .then((data) => {
      const route = data.routes[0];
      L.geoJSON(route.geometry, { style: { color: "purple", weight: 4 } })
        .addTo(map)
        .bindPopup(`Trajet vers Nice : ${(route.distance / 1000).toFixed(1)} km, ${Math.round(route.duration / 60)} min`);
    })
    .catch((error) => console.error("OSRM :", error));
};

const displayPosition = (position) => {
  const { latitude, longitude, accuracy } = position.coords;
  const me = [latitude, longitude];

  map.setView(me, 13);

  L.marker(me).addTo(map).bindPopup("Ma position").openPopup();

  // Cercle dont le rayon correspond à la précision estimée
  L.circle(me, { radius: accuracy, color: "orange" }).addTo(map);

  const km = (distance(MARSEILLE, me) / 1000).toFixed(1);
  document.getElementById("distance").textContent = `${km} km`;
  L.polyline([MARSEILLE, me], { color: "gray", dashArray: "5 5" })
    .addTo(map)
    .bindPopup(`Distance Marseille → ma position : ${km} km`);

  displayRoute(me, NICE);
};

const displayError = (error) => {
  console.error(error);
  alert(`Erreur de géolocalisation (${error.code}) : ${error.message}`);
};

navigator.geolocation.getCurrentPosition(displayPosition, displayError, {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
});
