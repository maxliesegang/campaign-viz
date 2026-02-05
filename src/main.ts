import './style.css'
import { queryElement } from './utils/dom'
import { renderTemplate } from './components/template'
import {
  initMap,
  initMapStyleControls,
  updateMapVisualization,
  updateDateDisplay,
  reinitializeMap,
  invalidateRecentKeysCache,
} from './components/MapController'
import { initTimeline, stopPlayback } from './components/TimelineController'
import { getDateRange, getProcessedActivities, switchRegion } from './data/activities'
import { initializeStartDate, updateState, resetToStart } from './state'
import { initFaceCelebration } from './components/FaceCelebration'
import { getCurrentRegionFromHash, onRegionChange, navigateToRegion } from './router'
import { getRegionConfig, type RegionId } from './regions'

function init(): void {
  const regionId = getCurrentRegionFromHash()
  renderRegion(regionId, { reuseMap: false })
  onRegionChange(handleRegionChange)
}

function renderRegion(regionId: RegionId, options: { reuseMap?: boolean } = {}): void {
  const { reuseMap = false } = options
  const regionConfig = getRegionConfig(regionId)

  switchRegion(regionId)
  const activities = getProcessedActivities()

  const { start } = getDateRange()
  initializeStartDate(start)
  resetToStart()
  updateState({ currentRegion: regionId })
  invalidateRecentKeysCache()

  queryElement<HTMLDivElement>('#app').innerHTML = renderTemplate(regionConfig)

  initFaceCelebration()
  reuseMap ? reinitializeMap(regionConfig) : initMap(regionConfig)
  initMapStyleControls()
  initTimeline(activities)
  initRegionSelector(regionId)

  updateDateDisplay()
  updateMapVisualization(activities)
}

function initRegionSelector(currentRegionId: RegionId): void {
  const select = document.getElementById('region-select') as HTMLSelectElement | null
  if (!select) return

  select.value = currentRegionId
  select.addEventListener('change', () => {
    navigateToRegion(select.value)
  })
}

function handleRegionChange(newRegionId: RegionId): void {
  stopPlayback()
  document.exitFullscreen?.()

  renderRegion(newRegionId, { reuseMap: true })
}

document.addEventListener('DOMContentLoaded', init)
