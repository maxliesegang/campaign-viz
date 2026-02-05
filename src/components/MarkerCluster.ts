import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'

export function createClusterGroup(): L.MarkerClusterGroup {
  return L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 50,
    chunkDelay: 50,
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,
    maxClusterRadius: 4, // Minimal clustering - nearly individual points
    disableClusteringAtZoom: 18, // Keep paint dots visible at all zoom levels
    iconCreateFunction: createPaintDot,
    animate: false, // Smoother for large datasets
    animateAddingMarkers: false,
  })
}

function createPaintDot(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount()

  // Scale size based on count (logarithmic for better distribution)
  const minSize = 4
  const maxSize = 12
  const scale = Math.min(1, Math.log10(count + 1) / 2) // 0-1 range, fast scaling
  const size = Math.round(minSize + scale * (maxSize - minSize))

  // Vary opacity slightly for depth effect
  const opacity = 0.5 + scale * 0.3

  return L.divIcon({
    html: `<div class="paint-dot" style="--dot-opacity: ${opacity}"></div>`,
    className: 'marker-cluster-paint',
    iconSize: L.point(size, size),
  })
}
