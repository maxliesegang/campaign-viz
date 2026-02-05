/** Convert hex color to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  const value = parseInt(hex.replace('#', ''), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
