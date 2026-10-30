import JSZip from 'jszip'
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { detectionsToCsv, detectionsToJson, downloadTextFile } from '../core/export-detections'
import { hiddenPayloadLimit } from '../core/hidden-watermark/image'
import { utf8ByteLength } from '../core/hidden-watermark/payload'
import { batchLimitFor, detectMediaKind, validateMediaFile } from '../core/media'
import {
  defaultWatermarkOptions,
  type DetectionResult,
  type JobProgress,
  type ProcessingResult,
  type WorkflowMode,
} from '../core/types'
import { detectImage, processImage } from '../engines/image'

type DetectionItem = DetectionResult & { fileName: string }

export type AddFilesOptions = {
  /** true：追加到现有队列；false：整体替换 */
  append?: boolean
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const mode = ref<WorkflowMode>('embed')
  const files = ref<File[]>([])
  const options = reactive({ ...defaultWatermarkOptions })
  const status = ref<'idle' | 'processing' | 'done' | 'error'>('idle')
  const progress = ref<JobProgress>({ phase: '等待文件', progress: 0 })
  const error = ref('')
  const results = ref<ProcessingResult[]>([])
  const detections = ref<DetectionItem[]>([])
  const cancelled = ref(false)

  const mediaKind = computed(() => (files.value[0] ? detectMediaKind(files.value[0]) : null))
  const processBlockedReason = computed(() => {
    if (status.value === 'processing') return '正在处理中…'
    if (files.value.length === 0) {
      return mode.value === 'detect' ? '请先选择要检测的文件' : '请先选择要处理的文件'
    }
    if (mode.value === 'detect') return ''

    const needsHidden = options.embedStyle !== 'visible'
    const needsVisible = options.embedStyle !== 'hidden'

    if (needsHidden) {
      const payload = options.hiddenPayload.trim()
      if (!payload) return '请填写隐藏标识'
      if (utf8ByteLength(payload) > hiddenPayloadLimit()) {
        return `隐藏标识超出 ${hiddenPayloadLimit()} 字节上限`
      }
    }
    if (!needsVisible) return ''
    if (options.mode === 'logo' && !options.logoFile) return '请选择 Logo 图片'
    if (options.mode === 'text' && !options.text.trim()) return '请填写水印文字'
    return ''
  })

  const canProcess = computed(() => !processBlockedReason.value)

  function clearResultUrls() {
    for (const result of results.value) {
      if (result.previewUrl) URL.revokeObjectURL(result.previewUrl)
    }
  }

  function resetResults() {
    clearResultUrls()
    results.value = []
    detections.value = []
    error.value = ''
    status.value = 'idle'
    progress.value = { phase: '等待处理', progress: 0 }
  }

  function addFiles(incoming: File[], addOptions: AddFilesOptions = {}) {
    const append = Boolean(addOptions.append)
    if (!incoming.length) return

    const validationError = incoming.map(validateMediaFile).find(Boolean)
    if (validationError) {
      error.value = validationError
      status.value = 'error'
      return
    }

    const incomingKinds = new Set(incoming.map(detectMediaKind))
    if (incomingKinds.size !== 1 || incomingKinds.has(null)) {
      error.value = '请将图片、PDF 和视频分开处理'
      status.value = 'error'
      return
    }
    const kind = detectMediaKind(incoming[0])!
    const limit = batchLimitFor(kind)

    if (append && files.value.length) {
      const existingKind = detectMediaKind(files.value[0])
      if (existingKind !== kind) {
        error.value = '请将图片、PDF 和视频分开处理'
        status.value = 'error'
        return
      }
    }

    const merged =
      append && files.value.length > 0 ? [...files.value, ...incoming] : [...incoming]

    if (merged.length > limit) {
      error.value =
        kind === 'image'
          ? `图片每次最多处理 ${limit} 个`
          : kind === 'pdf'
            ? `PDF 每次最多处理 ${limit} 个`
            : `视频每次最多处理 ${limit} 个（串行，较慢）`
      status.value = 'error'
      return
    }

    resetResults()
    files.value = merged
  }

  function removeFile(index: number) {
    files.value.splice(index, 1)
    resetResults()
  }

  function clearFiles() {
    files.value = []
    resetResults()
  }

  function setMode(nextMode: WorkflowMode) {
    if (mode.value === nextMode) return
    mode.value = nextMode
    files.value = []
    resetResults()
  }

  async function processFiles() {
    if (!canProcess.value) return
    cancelled.value = false
    status.value = 'processing'
    error.value = ''
    clearResultUrls()
    results.value = []
    detections.value = []
    const updateProgress = (next: JobProgress) => {
      progress.value = next
    }

    try {
      for (let index = 0; index < files.value.length; index += 1) {
        if (cancelled.value) throw new Error('任务已取消')
        const file = files.value[index]
        const kind = detectMediaKind(file)
        const baseProgress = index / files.value.length
        const span = 1 / files.value.length
        updateProgress({
          phase: `处理 ${index + 1}/${files.value.length} · ${file.name}`,
          progress: baseProgress,
        })

        if (mode.value === 'embed') {
          let result: ProcessingResult
          if (kind === 'image') {
            result = await processImage(file, options)
          } else if (kind === 'pdf') {
            const { processPdf } = await import('../engines/pdf')
            result = await processPdf(file, options)
          } else {
            const { processVideo } = await import('../engines/video')
            result = await processVideo(file, options, (videoProgress) =>
              updateProgress({
                phase: `${index + 1}/${files.value.length} · ${videoProgress.phase}`,
                progress: baseProgress + videoProgress.progress * span,
              }),
            )
          }
          result.previewUrl = URL.createObjectURL(result.blob)
          results.value.push(result)
        } else {
          let detection: DetectionResult
          if (kind === 'image') detection = await detectImage(file)
          else if (kind === 'pdf') {
            const { detectPdf } = await import('../engines/pdf')
            detection = await detectPdf(file)
          } else {
            const { detectVideo } = await import('../engines/video')
            detection = await detectVideo(file, (videoProgress) =>
              updateProgress({
                phase: `${index + 1}/${files.value.length} · ${videoProgress.phase}`,
                progress: baseProgress + videoProgress.progress * span,
              }),
            )
          }
          detections.value.push({ ...detection, fileName: file.name })
        }
        updateProgress({
          phase: `已完成 ${index + 1}/${files.value.length}`,
          progress: (index + 1) / files.value.length,
        })
      }
      if (cancelled.value) throw new Error('任务已取消')
      status.value = 'done'
    } catch (cause) {
      if (cancelled.value) {
        error.value = ''
        progress.value = { phase: '任务已取消', progress: 0 }
        // 已有部分结果时保留可下载；否则回到空闲
        status.value = results.value.length || detections.value.length ? 'done' : 'idle'
        return
      }
      status.value = 'error'
      error.value = cause instanceof Error ? cause.message : '处理失败，请重试'
    }
  }

  function cancel() {
    if (status.value !== 'processing') return
    cancelled.value = true
    progress.value = { phase: '正在取消…', progress: progress.value.progress }
    void import('../engines/video').then(({ cancelVideoProcessing }) => cancelVideoProcessing())
  }

  function downloadResult(result: ProcessingResult) {
    const link = document.createElement('a')
    link.href = result.previewUrl ?? URL.createObjectURL(result.blob)
    link.download = result.fileName
    link.click()
  }

  async function downloadAll() {
    if (results.value.length === 1) {
      downloadResult(results.value[0])
      return
    }
    const zip = new JSZip()
    for (const result of results.value) zip.file(result.fileName, result.blob)
    const blob = await zip.generateAsync({ type: 'blob' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = 'dandan-watermarked-images.zip'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function exportDetections(format: 'json' | 'csv') {
    if (!detections.value.length) return
    if (format === 'json') {
      downloadTextFile(detectionsToJson(detections.value), 'dandan-detections.json', 'application/json')
      return
    }
    downloadTextFile(detectionsToCsv(detections.value), 'dandan-detections.csv', 'text/csv;charset=utf-8')
  }

  return {
    mode,
    files,
    options,
    status,
    progress,
    error,
    results,
    detections,
    mediaKind,
    canProcess,
    processBlockedReason,
    addFiles,
    removeFile,
    clearFiles,
    setMode,
    processFiles,
    cancel,
    downloadResult,
    downloadAll,
    exportDetections,
  }
})
