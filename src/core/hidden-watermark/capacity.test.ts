import { describe, expect, it } from 'vitest'
import {
  MIN_HIDDEN_SIDE,
  detectHiddenWatermark,
  embedHiddenWatermark,
  hiddenPayloadLimit,
} from './image'
import { PROTOCOL_VERSION, utf8ByteLength } from './payload'

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

describe('hidden watermark capacity', () => {
  it('limits v2 payload to grid capacity (~14 bytes)', () => {
    expect(hiddenPayloadLimit(PROTOCOL_VERSION)).toBe(14)
  })

  it('rejects oversized utf-8 payloads before embedding', () => {
    const buffer = solidBuffer(340, 340)
    const payload = '这是一段明显超过容量的中文隐藏标识'
    expect(utf8ByteLength(payload)).toBeGreaterThan(hiddenPayloadLimit())
    expect(() => embedHiddenWatermark(buffer, payload)).toThrow(/过长/)
  })

  it('embeds and detects a payload at the byte limit', () => {
    const buffer = solidBuffer(340, 340)
    const payload = 'a'.repeat(hiddenPayloadLimit())
    embedHiddenWatermark(buffer, payload, 7)
    const result = detectHiddenWatermark(buffer)
    expect(result.found).toBe(true)
    expect(result.payload).toBe(payload)
    expect(result.integrity).toBe('valid')
  })

  it('rejects canvases smaller than the v2 safe minimum', () => {
    const buffer = solidBuffer(102, 102)
    expect(() => embedHiddenWatermark(buffer, 'x')).toThrow(String(MIN_HIDDEN_SIDE))
  })
})
