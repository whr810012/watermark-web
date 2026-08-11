import type { FFmpeg as FFmpegType } from '@ffmpeg/ffmpeg'
import { createHiddenPattern } from '../core/hidden-watermark/image'
import { outputName } from '../core/media'
import { drawVisibleWatermark, loadBitmap } from '../core/render'
import {
  VIDEO_ENCODE_MAP,
  wantsHiddenWatermark,
  wantsVisibleWatermark,
  type DetectionResult,
  type JobProgress,
  type ProcessingResult,
  type WatermarkOptions,
} from '../core/types'
import { detectImage } from './image'

let ffmpeg: FFmpegType | null = null
let loadedVariant: 'single' | 'multi' | null = null

function ffmpegBaseUrl(canUseThreads: boolean) {
  const cdn = import.meta.env.VITE_FFMPEG_CDN as string | undefined
  if (cdn) {
    const packageName = canUseThreads ? '@ffmpeg/core-mt' : '@ffmpeg/core'
    return `${cdn.replace(/\/$/, '')}/${packageName}@0.12.10/dist/esm`
  }
  const folder = canUseThreads ? 'core-mt' : 'core'
  return `${import.meta.env.BASE_URL}ffmpeg/${folder}`
}

async function getFfmpeg(
  onProgress?: (progress: JobProgress) => void,
  forceSingle = false,
) {
  const canUseThreads =
    !forceSingle &&
    !navigator.webdriver &&
    crossOriginIsolated &&
    typeof SharedArrayBuffer !== 'undefined'
  const variant = canUseThreads ? 'multi' : 'single'
  if (ffmpeg && loadedVariant === variant) return ffmpeg

  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ])
  ffmpeg = new FFmpeg()
  onProgress?.({ phase: canUseThreads ? '加载多线程视频引擎' : '加载兼容视频引擎', progress: 0.04 })

  const baseUrl = ffmpegBaseUrl(canUseThreads)
  try {
    const loadOptions: Parameters<FFmpegType['load']>[0] = {
      coreURL: await toBlobURL(`${baseUrl}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, 'application/wasm'),
    }
    if (canUseThreads) {
      loadOptions.workerURL = await toBlobURL(
        `${baseUrl}/ffmpeg-core.worker.js`,
        'text/javascript',
      )
    }
    await ffmpeg.load(loadOptions)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    // 多线程 CDN 失败时回退单线程（生产默认 unpkg）
    if (!forceSingle && canUseThreads) {
      onProgress?.({ phase: '多线程引擎加载失败，改用兼容引擎', progress: 0.04 })
      ffmpeg = null
      loadedVariant = null
      return getFfmpeg(onProgress, true)
    }
    throw new Error(
      `视频引擎加载失败（无法获取 FFmpeg）。请检查网络是否可访问视频引擎 CDN，或稍后重试。详情：${detail}`,
    )
  }
  loadedVariant = variant
  return ffmpeg
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ])
}

function videoMetadata(file: File) {
  return new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const metadata = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      }
      URL.revokeObjectURL(url)
      resolve(metadata)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('浏览器无法读取该视频的尺寸或时长'))
    }
    video.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('无法生成视频水印图层'))), 'image/png')
  })
}

async function buildOverlay(
  width: number,
  height: number,
  options: WatermarkOptions,
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建视频水印画布')

  const logo = options.mode === 'logo' && options.logoFile ? await loadBitmap(options.logoFile) : null
  if (wantsVisibleWatermark(options)) {
    drawVisibleWatermark(context, width, height, options, logo)
  }
  logo?.close()

  if (wantsHiddenWatermark(options)) {
    const pattern = createHiddenPattern(width, height, options.hiddenPayload, options.hiddenStrength)
    const layer = document.createElement('canvas')
    layer.width = width
    layer.height = height
    layer.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(pattern.data), width, height), 0, 0)
    context.drawImage(layer, 0, 0)
  }
  return canvasToBlob(canvas)
}

export function cancelVideoProcessing() {
  ffmpeg?.terminate()
  ffmpeg = null
  loadedVariant = null
}

export async function processVideo(
  file: File,
  options: WatermarkOptions,
  onProgress?: (progress: JobProgress) => void,
  forceSingle = false,
): Promise<ProcessingResult> {
  const metadata = await videoMetadata(file)
  if (metadata.width * metadata.height > 3840 * 2160) throw new Error('首版暂不处理高于 4K 的视频')
  const engine = await getFfmpeg(onProgress, forceSingle)
  const inputName = `input.${file.name.split('.').pop() || 'mp4'}`
  const overlayName = 'watermark-overlay.png'
  const outputFile = 'watermarked.mp4'
  const encode = VIDEO_ENCODE_MAP[options.videoEncode]
  const progressHandler = ({ progress }: { progress: number }) =>
    onProgress?.({ phase: '正在逐帧合成水印', progress: 0.12 + Math.max(0, progress) * 0.84 })
  engine.on('progress', progressHandler)

  try {
    onProgress?.({ phase: '准备本地视频文件', progress: 0.08 })
    await withTimeout(
      engine.writeFile(inputName, new Uint8Array(await file.arrayBuffer())),
      15_000,
      forceSingle || loadedVariant === 'single'
        ? '兼容视频引擎没有响应'
        : '多线程视频引擎没有响应',
    )
    const overlay = await buildOverlay(metadata.width, metadata.height, options)
    await withTimeout(
      engine.writeFile(
        overlayName,
        new Uint8Array(await overlay.arrayBuffer()),
      ),
      15_000,
      forceSingle || loadedVariant === 'single'
        ? '兼容视频引擎没有响应'
        : '多线程视频引擎没有响应',
    )
    await engine.exec([
      '-i',
      inputName,
      '-i',
      overlayName,
      '-filter_complex',
      '[0:v][1:v]overlay=0:0:format=auto',
      '-c:v',
      'libx264',
      '-preset',
      encode.preset,
      '-crf',
      encode.crf,
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      outputFile,
    ])
    const output = await engine.readFile(outputFile)
    const bytes = typeof output === 'string' ? new TextEncoder().encode(output) : output
    onProgress?.({ phase: '处理完成', progress: 1 })
    return {
      blob: new Blob([bytes as BlobPart], { type: 'video/mp4' }),
      fileName: outputName(file, 'watermarked', 'mp4'),
    }
  } catch (cause) {
    if (!forceSingle && loadedVariant === 'multi') {
      cancelVideoProcessing()
      onProgress?.({ phase: '多线程不可用，切换兼容引擎', progress: 0.05 })
      return processVideo(file, options, onProgress, true)
    }
    throw cause
  } finally {
    engine.off('progress', progressHandler)
    if (ffmpeg === engine) {
      await Promise.allSettled([
        engine.deleteFile(inputName),
        engine.deleteFile(overlayName),
        engine.deleteFile(outputFile),
      ])
    }
  }
}

export async function detectVideo(
  file: File,
  onProgress?: (progress: JobProgress) => void,
  forceSingle = false,
): Promise<DetectionResult> {
  const metadata = await videoMetadata(file)
  const engine = await getFfmpeg(onProgress, forceSingle)
  const inputName = `detect.${file.name.split('.').pop() || 'mp4'}`
  const sampleTimes = [0, metadata.duration * 0.5, Math.max(0, metadata.duration - 0.25)]
  const results: DetectionResult[] = []

  try {
    await withTimeout(
      engine.writeFile(inputName, new Uint8Array(await file.arrayBuffer())),
      15_000,
      forceSingle || loadedVariant === 'single'
        ? '兼容视频引擎没有响应'
        : '多线程视频引擎没有响应',
    )
    for (let index = 0; index < sampleTimes.length; index += 1) {
      const frameName = `sample-${index}.png`
      onProgress?.({ phase: `抽取视频样本 ${index + 1}/3`, progress: 0.12 + index * 0.25 })
      await engine.exec([
        '-ss',
        String(sampleTimes[index]),
        '-i',
        inputName,
        '-frames:v',
        '1',
        frameName,
      ])
      const frame = await engine.readFile(frameName)
      const bytes = typeof frame === 'string' ? new TextEncoder().encode(frame) : frame
      results.push(await detectImage(new Blob([bytes as BlobPart], { type: 'image/png' })))
      await engine.deleteFile(frameName)
    }
  } catch (cause) {
    if (!forceSingle && loadedVariant === 'multi') {
      cancelVideoProcessing()
      onProgress?.({ phase: '多线程不可用，切换兼容引擎', progress: 0.05 })
      return detectVideo(file, onProgress, true)
    }
    throw cause
  } finally {
    await engine.deleteFile(inputName).catch(() => undefined)
  }

  const found = results.filter((result) => result.found)
  if (!found.length) {
    return {
      found: false,
      confidence: results.reduce((sum, result) => sum + result.confidence, 0) / results.length,
      payload: null,
      embeddedAt: null,
      integrity: 'unknown',
      samples: results.length,
      message: '已检测多个时间点，未检出本工具生成的隐藏水印',
    }
  }
  const best = found.sort((a, b) => b.confidence - a.confidence)[0]
  return {
    ...best,
    samples: results.length,
    confidence: found.reduce((sum, result) => sum + result.confidence, 0) / found.length,
    message: `${found.length}/${results.length} 个视频样本检出同源水印`,
  }
}
