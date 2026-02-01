import { NUMBER_ANIMATION_DURATION_MS, ACTIVITY_LABELS } from '../config'
import { getState } from '../state'
import { getElement, showElement } from '../utils/dom'
import type { ProcessedActivity } from '../data/activities'
import { getVisibleActivitiesUpTo, selectVisibleActivities } from '../data/activities'
import { ACTIVITY_TYPES, type ActivityCounts } from '../types/activity'

export interface Stats {
  locations: number
  POSTER: number
  HOUSE: number
  activeDays: number
}

export function calculateStats(
  activities: ProcessedActivity[],
  upToDate: Date,
  dayOffset: number,
): Stats {
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

export function updateStats(activities: ProcessedActivity[]): void {
  const targets = getStatElements()
  if (!targets) return
  const stats = buildStats(selectVisibleActivities(activities, getState()))

  animateNumber(targets.HOUSE, stats.HOUSE)
  animateNumber(targets.POSTER, stats.POSTER)
  animateNumber(targets.days, stats.activeDays)
}

type StatElements = {
  HOUSE: HTMLElement
  POSTER: HTMLElement
  days: HTMLElement
}

let statElements: StatElements | null = null

function getStatElements(): StatElements | null {
  if (statElements) return statElements
  const house = document.getElementById('stat-houses')
  const poster = document.getElementById('stat-plakate')
  const days = document.getElementById('stat-days')
  if (!house || !poster || !days) return null
  statElements = { HOUSE: house, POSTER: poster, days }
  return statElements
}

function animateNumber(element: HTMLElement, targetValue: number): void {
  const currentValue = parseInt(element.textContent?.replace(/\./g, '') || '0')

  if (currentValue === targetValue) return

  const startTime = performance.now()

  function update(): void {
    const elapsed = performance.now() - startTime
    const progress = Math.min(elapsed / NUMBER_ANIMATION_DURATION_MS, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = Math.round(currentValue + (targetValue - currentValue) * eased)

    element.textContent = current.toLocaleString('de-DE')

    if (progress < 1) {
      requestAnimationFrame(update)
    }
  }

  requestAnimationFrame(update)
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
