import { isBefore, isSameDay } from 'date-fns'
import { seededRandom } from '../utils/random'
import { blurCoordinates } from '../utils/privacyBlur'
import { START_DATE, END_DATE, MS_PER_DAY } from '../config'
import type { ActivityType, ActivityFilter } from '../types/activity'

export interface Activity {
  date: string
  type: ActivityType
  lat: number
  lng: number
  count: number
}

export interface ProcessedActivity extends Activity {
  blurredLat: number
  blurredLng: number
  dateObj: Date
  dayIndex: number
  revealFraction: number
}

const neighborhoods = [
  { lat: 49.0069, lng: 8.3937 },
  { lat: 49.0089, lng: 8.4137 },
  { lat: 49.0009, lng: 8.3867 },
  { lat: 48.9969, lng: 8.4037 },
  { lat: 49.0129, lng: 8.3637 },
  { lat: 49.0049, lng: 8.3337 },
  { lat: 48.9969, lng: 8.3537 },
  { lat: 48.9849, lng: 8.3437 },
  { lat: 48.9989, lng: 8.4737 },
  { lat: 49.0049, lng: 8.5237 },
  { lat: 48.9869, lng: 8.4637 },
  { lat: 49.0109, lng: 8.4237 },
  { lat: 49.0269, lng: 8.3737 },
  { lat: 49.0249, lng: 8.4037 },
  { lat: 49.0449, lng: 8.3637 },
  { lat: 49.0229, lng: 8.4437 },
  { lat: 49.0349, lng: 8.4537 },
  { lat: 48.9769, lng: 8.4137 },
  { lat: 48.9829, lng: 8.3937 },
  { lat: 48.9889, lng: 8.3837 },
]

function generateSampleActivities(): Activity[] {
  const activities: Activity[] = []
  let activityId = 0

  const totalDays = Math.round((END_DATE.getTime() - START_DATE.getTime()) / MS_PER_DAY)

  for (let offset = 0; offset <= totalDays; offset++) {
    const currentDate = new Date(START_DATE.getTime() + offset * MS_PER_DAY)
    const month = currentDate.getMonth()
    const dayOfWeek = currentDate.getDay()
    const dateStr = currentDate.toISOString().split('T')[0]

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    let activityChance: number

    if (month === 0) {
      activityChance = isWeekend ? 0.7 : 0.3
    } else if (month === 1) {
      activityChance = isWeekend ? 0.9 : 0.5
    } else {
      activityChance = isWeekend ? 0.85 : 0.45
    }

    if (seededRandom(activityId * 7 + currentDate.getTime()) > activityChance) {
      activityId++
      continue
    }

    const numActivities = Math.floor(seededRandom(activityId * 3) * 3) + 1

    for (let i = 0; i < numActivities; i++) {
      const neighborhoodIndex = Math.floor(seededRandom(activityId * 11 + i) * neighborhoods.length)
      const neighborhood = neighborhoods[neighborhoodIndex]

      const latOffset = (seededRandom(activityId * 13 + i * 2) - 0.5) * 0.015
      const lngOffset = (seededRandom(activityId * 17 + i * 3) - 0.5) * 0.015

      const type: ActivityType = seededRandom(activityId * 19 + i * 5) < 0.7 ? 'HOUSE' : 'POSTER'
      const count =
        type === 'HOUSE'
          ? Math.floor(seededRandom(activityId * 23 + i * 7) * 25) + 8
          : Math.floor(seededRandom(activityId * 31 + i * 13) * 8) + 2

      activities.push({
        date: dateStr,
        type,
        lat: neighborhood.lat + latOffset,
        lng: neighborhood.lng + lngOffset,
        count,
      })

      activityId++
    }
  }

  return activities
}

function computeDateRange(activities: Activity[]): { start: Date; end: Date } {
  if (activities.length === 0) return { start: new Date(START_DATE), end: new Date(END_DATE) }

  return activities.reduce(
    ({ start, end }, activity) => {
      const date = new Date(activity.date)
      return {
        start: date < start ? date : start,
        end: date > end ? date : end,
      }
    },
    { start: new Date(activities[0].date), end: new Date(activities[0].date) },
  )
}

function processActivities(
  activities: Activity[],
  alreadyBlurred = false,
  startDate: Date,
): ProcessedActivity[] {
  return activities.map((activity, idx) => {
    const dateObj = new Date(activity.date)
    const dayIndex = Math.max(0, Math.round((dateObj.getTime() - startDate.getTime()) / MS_PER_DAY))
    const revealFraction = seededRandom(idx * 97 + activity.lat * 1000 + activity.lng * 1000)
    const coords = alreadyBlurred
      ? { lat: activity.lat, lng: activity.lng }
      : blurCoordinates(activity.lat, activity.lng)

    return {
      ...activity,
      blurredLat: coords.lat,
      blurredLng: coords.lng,
      dateObj,
      dayIndex,
      revealFraction,
    }
  })
}

// Load JSON files from src/data/activity-files/*.json, fallback to generated sample data
const importedModules = import.meta.glob('./activity-files/*.json', { eager: true })
const importedActivities: Activity[] = Object.values(importedModules).flatMap((mod) => {
  const data = (mod as { default?: Activity[] }).default
  return Array.isArray(data) ? data : []
})

const activities = importedActivities.length > 0 ? importedActivities : generateSampleActivities()
const dateRange = computeDateRange(activities)

// Skip coordinate blurring - imported data should be pre-processed, generated data is already randomized
export const processedActivities = processActivities(activities, true, dateRange.start)

export function getDateRange(): { start: Date; end: Date } {
  return { start: new Date(dateRange.start), end: new Date(dateRange.end) }
}

export function isActivityVisible(activity: ProcessedActivity, dayOffset: number): boolean {
  const wholeDays = Math.floor(dayOffset)
  const intraDay = dayOffset - wholeDays
  return (
    activity.dayIndex < wholeDays ||
    (activity.dayIndex === wholeDays && intraDay >= activity.revealFraction)
  )
}

export function getVisibleActivitiesUpTo(
  activities: ProcessedActivity[],
  upToDate: Date,
  dayOffset: number,
): ProcessedActivity[] {
  return activities.filter(
    (activity) =>
      isActivityVisible(activity, dayOffset) &&
      (isBefore(activity.dateObj, upToDate) || isSameDay(activity.dateObj, upToDate)),
  )
}

export function filterActivities(
  activities: ProcessedActivity[],
  filter: ActivityFilter,
): ProcessedActivity[] {
  if (filter === 'ALL') return activities
  return activities.filter((activity) => activity.type === filter)
}

export function selectVisibleActivities(
  activities: ProcessedActivity[],
  state: { currentDate: Date; dayOffset: number; activityFilter: ActivityFilter },
): ProcessedActivity[] {
  const visible = getVisibleActivitiesUpTo(activities, state.currentDate, state.dayOffset)
  return filterActivities(visible, state.activityFilter)
}
