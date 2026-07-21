import { buildWatermarkLayout } from './layout'
import type { WatermarkOptions } from './types'

type RenderContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export async function loadBitmap(file: Blob) {
  return createImageBitmap(file)
}

export function drawVisibleWatermark(
  context: RenderContext,
  canvasWidth: number,
  canvasHeight: number,
  options: WatermarkOptions,
  logo: ImageBitmap | null,
) {
  const baseSize = Math.max(18, Math.round(Math.min(canvasWidth, canvasHeight) * options.scale))
  let markWidth = baseSize * 4
  let markHeight = baseSize * 1.2

  context.save()
  context.font = `700 ${baseSize}px "Aptos Display", "Noto Sans SC", sans-serif`
  context.textBaseline = 'middle'
  context.textAlign = 'center'
  if (options.mode === 'text') {
    markWidth = Math.max(baseSize * 2, context.measureText(options.text || 'DANDAN HUB').width + 28)
  } else if (logo) {
    const ratio = logo.width / Math.max(1, logo.height)
    markHeight = baseSize * 1.4
    markWidth = markHeight * ratio
  }

  const marks = buildWatermarkLayout({
    canvasWidth,
    canvasHeight,
    markWidth,
    markHeight,
    placement: options.placement,
    position: options.position,
    gap: options.gap,
    rotation: options.rotation,
  })

  context.globalAlpha = options.opacity
  context.fillStyle = options.color
  context.strokeStyle = options.color === '#ffffff' ? 'rgba(15, 23, 42, .35)' : 'rgba(255,255,255,.4)'
  context.lineWidth = Math.max(1, baseSize / 18)

  for (const mark of marks) {
    context.save()
    context.translate(mark.x + markWidth / 2, mark.y + markHeight / 2)
    context.rotate((mark.rotation * Math.PI) / 180)
    if (options.mode === 'logo' && logo) {
      context.drawImage(logo, -markWidth / 2, -markHeight / 2, markWidth, markHeight)
    } else {
      const text = options.text.trim() || 'DANDAN HUB'
      context.strokeText(text, 0, 0)
      context.fillText(text, 0, 0)
    }
    context.restore()
  }
  context.restore()
}
