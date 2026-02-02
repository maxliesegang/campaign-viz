import type L from 'leaflet'
import type { ActivityType } from './types/activity'

// Map Configuration
export const MAP_CENTER: L.LatLngTuple = [49.0069, 8.4037]
export const MAP_INITIAL_ZOOM = 12
export const MAP_MAX_ZOOM = 19

export const MAP_STYLES = [
  {
    id: 'osm-standard',
    label: 'OSM Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  {
    id: 'osm-hot',
    label: 'OSM Humanitarian',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, style by Humanitarian OpenStreetMap Team',
  },
  {
    id: 'carto-dark',
    label: 'CARTO Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: 'carto-positron',
    label: 'CARTO Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: 'carto-voyager',
    label: 'CARTO Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
] as const
export const DEFAULT_MAP_STYLE_ID = 'carto-dark'

// Date Range
export const START_DATE = new Date('2026-01-01')
export const END_DATE = new Date('2026-03-08')

// Timeline & Animation
export const RECENT_MARKER_COUNT = 80 // Number of most recently revealed markers to highlight
export const AD_MODE_DURATION_MS = 25000
export const BASE_DAYS_PER_MS = 1 / 800 // 1 day per 800ms at 1x speed (~1.25 days/sec)
export const UPDATE_INTERVAL_DAYS = 0.05 // Update visualization ~20 times per day for smoother steps
export const MS_PER_DAY = 86_400_000
export const FACE_TRIGGER_HOUSE = 45 // show face every N house visits
export const FACE_TRIGGER_POSTER = 90 // show face every N posters
export const FACE_MAX_ACTIVE = 10

// Marker Styling
export const MARKER_BASE_RADIUS = 3
export const MARKER_MAX_RADIUS = 8
export const MARKER_COUNT_SCALE_MAX = 50

export const MARKER_COLORS = {
  recent: {
    fill: '#e6fd53', // Limette
    stroke: '#4f6a5f', // darker edge for contrast
    fillOpacity: 0.9,
    weight: 1.6,
  },
  cumulative: {
    fill: '#78a08c', // Salbei
    stroke: '#4f6a5f',
    fillOpacity: 0.5,
    weight: 0.9,
  },
} as const

// Activity Type Labels (German) - maps API types to display labels
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  POSTER: 'Plakate',
  HOUSE: 'Haustüren',
} as const

// Playback Speeds
export const PLAYBACK_SPEEDS = [1, 2, 5] as const
