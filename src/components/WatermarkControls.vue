<script setup lang="ts">
import { BookmarkPlus, Eye, Grid3X3, ImagePlus, ShieldCheck, Trash2, Type } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import {
  BUILTIN_PRESETS,
  applyPreset,
  deleteUserPreset,
  loadUserPresets,
  saveUserPreset,
  type WatermarkPreset,
} from '../core/presets'
import type { EmbedStyle, WatermarkOptions, WatermarkPosition } from '../core/types'

const options = defineModel<WatermarkOptions>({ required: true })
const userPresets = ref<WatermarkPreset[]>([])

const positions: Array<{ value: WatermarkPosition; label: string }> = [
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'center', label: '居中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
]

const embedStyles: Array<{ value: EmbedStyle; label: string }> = [
  { value: 'visible', label: '仅可见' },
  { value: 'hidden', label: '仅隐藏' },
  { value: 'both', label: '可见+隐藏' },
]

const showVisibleControls = computed(() => options.value.embedStyle !== 'hidden')
const showHiddenControls = computed(() => options.value.embedStyle !== 'visible')

onMounted(() => {
  userPresets.value = loadUserPresets()
})

function setLogo(event: Event) {
  options.value.logoFile = (event.target as HTMLInputElement).files?.[0] ?? null
}

function setCustomFont(event: Event) {
  options.value.customFontFile = (event.target as HTMLInputElement).files?.[0] ?? null
}

function usePreset(preset: WatermarkPreset) {
  applyPreset(options.value, preset)
}

function persistPreset() {
  const name = window.prompt('给当前参数起个名字', '我的预设')
  if (name === null) return
  userPresets.value = saveUserPreset(name, options.value)
}

function removePreset(id: string) {
  userPresets.value = deleteUserPreset(id)
}
</script>

<template>
  <section class="control-card" aria-labelledby="watermark-heading">
    <div class="section-heading">
      <span class="step-index">02</span>
      <div>
        <p class="eyebrow">MARK DESIGN</p>
        <h2 id="watermark-heading">设计水印</h2>
      </div>
    </div>

    <div class="preset-row">
      <label class="field">
        <span>预设模板</span>
        <select
          name="preset"
          @change="
            (event) => {
              const id = (event.target as HTMLSelectElement).value
              const preset = [...BUILTIN_PRESETS, ...userPresets].find((item) => item.id === id)
              if (preset) usePreset(preset)
              ;(event.target as HTMLSelectElement).value = ''
            }
          "
        >
          <option value="">选择预设…</option>
          <optgroup label="内置">
            <option v-for="preset in BUILTIN_PRESETS" :key="preset.id" :value="preset.id">
              {{ preset.name }}
            </option>
          </optgroup>
          <optgroup v-if="userPresets.length" label="我的">
            <option v-for="preset in userPresets" :key="preset.id" :value="preset.id">
              {{ preset.name }}
            </option>
          </optgroup>
        </select>
      </label>
      <button class="secondary-button" type="button" @click="persistPreset">
        <BookmarkPlus :size="15" /> 保存当前
      </button>
    </div>
    <ul v-if="userPresets.length" class="user-preset-list">
      <li v-for="preset in userPresets" :key="preset.id">
        <button type="button" @click="usePreset(preset)">{{ preset.name }}</button>
        <button type="button" :aria-label="`删除 ${preset.name}`" @click="removePreset(preset.id)">
          <Trash2 :size="14" />
        </button>
      </li>
    </ul>

    <div class="segmented-control segmented-control--triple" aria-label="水印写入方式">
      <button
        v-for="style in embedStyles"
        :key="style.value"
        type="button"
        :class="{ active: options.embedStyle === style.value }"
        :aria-pressed="options.embedStyle === style.value"
        @click="options.embedStyle = style.value"
      >
        {{ style.label }}
      </button>
    </div>

    <template v-if="showVisibleControls">
      <div class="segmented-control" aria-label="水印内容类型">
        <button
          type="button"
          :class="{ active: options.mode === 'text' }"
          :aria-pressed="options.mode === 'text'"
          @click="options.mode = 'text'"
        >
          <Type :size="17" /> 文字
        </button>
        <button
          type="button"
          :class="{ active: options.mode === 'logo' }"
          :aria-pressed="options.mode === 'logo'"
          @click="options.mode = 'logo'"
        >
          <ImagePlus :size="17" /> Logo
        </button>
      </div>

      <label v-if="options.mode === 'text'" class="field">
        <span>水印文字</span>
        <input
          v-model="options.text"
          maxlength="80"
          name="watermarkText"
          placeholder="输入品牌、姓名或版权信息"
        />
      </label>
      <label v-else class="logo-picker">
        <input class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="setLogo" />
        <ImagePlus :size="20" />
        <span>
          <strong>{{ options.logoFile?.name || '选择透明 Logo' }}</strong>
          <small>建议 PNG / WebP，最大 10 MB</small>
        </span>
      </label>

      <div class="two-columns">
        <label class="field">
          <span>排列方式</span>
          <select v-model="options.placement" name="placement">
            <option value="single">单个</option>
            <option value="tile">平铺</option>
          </select>
        </label>
        <label class="field">
          <span>文字颜色</span>
          <span class="color-field">
            <input v-model="options.color" type="color" name="watermarkColor" />
            <code>{{ options.color.toUpperCase() }}</code>
          </span>
        </label>
      </div>

      <fieldset v-if="options.placement === 'single'" class="position-grid">
        <legend>位置</legend>
        <button
          v-for="position in positions"
          :key="position.value"
          type="button"
          :class="{ active: options.position === position.value }"
          :aria-label="position.label"
          :aria-pressed="options.position === position.value"
          @click="options.position = position.value"
        />
      </fieldset>

      <div class="range-grid">
        <label>
          <span>透明度 <output>{{ Math.round(options.opacity * 100) }}%</output></span>
          <input v-model.number="options.opacity" type="range" min="0.06" max="1" step="0.01" name="opacity" />
        </label>
        <label>
          <span>大小 <output>{{ Math.round(options.scale * 100) }}</output></span>
          <input v-model.number="options.scale" type="range" min="0.04" max="0.28" step="0.01" name="scale" />
        </label>
        <label>
          <span>旋转 <output>{{ options.rotation }}°</output></span>
          <input v-model.number="options.rotation" type="range" min="-60" max="60" step="1" name="rotation" />
        </label>
        <label v-if="options.placement === 'tile'">
          <span>间距 <output>{{ options.gap }} px</output></span>
          <input v-model.number="options.gap" type="range" min="24" max="240" step="4" name="gap" />
        </label>
      </div>

      <label class="logo-picker font-picker">
        <input class="sr-only" type="file" accept=".ttf,.otf,font/ttf,font/otf" @change="setCustomFont" />
        <Type :size="18" />
        <span>
          <strong>{{ options.customFontFile?.name || '可选：上传 PDF 中文字体' }}</strong>
          <small>默认使用内置 Noto Sans SC；上传 TTF/OTF 可覆盖</small>
        </span>
      </label>
    </template>

    <div class="range-grid">
      <label>
        <span>图片导出质量 <output>{{ Math.round(options.imageQuality * 100) }}%</output></span>
        <input
          v-model.number="options.imageQuality"
          type="range"
          min="0.7"
          max="1"
          step="0.01"
          name="imageQuality"
        />
      </label>
      <label class="field">
        <span>视频编码</span>
        <select v-model="options.videoEncode" name="videoEncode">
          <option value="fast">更快（体积小）</option>
          <option value="balanced">均衡</option>
          <option value="quality">更高画质</option>
        </select>
      </label>
    </div>

    <div class="hidden-panel" :class="{ active: showHiddenControls }">
      <div class="switch-row">
        <span class="switch-icon"><ShieldCheck :size="18" /></span>
        <span>
          <strong>{{ options.embedStyle === 'hidden' ? '仅写入隐藏水印' : '写入隐藏水印' }}</strong>
          <small>工具专属 DDWM v2 标记，可在检测页读取（兼容 v1）</small>
        </span>
      </div>
      <template v-if="showHiddenControls">
        <label class="field">
          <span>隐藏标识</span>
          <input
            v-model="options.hiddenPayload"
            maxlength="32"
            name="hiddenPayload"
            placeholder="例如：订单号、创作者 ID"
          />
        </label>
        <label class="hidden-strength">
          <span>嵌入强度 <output>{{ options.hiddenStrength }}</output></span>
          <input
            v-model.number="options.hiddenStrength"
            type="range"
            min="3"
            max="10"
            step="1"
            name="hiddenStrength"
          />
        </label>
        <p class="boundary-note">
          <Eye :size="15" />
          可抵抗轻度压缩、约 80% 缩放与约 10% 边缘裁剪；不承诺大角度旋转、重度截图或恶意清除。
        </p>
      </template>
    </div>

    <div class="control-footnote">
      <Grid3X3 :size="15" />
      所有参数只在本机浏览器内参与计算。Logo 预设不会保存位图，需重新选择。
    </div>
  </section>
</template>
