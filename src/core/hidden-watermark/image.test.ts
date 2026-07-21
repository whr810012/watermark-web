import { describe, expect, it } from 'vitest'
import { detectHiddenWatermark, embedHiddenWatermark, type PixelBuffer } from './image'

function flatBuffer(width: number, height: number, value = 128): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < data.length; index += 4) {
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
    data[index + 3] = 255
  }
  return { width, height, data }
}

function resizeNearest(source: PixelBuffer, width: number, height: number): PixelBuffer {
  const target = flatBuffer(width, height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x / width) * source.width))
      const sourceY = Math.min(source.height - 1, Math.floor((y / height) * source.height))
      const sourceOffset = (sourceY * source.width + sourceX) * 4
      const targetOffset = (y * width + x) * 4
      target.data.set(source.data.slice(sourceOffset, sourceOffset + 4), targetOffset)
    }
  }
  return target
}

describe('hidden image watermark', () => {
  it('completes the image embed and detection loop', () => {
    const buffer = flatBuffer(680, 680)
    embedHiddenWatermark(buffer, 'image-owner', 7)
    const result = detectHiddenWatermark(buffer)

    expect(result.found).toBe(true)
    expect(result.payload).toBe('image-owner')
    expect(result.integrity).toBe('valid')
  })

  it('survives proportional resizing', () => {
    const original = flatBuffer(680, 510)
    embedHiddenWatermark(original, 'resized-copy', 8)
    const resized = resizeNearest(original, 476, 357)
    const result = detectHiddenWatermark(resized)

    expect(result.found).toBe(true)
    expect(result.payload).toBe('resized-copy')
  })

  it('does not claim a watermark on an unmarked image', () => {
    const result = detectHiddenWatermark(flatBuffer(340, 340))
    expect(result.found).toBe(false)
  })
})
