import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
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
import { getRegionConfig, type RegionConfig } from '../regions'
import type { MarkerVariant } from '../types/activity'
import { createClusterGroup } from './MarkerCluster'
import { hexToRgba } from '../utils/color'

type MarkerStyle = 'sunflower' | 'simple'
type MarkerEntry = { marker: L.Marker; variant: MarkerVariant; style: MarkerStyle }
type MarkerDescriptor = {
  activity: ProcessedActivity
  key: string
  variant: MarkerVariant
}

const TOOLTIP_OPTIONS: L.TooltipOptions = { direction: 'top', offset: [0, -8] }
const MIN_MARKER_SIZE = 6
const ZOOM_SCALE_BASE = 1.3
const ZOOM_SCALE_MIN = 0.6
const ZOOM_SCALE_MAX = 2.6
const ZOOM_DEBOUNCE_MS = 50
const BASE_MARKER_SIZE = Math.max(MARKER_BASE_RADIUS * 2, MIN_MARKER_SIZE)

interface MapContext {
  map: L.Map
  markersLayer: L.LayerGroup | L.MarkerClusterGroup
  baseLayer: L.TileLayer
  clusteringEnabled: boolean
  initialZoom: number
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

export function initMap(regionConfig: RegionConfig): void {
  if (mapContext) return

  // Pre-render sunflower sprites for better performance
  initSunflowerSprites()

  const map = L.map('map', {
    center: regionConfig.center,
    zoom: regionConfig.initialZoom,
    zoomControl: false,
    preferCanvas: true,
  })

  L.control.zoom({ position: 'topright' }).addTo(map)

  const initialStyle = getStyleOrDefault(DEFAULT_MAP_STYLE_ID)
  const baseLayer = createTileLayer(initialStyle).addTo(map)

  // Use MarkerClusterGroup for regions with clustering enabled
  const markersLayer = regionConfig.clusteringEnabled
    ? createClusterGroup().addTo(map)
    : L.layerGroup().addTo(map)

  mapContext = {
    map,
    markersLayer,
    baseLayer,
    clusteringEnabled: regionConfig.clusteringEnabled,
    initialZoom: regionConfig.initialZoom,
  }

  map.on('zoom', () => {
    if (zoomDebounceTimer) clearTimeout(zoomDebounceTimer)
    zoomDebounceTimer = setTimeout(updateMarkerScaleForZoom, ZOOM_DEBOUNCE_MS)
  })
}

export function destroyMap(): void {
  if (!mapContext) return

  if (zoomDebounceTimer) {
    clearTimeout(zoomDebounceTimer)
    zoomDebounceTimer = null
  }

  mapContext.markersLayer.clearLayers()
  markerRegistry.clear()
  mapContext.map.remove()
  mapContext = null

  cachedRecentKeys = null
  cachedVisibleCount = -1
}

export function reinitializeMap(regionConfig: RegionConfig): void {
  destroyMap()
  initMap(regionConfig)
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
  const ctx = requireMapContext()
  const visibleActivities = selectVisibleActivities(activities, getState())

  if (!visibleActivities.length) {
    clearMarkers(ctx.markersLayer)
    return visibleActivities
  }

  const markerStyle = getMarkerStyle()
  const descriptors = buildMarkerDescriptors(visibleActivities)

  if (ctx.clusteringEnabled) {
    syncClusterGroup(ctx.markersLayer as L.MarkerClusterGroup, descriptors, markerStyle)
  } else {
    syncLayerGroup(ctx.markersLayer as L.LayerGroup, descriptors, markerStyle)
  }

  return visibleActivities
}

function buildMarkerDescriptors(activities: ProcessedActivity[]): MarkerDescriptor[] {
  const shouldHighlightRecent = shouldHighlightRecentMarkers()
  const recentKeys = shouldHighlightRecent ? computeRecentActivityKeys(activities) : null

  return activities.map((activity) => {
    const key = createActivityKey(activity)
    const variant: MarkerVariant = recentKeys?.has(key) ? 'recent' : 'cumulative'
    return { activity, key, variant }
  })
}

function shouldHighlightRecentMarkers(): boolean {
  const { currentRegion } = getState()
  return getRegionConfig(currentRegion).highlightRecentMarkers
}

function syncLayerGroup(
  layerGroup: L.LayerGroup,
  descriptors: MarkerDescriptor[],
  markerStyle: MarkerStyle,
): void {
  const visibleKeys = new Set<string>()

  for (const descriptor of descriptors) {
    syncMarker(layerGroup, descriptor, markerStyle)
    visibleKeys.add(descriptor.key)
  }

  removeStaleMarkers(layerGroup, visibleKeys)
}

function syncClusterGroup(
  clusterGroup: L.MarkerClusterGroup,
  descriptors: MarkerDescriptor[],
  markerStyle: MarkerStyle,
): void {
  const visibleKeys = new Set<string>()
  const pendingAdd: L.Marker[] = []

  for (const descriptor of descriptors) {
    const { created, marker } = syncMarker(clusterGroup, descriptor, markerStyle, {
      deferAdd: true,
    })
    if (created) pendingAdd.push(marker)
    visibleKeys.add(descriptor.key)
  }

  if (pendingAdd.length) {
    clusterGroup.addLayers(pendingAdd)
  }

  removeStaleMarkers(clusterGroup, visibleKeys)
}

export function invalidateRecentKeysCache(): void {
  cachedRecentKeys = null
  cachedVisibleCount = -1
}

function syncMarker(
  targetLayer: L.LayerGroup | L.MarkerClusterGroup,
  descriptor: MarkerDescriptor,
  markerStyle: MarkerStyle,
  options: { deferAdd?: boolean } = {},
): { created: boolean; marker: L.Marker } {
  const { deferAdd = false } = options
  const { key, activity, variant } = descriptor
  const existing = markerRegistry.get(key)

  const needsRebuild = !existing || existing.style !== markerStyle
  if (needsRebuild) {
    if (existing) {
      targetLayer.removeLayer(existing.marker)
      markerRegistry.delete(key)
    }

    const marker = createMarker(activity, variant, markerStyle)
    markerRegistry.set(key, { marker, variant, style: markerStyle })
    if (!deferAdd) {
      targetLayer.addLayer(marker)
    }
    applyMarkerStyle(marker, variant, markerStyle)
    adjustZIndex(marker, variant)
    return { created: true, marker }
  }

  const marker = existing.marker
  const variantChanged = existing.variant !== variant

  if (variantChanged) {
    applyMarkerStyle(marker, variant, markerStyle)
    updateMarkerClasses(marker, variant, true, markerStyle)
    adjustZIndex(marker, variant)
    existing.variant = variant
  } else {
    // Keep styles in sync with zoom/style toggles
    applyMarkerStyle(marker, variant, markerStyle)
  }

  return { created: false, marker }
}

function removeStaleMarkers(
  markersLayer: L.LayerGroup | L.MarkerClusterGroup,
  visibleKeys: Set<string>,
): void {
  for (const [key, entry] of markerRegistry) {
    if (!visibleKeys.has(key)) {
      markersLayer.removeLayer(entry.marker)
      markerRegistry.delete(key)
    }
  }
}

function clearMarkers(markersLayer: L.LayerGroup | L.MarkerClusterGroup): void {
  markersLayer.clearLayers()
  markerRegistry.clear()
}

function createMarker(
  activity: ProcessedActivity,
  variant: MarkerVariant,
  markerStyle: MarkerStyle,
): L.Marker {
  const icon = markerStyle === 'sunflower' ? createSunflowerIcon(variant) : createDotIcon(variant)

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

function createSunflowerIcon(variant: MarkerVariant): L.DivIcon {
  const size = BASE_MARKER_SIZE
  const sprite = getSunflowerSprite(variant)

  return L.divIcon({
    className: buildMarkerClass(variant, 'sunflower'),
    html: wrapMarkerVisual(
      `<img src="${sprite}" class="marker-visual sunflower-sprite" data-variant="${variant}" alt="" draggable="false" />`,
    ),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function createDotIcon(variant: MarkerVariant): L.DivIcon {
  const size = BASE_MARKER_SIZE

  return L.divIcon({
    className: buildMarkerClass(variant, 'simple'),
    html: wrapMarkerVisual('<div class="marker-visual dot-shape" aria-hidden="true"></div>'),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function wrapMarkerVisual(content: string): string {
  return `<div class="marker-scale">${content}</div>`
}

function applyMarkerStyle(
  marker: L.Marker,
  variant: MarkerVariant,
  markerStyle: MarkerStyle,
): void {
  const el = marker.getElement()
  if (!el) return

  const zoomScale = computeZoomScale()
  const sizePx = BASE_MARKER_SIZE * zoomScale

  if (markerStyle === 'sunflower') {
    applySunflowerMarkerStyle(el, sizePx, variant)
  } else {
    applyDotMarkerStyle(el, sizePx, variant)
  }
}

function applySunflowerMarkerStyle(el: HTMLElement, sizePx: number, variant: MarkerVariant): void {
  el.style.setProperty('--sunflower-size', `${sizePx}px`)

  const img = el.querySelector<HTMLImageElement>('.sunflower-sprite')
  if (!img || img.dataset.variant === variant) return

  img.src = getSunflowerSprite(variant)
  img.dataset.variant = variant
}

function applyDotMarkerStyle(el: HTMLElement, sizePx: number, variant: MarkerVariant): void {
  const colors = MARKER_COLORS[variant]

  el.style.setProperty('--dot-size', `${sizePx}px`)
  el.style.setProperty('--dot-fill', hexToRgba(colors.fill, colors.fillOpacity))
  el.style.setProperty('--dot-stroke', hexToRgba(colors.stroke, colors.strokeOpacity))
  el.style.setProperty('--dot-border-width', `${colors.strokeWidth}px`)
}

function computeZoomScale(): number {
  const ctx = mapContext
  if (!ctx) return 1
  const zoom = ctx.map.getZoom()
  const scale = Math.pow(ZOOM_SCALE_BASE, zoom - ctx.initialZoom)
  return Math.min(Math.max(scale, ZOOM_SCALE_MIN), ZOOM_SCALE_MAX)
}

function updateMarkerScaleForZoom(): void {
  for (const entry of markerRegistry.values()) {
    applyMarkerStyle(entry.marker, entry.variant, entry.style)
  }
}

function adjustZIndex(marker: L.Marker, variant: MarkerVariant): void {
  marker.setZIndexOffset(variant === 'recent' ? 1000 : 0)
}

function createActivityKey(activity: ProcessedActivity): string {
  return `${activity.date}|${activity.type}|${activity.blurredLat.toFixed(5)}|${activity.blurredLng.toFixed(5)}|${activity.count}`
}

function getMarkerClasses(variant: MarkerVariant, markerStyle: MarkerStyle): string[] {
  const iconClass = markerStyle === 'sunflower' ? 'sunflower-icon' : 'dot-icon'
  const variantClass = variant === 'recent' ? 'marker-recent' : 'marker-cumulative'
  return ['marker', iconClass, variantClass]
}

function buildMarkerClass(variant: MarkerVariant, markerStyle: MarkerStyle): string {
  return [...getMarkerClasses(variant, markerStyle), 'marker-appear'].join(' ')
}

function updateMarkerClasses(
  marker: L.Marker,
  variant: MarkerVariant,
  animate: boolean,
  markerStyle: MarkerStyle,
): void {
  const el = marker.getElement()
  if (!el) return

  const leafletClasses = Array.from(el.classList).filter((cls) => cls.startsWith('leaflet-'))
  const classes = [...leafletClasses, ...getMarkerClasses(variant, markerStyle)]
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
