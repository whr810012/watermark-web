export const MAGIC = new Uint8Array([0x44, 0x44, 0x57, 0x4d])
export const PROTOCOL_VERSION = 2
export const LEGACY_PROTOCOL_VERSION = 1
/** 协议字段允许的最大载荷字节数（与网格容量无关） */
export const MAX_HIDDEN_PAYLOAD_BYTES = 32
/** 固定头：magic4 + ver1 + ts4 + len1 = 10，尾 CRC = 4 */
export const PACKED_OVERHEAD_BYTES = 14

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint32(offset, value >>> 0, false)
}

function readUint32(source: Uint8Array, offset: number) {
  return new DataView(source.buffer, source.byteOffset, source.byteLength).getUint32(offset, false)
}

export function bitRepeatCount(version: number) {
  return version >= 2 ? 5 : 3
}

/** 按 UTF-8 字符边界截断，避免切开多字节字符 */
export function truncateUtf8Bytes(text: string, maxBytes: number) {
  const encoded = new TextEncoder().encode(text.trim())
  if (encoded.length <= maxBytes) return encoded
  let end = maxBytes
  while (end > 0 && (encoded[end] & 0xc0) === 0x80) end -= 1
  return encoded.slice(0, end)
}

export function utf8ByteLength(text: string) {
  return new TextEncoder().encode(text.trim()).length
}

/**
 * 当前网格在指定协议版本下可嵌入的最大载荷字节数。
 * v2（5 倍重复）约 14 字节；v1（3 倍）可达协议上限 32。
 */
export function embeddablePayloadBytes(gridCells: number, version = PROTOCOL_VERSION) {
  const maxPacked = Math.floor(gridCells / bitRepeatCount(version) / 8)
  return Math.max(0, Math.min(MAX_HIDDEN_PAYLOAD_BYTES, maxPacked - PACKED_OVERHEAD_BYTES))
}

export function packHiddenPayload(
  payload: string,
  timestamp = Date.now(),
  version = PROTOCOL_VERSION,
  maxPayloadBytes = MAX_HIDDEN_PAYLOAD_BYTES,
) {
  const payloadBytes = truncateUtf8Bytes(payload, maxPayloadBytes)
  const body = new Uint8Array(10 + payloadBytes.length)
  body.set(MAGIC, 0)
  body[4] = version
  writeUint32(body, 5, Math.floor(timestamp / 1000))
  body[9] = payloadBytes.length
  body.set(payloadBytes, 10)

  const packed = new Uint8Array(body.length + 4)
  packed.set(body)
  writeUint32(packed, body.length, crc32(body))
  return packed
}

export function unpackHiddenPayload(bytes: Uint8Array) {
  if (bytes.length < 14 || !MAGIC.every((value, index) => bytes[index] === value)) return null
  const version = bytes[4]
  if (version !== PROTOCOL_VERSION && version !== LEGACY_PROTOCOL_VERSION) return null
  const payloadLength = bytes[9]
  const totalLength = 10 + payloadLength + 4
  if (payloadLength > MAX_HIDDEN_PAYLOAD_BYTES || bytes.length < totalLength) return null

  const body = bytes.slice(0, totalLength - 4)
  const expectedCrc = readUint32(bytes, totalLength - 4)
  const actualCrc = crc32(body)
  const payload = new TextDecoder().decode(bytes.slice(10, 10 + payloadLength))

  return {
    payload,
    version,
    embeddedAt: new Date(readUint32(bytes, 5) * 1000),
    integrity: expectedCrc === actualCrc,
  }
}

export function bytesToRepeatedBits(bytes: Uint8Array, version = PROTOCOL_VERSION) {
  const repeats = bitRepeatCount(version)
  const bits: number[] = []
  for (const byte of bytes) {
    for (let shift = 7; shift >= 0; shift -= 1) {
      const bit = (byte >>> shift) & 1
      for (let copy = 0; copy < repeats; copy += 1) bits.push(bit)
    }
  }
  return bits
}

export function repeatedSignalsToBytes(signals: number[], repeats = 3) {
  const bits: number[] = []
  let agreement = 0
  let groups = 0
  for (let index = 0; index + repeats - 1 < signals.length; index += repeats) {
    const group = signals.slice(index, index + repeats)
    const positives = group.filter((value) => value >= 0).length
    const bit = positives * 2 >= repeats ? 1 : 0
    bits.push(bit)
    agreement += Math.max(positives, repeats - positives) / repeats
    groups += 1
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    let value = 0
    for (let bit = 0; bit < 8; bit += 1) value = (value << 1) | bits[byteIndex * 8 + bit]
    bytes[byteIndex] = value
  }
  return { bytes, confidence: groups ? agreement / groups : 0 }
}
