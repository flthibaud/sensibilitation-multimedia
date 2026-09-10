const setLongitude = (longitude) => {
  document.getElementById("longitude").textContent = longitude;
}

const setLatitude = (latitude) => {
  document.getElementById("latitude").textContent = latitude;
}

const setAltitude = (altitude) => {
  document.getElementById("altitude").textContent = altitude;
}

navigator.geolocation.getCurrentPosition((position) => {
  setLongitude(position.coords.longitude);
  setLatitude(position.coords.latitude);
  setAltitude(position.coords.altitude);
});