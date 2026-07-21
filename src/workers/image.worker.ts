/// <reference lib="webworker" />

import { detectHiddenWatermark, embedHiddenWatermark } from '../core/hidden-watermark/image'
import { drawVisibleWatermark } from '../core/render'
import type { WatermarkOptions } from '../core/types'

type WorkerRequest = {
  id: string
  action: 'process' | 'detect'
  file: { name: string; type: string; buffer: ArrayBuffer }
  options?: Omit<WatermarkOptions, 'logoFile'>
  logo?: { type: string; buffer: ArrayBuffer }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, action, file, options, logo } = event.data
  try {
    const bitmap = await createImageBitmap(new Blob([file.buffer], { type: file.type }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('无法创建离屏图片处理画布')
    context.drawImage(bitmap, 0, 0)
    bitmap.close()

    if (action === 'detect') {
      const result = detectHiddenWatermark(
        context.getImageData(0, 0, canvas.width, canvas.height),
      )
      self.postMessage({ id, result })
      return
    }

    if (!options) throw new Error('缺少水印参数')
    const logoBitmap = logo
      ? await createImageBitmap(new Blob([logo.buffer], { type: logo.type }))
      : null
    drawVisibleWatermark(
      context,
      canvas.width,
      canvas.height,
      { ...options, logoFile: null },
      logoBitmap,
    )
    logoBitmap?.close()

    if (options.hiddenEnabled) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      embedHiddenWatermark(imageData, options.hiddenPayload, options.hiddenStrength)
      context.putImageData(imageData, 0, 0)
    }

    const outputType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      ? file.type
      : 'image/png'
    const blob = await canvas.convertToBlob({ type: outputType, quality: 0.92 })
    const buffer = await blob.arrayBuffer()
    self.postMessage({ id, result: { buffer, type: outputType } }, { transfer: [buffer] })
  } catch (cause) {
    self.postMessage({
      id,
      error: cause instanceof Error ? cause.message : '图片处理失败',
    })
  }
}
