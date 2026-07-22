import type { DetectionResult } from '../types'
import {
  PROTOCOL_VERSION,
  bitRepeatCount,
  bytesToRepeatedBits,
  packHiddenPayload,
  repeatedSignalsToBytes,
  unpackHiddenPayload,
} from './payload'

export const HIDDEN_GRID_SIZE = 34
const V2_EMBED_MARGIN = 0.1
const V2_DETECT_MARGINS = [0.1, 0.05, 0, 0.15, 0.08]

export type PixelBuffer = {
  width: number
  height: number
  data: Uint8ClampedArray
}

function luminance(data: Uint8ClampedArray, offset: number) {
  return data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114
}

function cellBounds(index: number, width: number, height: number, margin: number) {
  const column = index % HIDDEN_GRID_SIZE
  const row = Math.floor(index / HIDDEN_GRID_SIZE)
  if (margin <= 0) {
    return {
      left: Math.floor((column * width) / HIDDEN_GRID_SIZE),
      right: Math.floor(((column + 1) * width) / HIDDEN_GRID_SIZE),
      top: Math.floor((row * height) / HIDDEN_GRID_SIZE),
      bottom: Math.floor(((row + 1) * height) / HIDDEN_GRID_SIZE),
    }
  }
  const marginX = Math.floor(width * margin)
  const marginY = Math.floor(height * margin)
  const usableW = Math.max(HIDDEN_GRID_SIZE * 3, width - marginX * 2)
  const usableH = Math.max(HIDDEN_GRID_SIZE * 3, height - marginY * 2)
  return {
    left: marginX + Math.floor((column * usableW) / HIDDEN_GRID_SIZE),
    right: marginX + Math.floor(((column + 1) * usableW) / HIDDEN_GRID_SIZE),
    top: marginY + Math.floor((row * usableH) / HIDDEN_GRID_SIZE),
    bottom: marginY + Math.floor(((row + 1) * usableH) / HIDDEN_GRID_SIZE),
  }
}

function applyBitPattern(
  buffer: PixelBuffer,
  bits: number[],
  strength: number,
  margin: number,
  mode: 'embed' | 'pattern',
) {
  const amount = Math.max(2, Math.min(12, strength))
  const alpha = Math.round(Math.max(10, Math.min(28, strength * 3)))
  const target = mode === 'pattern' ? new Uint8ClampedArray(buffer.width * buffer.height * 4) : buffer.data

  for (let index = 0; index < bits.length; index += 1) {
    const bounds = cellBounds(index, buffer.width, buffer.height, margin)
    const midpoint = Math.floor((bounds.left + bounds.right) / 2)
    const direction = bits[index] ? 1 : -1
    for (let y = bounds.top; y < bounds.bottom; y += 1) {
      for (let x = bounds.left; x < bounds.right; x += 1) {
        const side = x < midpoint ? 1 : -1
        const offset = (y * buffer.width + x) * 4
        if (mode === 'pattern') {
          const light = direction * side > 0
          target[offset] = light ? 255 : 0
          target[offset + 1] = light ? 255 : 0
          target[offset + 2] = light ? 255 : 0
          target[offset + 3] = alpha
        } else {
          const delta = direction * side * amount
          target[offset] = Math.max(0, Math.min(255, target[offset] + delta))
          target[offset + 1] = Math.max(0, Math.min(255, target[offset + 1] + delta))
          target[offset + 2] = Math.max(0, Math.min(255, target[offset + 2] + delta))
        }
      }
    }
  }
  return target
}

export function embedHiddenWatermark(
  buffer: PixelBuffer,
  payload: string,
  strength = 7,
  version = PROTOCOL_VERSION,
) {
  const bits = bytesToRepeatedBits(packHiddenPayload(payload, Date.now(), version), version)
  if (buffer.width < HIDDEN_GRID_SIZE * 3 || buffer.height < HIDDEN_GRID_SIZE * 3) {
    throw new Error('隐藏水印要求画面宽高至少为 102 像素')
  }
  if (bits.length > HIDDEN_GRID_SIZE * HIDDEN_GRID_SIZE) {
    throw new Error('隐藏水印载荷过长')
  }
  const margin = version >= 2 ? V2_EMBED_MARGIN : 0
  applyBitPattern(buffer, bits, strength, margin, 'embed')
  return buffer
}

export function createHiddenPattern(width: number, height: number, payload: string, strength = 7) {
  const version = PROTOCOL_VERSION
  const bits = bytesToRepeatedBits(packHiddenPayload(payload, Date.now(), version), version)
  const data = applyBitPattern(
    { width, height, data: new Uint8ClampedArray(width * height * 4) },
    bits,
    strength,
    V2_EMBED_MARGIN,
    'pattern',
  )
  return { width, height, data }
}

function decodeOrientation(
  buffer: PixelBuffer,
  version: number,
  margin: number,
  flipX: boolean,
  flipY: boolean,
) {
  const repeats = bitRepeatCount(version)
  const signals: number[] = []
  for (let index = 0; index < HIDDEN_GRID_SIZE * HIDDEN_GRID_SIZE; index += 1) {
    const logicalColumn = index % HIDDEN_GRID_SIZE
    const logicalRow = Math.floor(index / HIDDEN_GRID_SIZE)
    const physicalColumn = flipX ? HIDDEN_GRID_SIZE - logicalColumn - 1 : logicalColumn
    const physicalRow = flipY ? HIDDEN_GRID_SIZE - logicalRow - 1 : logicalRow
    const physicalIndex = physicalRow * HIDDEN_GRID_SIZE + physicalColumn
    const bounds = cellBounds(physicalIndex, buffer.width, buffer.height, margin)
    const midpoint = Math.floor((bounds.left + bounds.right) / 2)
    let left = 0
    let right = 0
    let leftCount = 0
    let rightCount = 0
    for (let y = bounds.top; y < bounds.bottom; y += 1) {
      for (let x = bounds.left; x < bounds.right; x += 1) {
        const offset = (y * buffer.width + x) * 4
        if (x < midpoint) {
          left += luminance(buffer.data, offset)
          leftCount += 1
        } else {
          right += luminance(buffer.data, offset)
          rightCount += 1
        }
      }
    }
    const signal = left / Math.max(1, leftCount) - right / Math.max(1, rightCount)
    signals.push(flipX ? -signal : signal)
  }
  const decoded = repeatedSignalsToBytes(signals, repeats)
  return { decoded, unpacked: unpackHiddenPayload(decoded.bytes) }
}

export function detectHiddenWatermark(buffer: PixelBuffer): DetectionResult {
  if (buffer.width < HIDDEN_GRID_SIZE * 3 || buffer.height < HIDDEN_GRID_SIZE * 3) {
    return {
      found: false,
      confidence: 0,
      payload: null,
      embeddedAt: null,
      integrity: 'unknown',
      samples: 1,
      message: '画面尺寸过小，无法可靠检测隐藏水印',
    }
  }

  const orientations = [
    { flipX: false, flipY: false },
    { flipX: false, flipY: true },
    { flipX: true, flipY: false },
    { flipX: true, flipY: true },
  ]
  const layouts = [
    ...V2_DETECT_MARGINS.map((margin) => ({ version: 2, margin })),
    { version: 1, margin: 0 },
  ]
  const candidates = layouts.flatMap(({ version, margin }) =>
    orientations.map(({ flipX, flipY }) => decodeOrientation(buffer, version, margin, flipX, flipY)),
  )
  const match = candidates.find((candidate) => candidate.unpacked)
  const bestConfidence = Math.max(...candidates.map((candidate) => candidate.decoded.confidence))
  if (!match?.unpacked) {
    return {
      found: false,
      confidence: bestConfidence * 0.35,
      payload: null,
      embeddedAt: null,
      integrity: 'unknown',
      samples: 1,
      message: '未检出本工具生成的隐藏水印',
    }
  }

  const { decoded, unpacked } = match
  return {
    found: true,
    confidence: unpacked.integrity ? Math.max(0.72, decoded.confidence) : decoded.confidence * 0.65,
    payload: unpacked.payload,
    embeddedAt: unpacked.embeddedAt,
    integrity: unpacked.integrity ? 'valid' : 'damaged',
    samples: 1,
    message: unpacked.integrity
      ? `检测到有效隐藏水印（DDWM v${unpacked.version}）`
      : '检测到疑似水印，但完整性校验未通过',
  }
}
