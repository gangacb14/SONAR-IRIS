/**
 * Geodesy and Coordinate Reference System (CRS) Utilities.
 * Handles canonical WGS84 (EPSG:4326) and Universal Transverse Mercator (UTM) transformations.
 */

// WGS84 Ellipsoid constants
const WGS84_A = 6378137.0; // Semi-major axis (meters)
const WGS84_F = 1 / 298.257223563; // Flattening
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F; // First eccentricity squared
const WGS84_E_PRIME2 = WGS84_E2 / (1 - WGS84_E2); // Second eccentricity squared
const UTM_K0 = 0.9996; // Scale factor along central meridian

export interface UtmCoordinates {
  zone: string; // e.g. "44N"
  zoneNumber: number; // e.g. 44
  hemisphere: 'N' | 'S';
  easting: number; // meters
  northing: number; // meters
}

export interface Wgs84Coordinates {
  lat: number;
  lng: number;
}

/**
 * Validates whether latitude and longitude are valid WGS84 values
 */
export function isValidWgs84(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Determine the UTM Zone number from longitude
 */
export function getUtmZoneNumber(lng: number): number {
  let zone = Math.floor((lng + 180) / 6) + 1;
  if (zone < 1) zone = 1;
  if (zone > 60) zone = 60;
  return zone;
}

/**
 * Convert WGS84 geographic coordinates (latitude, longitude) to UTM coordinates.
 */
export function wgs84ToUtm(lat: number, lng: number): UtmCoordinates {
  if (!isValidWgs84(lat, lng)) {
    throw new Error(`Invalid WGS84 coordinates: lat=${lat}, lng=${lng}`);
  }

  const zoneNumber = getUtmZoneNumber(lng);
  const isNorthern = lat >= 0;
  const hemisphere = isNorthern ? 'N' : 'S';
  const zone = `${zoneNumber}${hemisphere}`;

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  // Central meridian of UTM zone
  const centralLng = (zoneNumber - 1) * 6 - 180 + 3;
  const centralLngRad = (centralLng * Math.PI) / 180;

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = WGS84_E_PRIME2 * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lngRad - centralLngRad);

  // Meridian distance M
  const M =
    WGS84_A *
    ((1 - WGS84_E2 / 4 - (3 * WGS84_E2 * WGS84_E2) / 64 - (5 * Math.pow(WGS84_E2, 3)) / 256) * latRad -
      ((3 * WGS84_E2) / 8 + (3 * WGS84_E2 * WGS84_E2) / 32 + (45 * Math.pow(WGS84_E2, 3)) / 1024) *
        Math.sin(2 * latRad) +
      ((15 * WGS84_E2 * WGS84_E2) / 256 + (45 * Math.pow(WGS84_E2, 3)) / 1024) * Math.sin(4 * latRad) -
      ((35 * Math.pow(WGS84_E2, 3)) / 3072) * Math.sin(6 * latRad));

  // Easting
  const easting =
    UTM_K0 *
      N *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * WGS84_E_PRIME2) * Math.pow(A, 5)) / 120) +
    500000.0;

  // Northing
  let northing =
    UTM_K0 *
    (M +
      N *
        Math.tan(latRad) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * WGS84_E_PRIME2) * Math.pow(A, 6)) / 720));

  if (!isNorthern) {
    northing += 10000000.0; // False northing for southern hemisphere
  }

  return {
    zone,
    zoneNumber,
    hemisphere,
    easting: Math.round(easting * 10) / 10,
    northing: Math.round(northing * 10) / 10,
  };
}

/**
 * Convert UTM coordinates back to WGS84 latitude and longitude
 */
export function utmToWgs84(
  easting: number,
  northing: number,
  zoneNumber: number,
  isNorthern: boolean = true
): Wgs84Coordinates {
  const x = easting - 500000.0;
  let y = northing;
  if (!isNorthern) {
    y -= 10000000.0;
  }

  const m = y / UTM_K0;
  const mu =
    m /
    (WGS84_A *
      (1 - WGS84_E2 / 4 - (3 * WGS84_E2 * WGS84_E2) / 64 - (5 * Math.pow(WGS84_E2, 3)) / 256));

  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2));
  const J1 = (3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32;
  const J2 = (21 * e1 * e1) / 16 - (55 * Math.pow(e1, 4)) / 32;
  const J3 = (151 * Math.pow(e1, 3)) / 96;

  const fp =
    mu +
    J1 * Math.sin(2 * mu) +
    J2 * Math.sin(4 * mu) +
    J3 * Math.sin(6 * mu);

  const C1 = WGS84_E_PRIME2 * Math.cos(fp) * Math.cos(fp);
  const T1 = Math.tan(fp) * Math.tan(fp);
  const N1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(fp) * Math.sin(fp));
  const R1 =
    (WGS84_A * (1 - WGS84_E2)) /
    Math.pow(1 - WGS84_E2 * Math.sin(fp) * Math.sin(fp), 1.5);
  const D = x / (N1 * UTM_K0);

  const latRad =
    fp -
    ((N1 * Math.tan(fp)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * WGS84_E_PRIME2) * Math.pow(D, 4)) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * WGS84_E_PRIME2 - 3 * C1 * C1) *
          Math.pow(D, 6)) /
          720);

  const centralLng = (zoneNumber - 1) * 6 - 180 + 3;
  const lngRad =
    ((zoneNumber - 1) * 6 - 180 + 3) * (Math.PI / 180) +
    (D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * WGS84_E_PRIME2 + 24 * T1 * T1) * Math.pow(D, 5)) /
        120) /
      Math.cos(fp);

  return {
    lat: (latRad * 180) / Math.PI,
    lng: (lngRad * 180) / Math.PI,
  };
}

/**
 * Format coordinates for operational hydrographic displays
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}°${latDir}, ${Math.abs(lng).toFixed(5)}°${lngDir}`;
}
