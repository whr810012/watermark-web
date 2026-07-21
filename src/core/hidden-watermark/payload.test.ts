import { describe, expect, it } from 'vitest'
import {
  bytesToRepeatedBits,
  crc32,
  packHiddenPayload,
  repeatedSignalsToBytes,
  unpackHiddenPayload,
} from './payload'

describe('DDWM payload', () => {
  it('encodes and validates a payload', () => {
    const timestamp = Date.UTC(2026, 6, 21, 8, 0, 0)
    const packed = packHiddenPayload('creator-0721', timestamp)
    const decoded = unpackHiddenPayload(packed)

    expect(decoded?.payload).toBe('creator-0721')
    expect(decoded?.embeddedAt.toISOString()).toBe('2026-07-21T08:00:00.000Z')
    expect(decoded?.integrity).toBe(true)
  })

  it('rejects corrupted content through CRC', () => {
    const packed = packHiddenPayload('protected')
    packed[10] ^= 0xff
    expect(unpackHiddenPayload(packed)?.integrity).toBe(false)
  })

  it('recovers one bad signal from every repeated triple', () => {
    const packed = packHiddenPayload('redundant')
    const bits = bytesToRepeatedBits(packed)
    for (let index = 0; index < bits.length; index += 3) bits[index] = bits[index] ? 0 : 1
    const decoded = repeatedSignalsToBytes(bits.map((bit) => (bit ? 1 : -1)))

    expect(unpackHiddenPayload(decoded.bytes)?.payload).toBe('redundant')
    expect(decoded.confidence).toBeCloseTo(2 / 3)
  })

  it('uses a stable CRC-32 implementation', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})
