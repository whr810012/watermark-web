import { detectHiddenWatermark, embedHiddenWatermark } from '../core/hidden-watermark/image'
import { outputName } from '../core/media'
import { drawVisibleWatermark, loadBitmap } from '../core/render'
import type { DetectionResult, ProcessingResult, WatermarkOptions } from '../core/types'

function canUseImageWorker() {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
}

function runImageWorker<T>(
  request: Record<string, unknown>,
  transfer: Transferable[],
) {
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/image.worker.ts', import.meta.url), {
      type: 'module',
    })
    const id = crypto.randomUUID()
    worker.onmessage = (event: MessageEvent<{ id: string; result?: T; error?: string }>) => {
      if (event.data.id !== id) return
      worker.terminate()
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data.result as T)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || '图片处理线程异常'))
    }
    worker.postMessage({ ...request, id }, transfer)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('浏览器无法导出处理后的图片'))),
      type,
      quality,
    )
  })
}

async function fileToCanvas(file: Blob) {
  const bitmap = await loadBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('无法创建图片处理画布')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return { canvas, context }
}

export async function processImage(
  file: File,
  options: WatermarkOptions,
): Promise<ProcessingResult> {
  if (canUseImageWorker()) {
    const fileBuffer = await file.arrayBuffer()
    const { logoFile, ...serializableOptions } = options
    const logoBuffer = logoFile ? await logoFile.arrayBuffer() : null
    const transfer: Transferable[] = [fileBuffer]
    if (logoBuffer) transfer.push(logoBuffer)
    const result = await runImageWorker<{ buffer: ArrayBuffer; type: string }>(
      {
        action: 'process',
        file: { name: file.name, type: file.type, buffer: fileBuffer },
        options: serializableOptions,
        logo: logoFile && logoBuffer ? { type: logoFile.type, buffer: logoBuffer } : undefined,
      },
      transfer,
    )
    const extension = result.type === 'image/jpeg' ? 'jpg' : result.type.split('/')[1]
    return {
      blob: new Blob([result.buffer], { type: result.type }),
      fileName: outputName(file, 'watermarked', extension),
    }
  }

  const { canvas, context } = await fileToCanvas(file)
  const logo = options.mode === 'logo' && options.logoFile ? await loadBitmap(options.logoFile) : null

  drawVisibleWatermark(context, canvas.width, canvas.height, options, logo)
  logo?.close()

  if (options.hiddenEnabled) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    embedHiddenWatermark(imageData, options.hiddenPayload, options.hiddenStrength)
    context.putImageData(imageData, 0, 0)
  }

  const type = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ? file.type : 'image/png'
  const extension = type === 'image/jpeg' ? 'jpg' : type.split('/')[1]
  const blob = await canvasToBlob(canvas, type)
  return {
    blob,
    fileName: outputName(file, 'watermarked', extension),
  }
}

export async function detectImage(file: Blob): Promise<DetectionResult> {
  if (canUseImageWorker()) {
    const buffer = await file.arrayBuffer()
    return runImageWorker<DetectionResult>(
      {
        action: 'detect',
        file: {
          name: file instanceof File ? file.name : 'image',
          type: file.type,
          buffer,
        },
      },
      [buffer],
    )
  }
  const { canvas, context } = await fileToCanvas(file)
  return detectHiddenWatermark(context.getImageData(0, 0, canvas.width, canvas.height))
}
