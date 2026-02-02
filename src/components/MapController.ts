import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  MAP_CENTER,
  MAP_INITIAL_ZOOM,
  MAP_MAX_ZOOM,
  MAP_STYLES,
  DEFAULT_MAP_STYLE_ID,
  RECENT_MARKER_COUNT,
  MARKER_BASE_RADIUS,
  MARKER_COLORS,
  ACTIVITY_LABELS,
  MS_PER_DAY,
} from '../config'
import { getSunflowerSprite, initSunflowerSprites } from '../assets/sunflowerSprite'
import { getState } from '../state'
import type { ProcessedActivity } from '../data/activities'
import { selectVisibleActivities } from '../data/activities'

type LayerType = 'recent' | 'cumulative'
type MarkerStyle = 'sunflower' | 'simple'
type MarkerEntry = { marker: L.Marker; layer: LayerType; radius: number; style: MarkerStyle }

const TOOLTIP_OPTIONS: L.TooltipOptions = { direction: 'top', offset: [0, -8] }
const MIN_MARKER_SIZE = 6
const ZOOM_SCALE_BASE = 1.3
const ZOOM_SCALE_MIN = 0.6
const ZOOM_SCALE_MAX = 2.6
const ZOOM_DEBOUNCE_MS = 50

interface MapContext {
  map: L.Map
  markersLayer: L.LayerGroup
  baseLayer: L.TileLayer
}

let mapContext: MapContext | null = null
const markerRegistry = new Map<string, MarkerEntry>()

// Cache for recent activity keys to avoid re-sorting on every frame
let cachedRecentKeys: Set<string> | null = null
let cachedVisibleCount = -1

// Debounce timer for zoom updates
let zoomDebounceTimer: ReturnType<typeof setTimeout> | null = null

function getMarkerStyle(): MarkerStyle {
  return getState().useSunflowerMarkers ? 'sunflower' : 'simple'
}

export function initMap(): void {
  if (mapContext) return

  // Pre-render sunflower sprites for better performance
  initSunflowerSprites()

  const map = L.map('map', {
    center: MAP_CENTER,
    zoom: MAP_INITIAL_ZOOM,
    zoomControl: false,
    preferCanvas: true,
  })

  L.control.zoom({ position: 'topright' }).addTo(map)

  const initialStyle = getStyleOrDefault(DEFAULT_MAP_STYLE_ID)
  const baseLayer = createTileLayer(initialStyle).addTo(map)

  const markersLayer = L.layerGroup().addTo(map)
  mapContext = { map, markersLayer, baseLayer }

  map.on('zoom', () => {
    if (zoomDebounceTimer) clearTimeout(zoomDebounceTimer)
    zoomDebounceTimer = setTimeout(updateMarkerScaleForZoom, ZOOM_DEBOUNCE_MS)
  })
}

export function initMapStyleControls(): void {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-map-style]'))
  const select = document.getElementById('map-style-select') as HTMLSelectElement | null

  const applySelection = (styleId: string) => {
    setMapStyle(styleId)
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mapStyle === styleId
      btn.classList.toggle('chip-active', isActive)
      btn.classList.toggle('chip', !isActive)
    })
    if (select) select.value = styleId
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const styleId = btn.dataset.mapStyle
      if (styleId) applySelection(styleId)
    })
  })

  if (select) {
    select.value = DEFAULT_MAP_STYLE_ID
    select.addEventListener('change', () => applySelection(select.value))
  }
}

export function setMapStyle(styleId: string): void {
  const ctx = requireMapContext()
  const style = getStyleOrDefault(styleId)
  ctx.baseLayer.remove()
  ctx.baseLayer = createTileLayer(style).addTo(ctx.map)
}

function createTileLayer(style: (typeof MAP_STYLES)[number]): L.TileLayer {
  return L.tileLayer(style.url, {
    attribution: style.attribution,
    maxZoom: MAP_MAX_ZOOM,
  })
}

function getStyleOrDefault(id: string) {
  return MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0]
}

export function updateMapVisualization(activities: ProcessedActivity[]): ProcessedActivity[] {
  const { markersLayer } = requireMapContext()
  const visibleActivities = selectVisibleActivities(activities, getState())
  const markerStyle = getMarkerStyle()

  if (!visibleActivities.length) {
    clearMarkers(markersLayer)
    return visibleActivities
  }

  const recentKeys = computeRecentActivityKeys(visibleActivities)
  const visibleKeys = new Set<string>()

  for (const activity of visibleActivities) {
    const key = createActivityKey(activity)
    const layerType: LayerType = recentKeys.has(key) ? 'recent' : 'cumulative'

    visibleKeys.add(key)
    upsertMarker(markersLayer, activity, key, layerType, markerStyle)
  }

  removeStaleMarkers(markersLayer, visibleKeys)
  return visibleActivities
}

export function invalidateRecentKeysCache(): void {
  cachedRecentKeys = null
  cachedVisibleCount = -1
}

function upsertMarker(
  markersLayer: L.LayerGroup,
  activity: ProcessedActivity,
  key: string,
  layerType: LayerType,
  markerStyle: MarkerStyle,
): void {
  const radius = computeRadius(activity.count)
  const existing = markerRegistry.get(key)

  if (existing) {
    const layerChanged = existing.layer !== layerType
    const styleChanged = existing.style !== markerStyle

    if (!styleChanged) {
      applyMarkerStyle(existing.marker, layerType, radius, markerStyle)
      updateMarkerClasses(existing.marker, layerType, layerChanged, markerStyle)
      adjustZIndex(existing.marker, layerType)

      existing.layer = layerType
      existing.radius = radius
      return
    }

    markersLayer.removeLayer(existing.marker)
    markerRegistry.delete(key)
  }

  const marker = createMarker(activity, layerType, markerStyle)
  markersLayer.addLayer(marker)
  applyMarkerStyle(marker, layerType, radius, markerStyle)
  adjustZIndex(marker, layerType)
  markerRegistry.set(key, { marker, layer: layerType, radius, style: markerStyle })
}

function removeStaleMarkers(markersLayer: L.LayerGroup, visibleKeys: Set<string>): void {
  for (const [key, entry] of markerRegistry) {
    if (!visibleKeys.has(key)) {
      markersLayer.removeLayer(entry.marker)
      markerRegistry.delete(key)
    }
  }
}

function clearMarkers(markersLayer: L.LayerGroup): void {
  markersLayer.clearLayers()
  markerRegistry.clear()
}

function createMarker(
  activity: ProcessedActivity,
  layerType: LayerType,
  markerStyle: MarkerStyle,
): L.Marker {
  const radius = computeRadius(activity.count)
  const icon =
    markerStyle === 'sunflower'
      ? createSunflowerIcon(radius, layerType)
      : createDotIcon(radius, layerType)

  const marker = L.marker([activity.blurredLat, activity.blurredLng], {
    icon,
    keyboard: false,
  })

  marker.bindTooltip(buildTooltipContent(activity), TOOLTIP_OPTIONS)
  return marker
}

function buildTooltipContent(activity: ProcessedActivity): string {
  return `<div class="text-sm">
    <div class="font-medium">${format(activity.dateObj, 'd. MMM', { locale: de })}</div>
    <div class="text-[11px] text-gray-400">${format(activity.dateObj, 'EEEE', { locale: de })}</div>
    <div>${ACTIVITY_LABELS[activity.type]}: ${activity.count}</div>
  </div>`
}

function computeRadius(count: number): number {
  void count // keep signature; size is fixed
  return MARKER_BASE_RADIUS
}

function computeRecentActivityKeys(visibleActivities: ProcessedActivity[]): Set<string> {
  if (!visibleActivities.length) {
    cachedRecentKeys = null
    cachedVisibleCount = 0
    return new Set()
  }

  // Use cached result if visible count hasn't changed
  // (activities only grow during playback, so same count = same set)
  if (cachedRecentKeys && visibleActivities.length === cachedVisibleCount) {
    return cachedRecentKeys
  }

  const sortedByReveal = [...visibleActivities].sort(
    (a, b) => getRevealTimestamp(a) - getRevealTimestamp(b),
  )

  cachedRecentKeys = new Set(sortedByReveal.slice(-RECENT_MARKER_COUNT).map(createActivityKey))
  cachedVisibleCount = visibleActivities.length
  return cachedRecentKeys
}

function getRevealTimestamp(activity: ProcessedActivity): number {
  return activity.dateObj.getTime() + activity.revealFraction * MS_PER_DAY
}

function getMarkerColors(layerType: LayerType) {
  return MARKER_COLORS[layerType]
}

function toRgba(hex: string, alpha = 1): string {
  if (hex.startsWith('rgb')) {
    // Preserve existing rgb/rgba strings
    if (hex.startsWith('rgba')) return hex
    return hex.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
  }

  const sanitized = hex.replace('#', '')
  if (sanitized.length !== 3 && sanitized.length !== 6) return hex

  const expanded =
    sanitized.length === 3
      ? sanitized
          .split('')
          .map((c) => c + c)
          .join('')
      : sanitized

  const value = parseInt(expanded, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function createSunflowerIcon(radius: number, layerType: LayerType): L.DivIcon {
  const size = Math.max(radius * 2, MIN_MARKER_SIZE)
  const sprite = getSunflowerSprite(layerType)

  return L.divIcon({
    className: buildMarkerClass(layerType, 'sunflower'),
    html: `<img src="${sprite}" class="sunflower-sprite" alt="" draggable="false" />`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function createDotIcon(radius: number, layerType: LayerType): L.DivIcon {
  const size = Math.max(radius * 2, MIN_MARKER_SIZE)

  return L.divIcon({
    className: buildMarkerClass(layerType, 'simple'),
    html: '<div class="dot-shape" aria-hidden="true"></div>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function applyMarkerStyle(
  marker: L.Marker,
  layerType: LayerType,
  radius: number,
  markerStyle: MarkerStyle,
): void {
  const el = marker.getElement()
  if (!el) return

  const colors = getMarkerColors(layerType)
  const zoomScale = computeZoomScale()
  const sizePx = Math.max(radius * 2, MIN_MARKER_SIZE) * zoomScale

  if (markerStyle === 'sunflower') {
    // PNG sprite - update size and sprite variant (colors baked into sprite)
    el.style.setProperty('--sunflower-size', `${sizePx}px`)
    const img = el.querySelector<HTMLImageElement>('.sunflower-sprite')
    if (img) {
      const sprite = getSunflowerSprite(layerType)
      if (img.src !== sprite) {
        img.src = sprite
      }
    }
  } else {
    const fill = toRgba(colors.fill, colors.fillOpacity ?? 1)
    const stroke = toRgba(colors.stroke, colors.strokeOpacity ?? 1)
    const borderWidth = colors.strokeWidth ?? 1.2

    el.style.setProperty('--dot-size', `${sizePx}px`)
    el.style.setProperty('--dot-fill', fill)
    el.style.setProperty('--dot-stroke', stroke)
    el.style.setProperty('--dot-border-width', `${borderWidth}px`)
  }

  el.style.color = colors.fill
}

function computeZoomScale(): number {
  const ctx = mapContext
  if (!ctx) return 1
  const zoom = ctx.map.getZoom()
  const scale = Math.pow(ZOOM_SCALE_BASE, zoom - MAP_INITIAL_ZOOM)
  return Math.min(Math.max(scale, ZOOM_SCALE_MIN), ZOOM_SCALE_MAX)
}

function updateMarkerScaleForZoom(): void {
  for (const entry of markerRegistry.values()) {
    applyMarkerStyle(entry.marker, entry.layer, entry.radius, entry.style)
  }
}

function adjustZIndex(marker: L.Marker, layerType: LayerType): void {
  marker.setZIndexOffset(layerType === 'recent' ? 1000 : 0)
}

function createActivityKey(activity: ProcessedActivity): string {
  return `${activity.date}|${activity.type}|${activity.blurredLat.toFixed(5)}|${activity.blurredLng.toFixed(5)}|${activity.count}`
}

function getMarkerClasses(layerType: LayerType, markerStyle: MarkerStyle): string[] {
  const iconClass = markerStyle === 'sunflower' ? 'sunflower-icon' : 'dot-icon'
  const layerClass = layerType === 'recent' ? 'marker-recent' : 'marker-cumulative'
  return ['marker', iconClass, layerClass]
}

function buildMarkerClass(layerType: LayerType, markerStyle: MarkerStyle): string {
  return [...getMarkerClasses(layerType, markerStyle), 'marker-appear'].join(' ')
}

function updateMarkerClasses(
  marker: L.Marker,
  layerType: LayerType,
  animate: boolean,
  markerStyle: MarkerStyle,
): void {
  const el = marker.getElement()
  if (!el) return

  const leafletClasses = Array.from(el.classList).filter((cls) => cls.startsWith('leaflet-'))
  const classes = [...leafletClasses, ...getMarkerClasses(layerType, markerStyle)]
  if (animate) classes.push('marker-switch')

  el.className = classes.join(' ')
}

export function updateDateDisplay(): void {
  const { currentDate } = getState()
  const dateDisplay = document.getElementById('current-date-display')
  if (dateDisplay) {
    dateDisplay.textContent = format(currentDate, 'd. MMMM yyyy', { locale: de })
  }
}

function requireMapContext(): MapContext {
  if (!mapContext) {
    throw new Error('Map not initialized. Call initMap() before updating.')
  }
  return mapContext
}
