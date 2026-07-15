/**
 * Great-circle ("straight line") distance in km between two points, haversine.
 *
 * This is exact as a straight line — but it is NOT road distance. A customer
 * 2.9 km away as the crow flies can be 4.5 km by road. Anywhere we show this to
 * a human we label it "straight line" and offer a Directions link for the real
 * route. Road distance would need a paid routing API.
 *
 * R uses the IUGG mean Earth radius; at city scale the error is centimetres —
 * far smaller than phone GPS accuracy (typically 10-50 m).
 */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371.0088;
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

/** Google Maps driving directions between two points (free deep link). */
export function directionsUrl(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=driving`;
}

/** Directions to a place from wherever the customer currently is. */
export function directionsToUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}
