document.addEventListener("DOMContentLoaded", () => {
  const mapContainer = document.getElementById("map");

  if (!mapContainer || typeof listingCoordinates === "undefined") return;

  const map = L.map("map").setView(listingCoordinates, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  L.marker(listingCoordinates)
    .addTo(map)
    .bindPopup(`${listingTitle} - ${listingLocation}`)
    .openPopup();
});
