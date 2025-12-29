document.addEventListener("DOMContentLoaded", () => {
  console.log("🗺️ Map script loaded");

  const mapContainer = document.getElementById("map");
  console.log("Map container:", mapContainer);

  if (!mapContainer) {
    console.error("❌ Map container not found!");
    return;
  }

  if (typeof listingCoordinates === "undefined") {
    console.error("❌ listingCoordinates not defined!");
    return;
  }

  console.log("✅ Coordinates:", listingCoordinates);
  console.log("✅ Title:", listingTitle);
  console.log("✅ Location:", listingLocation);

  try {
    const map = L.map("map").setView(listingCoordinates, 13);
    console.log("✅ Map initialized");

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    console.log("✅ Tile layer added");

    L.marker(listingCoordinates)
      .addTo(map)
      .bindPopup(`${listingTitle} - ${listingLocation}`)
      .openPopup();
    console.log("✅ Marker added");
  } catch (error) {
    console.error("❌ Error initializing map:", error);
  }
});
