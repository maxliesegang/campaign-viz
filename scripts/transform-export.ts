#!/usr/bin/env npx ts-node

/**
 * Transforms campaign API export data into privacy-safe activity format.
 *
 * Structure:
 *   raw-exports/
 *   ├── karlsruhe/
 *   │   ├── export-HOUSE.json
 *   │   └── export-POSTER.json
 *   └── bawu/
 *       ├── export-HOUSE.json
 *       └── export-POSTER.json
 *
 * Output:
 *   src/data/activity-files/
 *   ├── karlsruhe/
 *   │   ├── HOUSE.json
 *   │   └── POSTER.json
 *   └── bawu/
 *       ├── HOUSE.json
 *       └── POSTER.json
 *
 * Usage:
 *   npx tsx scripts/transform-export.ts [--no-blur] [--no-aggregate]
 */

import * as fs from 'fs'
import * as path from 'path'
import { blurCoordinates } from '../src/utils/privacyBlur'

const VALID_TYPES = ['POSTER', 'HOUSE'] as const
type ActivityType = (typeof VALID_TYPES)[number]

interface ApiRecord {
  id: string
  type: string
  coords: [number, number] // [lng, lat]
  createdAt: string
  house?: { countClosedDoors?: number; countOpenedDoors?: number }
  [key: string]: unknown
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
  if (raw === 'FLYER') return null
  return VALID_TYPES.includes(raw as ActivityType) ? (raw as ActivityType) : null
}

function transformRecord(record: ApiRecord, shouldBlur: boolean): Activity | null {
  const type = normalizeType(record.type)
  if (!type) return null

  const [lng, lat] = record.coords
  if (!lat || !lng) return null

  const coords = shouldBlur ? blurCoordinates(lat, lng) : { lat, lng }
  const date = record.createdAt.split('T')[0]

  const houseCounts =
    record.house && typeof record.house === 'object'
      ? Number(record.house.countClosedDoors || 0) + Number(record.house.countOpenedDoors || 0)
      : 0
  const count = Math.max(1, houseCounts)

  return { date, type, lat: coords.lat, lng: coords.lng, count }
}

function aggregateByDateAndLocation(activities: Activity[]): Activity[] {
  const gridSize = 0.001 // ~100m
  const groups = new Map<string, Activity>()

  for (const activity of activities) {
    const gridLat = Math.round(activity.lat / gridSize) * gridSize
    const gridLng = Math.round(activity.lng / gridSize) * gridSize
    const key = `${activity.date}|${activity.type}|${gridLat.toFixed(4)}|${gridLng.toFixed(4)}`

    const existing = groups.get(key)
    if (existing) {
      existing.count += activity.count
    } else {
      groups.set(key, { ...activity, lat: gridLat, lng: gridLng })
    }
  }

  return Array.from(groups.values())
}

function processFile(filePath: string, shouldBlur: boolean): Activity[] {
  const data = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(data)
  const records: ApiRecord[] = Array.isArray(parsed) ? parsed : parsed.data || []

  return records.map((r) => transformRecord(r, shouldBlur)).filter((a): a is Activity => a !== null)
}

function main() {
  const args = process.argv.slice(2)
  const shouldAggregate = !args.includes('--no-aggregate')
  const shouldBlur = !args.includes('--no-blur')

  const rawDir = path.resolve('raw-exports')
  const targetDir = path.resolve('src/data/activity-files')

  if (!fs.existsSync(rawDir)) {
    console.error(`${rawDir} does not exist.`)
    process.exit(1)
  }

  // Find region folders in raw-exports
  const entries = fs.readdirSync(rawDir, { withFileTypes: true })
  const regionDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)

  if (regionDirs.length === 0) {
    console.error(`No region folders found in ${rawDir}`)
    console.error('Expected structure: raw-exports/<region>/*.json')
    process.exit(1)
  }

  console.log(`Found regions: ${regionDirs.join(', ')}\n`)

  for (const region of regionDirs) {
    const regionRawDir = path.join(rawDir, region)
    const regionTargetDir = path.join(targetDir, region)

    const jsonFiles = fs.readdirSync(regionRawDir).filter((f) => f.endsWith('.json'))
    if (jsonFiles.length === 0) {
      console.log(`  ${region}: no JSON files, skipping`)
      continue
    }

    // Collect activities by type
    const byType: Record<ActivityType, Activity[]> = { HOUSE: [], POSTER: [] }

    for (const file of jsonFiles) {
      const filePath = path.join(regionRawDir, file)
      console.log(`  Processing ${region}/${file}`)

      const activities = processFile(filePath, shouldBlur)
      for (const activity of activities) {
        byType[activity.type].push(activity)
      }
    }

    // Write output files
    if (!fs.existsSync(regionTargetDir)) {
      fs.mkdirSync(regionTargetDir, { recursive: true })
    }

    for (const type of VALID_TYPES) {
      let activities = byType[type]
      if (activities.length === 0) continue

      if (shouldAggregate) {
        activities = aggregateByDateAndLocation(activities)
      }
      activities.sort((a, b) => a.date.localeCompare(b.date))

      const totalCount = activities.reduce((sum, a) => sum + a.count, 0)
      const outputPath = path.join(regionTargetDir, `${type}.json`)

      fs.writeFileSync(outputPath, JSON.stringify(activities, null, 2))
      console.log(`    → ${type}.json: ${activities.length} locations, ${totalCount} total`)
    }
  }

  console.log('\nDone.')
}

main()
