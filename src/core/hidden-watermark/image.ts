import type { DetectionResult } from '../types'
import {
  PROTOCOL_VERSION,
  bitRepeatCount,
  bytesToRepeatedBits,
  embeddablePayloadBytes,
  packHiddenPayload,
  repeatedSignalsToBytes,
  unpackHiddenPayload,
  utf8ByteLength,
} from './payload'

export const HIDDEN_GRID_SIZE = 34
export const HIDDEN_GRID_CELLS = HIDDEN_GRID_SIZE * HIDDEN_GRID_SIZE
const V2_EMBED_MARGIN = 0.1
const V2_DETECT_MARGINS = [0.1, 0.05, 0, 0.15, 0.08]
/** v2 含 10% 边距时，可用区至少 102px → 整图至少约 128px */
export const MIN_HIDDEN_SIDE = Math.ceil((HIDDEN_GRID_SIZE * 3) / (1 - 2 * V2_EMBED_MARGIN))

export type PixelBuffer = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export function hiddenPayloadLimit(version = PROTOCOL_VERSION) {
  return embeddablePayloadBytes(HIDDEN_GRID_CELLS, version)
}

function luminance(data: Uint8ClampedArray, offset: number) {
  return data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114
}

/** 只用蓝通道承载信号：人眼对蓝最不敏感，纯色底上几乎看不出网纹/竖纹 */
function blueChannel(data: Uint8ClampedArray, offset: number) {
  return data[offset + 2]
}

function addBlueDelta(data: Uint8ClampedArray, offset: number, delta: number) {
  data[offset + 2] = Math.max(0, Math.min(255, data[offset + 2] + delta))
}

/** 稀疏取样，避免左右半格实心涂色形成可见竖条 */
function shouldTouchPixel(x: number, y: number) {
  return (Math.imul(x + 3, 374761) ^ Math.imul(y + 5, 668265)) % 3 === 0
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
  // 可用区不得超过画布，避免写出边界污染相邻行
  const usableW = Math.max(HIDDEN_GRID_SIZE, width - marginX * 2)
  const usableH = Math.max(HIDDEN_GRID_SIZE, height - marginY * 2)
  const left = marginX + Math.floor((column * usableW) / HIDDEN_GRID_SIZE)
  const right = marginX + Math.floor(((column + 1) * usableW) / HIDDEN_GRID_SIZE)
  const top = marginY + Math.floor((row * usableH) / HIDDEN_GRID_SIZE)
  const bottom = marginY + Math.floor(((row + 1) * usableH) / HIDDEN_GRID_SIZE)
  return {
    left: Math.max(0, Math.min(width, left)),
    right: Math.max(0, Math.min(width, right)),
    top: Math.max(0, Math.min(height, top)),
    bottom: Math.max(0, Math.min(height, bottom)),
  }
}

/** 强度只影响是否用 2 档 LSB；默认 ±1，肉眼在 8bit 图上几乎不可见 */
function embedAmount(strength: number) {
  return strength >= 9 ? 2 : 1
}

/** 载荷比特往往填不满 34×34：用确定性填充铺满网格，避免只在上半区留下一团纹理 */
function padBitsToGrid(bits: number[]) {
  if (bits.length >= HIDDEN_GRID_CELLS) return bits.slice(0, HIDDEN_GRID_CELLS)
  const padded = bits.slice()
  let state = (bits.length + 1) * 2654435761
  while (padded.length < HIDDEN_GRID_CELLS) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    padded.push(state & 1)
  }
  return padded
}

/**
 * 边距区写入同等幅度、无左右结构的蓝色底噪，避免「中间有块、四周干净」。
 */
function applyMarginGrain(buffer: PixelBuffer, margin: number, amount: number) {
  if (margin <= 0 || amount <= 0) return
  const marginX = Math.floor(buffer.width * margin)
  const marginY = Math.floor(buffer.height * margin)
  const right = buffer.width - marginX
  const bottom = buffer.height - marginY
  for (let y = 0; y < buffer.height; y += 1) {
    for (let x = 0; x < buffer.width; x += 1) {
      if (x >= marginX && x < right && y >= marginY && y < bottom) continue
      if (!shouldTouchPixel(x, y)) continue
      const sign = ((Math.imul(x + 1, 374761) ^ Math.imul(y + 1, 668265)) & 1) === 0 ? 1 : -1
      addBlueDelta(buffer.data, (y * buffer.width + x) * 4, sign * amount)
    }
  }
}

function applyBitPattern(
  buffer: PixelBuffer,
  bits: number[],
  strength: number,
  margin: number,
  mode: 'embed' | 'pattern',
) {
  const amount = embedAmount(strength)
  // PDF/视频：极低透明蓝色点，避免灰白棋盘马赛克
  const alpha = Math.round(Math.max(2, Math.min(5, 1 + strength * 0.35)))
  const target = mode === 'pattern' ? new Uint8ClampedArray(buffer.width * buffer.height * 4) : buffer.data
  const gridBits = padBitsToGrid(bits)

  for (let index = 0; index < gridBits.length; index += 1) {
    const bounds = cellBounds(index, buffer.width, buffer.height, margin)
    if (bounds.right - bounds.left < 2 || bounds.bottom - bounds.top < 1) continue
    const midpoint = Math.floor((bounds.left + bounds.right) / 2)
    const direction = gridBits[index] ? 1 : -1
    for (let y = bounds.top; y < bounds.bottom; y += 1) {
      for (let x = bounds.left; x < bounds.right; x += 1) {
        if (!shouldTouchPixel(x, y)) continue
        const side = x < midpoint ? 1 : -1
        const offset = (y * buffer.width + x) * 4
        if (mode === 'pattern') {
          const light = direction * side > 0
          target[offset] = 0
          target[offset + 1] = 0
          target[offset + 2] = light ? 255 : 0
          target[offset + 3] = alpha
        } else {
          addBlueDelta(target, offset, direction * side * amount)
        }
      }
    }
  }

  if (mode === 'embed') {
    applyMarginGrain(buffer, margin, amount)
  } else {
    const marginX = Math.floor(buffer.width * margin)
    const marginY = Math.floor(buffer.height * margin)
    const right = buffer.width - marginX
    const bottom = buffer.height - marginY
    for (let y = 0; y < buffer.height; y += 1) {
      for (let x = 0; x < buffer.width; x += 1) {
        if (x >= marginX && x < right && y >= marginY && y < bottom) continue
        if (!shouldTouchPixel(x, y)) continue
        const offset = (y * buffer.width + x) * 4
        const light = ((Math.imul(x + 1, 374761) ^ Math.imul(y + 1, 668265)) & 1) === 0
        target[offset] = 0
        target[offset + 1] = 0
        target[offset + 2] = light ? 255 : 0
        target[offset + 3] = alpha
      }
    }
  }
  return target
}

function assertEmbeddable(payload: string, width: number, height: number, version: number) {
  if (width < MIN_HIDDEN_SIDE || height < MIN_HIDDEN_SIDE) {
    throw new Error(`隐藏水印要求画面宽高至少为 ${MIN_HIDDEN_SIDE} 像素`)
  }
  const limit = hiddenPayloadLimit(version)
  const bytes = utf8ByteLength(payload)
  if (bytes > limit) {
    throw new Error(
      `隐藏标识过长（UTF-8 ${bytes} 字节），当前协议最多 ${limit} 字节（约 ${Math.floor(limit / 3)} 个汉字或 ${limit} 个英文）`,
    )
  }
}

export function embedHiddenWatermark(
  buffer: PixelBuffer,
  payload: string,
  strength = 7,
  version = PROTOCOL_VERSION,
) {
  assertEmbeddable(payload, buffer.width, buffer.height, version)
  const bits = bytesToRepeatedBits(
    packHiddenPayload(payload, Date.now(), version, hiddenPayloadLimit(version)),
    version,
  )
  if (bits.length > HIDDEN_GRID_CELLS) {
    throw new Error('隐藏水印载荷过长')
  }
  const margin = version >= 2 ? V2_EMBED_MARGIN : 0
  applyBitPattern(buffer, bits, strength, margin, 'embed')
  return buffer
}

export function createHiddenPattern(width: number, height: number, payload: string, strength = 7) {
  const version = PROTOCOL_VERSION
  assertEmbeddable(payload, width, height, version)
  const bits = bytesToRepeatedBits(
    packHiddenPayload(payload, Date.now(), version, hiddenPayloadLimit(version)),
    version,
  )
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
  sample: (data: Uint8ClampedArray, offset: number) => number,
) {
  const repeats = bitRepeatCount(version)
  const signals: number[] = []
  for (let index = 0; index < HIDDEN_GRID_CELLS; index += 1) {
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
        const value = sample(buffer.data, offset)
        if (x < midpoint) {
          left += value
          leftCount += 1
        } else {
          right += value
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
  // 先蓝通道（新嵌入），再亮度（兼容旧版 RGB 同改）
  const sampleFns = [blueChannel, luminance]
  const candidates = sampleFns.flatMap((sample) =>
    layouts.flatMap(({ version, margin }) =>
      orientations.map(({ flipX, flipY }) =>
        decodeOrientation(buffer, version, margin, flipX, flipY, sample),
      ),
    ),
  )
  // 优先完整性通过的候选，避免噪声方向抢先匹配到 damaged
  const match =
    candidates.find((candidate) => candidate.unpacked?.integrity) ??
    candidates.find((candidate) => candidate.unpacked)
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
