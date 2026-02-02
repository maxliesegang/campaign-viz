import { FACE_MAX_ACTIVE, FACE_TRIGGER_HOUSE, FACE_TRIGGER_POSTER } from '../config'
import { getState } from '../state'
import type { ActivityCounts } from '../types/activity'

const PLACEHOLDER_FACE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'><rect width='16' height='16' fill='%23f5f1e9'/><rect x='3' y='3' width='10' height='10' fill='%23f9d29d'/><rect x='5' y='6' width='2' height='2' fill='%23222'/><rect x='9' y='6' width='2' height='2' fill='%23222'/><rect x='6' y='10' width='4' height='1' fill='%23cc6b49'/><rect x='5' y='11' width='6' height='1' fill='%23cc6b49'/><rect x='2' y='9' width='2' height='2' fill='%23e6fd53'/><rect x='12' y='9' width='2' height='2' fill='%23e6fd53'/></svg>"

let nextTriggerHouse = FACE_TRIGGER_HOUSE
let nextTriggerPoster = FACE_TRIGGER_POSTER
let faceLayer: HTMLElement | null = null
let faceUrls: string[] = []
let nextFaceIndex = 0

export function initFaceCelebration(): void {
  if (faceLayer) return
  const layer = document.getElementById('face-layer')
  if (!layer) return
  faceLayer = layer
  faceLayer.setAttribute('data-face-placeholder', PLACEHOLDER_FACE)

  const base = import.meta.env.BASE_URL ?? '/'
  const urlListAttr = faceLayer.getAttribute('data-face-urls')
  const singleUrlAttr = faceLayer.getAttribute('data-face-url')

  if (urlListAttr) {
    faceUrls = urlListAttr
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => normalizeUrl(base, url))
  } else if (singleUrlAttr) {
    faceUrls = [normalizeUrl(base, singleUrlAttr)]
  }

  // Fallback: use placeholder if nothing provided
  if (!faceUrls.length) {
    faceUrls = [PLACEHOLDER_FACE]
  }
}

export function resetFaceCelebration(): void {
  nextTriggerHouse = FACE_TRIGGER_HOUSE
  nextTriggerPoster = FACE_TRIGGER_POSTER
  if (faceLayer) faceLayer.innerHTML = ''
}

export function handleFaceCelebration(counts: ActivityCounts): void {
  if (!faceLayer) return
  const { isPlaying, cemMode } = getState()
  if (!cemMode || !isPlaying) return

  let triggered = false

  if (counts.HOUSE >= nextTriggerHouse) {
    triggered = true
    nextTriggerHouse += FACE_TRIGGER_HOUSE
  }

  if (counts.POSTER >= nextTriggerPoster) {
    triggered = true
    nextTriggerPoster += FACE_TRIGGER_POSTER
  }

  if (triggered) {
    spawnFace()
  }
}

function spawnFace(): void {
  if (!faceLayer) return

  trimExcessFaces()

  const face = document.createElement('div')
  face.className = 'face-sprite'

  const left = 20 + Math.random() * 60
  const drift = (Math.random() * 30 - 15).toFixed(1)
  const duration = 1.5 + Math.random() * 0.5

  face.style.left = `${left}%`
  face.style.setProperty('--face-drift', `${drift}%`)
  face.style.setProperty('--face-duration', `${duration}s`)

  const faceUrl = getNextFaceUrl()
  if (faceUrl) face.style.setProperty('--face-image', `url("${faceUrl}")`)

  face.addEventListener('animationend', () => face.remove())
  faceLayer.appendChild(face)
}

function getNextFaceUrl(): string | undefined {
  if (!faceUrls.length) return faceLayer?.dataset.facePlaceholder

  const url = faceUrls[nextFaceIndex % faceUrls.length]
  nextFaceIndex = (nextFaceIndex + 1) % faceUrls.length
  return url
}

function trimExcessFaces(): void {
  if (!faceLayer) return
  const excess = faceLayer.children.length - FACE_MAX_ACTIVE
  for (let i = 0; i < excess; i++) {
    faceLayer.firstElementChild?.remove()
  }
}

function normalizeUrl(base: string, url: string): string {
  // Already absolute or data URL - return as-is
  if (url.startsWith('http') || url.startsWith('data:')) return url
  // Already includes base path (from import.meta.glob) - return as-is
  if (base !== '/' && url.startsWith(base)) return url
  const cleanedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const cleanedUrl = url.startsWith('/') ? url.slice(1) : url
  return `${cleanedBase}/${cleanedUrl}`
}
