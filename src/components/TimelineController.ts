import { addDays, differenceInDays } from 'date-fns'
import { AD_MODE_DURATION_MS, BASE_DAYS_PER_MS, UPDATE_INTERVAL_DAYS } from '../config'
import { getState, resetToStart, updateState } from '../state'
import { getElement, hideElement, showElement } from '../utils/dom'
import { getDateRange, type ProcessedActivity } from '../data/activities'
import type { ActivityFilter } from '../types/activity'
import { updateDateDisplay, updateMapVisualization } from './MapController'
import { showFinalOverlay, updateStats } from './StatsController'

type TimelineUi = {
  slider: HTMLInputElement
  playButton: HTMLElement
  playIcon: HTMLElement
  pauseIcon: HTMLElement
  fullscreenButton: HTMLElement
  mainContainer: HTMLElement
  timeline: HTMLElement
  overlay: HTMLElement
}

let activities: ProcessedActivity[] = []
let timelineUi: TimelineUi | null = null

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

  setupKeyboardShortcuts()
}

function handleSliderChange(e: Event): void {
  const { start } = getDateRange()
  const dayOffset = parseFloat((e.target as HTMLInputElement).value)
  updateState({
    currentDate: addDays(start, dayOffset),
    dayOffset,
    lastUpdateInterval: -1,
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
    updateState({ activityFilter: select.value as ActivityFilter })
    refreshVisualization()
  })
}

function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault()
      togglePlayback()
      return
    }
    if (e.code === 'KeyF') toggleFullscreen()
  })
}

export function togglePlayback(): void {
  const { isPlaying } = getState()
  if (isPlaying) {
    stopPlayback()
  } else {
    startPlayback()
  }
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
      syncSliderToDate()
      refreshVisualization()
      startPlayback()
    }, RESTART_DELAY_MS)
    return
  }

  const currentInterval = Math.floor(newDayOffset / UPDATE_INTERVAL_DAYS)
  updateState({ dayOffset: newDayOffset, currentDate: addDays(start, newDayOffset) })

  if (currentInterval !== state.lastUpdateInterval) {
    updateState({ lastUpdateInterval: currentInterval })
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
  updateMapVisualization(activities)
  updateStats(activities)
}

export function setPlaybackSpeed(speed: number): void {
  updateState({ playbackSpeed: speed })
  updateSpeedButtonsUI(speed)
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

function updateSpeedButtonsUI(activeSpeed: number): void {
  const select = document.getElementById('speed-select') as HTMLSelectElement | null
  if (select) select.value = String(activeSpeed)
}

function syncSpeedSelect(): void {
  const select = document.getElementById('speed-select') as HTMLSelectElement | null
  if (select) select.value = String(getState().playbackSpeed)

  const activitySelect = document.getElementById('activity-filter') as HTMLSelectElement | null
  if (activitySelect) activitySelect.value = getState().activityFilter
}

export function toggleFullscreen(): void {
  const { isFullscreen } = getState()
  if (isFullscreen) {
    exitFullscreen()
  } else {
    enterFullscreen()
  }
}

function enterFullscreen(): void {
  const ui = requireTimelineUi()
  const { start, end } = getDateRange()

  ui.mainContainer.classList.add('fullscreen-mode')
  hideElement(ui.timeline)
  hideElement(ui.overlay)

  resetToStart()
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
