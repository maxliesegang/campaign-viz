import { START_DATE } from './config'
import type { ActivityFilter } from './types/activity'

export interface AppState {
  startDate: Date
  currentDate: Date
  dayOffset: number // Fractional days from start for smooth animation
  lastUpdateInterval: number // Tracks which interval was last rendered (-1 forces update)
  isPlaying: boolean
  playbackSpeed: number
  isFullscreen: boolean
  animationFrameId: number | null
  lastFrameTime: number
  activityFilter: ActivityFilter
}

type StateListener = (state: AppState) => void

const state: AppState = {
  startDate: new Date(START_DATE),
  currentDate: new Date(START_DATE),
  dayOffset: 0,
  lastUpdateInterval: -1,
  isPlaying: false,
  playbackSpeed: 1,
  isFullscreen: false,
  animationFrameId: null,
  lastFrameTime: 0,
  activityFilter: 'ALL',
}

const listeners: StateListener[] = []

export function getState(): Readonly<AppState> {
  return state
}

export function updateState(updates: Partial<AppState>): void {
  Object.assign(state, updates)
  listeners.forEach((listener) => listener(state))
}

export function subscribe(listener: StateListener): () => void {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index > -1) listeners.splice(index, 1)
  }
}

// Called after activities are loaded to set the correct start date
export function initializeStartDate(date: Date): void {
  const normalizedDate = new Date(date)
  updateState({
    startDate: normalizedDate,
    currentDate: new Date(normalizedDate),
    dayOffset: 0,
    lastUpdateInterval: -1,
  })
}

export function resetToStart(): void {
  updateState({
    currentDate: new Date(state.startDate),
    dayOffset: 0,
    lastUpdateInterval: -1,
    isPlaying: false,
    animationFrameId: null,
    lastFrameTime: 0,
  })
}
