import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { addDays, format, isAfter, isSameDay } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  MAP_CENTER,
  MAP_INITIAL_ZOOM,
  MAP_MAX_ZOOM,
  MAP_STYLES,
  DEFAULT_MAP_STYLE_ID,
  RECENT_DAYS,
  RECENT_MARKER_COUNT,
  MARKER_BASE_RADIUS,
  MARKER_MAX_RADIUS,
  MARKER_COUNT_SCALE_MAX,
  MARKER_COLORS,
  ACTIVITY_LABELS,
  MS_PER_DAY,
} from '../config'
import { getState } from '../state'
import type { ProcessedActivity } from '../data/activities'
import { selectVisibleActivities } from '../data/activities'

type LayerType = 'recent' | 'cumulative'
type MarkerEntry = { marker: L.CircleMarker; layer: LayerType }

const TOOLTIP_OPTIONS: L.TooltipOptions = { direction: 'top', offset: [0, -8] }

interface MapContext {
  map: L.Map
  markersLayer: L.LayerGroup
  baseLayer: L.TileLayer
}

let mapContext: MapContext | null = null
const markerRegistry = new Map<string, MarkerEntry>()

export function initMap(): void {
  if (mapContext) return

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

export function updateMapVisualization(activities: ProcessedActivity[]): void {
  const { markersLayer } = requireMapContext()
  const { currentDate } = getState()
  const visibleActivities = selectVisibleActivities(activities, getState())

  if (!visibleActivities.length) {
    clearMarkers(markersLayer)
    return
  }

  const recentCutoff = addDays(currentDate, -RECENT_DAYS)
  const recentKeys = computeRecentActivityKeys(visibleActivities, recentCutoff)
  const visibleKeys = new Set<string>()

  for (const activity of visibleActivities) {
    const key = createActivityKey(activity)
    const layerType: LayerType = recentKeys.has(key) ? 'recent' : 'cumulative'

    visibleKeys.add(key)
    upsertMarker(markersLayer, activity, key, layerType)
  }

  removeStaleMarkers(markersLayer, visibleKeys)
}

function upsertMarker(
  markersLayer: L.LayerGroup,
  activity: ProcessedActivity,
  key: string,
  layerType: LayerType,
): void {
  const radius = computeRadius(activity.count)
  const existing = markerRegistry.get(key)

  if (existing) {
    const layerChanged = existing.layer !== layerType

    applyMarkerStyle(existing.marker, layerType, radius)
    updateMarkerClasses(existing.marker, layerType, layerChanged)
    adjustZIndex(existing.marker, layerType)

    existing.layer = layerType
    return
  }

  const marker = createMarker(activity, layerType)
  markersLayer.addLayer(marker)
  adjustZIndex(marker, layerType)
  markerRegistry.set(key, { marker, layer: layerType })
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

function createMarker(activity: ProcessedActivity, layerType: LayerType): L.CircleMarker {
  const marker = L.circleMarker([activity.blurredLat, activity.blurredLng], {
    radius: computeRadius(activity.count),
    ...getColors(layerType),
    className: buildMarkerClass(layerType, true),
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
  const countScale = Math.min(count / MARKER_COUNT_SCALE_MAX, 1)
  return MARKER_BASE_RADIUS + countScale * (MARKER_MAX_RADIUS - MARKER_BASE_RADIUS)
}

function computeRecentActivityKeys(
  visibleActivities: ProcessedActivity[],
  recentCutoff: Date,
): Set<string> {
  if (!visibleActivities.length) return new Set()

  const sortedByReveal = [...visibleActivities].sort(
    (a, b) => getRevealTimestamp(a) - getRevealTimestamp(b),
  )
  const recentByCount = sortedByReveal.slice(-RECENT_MARKER_COUNT)
  const withinWindow = visibleActivities.filter((activity) =>
    isRecent(activity.dateObj, recentCutoff),
  )

  const shouldChurnHighlights = visibleActivities.length >= RECENT_MARKER_COUNT
  const candidates = shouldChurnHighlights
    ? recentByCount
    : withinWindow.length
      ? withinWindow
      : recentByCount

  return new Set(candidates.map(createActivityKey))
}

function isRecent(date: Date, cutoff: Date): boolean {
  return isAfter(date, cutoff) || isSameDay(date, cutoff)
}

function getRevealTimestamp(activity: ProcessedActivity): number {
  return activity.dateObj.getTime() + activity.revealFraction * MS_PER_DAY
}

function getColors(layerType: LayerType) {
  const base = layerType === 'recent' ? MARKER_COLORS.recent : MARKER_COLORS.cumulative
  return {
    fillColor: base.fill,
    fillOpacity: base.fillOpacity,
    color: base.stroke,
    weight: base.weight,
  }
}

function applyMarkerStyle(marker: L.CircleMarker, layerType: LayerType, radius: number): void {
  const colors = getColors(layerType)
  marker.setStyle(colors)
  marker.setRadius(radius)
}

function adjustZIndex(marker: L.CircleMarker, layerType: LayerType): void {
  layerType === 'recent' ? marker.bringToFront() : marker.bringToBack?.()
}

function createActivityKey(activity: ProcessedActivity): string {
  return `${activity.date}|${activity.type}|${activity.blurredLat.toFixed(5)}|${activity.blurredLng.toFixed(5)}|${activity.count}`
}

function buildMarkerClass(layerType: LayerType, animate: boolean): string {
  const classes = ['marker', layerType === 'recent' ? 'marker-recent' : 'marker-cumulative']
  if (animate) {
    classes.push('marker-appear')
    classes.push(layerType === 'recent' ? 'marker-recent-glow' : 'marker-pulse-soft')
  }
  return classes.join(' ')
}

function updateMarkerClasses(marker: L.CircleMarker, layerType: LayerType, animate: boolean): void {
  const el = marker.getElement()
  if (!el) return

  const classes = ['marker', layerType === 'recent' ? 'marker-recent' : 'marker-cumulative']
  if (animate) {
    classes.push(
      'marker-switch',
      layerType === 'recent' ? 'marker-recent-glow' : 'marker-pulse-soft',
    )
  }

  el.className = classes.join(' ')
}

export function updateDateDisplay(): void {
  const { currentDate } = getState()
  const dateDisplay = document.getElementById('current-date-display')
  if (dateDisplay) {
    dateDisplay.textContent = format(currentDate, 'd. MMMM yyyy', { locale: de })
  }
}

export function getMap(): L.Map {
  const { map } = requireMapContext()
  return map
}

function requireMapContext(): MapContext {
  if (!mapContext) {
    throw new Error('Map not initialized. Call initMap() before updating.')
  }
  return mapContext
}
