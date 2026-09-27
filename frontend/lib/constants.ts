/**
 * CivicFix - Map & Location Constants
 *
 * Centralized coordinates, default zoom levels, and boundary configurations
 * for the SRM Kattankulathur Campus demo service area.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Default map center for initial view / fallback (SRM Kattankulathur Campus - Tech Park Area).
 * This represents the default map center, NOT the user's actual GPS location.
 */
export const DEFAULT_CAMPUS_LOCATION: Coordinates = {
  latitude: 12.8236,
  longitude: 80.0454,
};

/**
 * Default map zoom level (optimal for campus landmarks, avenues, and building layout).
 */
export const DEFAULT_MAP_ZOOM = 16;

/**
 * OpenStreetMap Tile Configuration (HTTPS, no API key required).
 */
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Mandatory OpenStreetMap attribution string.
 */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/**
 * Demo Service Area Bounding Box for SRM Kattankulathur Campus.
 * Corresponds to the seeded OrganizationServiceArea in backend PostgreSQL.
 */
export const SRM_CAMPUS_BOUNDS = {
  name: 'SRM Kattankulathur Campus Perimeter',
  minLatitude: 12.815,
  maxLatitude: 12.835,
  minLongitude: 80.035,
  maxLongitude: 80.055,
  centerLatitude: 12.823,
  centerLongitude: 80.0444,
  radiusKm: 2.5,
};
