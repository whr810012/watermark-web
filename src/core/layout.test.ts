import { describe, expect, it } from 'vitest'
import { buildWatermarkLayout, singlePosition } from './layout'

describe('visible watermark layout', () => {
  it('places a single mark with a safe margin', () => {
    expect(singlePosition(1000, 600, 180, 60, 'bottom-right', 24)).toEqual({
      x: 796,
      y: 516,
    })
  })

  it('builds enough staggered tile marks to cover the canvas', () => {
    const marks = buildWatermarkLayout({
      canvasWidth: 800,
      canvasHeight: 500,
      markWidth: 120,
      markHeight: 40,
      placement: 'tile',
      position: 'center',
      gap: 80,
      rotation: -18,
    })

    expect(marks.length).toBeGreaterThan(20)
    expect(marks.every((mark) => mark.rotation === -18)).toBe(true)
    expect(new Set(marks.map((mark) => mark.x)).size).toBeGreaterThan(4)
  })
})
