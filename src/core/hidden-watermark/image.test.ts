import { describe, expect, it } from 'vitest'
import { detectHiddenWatermark, embedHiddenWatermark } from './image'
import { LEGACY_PROTOCOL_VERSION } from './payload'

function solidBuffer(width: number, height: number, value = 128) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < data.length; index += 4) {
    data[index] = value
    data[index + 1] = value
    data[index + 2] = value
    data[index + 3] = 255
  }
  return { width, height, data }
}

function scaleBuffer(
  source: { width: number; height: number; data: Uint8ClampedArray },
  scale: number,
) {
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor(x / scale))
      const sy = Math.min(source.height - 1, Math.floor(y / scale))
      const from = (sy * source.width + sx) * 4
      const to = (y * width + x) * 4
      data[to] = source.data[from]
      data[to + 1] = source.data[from + 1]
      data[to + 2] = source.data[from + 2]
      data[to + 3] = 255
    }
  }
  return { width, height, data }
}

function cropEdges(
  source: { width: number; height: number; data: Uint8ClampedArray },
  ratio: number,
) {
  const cutX = Math.floor(source.width * ratio)
  const cutY = Math.floor(source.height * ratio)
  const width = source.width - cutX * 2
  const height = source.height - cutY * 2
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = ((y + cutY) * source.width + (x + cutX)) * 4
      const to = (y * width + x) * 4
      data.set(source.data.subarray(from, from + 4), to)
    }
  }
  return { width, height, data }
}

describe('hidden watermark robustness', () => {
  it('detects a fresh v2 embed', () => {
    const buffer = solidBuffer(340, 340)
    embedHiddenWatermark(buffer, 'owner-v2', 7)
    const result = detectHiddenWatermark(buffer)
    expect(result.found).toBe(true)
    expect(result.payload).toBe('owner-v2')
    expect(result.integrity).toBe('valid')
  })

  it('still detects legacy v1 embeds', () => {
    const buffer = solidBuffer(340, 340)
    embedHiddenWatermark(buffer, 'owner-v1', 6, LEGACY_PROTOCOL_VERSION)
    const result = detectHiddenWatermark(buffer)
    expect(result.found).toBe(true)
    expect(result.payload).toBe('owner-v1')
  })

  it('survives ~80% scale', () => {
    const buffer = solidBuffer(420, 420)
    embedHiddenWatermark(buffer, 'scale-owner', 7)
    const scaled = scaleBuffer(buffer, 0.8)
    const result = detectHiddenWatermark(scaled)
    expect(result.found).toBe(true)
    expect(result.payload).toBe('scale-owner')
  })

  it('survives ~10% edge crop', () => {
    const buffer = solidBuffer(420, 420)
    embedHiddenWatermark(buffer, 'crop-owner', 7)
    const cropped = cropEdges(buffer, 0.1)
    const result = detectHiddenWatermark(cropped)
    expect(result.found).toBe(true)
    expect(result.payload).toBe('crop-owner')
  })
})
