import { ACTIVITY_LABELS } from '../config'
import { getState } from '../state'
import { getElement, showElement } from '../utils/dom'
import type { ProcessedActivity } from '../data/activities'
import { getVisibleActivitiesUpTo } from '../data/activities'
import { ACTIVITY_TYPES, type ActivityCounts } from '../types/activity'

export interface Stats {
  locations: number
  POSTER: number
  HOUSE: number
  activeDays: number
}

function calculateStats(activities: ProcessedActivity[], upToDate: Date, dayOffset: number): Stats {
  const visibleActivities = getVisibleActivitiesUpTo(activities, upToDate, dayOffset)
  return buildStats(visibleActivities)
}

function buildStats(visibleActivities: ProcessedActivity[]): Stats {
  const counts: ActivityCounts = { HOUSE: 0, POSTER: 0 }
  const activeDates = new Set<string>()

  for (const activity of visibleActivities) {
    counts[activity.type] += activity.count
    activeDates.add(activity.date)
  }

  return {
    locations: visibleActivities.length,
    ...counts,
    activeDays: activeDates.size,
  }
}

export function showFinalOverlay(activities: ProcessedActivity[]): void {
  const { currentDate, dayOffset } = getState()
  const overlay = getElement('final-overlay')
  const statsContainer = getElement('final-stats')
  const stats = calculateStats(activities, currentDate, dayOffset)

  const statMarkup = ACTIVITY_TYPES.map(
    (type) => `
      <div class="p-4">
        <div class="stat-number text-4xl font-bold">${stats[type].toLocaleString('de-DE')}</div>
        <div class="text-lg opacity-80">${ACTIVITY_LABELS[type]}</div>
      </div>`,
  ).join('')

  statsContainer.innerHTML = `
    ${statMarkup}
    <div class="p-4">
      <div class="stat-number text-4xl font-bold">${stats.activeDays}</div>
      <div class="text-lg opacity-80">Tage aktiv</div>
    </div>
  `

  showElement(overlay)
  overlay.classList.add('fade-in')
}
