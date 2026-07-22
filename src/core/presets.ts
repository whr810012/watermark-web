import type { WatermarkOptions } from './types'

export type PresetSnapshot = Omit<WatermarkOptions, 'logoFile' | 'customFontFile'>

export type WatermarkPreset = {
  id: string
  name: string
  builtin?: boolean
  options: PresetSnapshot
}

export const BUILTIN_PRESETS: WatermarkPreset[] = [
  {
    id: 'copyright-tile',
    name: '版权平铺',
    builtin: true,
    options: {
      mode: 'text',
      placement: 'tile',
      text: '版权所有 · 禁止盗用',
      opacity: 0.22,
      scale: 0.08,
      rotation: -24,
      gap: 120,
      position: 'center',
      color: '#ffffff',
      embedStyle: 'visible',
      hiddenPayload: '',
      hiddenStrength: 7,
      imageQuality: 0.92,
      videoEncode: 'balanced',
    },
  },
  {
    id: 'corner-light',
    name: '角标轻量',
    builtin: true,
    options: {
      mode: 'text',
      placement: 'single',
      text: 'DANDAN HUB',
      opacity: 0.48,
      scale: 0.1,
      rotation: 0,
      gap: 96,
      position: 'bottom-right',
      color: '#ffffff',
      embedStyle: 'visible',
      hiddenPayload: '',
      hiddenStrength: 7,
      imageQuality: 0.92,
      videoEncode: 'balanced',
    },
  },
  {
    id: 'hidden-trace',
    name: '隐藏溯源',
    builtin: true,
    options: {
      mode: 'text',
      placement: 'single',
      text: 'DANDAN HUB',
      opacity: 0.42,
      scale: 0.12,
      rotation: -18,
      gap: 96,
      position: 'bottom-right',
      color: '#ffffff',
      embedStyle: 'hidden',
      hiddenPayload: '',
      hiddenStrength: 7,
      imageQuality: 0.92,
      videoEncode: 'balanced',
    },
  },
]

const STORAGE_KEY = 'dandan-watermark-presets'
const MAX_USER_PRESETS = 10

export function snapshotOptions(options: WatermarkOptions): PresetSnapshot {
  const { logoFile: _logoFile, customFontFile: _customFontFile, ...rest } = options
  return { ...rest }
}

export function applyPreset(target: WatermarkOptions, preset: WatermarkPreset) {
  Object.assign(target, preset.options)
  target.logoFile = null
  target.customFontFile = null
}

export function loadUserPresets(): WatermarkPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WatermarkPreset[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_USER_PRESETS) : []
  } catch {
    return []
  }
}

export function saveUserPreset(name: string, options: WatermarkOptions) {
  const presets = loadUserPresets()
  const preset: WatermarkPreset = {
    id: `user-${Date.now()}`,
    name: name.trim() || `我的预设 ${presets.length + 1}`,
    options: snapshotOptions(options),
  }
  const next = [preset, ...presets].slice(0, MAX_USER_PRESETS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function deleteUserPreset(id: string) {
  const next = loadUserPresets().filter((preset) => preset.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
