const displayPosition = (prefix, position) => {
  const { longitude, latitude, altitude, accuracy, speed } = position.coords;

  document.getElementById(`${prefix}-longitude`).textContent = longitude;
  document.getElementById(`${prefix}-latitude`).textContent = latitude;
  document.getElementById(`${prefix}-altitude`).textContent = altitude ?? "non disponible";
  document.getElementById(`${prefix}-accuracy`).textContent = `${accuracy} m`;
  document.getElementById(`${prefix}-speed`).textContent = speed ?? "non disponible";
  document.getElementById(`${prefix}-date`).textContent = new Date(position.timestamp).toLocaleString();
};

const displayError = (error) => {
  console.error(error);
  alert(`Erreur de géolocalisation (${error.code}) : ${error.message}`);
};

const options = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

navigator.geolocation.getCurrentPosition(
  (position) => displayPosition("gcp", position),
  displayError,
  options
);

navigator.geolocation.watchPosition(
  (position) => displayPosition("wp", position),
  displayError,
  options
);
