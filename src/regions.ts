import type L from 'leaflet'

export type RegionId = 'karlsruhe' | 'bawu'

export interface RegionConfig {
  id: RegionId
  name: string
  center: L.LatLngTuple
  initialZoom: number
  clusteringEnabled: boolean
  highlightRecentMarkers: boolean
}

export const REGIONS: Record<RegionId, RegionConfig> = {
  karlsruhe: {
    id: 'karlsruhe',
    name: 'Karlsruhe',
    center: [49.0069, 8.4037],
    initialZoom: 12,
    clusteringEnabled: false,
    highlightRecentMarkers: true,
  },
  bawu: {
    id: 'bawu',
    name: 'Baden-Württemberg',
    center: [48.6, 9.1],
    initialZoom: 8,
    clusteringEnabled: true,
    highlightRecentMarkers: false,
  },
}

export const DEFAULT_REGION: RegionId = 'karlsruhe'

export function getRegionConfig(regionId: string): RegionConfig {
  return REGIONS[regionId as RegionId] ?? REGIONS[DEFAULT_REGION]
}

export function isValidRegion(regionId: string): regionId is RegionId {
  return regionId in REGIONS
}
