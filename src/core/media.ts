import type { MediaKind } from './types'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_IMAGE_BYTES = 40 * 1024 * 1024
const MAX_PDF_BYTES = 120 * 1024 * 1024
const MAX_VIDEO_BYTES = 500 * 1024 * 1024

export function detectMediaKind(file: Pick<File, 'type' | 'name'>): MediaKind | null {
  const extension = file.name.toLowerCase().split('.').pop()
  if (IMAGE_TYPES.includes(file.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(extension ?? '')) {
    return 'image'
  }
  if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf'
  if (VIDEO_TYPES.includes(file.type) || ['mp4', 'webm', 'mov'].includes(extension ?? '')) {
    return 'video'
  }
  return null
}

export function validateMediaFile(file: File) {
  const kind = detectMediaKind(file)
  if (!kind) return '暂不支持该文件格式'
  if (file.size <= 0) return '文件内容为空'
  const maxBytes = kind === 'image' ? MAX_IMAGE_BYTES : kind === 'pdf' ? MAX_PDF_BYTES : MAX_VIDEO_BYTES
  if (file.size > maxBytes) {
    const size = Math.round(maxBytes / 1024 / 1024)
    return `${kind === 'image' ? '图片' : kind === 'pdf' ? 'PDF' : '视频'}不能超过 ${size} MB`
  }
  return null
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function outputName(file: File, suffix: string, extension?: string) {
  const base = file.name.replace(/\.[^.]+$/, '')
  const currentExtension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  return `${base}-${suffix}.${extension ?? currentExtension}`
}
