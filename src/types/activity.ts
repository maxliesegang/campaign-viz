export type ActivityType = 'POSTER' | 'HOUSE'

export const ACTIVITY_TYPES = ['HOUSE', 'POSTER'] as const satisfies readonly ActivityType[]

export type ActivityCounts = Record<ActivityType, number>

export type ActivityFilter = 'ALL' | ActivityType

/** Marker visual state: recently revealed vs accumulated historical */
export type MarkerVariant = 'recent' | 'cumulative'
