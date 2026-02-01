import './style.css'
import { queryElement } from './utils/dom'
import { renderTemplate } from './components/template'
import {
  initMap,
  initMapStyleControls,
  updateMapVisualization,
  updateDateDisplay,
} from './components/MapController'
import { initTimeline } from './components/TimelineController'
import { updateStats } from './components/StatsController'
import { processedActivities, getDateRange } from './data/activities'
import { initializeStartDate } from './state'

function init(): void {
  // Initialize state with actual date range from data
  const { start } = getDateRange()
  initializeStartDate(start)

  queryElement<HTMLDivElement>('#app').innerHTML = renderTemplate()

  initMap()
  initMapStyleControls()
  initTimeline(processedActivities)

  updateDateDisplay()
  updateMapVisualization(processedActivities)
  updateStats(processedActivities)
}

document.addEventListener('DOMContentLoaded', init)
