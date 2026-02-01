/**
 * Type-safe DOM query utilities
 */

export function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) {
    throw new Error(`Element with id "${id}" not found`)
  }
  return element as T
}

export function queryElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Element matching "${selector}" not found`)
  }
  return element
}

export function showElement(element: HTMLElement): void {
  element.classList.remove('hidden')
}

export function hideElement(element: HTMLElement): void {
  element.classList.add('hidden')
}
