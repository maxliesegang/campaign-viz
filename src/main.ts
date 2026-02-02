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
import { processedActivities, getDateRange } from './data/activities'
import { initializeStartDate } from './state'
import { initFaceCelebration } from './components/FaceCelebration'

function init(): void {
  // Initialize state with actual date range from data
  const { start } = getDateRange()
  initializeStartDate(start)

  queryElement<HTMLDivElement>('#app').innerHTML = renderTemplate()

  initFaceCelebration()
  initMap()
  initMapStyleControls()
  initTimeline(processedActivities)

  updateDateDisplay()
  updateMapVisualization(processedActivities)
}

document.addEventListener('DOMContentLoaded', init)
