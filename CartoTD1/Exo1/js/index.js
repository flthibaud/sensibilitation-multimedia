const getLongitude = (longitude) => {
  document.getElementById("longitude").textContent = longitude;
}

navigator.geolocation.getCurrentPosition((position) => {
  getLongitude(position.coords.longitude);
});

export { getLongitude };