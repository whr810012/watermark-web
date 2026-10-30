export type MediaKind = 'image' | 'pdf' | 'video'
export type WorkflowMode = 'embed' | 'detect'
export type WatermarkMode = 'text' | 'logo'
export type PlacementMode = 'single' | 'tile'
export type EmbedStyle = 'visible' | 'hidden' | 'both'
export type VideoEncodePreset = 'fast' | 'balanced' | 'quality'
export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-right'

export type WatermarkOptions = {
  mode: WatermarkMode
  placement: PlacementMode
  text: string
  logoFile: File | null
  opacity: number
  scale: number
  rotation: number
  gap: number
  position: WatermarkPosition
  color: string
  embedStyle: EmbedStyle
  hiddenPayload: string
  hiddenStrength: number
  imageQuality: number
  videoEncode: VideoEncodePreset
  customFontFile: File | null
}

export type DetectionResult = {
  found: boolean
  confidence: number
  payload: string | null
  embeddedAt: Date | null
  integrity: 'valid' | 'damaged' | 'unknown'
  samples: number
  message: string
}

export type ProcessingResult = {
  blob: Blob
  fileName: string
  previewUrl?: string
}

export type JobProgress = {
  phase: string
  progress: number
}

export const defaultWatermarkOptions: WatermarkOptions = {
  mode: 'text',
  placement: 'single',
  text: 'DANDAN HUB',
  logoFile: null,
  opacity: 0.42,
  scale: 0.12,
  rotation: -18,
  gap: 96,
  position: 'bottom-right',
  color: '#ffffff',
  embedStyle: 'both',
  hiddenPayload: '',
  hiddenStrength: 5,
  imageQuality: 0.92,
  videoEncode: 'balanced',
  customFontFile: null,
}

export function wantsVisibleWatermark(options: Pick<WatermarkOptions, 'embedStyle'>) {
  return options.embedStyle !== 'hidden'
}

export function wantsHiddenWatermark(options: Pick<WatermarkOptions, 'embedStyle'>) {
  return options.embedStyle !== 'visible'
}

export const VIDEO_ENCODE_MAP: Record<VideoEncodePreset, { preset: string; crf: string }> = {
  fast: { preset: 'veryfast', crf: '23' },
  balanced: { preset: 'fast', crf: '20' },
  quality: { preset: 'medium', crf: '18' },
}
