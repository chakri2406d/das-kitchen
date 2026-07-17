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

// ---------------------------------------------------------------------------
// Delivery pricing
// ---------------------------------------------------------------------------

export type DeliveryPricing = {
  /** Flat fee that covers everything inside the radius. */
  baseFee: number;
  /** Distance the base fee covers. 0 = no distance rules at all. */
  freeRadiusKm: number;
  /** Rupees per km (rounded up) beyond the radius. 0 = we don't deliver beyond it. */
  perKmFee: number;
  /** Hard cut-off regardless of the per-km fee. null = no limit. */
  maxKm: number | null;
};

export type DeliveryQuote = {
  /** What the customer pays for delivery. */
  fee: number;
  /** Whole km being charged as "extra" (0 when inside the radius). */
  extraKm: number;
  extraFee: number;
  /** null = we can deliver. Otherwise the reason we can't, ready to show. */
  refusal: string | null;
};

/**
 * The single source of truth for what delivery costs.
 *
 * Both the checkout page and the server call this with the same inputs, so the
 * price the customer is shown is the price they are charged. If you change the
 * rule, change it here and nowhere else.
 *
 * `km` is the straight-line distance (see distanceKm) — always a little shorter
 * than the road, so this errs in the customer's favour, which is the right way
 * round to be wrong about money.
 */
export function quoteDelivery(km: number | null, p: DeliveryPricing): DeliveryQuote {
  const base: DeliveryQuote = { fee: p.baseFee, extraKm: 0, extraFee: 0, refusal: null };

  // No location shared, or no radius configured — nothing to charge extra for.
  if (km == null) return base;
  const radius = Math.max(0, p.freeRadiusKm);
  if (radius <= 0) return base;

  // The epsilon absorbs floating-point dust, so a distance that is really
  // exactly the radius (3.0000000001) isn't billed an extra km.
  const over = km - radius;
  if (over <= 1e-9) return base;

  // They're outside the radius. Do we go there at all?
  if (p.perKmFee <= 0) {
    return {
      ...base,
      refusal: `Sorry — you're about ${km.toFixed(1)} km away and we only deliver within ${radius} km of the kitchen.`,
    };
  }
  if (p.maxKm != null && p.maxKm > 0 && km > p.maxKm) {
    return {
      ...base,
      refusal: `Sorry — you're about ${km.toFixed(1)} km away. We can't deliver further than ${p.maxKm} km from the kitchen.`,
    };
  }

  // Charged per whole km started: 3.2 km over the radius bills as 4 km.
  const extraKm = Math.ceil(over);
  const extraFee = Math.round(extraKm * p.perKmFee);
  return { fee: p.baseFee + extraFee, extraKm, extraFee, refusal: null };
}
