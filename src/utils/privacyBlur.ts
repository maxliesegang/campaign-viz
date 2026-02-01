import { seededRandom } from './random'

/**
 * Adds a deterministic random offset of 30-100 meters to coordinates.
 * Uses the coordinates as a seed for consistency - same location always gets the same offset.
 */

const METERS_PER_DEGREE_LAT = 111320
const MIN_BLUR_METERS = 30
const BLUR_RANGE_METERS = 70

export interface BlurredCoordinate {
  lat: number
  lng: number
}

export function blurCoordinates(lat: number, lng: number): BlurredCoordinate {
  const seed = lat * 1000000 + lng * 1000

  const angle = seededRandom(seed) * 2 * Math.PI
  const distance = MIN_BLUR_METERS + seededRandom(seed * 2) * BLUR_RANGE_METERS

  const offsetLat = Math.cos(angle) * distance
  const offsetLng = Math.sin(angle) * distance

  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180)

  return {
    lat: lat + offsetLat / METERS_PER_DEGREE_LAT,
    lng: lng + offsetLng / metersPerDegreeLng,
  }
}
