import { differenceInDays, format } from 'date-fns'
import { de } from 'date-fns/locale'
import { getDateRange } from '../data/activities'
import { MAP_STYLES, PLAYBACK_SPEEDS, UPDATE_INTERVAL_DAYS } from '../config'
import { REGIONS, type RegionConfig } from '../regions'

export function renderTemplate(regionConfig: RegionConfig): string {
  const { start, end } = getDateRange()
  const totalDays = differenceInDays(end, start)

  // Dynamically discover all face images from public/faces/ at build time
  const faceModules = import.meta.glob<string>('/public/faces/*.{png,jpg,jpeg,webp,gif}', {
    eager: true,
    query: '?url',
    import: 'default',
  })
  const faceImageUrls = Object.values(faceModules).sort()

  // Generate month labels based on date range
  const startLabel = format(start, 'MMM', { locale: de })
  const endLabel = format(end, 'MMM', { locale: de })

  // Calculate middle date for middle label
  const middleDate = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2)
  const middleLabel = format(middleDate, 'MMM', { locale: de })

  const speedOptions = PLAYBACK_SPEEDS.map(
    (speed) => `<option value="${speed}">${speed}x</option>`,
  ).join('')
  const mapStyleOptions = MAP_STYLES.map(
    (style) => `<option value="${style.id}">${style.label}</option>`,
  ).join('')
  const activityOptions = `
    <option value="ALL">Alle</option>
    <option value="HOUSE">Haustüren</option>
    <option value="POSTER">Plakate</option>
  `
  const regionOptions = Object.values(REGIONS)
    .map(
      (region) =>
        `<option value="${region.id}" ${region.id === regionConfig.id ? 'selected' : ''}>${region.name}</option>`,
    )
    .join('')

  return `
    <div id="main-container" class="h-screen bg-sand flex flex-col text-slate-900">
      <!-- Map takes most space -->
      <div id="map-wrapper" class="relative flex-1">
        <div id="map" class="w-full h-full"></div>
        <div
          id="face-layer"
          data-face-urls="${faceImageUrls.join(',')}"
          class="pointer-events-none absolute inset-0 overflow-hidden z-[800]"></div>

        <!-- Fullscreen overlay -->
        <div id="final-overlay" class="hidden absolute inset-0 overlay-gradient flex items-center justify-center z-[1000]">
          <div class="text-center text-white">
            <h2 class="text-4xl md:text-6xl font-bold mb-8">Wahlkampf ${regionConfig.name} 2026</h2>
            <div id="final-stats" class="grid grid-cols-2 gap-6 text-2xl md:text-4xl"></div>
          </div>
        </div>
      </div>

      <!-- Bottom menu bar -->
      <div id="timeline-container" class="bottom-menu">
        <div class="playback-group">
          <button id="btn-play" class="btn-primary play-btn" aria-label="Play/Pause">
            <svg id="play-icon" class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <svg id="pause-icon" class="w-5 h-5 hidden" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>
          <div class="date-display">
            <span class="date-display__label">Datum</span>
            <span id="current-date-display" class="date-display__value">–</span>
          </div>
          <select id="speed-select" class="speed-select" aria-label="Abspielgeschwindigkeit">
            ${speedOptions}
          </select>
        </div>

        <div class="slider-group">
          <input
            type="range"
            id="timeline-slider"
            min="0"
          max="${totalDays}"
          value="0"
          step="${UPDATE_INTERVAL_DAYS}"
          class="timeline-slider"
        />
          <div class="slider-labels">
            <span>${startLabel}</span>
            <span>${middleLabel}</span>
            <span>${endLabel}</span>
          </div>
        </div>

        <div class="filter-group">
          <select id="region-select" class="filter-select" aria-label="Region">
            ${regionOptions}
          </select>
          <select id="activity-filter" class="filter-select" aria-label="Aktivitäten filtern">
            ${activityOptions}
          </select>
          <select id="map-style-select" class="filter-select" aria-label="Kartenstil">
            ${mapStyleOptions}
          </select>
        </div>

        <div class="action-group">
          <button id="cem-toggle" class="cem-btn" type="button" aria-pressed="false">
            Cem Modus
          </button>
          <button
            id="marker-style-toggle"
            class="marker-style-btn"
            type="button"
            aria-pressed="false"
            title="Sunflower Marker umschalten"
            aria-label="Sunflower Marker umschalten"
          >
            🌻
          </button>
          <button id="btn-fullscreen" class="icon-btn" title="Vollbild" aria-label="Vollbild umschalten">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `
}
