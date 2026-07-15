/** Distance in km between two lat/lng points (haversine). */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rough ETA in minutes, assuming ~18 km/h average city scooter speed + 2 min buffer. */
export function etaMinutes(km: number): number {
  return Math.max(1, Math.round((km / 18) * 60) + 2);
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/**
 * Free OpenStreetMap embed centred on a point — no API key, no billing.
 * `span` controls the zoom box (smaller = closer).
 */
export function osmEmbedUrl(lat: number, lng: number, span = 0.008): string {
  const bbox = [lng - span, lat - span / 2, lng + span, lat + span / 2].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function osmLinkUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}
