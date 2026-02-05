import { DEFAULT_REGION, type RegionId } from './regions'
import type { ActivityFilter } from './types/activity'

export interface AppState {
  startDate: Date
  currentDate: Date
  dayOffset: number // Fractional days from start for smooth animation
  isPlaying: boolean
  playbackSpeed: number
  isFullscreen: boolean
  cemMode: boolean
  useSunflowerMarkers: boolean
  animationFrameId: number | null
  lastFrameTime: number
  activityFilter: ActivityFilter
  currentRegion: RegionId
}

const state: AppState = {
  startDate: new Date(),
  currentDate: new Date(),
  dayOffset: 0,
  isPlaying: false,
  playbackSpeed: 1,
  isFullscreen: false,
  cemMode: false,
  useSunflowerMarkers: true,
  animationFrameId: null,
  lastFrameTime: 0,
  activityFilter: 'ALL',
  currentRegion: DEFAULT_REGION,
}

export function getState(): Readonly<AppState> {
  return state
}

export function updateState(updates: Partial<AppState>): void {
  Object.assign(state, updates)
}

// Called after activities are loaded to set the correct start date
export function initializeStartDate(date: Date): void {
  const normalizedDate = new Date(date)
  updateState({
    startDate: normalizedDate,
    currentDate: new Date(normalizedDate),
    dayOffset: 0,
  })
}

export function resetToStart(): void {
  updateState({
    currentDate: new Date(state.startDate),
    dayOffset: 0,
    isPlaying: false,
    animationFrameId: null,
    lastFrameTime: 0,
  })
}
