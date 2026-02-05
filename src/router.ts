import { DEFAULT_REGION, isValidRegion, type RegionId } from './regions'

export function getCurrentRegionFromHash(): RegionId {
  const hash = window.location.hash
  const match = hash.match(/^#\/(.+)$/)
  if (match && isValidRegion(match[1])) {
    return match[1]
  }
  return DEFAULT_REGION
}

export function navigateToRegion(regionId: string): void {
  if (isValidRegion(regionId)) {
    window.location.hash = `/${regionId}`
  }
}

let hashChangeHandler: (() => void) | null = null

export function onRegionChange(callback: (regionId: RegionId) => void): void {
  // Remove previous listener to prevent duplicates
  if (hashChangeHandler) {
    window.removeEventListener('hashchange', hashChangeHandler)
  }
  hashChangeHandler = () => callback(getCurrentRegionFromHash())
  window.addEventListener('hashchange', hashChangeHandler)
}
