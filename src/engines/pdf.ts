import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createHiddenPattern, detectHiddenWatermark } from '../core/hidden-watermark/image'
import { packHiddenPayload, unpackHiddenPayload } from '../core/hidden-watermark/payload'
import { outputName } from '../core/media'
import {
  wantsHiddenWatermark,
  wantsVisibleWatermark,
  type DetectionResult,
  type ProcessingResult,
  type WatermarkOptions,
} from '../core/types'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

let cachedDefaultFont: ArrayBuffer | null = null

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  return rgb(
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  )
}

function needsCjk(text: string) {
  return /[\u3400-\u9fff]/.test(text)
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('无法生成 PDF 水印图层'))
        return
      }
      resolve(await blob.arrayBuffer())
    }, 'image/png')
  })
}

async function loadDefaultFontBytes() {
  if (cachedDefaultFont) return cachedDefaultFont.slice(0)
  const url = `${import.meta.env.BASE_URL}fonts/NotoSansSC-Regular.otf`
  const response = await fetch(url)
  if (!response.ok) throw new Error('缺少中文字体文件，请先运行 npm run fetch-fonts')
  cachedDefaultFont = await response.arrayBuffer()
  return cachedDefaultFont.slice(0)
}

async function resolveFont(document: PDFDocument, options: WatermarkOptions, text: string) {
  document.registerFontkit(fontkit)
  if (options.mode === 'logo') {
    return document.embedFont(StandardFonts.HelveticaBold)
  }
  if (options.customFontFile) {
    const bytes = await options.customFontFile.arrayBuffer()
    return document.embedFont(bytes, { subset: true })
  }
  if (needsCjk(text)) {
    const bytes = await loadDefaultFontBytes()
    return document.embedFont(bytes, { subset: true })
  }
  return document.embedFont(StandardFonts.HelveticaBold)
}

async function hiddenOverlay(payload: string, strength: number) {
  const width = 680
  const height = 960
  const pattern = createHiddenPattern(width, height, payload, strength)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建 PDF 隐藏水印图层')
  context.putImageData(new ImageData(new Uint8ClampedArray(pattern.data), width, height), 0, 0)
  return canvasToPng(canvas)
}

async function normalizeLogo(file: File) {
  if (file.type === 'image/png' || file.type === 'image/jpeg') return file.arrayBuffer()
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法转换 Logo 图片')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvasToPng(canvas)
}

function logoPositions(width: number, height: number, markWidth: number, markHeight: number, options: WatermarkOptions) {
  if (options.placement === 'tile') {
    const positions: Array<{ x: number; y: number }> = []
    const gapX = Math.max(markWidth + options.gap, 64)
    const gapY = Math.max(markHeight + options.gap, 64)
    let row = 0
    for (let y = -markHeight; y < height + markHeight; y += gapY, row += 1) {
      const offset = row % 2 === 0 ? 0 : gapX / 2
      for (let x = -markWidth; x < width + markWidth; x += gapX) {
        positions.push({ x: x + offset, y })
      }
    }
    return positions
  }
  const margin = 24
  const map = {
    'top-left': { x: margin, y: height - markHeight - margin },
    'top-right': { x: width - markWidth - margin, y: height - markHeight - margin },
    center: { x: (width - markWidth) / 2, y: (height - markHeight) / 2 },
    'bottom-left': { x: margin, y: margin },
    'bottom-right': { x: width - markWidth - margin, y: margin },
  }
  return [map[options.position]]
}

export async function processPdf(file: File, options: WatermarkOptions): Promise<ProcessingResult> {
  const document = await PDFDocument.load(await file.arrayBuffer())
  const text = options.text.trim() || 'DANDAN HUB'
  let font: PDFFont | null = null
  let logo: PDFImage | null = null

  if (wantsVisibleWatermark(options)) {
    if (options.mode === 'logo' && options.logoFile) {
      const logoBytes = await normalizeLogo(options.logoFile)
      logo =
        options.logoFile.type === 'image/jpeg'
          ? await document.embedJpg(logoBytes)
          : await document.embedPng(logoBytes)
      font = await document.embedFont(StandardFonts.HelveticaBold)
    } else {
      font = await resolveFont(document, options, text)
    }
  }

  const hiddenImage = wantsHiddenWatermark(options)
    ? await document.embedPng(await hiddenOverlay(options.hiddenPayload, options.hiddenStrength))
    : null
  if (wantsHiddenWatermark(options)) {
    document.setSubject(`DDWM:${bytesToBase64(packHiddenPayload(options.hiddenPayload))}`)
  }

  for (const page of document.getPages()) {
    const { width, height } = page.getSize()
    if (wantsVisibleWatermark(options) && (logo || font)) {
      const fontSize = Math.max(14, Math.min(width, height) * options.scale)
      const markHeight = fontSize * 1.25
      const markWidth = logo
        ? markHeight * (logo.width / Math.max(1, logo.height))
        : font!.widthOfTextAtSize(text, fontSize)

      for (const position of logoPositions(width, height, markWidth, markHeight, options)) {
        if (logo) {
          page.drawImage(logo, {
            x: position.x,
            y: position.y,
            width: markWidth,
            height: markHeight,
            opacity: options.opacity,
            rotate: degrees(options.rotation),
          })
        } else if (font) {
          page.drawText(text, {
            x: position.x,
            y: position.y,
            size: fontSize,
            font,
            color: hexToRgb(options.color),
            opacity: options.opacity,
            rotate: degrees(options.rotation),
          })
        }
      }
    }

    if (hiddenImage) {
      page.drawImage(hiddenImage, { x: 0, y: 0, width, height })
    }
  }

  const bytes = await document.save()
  return {
    blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    fileName: outputName(file, 'watermarked', 'pdf'),
  }
}

export async function detectPdf(file: File): Promise<DetectionResult> {
  const source = new Uint8Array(await file.arrayBuffer())
  const metadataDocument = await PDFDocument.load(source.slice())
  const subject = metadataDocument.getSubject()
  const metadataPayload = subject?.startsWith('DDWM:')
    ? unpackHiddenPayload(base64ToBytes(subject.slice(5)))
    : null
  const pdfDocument = await pdfjs.getDocument({ data: source }).promise
  const results: DetectionResult[] = []
  const pageCount = Math.min(pdfDocument.numPages, 3)

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.35 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) continue
    await page.render({ canvas, canvasContext: context, viewport }).promise
    results.push(detectHiddenWatermark(context.getImageData(0, 0, canvas.width, canvas.height)))
  }

  const found = results.filter((result) => result.found)
  if (!found.length) {
    if (metadataPayload) {
      return {
        found: true,
        confidence: metadataPayload.integrity ? 0.82 : 0.58,
        payload: metadataPayload.payload,
        embeddedAt: metadataPayload.embeddedAt,
        integrity: metadataPayload.integrity ? 'valid' : 'damaged',
        samples: results.length,
        message: metadataPayload.integrity
          ? `DDWM 完整性校验通过；已扫描 ${results.length} 个页面样本`
          : `DDWM 元数据已检出但完整性校验未通过；已扫描 ${results.length} 个页面样本`,
      }
    }
    return {
      found: false,
      confidence: results.length
        ? results.reduce((sum, result) => sum + result.confidence, 0) / results.length
        : 0,
      payload: null,
      embeddedAt: null,
      integrity: 'unknown',
      samples: results.length,
      message: '已检查 PDF 页面，未检出本工具生成的隐藏水印',
    }
  }

  const best = found.sort((a, b) => b.confidence - a.confidence)[0]
  return { ...best, samples: results.length, message: `在 ${found.length}/${results.length} 个页面样本中检出水印` }
}
