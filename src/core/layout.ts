import type { PlacementMode, WatermarkPosition } from './types'

export type WatermarkMark = {
  x: number
  y: number
  rotation: number
}

export function singlePosition(
  width: number,
  height: number,
  markWidth: number,
  markHeight: number,
  position: WatermarkPosition,
  margin = 24,
) {
  const positions: Record<WatermarkPosition, { x: number; y: number }> = {
    'top-left': { x: margin, y: margin },
    'top-right': { x: width - markWidth - margin, y: margin },
    center: { x: (width - markWidth) / 2, y: (height - markHeight) / 2 },
    'bottom-left': { x: margin, y: height - markHeight - margin },
    'bottom-right': { x: width - markWidth - margin, y: height - markHeight - margin },
  }
  const result = positions[position]
  return {
    x: Math.max(0, result.x),
    y: Math.max(0, result.y),
  }
}

export function buildWatermarkLayout(options: {
  canvasWidth: number
  canvasHeight: number
  markWidth: number
  markHeight: number
  placement: PlacementMode
  position: WatermarkPosition
  gap: number
  rotation: number
}) {
  if (options.placement === 'single') {
    const point = singlePosition(
      options.canvasWidth,
      options.canvasHeight,
      options.markWidth,
      options.markHeight,
      options.position,
    )
    return [{ ...point, rotation: options.rotation }]
  }

  const marks: WatermarkMark[] = []
  const cellWidth = Math.max(options.markWidth + options.gap, 64)
  const cellHeight = Math.max(options.markHeight + options.gap, 64)
  for (let row = -1; row * cellHeight < options.canvasHeight + cellHeight; row += 1) {
    const offset = row % 2 === 0 ? 0 : cellWidth / 2
    for (let column = -1; column * cellWidth < options.canvasWidth + cellWidth; column += 1) {
      marks.push({
        x: column * cellWidth + offset,
        y: row * cellHeight,
        rotation: options.rotation,
      })
    }
  }
  return marks
}
