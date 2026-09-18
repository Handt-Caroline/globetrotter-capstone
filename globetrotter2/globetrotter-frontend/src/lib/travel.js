// =============================================================================
// lib/travel.js  -  DISTANCE, TIME AND TAXI FARE HELPERS
//
// These are pure functions: give them the same inputs and they always give
// the same answer, with no side effects. That makes them easy to reason
// about and easy to test.
//
// They are used by the Itinerary screen to answer the three questions a
// traveller in Yaoundé actually asks about a plan:
//   "How far apart are these stops?"
//   "How long will it take me?"
//   "What will that cost me in FCFA?"
// =============================================================================

// ---------------------------------------------------------------------------
// haversineKm - straight-line distance between two points on Earth
//
// You can't just subtract latitudes and longitudes, because the Earth is a
// sphere: one degree of longitude is ~111 km at the equator but shrinks to
// nothing at the poles. The haversine formula accounts for that curvature.
//
// It gives the "as the crow flies" distance. Real roads are longer, which
// is why the walking and driving estimates below multiply it by a detour
// factor.
// ---------------------------------------------------------------------------
export function haversineKm(lat1, lon1, lat2, lon2) {
  const EARTH_RADIUS_KM = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Real streets never run in a straight line, and Yaoundé is built on seven
// hills, so routes wind a lot. Multiplying the straight-line distance by
// ~1.35 gives a much more honest road distance.
const ROAD_DETOUR_FACTOR = 1.35;

// Yaoundé transport facts these estimates are built on:
//   - a shared taxi ("ramassage") charges a flat fare per hop, not per km
//   - a private taxi ("dépôt") is negotiated, and rises with distance
//   - moto-taxis are cheapest and quickest through traffic
//   - traffic in the centre is heavy, so average car speed is low
const SHARED_TAXI_FARE = 400;      // FCFA per person per hop, typical
const MOTO_BASE_FARE = 300;        // FCFA, short hop
const MOTO_PER_KM = 150;           // FCFA per extra km
const PRIVATE_TAXI_BASE = 1500;    // FCFA, minimum "dépôt" fare
const PRIVATE_TAXI_PER_KM = 400;   // FCFA per km on top
const WALKING_KMH = 4.5;           // average walking pace
const CITY_DRIVING_KMH = 18;       // realistic with Yaoundé traffic

// Round a fare to something a driver would actually say out loud. Nobody
// quotes 1 738 FCFA - they say 1 500 or 2 000.
const roundFare = (amount) => Math.max(200, Math.round(amount / 100) * 100);

// Format a number the way francophone Cameroon writes it: 12 500 FCFA,
// with a space as the thousands separator.
export const formatFcfa = (amount) =>
  `${Math.round(amount).toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} FCFA`;

// ---------------------------------------------------------------------------
// legBetween - everything about travelling from one stop to the next
// ---------------------------------------------------------------------------
export function legBetween(from, to) {
  const straightKm = haversineKm(from.latitude, from.longitude, to.latitude, to.longitude);
  const roadKm = straightKm * ROAD_DETOUR_FACTOR;

  const walkMinutes = Math.round((roadKm / WALKING_KMH) * 60);
  const driveMinutes = Math.max(3, Math.round((roadKm / CITY_DRIVING_KMH) * 60));

  // Under about 1.2 km most people in Yaoundé simply walk.
  const walkable = roadKm <= 1.2;

  return {
    km: roadKm,
    kmLabel: roadKm < 1 ? `${Math.round(roadKm * 1000)} m` : `${roadKm.toFixed(1)} km`,
    walkMinutes,
    driveMinutes,
    walkable,
    fares: {
      // A shared taxi is a flat fare, but long trips usually mean changing
      // taxi once or twice, so we add a hop roughly every 4 km.
      shared: roundFare(SHARED_TAXI_FARE * Math.max(1, Math.ceil(roadKm / 4))),
      moto: roundFare(MOTO_BASE_FARE + MOTO_PER_KM * roadKm),
      private: roundFare(PRIVATE_TAXI_BASE + PRIVATE_TAXI_PER_KM * roadKm),
    },
  };
}

// ---------------------------------------------------------------------------
// summariseTrip - totals for a whole list of stops, in order
//
// `stops` must be objects with latitude/longitude. Returns total distance,
// total travelling time and a cheap/comfortable budget range, so the user
// sees the real cost of the plan before saving it.
// ---------------------------------------------------------------------------
export function summariseTrip(stops, minutesAtEachStop = 45) {
  if (stops.length < 2) {
    return {
      legs: [],
      totalKm: 0,
      travelMinutes: 0,
      visitMinutes: stops.length * minutesAtEachStop,
      totalMinutes: stops.length * minutesAtEachStop,
      cheapFare: 0,
      comfortableFare: 0,
    };
  }

  const legs = [];
  for (let i = 0; i < stops.length - 1; i += 1) {
    legs.push(legBetween(stops[i], stops[i + 1]));
  }

  const totalKm = legs.reduce((sum, leg) => sum + leg.km, 0);
  // Walkable legs are walked; the rest are driven.
  const travelMinutes = legs.reduce(
    (sum, leg) => sum + (leg.walkable ? leg.walkMinutes : leg.driveMinutes),
    0
  );
  const visitMinutes = stops.length * minutesAtEachStop;

  return {
    legs,
    totalKm,
    travelMinutes,
    visitMinutes,
    totalMinutes: travelMinutes + visitMinutes,
    // Cheapest realistic day: walk what you can, shared taxi for the rest.
    cheapFare: legs.reduce((sum, leg) => sum + (leg.walkable ? 0 : leg.fares.shared), 0),
    // Comfortable day: private taxi everywhere.
    comfortableFare: legs.reduce((sum, leg) => sum + leg.fares.private, 0),
  };
}

// Turn 135 into "2h 15m", which is easier to read than a minute count.
export const formatDuration = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};
