const sheets = require('./googleSheets');
const regions = require('../config/lebanonRegions.json');

// Finds which top-level region a specific city/area belongs to (e.g. "Jounieh" -> "Mount Lebanon")
function findRegionOf(place) {
  for (const [region, cities] of Object.entries(regions)) {
    if (region.toLowerCase() === place.toLowerCase()) return region;
    if (cities.some(c => c.toLowerCase() === place.toLowerCase())) return region;
  }
  return null;
}

/**
 * Returns the automatically calculated stops for a ride.
 * 1) Looks up an admin-configured exact match in the "Routes" sheet tab (from -> to).
 * 2) If none exists, looks up a match at the region level (e.g. any Beirut -> any Bekaa trip).
 * 3) If still none, returns an empty list (no stops) - admin can add the route later from Settings.
 */
async function getAutoStops(fromPlace, toPlace) {
  const exact = await sheets.findRouteStops(fromPlace, toPlace);
  if (exact.length) return exact;

  const fromRegion = findRegionOf(fromPlace);
  const toRegion = findRegionOf(toPlace);
  if (fromRegion && toRegion) {
    const regionLevel = await sheets.findRouteStops(fromRegion, toRegion);
    if (regionLevel.length) return regionLevel;
  }
  return [];
}

function getAllRegionsAndCities() {
  return regions;
}

module.exports = { getAutoStops, getAllRegionsAndCities, findRegionOf };
