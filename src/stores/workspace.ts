import JSZip from 'jszip'
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { detectMediaKind, validateMediaFile } from '../core/media'
import {
  defaultWatermarkOptions,
  type DetectionResult,
  type JobProgress,
  type ProcessingResult,
  type WorkflowMode,
} from '../core/types'
import { detectImage, processImage } from '../engines/image'

type DetectionItem = DetectionResult & { fileName: string }

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
  const canProcess = computed(
    () =>
      files.value.length > 0 &&
      status.value !== 'processing' &&
      (mode.value === 'detect' ||
        options.mode === 'text' ||
        (options.mode === 'logo' && Boolean(options.logoFile))),
  )

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

  function addFiles(incoming: File[]) {
    resetResults()
    if (!incoming.length) return
    const validationError = incoming.map(validateMediaFile).find(Boolean)
    if (validationError) {
      error.value = validationError
      status.value = 'error'
      return
    }
    const kinds = new Set(incoming.map(detectMediaKind))
    if (kinds.size !== 1) {
      error.value = '请将图片、PDF 和视频分开处理'
      status.value = 'error'
      return
    }
    const kind = detectMediaKind(incoming[0])
    if (kind !== 'image' && incoming.length > 1) {
      error.value = 'PDF 和视频首版每次仅处理一个文件'
      status.value = 'error'
      return
    }
    files.value = kind === 'image' ? incoming.slice(0, 20) : incoming.slice(0, 1)
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
    resetResults()
  }

  async function processFiles() {
    if (!canProcess.value) return
    cancelled.value = false
    status.value = 'processing'
    error.value = ''
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
          phase: `处理 ${file.name}`,
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
                phase: videoProgress.phase,
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
            detection = await detectVideo(file, updateProgress)
          }
          detections.value.push({ ...detection, fileName: file.name })
        }
        updateProgress({
          phase: `已完成 ${index + 1}/${files.value.length}`,
          progress: (index + 1) / files.value.length,
        })
      }
      status.value = 'done'
    } catch (cause) {
      status.value = 'error'
      error.value = cause instanceof Error ? cause.message : '处理失败，请重试'
    }
  }

  function cancel() {
    cancelled.value = true
    void import('../engines/video').then(({ cancelVideoProcessing }) => cancelVideoProcessing())
    status.value = 'idle'
    progress.value = { phase: '任务已取消', progress: 0 }
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
    addFiles,
    removeFile,
    clearFiles,
    setMode,
    processFiles,
    cancel,
    downloadResult,
    downloadAll,
  }
})
