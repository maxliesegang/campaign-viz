import { differenceInDays, format } from 'date-fns'
import { de } from 'date-fns/locale'
import { getDateRange } from '../data/activities'
import { MAP_STYLES, PLAYBACK_SPEEDS } from '../config'

export function renderTemplate(): string {
  const { start, end } = getDateRange()
  const totalDays = differenceInDays(end, start)

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

  return `
    <div id="main-container" class="h-screen bg-sand flex flex-col text-slate-900">
      <!-- Map takes most space -->
      <div id="map-wrapper" class="relative flex-1">
        <div id="map" class="w-full h-full"></div>

        <!-- Fullscreen overlay -->
        <div id="final-overlay" class="hidden absolute inset-0 overlay-gradient flex items-center justify-center z-[1000]">
          <div class="text-center text-white">
            <h2 class="text-4xl md:text-6xl font-bold mb-8">Wahlkampf 2026</h2>
            <div id="final-stats" class="grid grid-cols-2 gap-6 text-2xl md:text-4xl"></div>
          </div>
        </div>
      </div>

      <!-- Compact timeline at bottom -->
      <div id="timeline-container" class="bg-sand border-t border-salbei-30 px-3 py-2">
        <div class="timeline-inner">
          <!-- Slider row -->
          <div class="timeline-row">
            <div class="flex items-center gap-3 flex-shrink-0">
              <button id="btn-play" class="btn-primary play-btn" aria-label="Play/Pause">
                <svg id="play-icon" class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <svg id="pause-icon" class="w-5 h-5 hidden" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              </button>
              <div class="text-xs leading-tight text-slate-600 whitespace-nowrap">
                <div class="uppercase tracking-wide text-[10px] text-slate-500">Datum</div>
                <div id="current-date-display" class="font-semibold text-slate-800">–</div>
              </div>
            </div>

            <div class="flex-1 min-w-[180px]">
              <input
                type="range"
                id="timeline-slider"
                min="0"
                max="${totalDays}"
                value="0"
                step="0.05"
                class="w-full"
              />
              <div class="flex justify-between text-xs text-slate-500 mt-1">
                <span aria-hidden="true">${startLabel}</span>
                <span aria-hidden="true">${middleLabel}</span>
                <span aria-hidden="true">${endLabel}</span>
              </div>
            </div>

            <!-- Speed controls -->
            <div class="controls-stack">
              <label class="map-style-select-label text-[11px] text-slate-600" aria-label="Abspielgeschwindigkeit">
                <span class="uppercase tracking-wide">Tempo</span>
                <select id="speed-select" class="map-style-select speed-select">
                  ${speedOptions}
                </select>
              </label>

              <label class="map-style-select-label text-[11px] text-slate-600" aria-label="Aktivitäten filtern">
                <span class="uppercase tracking-wide">Aktivität</span>
                <select id="activity-filter" class="map-style-select">
                  ${activityOptions}
                </select>
              </label>

              <label class="map-style-select-label text-[11px] text-slate-600" aria-label="Kartenstil">
                <span class="uppercase tracking-wide">Karte</span>
                <select id="map-style-select" class="map-style-select">
                  ${mapStyleOptions}
                </select>
              </label>

              <button id="btn-fullscreen" class="icon-btn" title="Vollbild" aria-label="Vollbild umschalten">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}
