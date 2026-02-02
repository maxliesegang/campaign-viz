import { addDays, differenceInDays } from 'date-fns'
import { AD_MODE_DURATION_MS, BASE_DAYS_PER_MS, UPDATE_INTERVAL_DAYS } from '../config'
import { getState, resetToStart, updateState } from '../state'
import { getElement, hideElement, showElement } from '../utils/dom'
import { getDateRange, type ProcessedActivity } from '../data/activities'
import type { ActivityFilter, ActivityCounts } from '../types/activity'
import {
  updateDateDisplay,
  updateMapVisualization,
  invalidateRecentKeysCache,
} from './MapController'
import { showFinalOverlay } from './StatsController'
import { handleFaceCelebration, resetFaceCelebration } from './FaceCelebration'

type TimelineUi = {
  slider: HTMLInputElement
  playButton: HTMLElement
  playIcon: HTMLElement
  pauseIcon: HTMLElement
  fullscreenButton: HTMLElement
  mainContainer: HTMLElement
  timeline: HTMLElement
  overlay: HTMLElement
  cemToggle: HTMLElement
  markerStyleToggle: HTMLElement
}

let activities: ProcessedActivity[] = []
let timelineUi: TimelineUi | null = null
let lastUpdateInterval = -1

export function initTimeline(processedActivities: ProcessedActivity[]): void {
  activities = processedActivities
  timelineUi = collectTimelineUi()
  setupTimelineListeners()
  syncSpeedSelect()
}

function collectTimelineUi(): TimelineUi {
  return {
    slider: getElement<HTMLInputElement>('timeline-slider'),
    playButton: getElement('btn-play'),
    playIcon: getElement('play-icon'),
    pauseIcon: getElement('pause-icon'),
    fullscreenButton: getElement('btn-fullscreen'),
    mainContainer: getElement('main-container'),
    timeline: getElement('timeline-container'),
    overlay: getElement('final-overlay'),
    cemToggle: getElement('cem-toggle'),
    markerStyleToggle: getElement('marker-style-toggle'),
  }
}

function requireTimelineUi(): TimelineUi {
  if (!timelineUi) throw new Error('Timeline UI not initialized')
  return timelineUi
}

function setupTimelineListeners(): void {
  const ui = requireTimelineUi()
  ui.slider.addEventListener('input', handleSliderChange)
  ui.playButton.addEventListener('click', togglePlayback)
  ui.fullscreenButton.addEventListener('click', toggleFullscreen)
  wireSpeedSelect()
  wireActivityFilter()
  wireCemToggle()
  wireMarkerStyleToggle()

  setupKeyboardShortcuts()
}

function handleSliderChange(e: Event): void {
  const { start } = getDateRange()
  const dayOffset = parseFloat((e.target as HTMLInputElement).value)
  lastUpdateInterval = -1
  invalidateRecentKeysCache() // Slider can move backward, invalidate cache
  updateState({
    currentDate: addDays(start, dayOffset),
    dayOffset,
  })
  refreshVisualization()
}

function wireSpeedSelect(): void {
  const select = document.getElementById('speed-select') as HTMLSelectElement | null
  if (!select) return
  select.addEventListener('change', () => {
    const speed = parseInt(select.value)
    setPlaybackSpeed(speed)
  })
}

function wireActivityFilter(): void {
  const select = document.getElementById('activity-filter') as HTMLSelectElement | null
  if (!select) return
  select.addEventListener('change', () => {
    invalidateRecentKeysCache() // Filter changed, invalidate cache
    updateState({ activityFilter: select.value as ActivityFilter })
    refreshVisualization()
  })
}

function wireToggleButton(
  btn: HTMLElement,
  getActive: () => boolean,
  onToggle: (active: boolean) => void,
): void {
  const sync = () => btn.setAttribute('aria-pressed', String(getActive()))
  btn.addEventListener('click', () => {
    onToggle(!getActive())
    sync()
  })
  sync()
}

function wireCemToggle(): void {
  wireToggleButton(
    requireTimelineUi().cemToggle,
    () => getState().cemMode,
    (active) => {
      updateState({ cemMode: active })
      if (!active) resetFaceCelebration()
    },
  )
}

function wireMarkerStyleToggle(): void {
  wireToggleButton(
    requireTimelineUi().markerStyleToggle,
    () => getState().useSunflowerMarkers,
    (active) => {
      updateState({ useSunflowerMarkers: active })
      refreshVisualization()
    },
  )
}

function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault()
      togglePlayback()
    } else if (e.code === 'KeyF') {
      toggleFullscreen()
    }
  })
}

export function togglePlayback(): void {
  getState().isPlaying ? stopPlayback() : startPlayback()
}

export function startPlayback(): void {
  updateState({
    isPlaying: true,
    lastFrameTime: performance.now(),
  })
  updatePlayButtonUI(true)
  animate()
}

export function stopPlayback(): void {
  const { animationFrameId } = getState()
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  updateState({
    isPlaying: false,
    animationFrameId: null,
  })
  updatePlayButtonUI(false)
}

const RESTART_DELAY_MS = 1200

function animate(): void {
  const state = getState()
  if (!state.isPlaying) return

  const { start, end } = getDateRange()
  const totalDays = differenceInDays(end, start)
  const now = performance.now()
  const deltaMs = now - state.lastFrameTime

  const daysPerMs = state.playbackSpeed * BASE_DAYS_PER_MS
  const daysToAdvance = deltaMs * daysPerMs
  const newDayOffset = state.dayOffset + daysToAdvance

  updateState({ lastFrameTime: now })

  if (newDayOffset >= totalDays) {
    updateState({ dayOffset: totalDays, currentDate: new Date(end) })
    syncSliderToDate()
    refreshVisualization()
    stopPlayback()
    if (state.isFullscreen) showFinalOverlay(activities)
    setTimeout(() => {
      resetToStart()
      lastUpdateInterval = -1
      invalidateRecentKeysCache()
      resetFaceCelebration()
      syncSliderToDate()
      refreshVisualization()
      startPlayback()
    }, RESTART_DELAY_MS)
    return
  }

  const currentInterval = Math.floor(newDayOffset / UPDATE_INTERVAL_DAYS)
  updateState({ dayOffset: newDayOffset, currentDate: addDays(start, newDayOffset) })

  if (currentInterval !== lastUpdateInterval) {
    lastUpdateInterval = currentInterval
    syncSliderToDate()
    refreshVisualization()
  }

  const frameId = requestAnimationFrame(animate)
  updateState({ animationFrameId: frameId })
}

function syncSliderToDate(): void {
  const { dayOffset } = getState()
  const { slider } = requireTimelineUi()
  slider.value = dayOffset.toFixed(2)
}

function refreshVisualization(): void {
  updateDateDisplay()
  const visibleActivities = updateMapVisualization(activities)

  const counts: ActivityCounts = { HOUSE: 0, POSTER: 0 }
  for (const activity of visibleActivities) {
    counts[activity.type] += activity.count
  }
  handleFaceCelebration(counts)
}

export function setPlaybackSpeed(speed: number): void {
  updateState({ playbackSpeed: speed })
  syncSelectValue('speed-select', String(speed))
}

function updatePlayButtonUI(isPlaying: boolean): void {
  const { playIcon, pauseIcon } = requireTimelineUi()
  if (isPlaying) {
    hideElement(playIcon)
    showElement(pauseIcon)
  } else {
    showElement(playIcon)
    hideElement(pauseIcon)
  }
}

function syncSelectValue(id: string, value: string): void {
  const select = document.getElementById(id) as HTMLSelectElement | null
  if (select) select.value = value
}

function syncSpeedSelect(): void {
  syncSelectValue('speed-select', String(getState().playbackSpeed))
  syncSelectValue('activity-filter', getState().activityFilter)
}

export function toggleFullscreen(): void {
  getState().isFullscreen ? exitFullscreen() : enterFullscreen()
}

function enterFullscreen(): void {
  const ui = requireTimelineUi()
  const { start, end } = getDateRange()

  ui.mainContainer.classList.add('fullscreen-mode')
  hideElement(ui.timeline)
  hideElement(ui.overlay)

  resetToStart()
  lastUpdateInterval = -1
  invalidateRecentKeysCache()
  resetFaceCelebration()
  syncSliderToDate()
  refreshVisualization()

  const totalDays = differenceInDays(end, start)
  const adModeSpeed = totalDays / (AD_MODE_DURATION_MS * BASE_DAYS_PER_MS)
  updateState({ isFullscreen: true, playbackSpeed: adModeSpeed })

  setTimeout(() => startPlayback(), 500)
  document.documentElement.requestFullscreen?.()
}

function exitFullscreen(): void {
  const ui = requireTimelineUi()

  ui.mainContainer.classList.remove('fullscreen-mode')
  showElement(ui.timeline)
  hideElement(ui.overlay)

  stopPlayback()
  setPlaybackSpeed(1)
  updateState({ isFullscreen: false })

  document.exitFullscreen?.()
}
