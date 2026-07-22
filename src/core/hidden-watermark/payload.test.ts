import { describe, expect, it } from 'vitest'
import {
  LEGACY_PROTOCOL_VERSION,
  PROTOCOL_VERSION,
  bitRepeatCount,
  bytesToRepeatedBits,
  crc32,
  packHiddenPayload,
  repeatedSignalsToBytes,
  unpackHiddenPayload,
} from './payload'

describe('DDWM payload', () => {
  it('encodes and validates a v2 payload', () => {
    const timestamp = Date.UTC(2026, 6, 21, 8, 0, 0)
    const packed = packHiddenPayload('creator-0721', timestamp)
    const decoded = unpackHiddenPayload(packed)

    expect(packed[4]).toBe(PROTOCOL_VERSION)
    expect(decoded?.payload).toBe('creator-0721')
    expect(decoded?.version).toBe(PROTOCOL_VERSION)
    expect(decoded?.embeddedAt.toISOString()).toBe('2026-07-21T08:00:00.000Z')
    expect(decoded?.integrity).toBe(true)
  })

  it('still unpacks legacy v1 payloads', () => {
    const packed = packHiddenPayload('legacy-owner', Date.UTC(2026, 0, 1), LEGACY_PROTOCOL_VERSION)
    const decoded = unpackHiddenPayload(packed)
    expect(decoded?.version).toBe(1)
    expect(decoded?.payload).toBe('legacy-owner')
  })

  it('rejects corrupted content through CRC', () => {
    const packed = packHiddenPayload('protected')
    packed[10] ^= 0xff
    expect(unpackHiddenPayload(packed)?.integrity).toBe(false)
  })

  it('recovers one bad signal from every repeated group', () => {
    const packed = packHiddenPayload('redundant')
    const repeats = bitRepeatCount(PROTOCOL_VERSION)
    const bits = bytesToRepeatedBits(packed, PROTOCOL_VERSION)
    for (let index = 0; index < bits.length; index += repeats) bits[index] = bits[index] ? 0 : 1
    const decoded = repeatedSignalsToBytes(
      bits.map((bit) => (bit ? 1 : -1)),
      repeats,
    )

    expect(unpackHiddenPayload(decoded.bytes)?.payload).toBe('redundant')
    expect(decoded.confidence).toBeCloseTo((repeats - 1) / repeats)
  })

  it('uses a stable CRC-32 implementation', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})
