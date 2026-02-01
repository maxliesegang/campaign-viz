#!/usr/bin/env npx ts-node

/**
 * Transforms campaign API export data into privacy-safe activity format.
 *
 * Usage:
 *   npx tsx scripts/transform-export.ts <input.json> [output.json]
 *
 * Default mode (no args):
 *   npx tsx scripts/transform-export.ts
 *   -> reads all JSON files in ./raw-exports (gitignored)
 *   -> writes transformed files to ./src/data/activity-files/<name>-transformed.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { blurCoordinates } from '../src/utils/privacyBlur'

// Valid activity types after normalization
const VALID_TYPES = ['POSTER', 'HOUSE'] as const
type ActivityType = (typeof VALID_TYPES)[number]

interface ApiRecord {
  id: string
  type: string
  campaignId: string
  userId: string
  address: {
    city: string
    zip: string
    street: string
    houseNumber: string | null
  }
  createdAt: string
  updatedAt: string
  divisionKey: string
  coords: [number, number] // [lng, lat]
  photos: unknown[]
  poster?: { status: string; comment: string | null }
  door?: unknown
  flyer?: unknown
}

interface Activity {
  date: string
  type: ActivityType
  lat: number
  lng: number
  count: number
}

function normalizeType(raw: string): ActivityType | null {
  if (raw === 'DOOR') return 'HOUSE'
  if (raw === 'FLYER') return null // drop flyers entirely
  return VALID_TYPES.includes(raw as ActivityType) ? (raw as ActivityType) : null
}

function transformRecord(record: ApiRecord, shouldBlur: boolean): Activity | null {
  const type = normalizeType(record.type)
  if (!type) {
    console.warn(`Unsupported type: ${record.type}, skipping record`)
    return null
  }

  // Extract coordinates (API format is [lng, lat])
  const [lng, lat] = record.coords
  if (!lat || !lng) {
    console.warn(`Missing coordinates for record, skipping`)
    return null
  }

  // Optionally apply privacy blur
  const coords = shouldBlur ? blurCoordinates(lat, lng) : { lat, lng }

  // Extract date (YYYY-MM-DD format)
  const date = record.createdAt.split('T')[0]

  // Derive count: use house door counts when available, otherwise default to 1
  const houseCounts =
    record.house && typeof record.house === 'object'
      ? Number(record.house.countClosedDoors || 0) + Number(record.house.countOpenedDoors || 0)
      : 0
  const count = Math.max(1, houseCounts)

  return {
    date,
    type,
    lat: coords.lat,
    lng: coords.lng,
    count,
  }
}

function aggregateByDateAndLocation(activities: Activity[]): Activity[] {
  // Group activities by date + type + approximate location (rounded to ~100m grid)
  const gridSize = 0.001 // ~100m
  const groups = new Map<string, Activity>()

  for (const activity of activities) {
    const gridLat = Math.round(activity.lat / gridSize) * gridSize
    const gridLng = Math.round(activity.lng / gridSize) * gridSize
    const key = `${activity.date}|${activity.type}|${gridLat.toFixed(4)}|${gridLng.toFixed(4)}`

    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
    } else {
      groups.set(key, { ...activity, lat: gridLat, lng: gridLng })
    }
  }

  return Array.from(groups.values())
}

function main() {
  const args = process.argv.slice(2)
  const shouldAggregate = !args.includes('--no-aggregate')
  const shouldBlur = !args.includes('--no-blur')
  const positional = args.filter((a) => !a.startsWith('--'))

  const rawDir = path.resolve('raw-exports')
  const targetDir = path.resolve('src/data/activity-files')

  // Default: process every JSON in raw-exports/
  if (positional.length === 0) {
    if (!fs.existsSync(rawDir)) {
      console.error(
        `No inputs given and ${rawDir} does not exist. Create it and drop your raw exports there.`,
      )
      process.exit(1)
    }
    const files = fs.readdirSync(rawDir).filter((f) => f.toLowerCase().endsWith('.json'))
    if (!files.length) {
      console.error(`No JSON files found in ${rawDir}`)
      process.exit(1)
    }
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

    for (const file of files) {
      const inputPath = path.join(rawDir, file)
      const outputName = file.replace(/\.json$/i, '-transformed.json')
      const outputPath = path.join(targetDir, outputName)
      transformFile(inputPath, outputPath, { shouldAggregate, shouldBlur })
    }
    console.log(`\nFertig. Ergebnisse liegen in ${targetDir}`)
    return
  }

  // Single-file mode
  const inputPath = positional[0]
  const outputPath = positional[1] || 'activities-transformed.json'
  transformFile(inputPath, outputPath, { shouldAggregate, shouldBlur })
}

type TransformOptions = { shouldAggregate: boolean; shouldBlur: boolean }

function transformFile(inputPath: string, outputPath: string, opts: TransformOptions) {
  const { shouldAggregate, shouldBlur } = opts

  console.log(`Reading: ${inputPath}`)
  const inputData = fs.readFileSync(path.resolve(inputPath), 'utf-8')

  // Parse - handle both array and {data: [...]} formats
  let records: ApiRecord[]
  const parsed = JSON.parse(inputData)

  if (Array.isArray(parsed)) {
    records = parsed
  } else if (parsed.data && Array.isArray(parsed.data)) {
    records = parsed.data
    console.log(`Total records in export: ${parsed.total || records.length}`)
  } else {
    console.error('Invalid input format. Expected array or {data: [...]}')
    process.exit(1)
  }

  console.log(`Processing ${records.length} records...`)

  // Transform records
  let activities = records
    .map((r) => transformRecord(r, shouldBlur))
    .filter((a): a is Activity => a !== null)

  console.log(`Transformed ${activities.length} valid activities`)

  // Optionally aggregate
  if (shouldAggregate) {
    const beforeCount = activities.length
    activities = aggregateByDateAndLocation(activities)
    console.log(`Aggregated to ${activities.length} activities (from ${beforeCount})`)
  }

  // Sort by date
  activities.sort((a, b) => a.date.localeCompare(b.date))

  // Generate stats
  const stats = {
    total: activities.length,
    byType: {
      HOUSE: activities.filter((a) => a.type === 'HOUSE').reduce((s, a) => s + a.count, 0),
      POSTER: activities.filter((a) => a.type === 'POSTER').reduce((s, a) => s + a.count, 0),
    },
    dateRange: {
      start: activities[0]?.date || null,
      end: activities[activities.length - 1]?.date || null,
    },
  }

  console.log('\nStats:')
  console.log(`  Date range: ${stats.dateRange.start} to ${stats.dateRange.end}`)
  console.log(`  HOUSE: ${stats.byType.HOUSE}`)
  console.log(`  POSTER: ${stats.byType.POSTER}`)

  // Write output
  const output = JSON.stringify(activities, null, 2)
  fs.writeFileSync(path.resolve(outputPath), output)
  console.log(`\nWritten to: ${outputPath}`)

  // Also show sample for verification
  console.log('\nSample output (first 3 records):')
  console.log(JSON.stringify(activities.slice(0, 3), null, 2))
}

main()
