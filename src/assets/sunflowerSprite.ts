import { SUNFLOWER_PATH } from './sunflower'

const SPRITE_SIZE = 64 // Render at 64px for crisp scaling
const VIEWBOX_SIZE = 512 // Original SVG viewBox size

type SpriteVariant = 'recent' | 'cumulative'

interface SpriteConfig {
  fill: string
  stroke: string
  strokeWidth: number
}

const SPRITE_CONFIGS: Record<SpriteVariant, SpriteConfig> = {
  recent: {
    fill: '#e6fd53', // limette
    stroke: '#4f6a5f', // wald
    strokeWidth: 14,
  },
  cumulative: {
    fill: '#4f6a5f', // wald (muted)
    stroke: '#4f6a5f',
    strokeWidth: 14,
  },
}

// Cache for rendered sprites
const spriteCache = new Map<SpriteVariant, string>()

function renderSpriteToCanvas(variant: SpriteVariant): string {
  const config = SPRITE_CONFIGS[variant]
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_SIZE
  canvas.height = SPRITE_SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Scale from viewBox coordinates to canvas size
  const scale = SPRITE_SIZE / VIEWBOX_SIZE
  ctx.scale(scale, scale)

  // Create path from SVG path data
  const path = new Path2D(SUNFLOWER_PATH)

  // Draw stroke first (behind fill)
  ctx.strokeStyle = config.stroke
  ctx.lineWidth = config.strokeWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke(path)

  // Draw fill
  ctx.fillStyle = config.fill
  ctx.fill(path, 'evenodd')

  return canvas.toDataURL('image/png')
}

export function getSunflowerSprite(variant: SpriteVariant): string {
  let sprite = spriteCache.get(variant)
  if (!sprite) {
    sprite = renderSpriteToCanvas(variant)
    spriteCache.set(variant, sprite)
  }
  return sprite
}

// Pre-render both variants on module load
export function initSunflowerSprites(): void {
  getSunflowerSprite('recent')
  getSunflowerSprite('cumulative')
}
