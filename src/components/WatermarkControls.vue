<script setup lang="ts">
import { BookmarkPlus, Check, Eye, ImagePlus, ShieldCheck, Trash2, Type, X } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { hiddenPayloadLimit } from '../core/hidden-watermark/image'
import { truncateUtf8Bytes, utf8ByteLength } from '../core/hidden-watermark/payload'
import {
  BUILTIN_PRESETS,
  applyPreset,
  deleteUserPreset,
  loadUserPresets,
  saveUserPreset,
  type WatermarkPreset,
} from '../core/presets'
import type { EmbedStyle, WatermarkOptions, WatermarkPosition } from '../core/types'

const props = defineProps<{
  compact?: boolean
}>()

const options = defineModel<WatermarkOptions>({ required: true })
const userPresets = ref<WatermarkPreset[]>([])
const payloadByteLimit = hiddenPayloadLimit()
const payloadBytesUsed = computed(() => utf8ByteLength(options.value.hiddenPayload))
const savingPreset = ref(false)
const presetName = ref('我的预设')

function onHiddenPayloadInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  const truncated = new TextDecoder().decode(truncateUtf8Bytes(value, payloadByteLimit))
  options.value.hiddenPayload = truncated
  if (truncated !== value) (event.target as HTMLInputElement).value = truncated
}

const positions: Array<{ value: WatermarkPosition; label: string }> = [
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'center', label: '居中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
]

const positionLabel = computed(
  () => positions.find((item) => item.value === options.value.position)?.label ?? '右下',
)

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

function openPresetSave() {
  presetName.value = '我的预设'
  savingPreset.value = true
}

function cancelPresetSave() {
  savingPreset.value = false
}

function confirmPresetSave() {
  const name = presetName.value.trim() || '我的预设'
  userPresets.value = saveUserPreset(name, options.value)
  savingPreset.value = false
}

function removePreset(id: string) {
  userPresets.value = deleteUserPreset(id)
}
</script>

<template>
  <!-- 紧凑双列：给 embed 一屏用 -->
  <section
    v-if="compact"
    class="control-card control-card--fit"
    aria-labelledby="watermark-heading"
  >
    <div class="fit-head">
      <h2 id="watermark-heading">设计水印</h2>
      <div class="fit-preset">
        <select
          name="preset"
          aria-label="预设模板"
          @change="
            (event) => {
              const id = (event.target as HTMLSelectElement).value
              const preset = [...BUILTIN_PRESETS, ...userPresets].find((item) => item.id === id)
              if (preset) usePreset(preset)
              ;(event.target as HTMLSelectElement).value = ''
            }
          "
        >
          <option value="">预设…</option>
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
        <button v-if="!savingPreset" class="secondary-button" type="button" @click="openPresetSave">
          <BookmarkPlus :size="14" />
        </button>
      </div>
    </div>

    <div v-if="savingPreset" class="preset-save-row">
      <input
        v-model="presetName"
        maxlength="24"
        name="presetName"
        placeholder="预设名称"
        @keydown.enter.prevent="confirmPresetSave"
        @keydown.esc.prevent="cancelPresetSave"
      />
      <button class="secondary-button" type="button" @click="confirmPresetSave"><Check :size="14" /></button>
      <button class="text-button" type="button" @click="cancelPresetSave"><X :size="14" /></button>
    </div>

    <div class="fit-grid">
      <div class="segmented-control segmented-control--triple fit-span" aria-label="水印写入方式">
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
        <div class="segmented-control" aria-label="内容类型">
          <button
            type="button"
            :class="{ active: options.mode === 'text' }"
            :aria-pressed="options.mode === 'text'"
            @click="options.mode = 'text'"
          >
            文字
          </button>
          <button
            type="button"
            :class="{ active: options.mode === 'logo' }"
            :aria-pressed="options.mode === 'logo'"
            @click="options.mode = 'logo'"
          >
            Logo
          </button>
        </div>

        <label v-if="options.mode === 'text'" class="field">
          <span>文字</span>
          <input v-model="options.text" maxlength="80" name="watermarkText" placeholder="水印文字" />
        </label>
        <label v-else class="logo-picker logo-picker--mini">
          <input class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="setLogo" />
          <ImagePlus :size="16" />
          <strong>{{ options.logoFile?.name || '选择 Logo' }}</strong>
        </label>

        <label class="field">
          <span>排列</span>
          <select v-model="options.placement" name="placement">
            <option value="single">单个</option>
            <option value="tile">平铺</option>
          </select>
        </label>
        <label v-if="options.placement === 'single'" class="field">
          <span>位置</span>
          <select v-model="options.position" name="position">
            <option v-for="position in positions" :key="position.value" :value="position.value">
              {{ position.label }}
            </option>
          </select>
        </label>
        <label v-else class="field">
          <span>间距 {{ options.gap }}px</span>
          <input v-model.number="options.gap" type="range" min="24" max="240" step="4" name="gap" />
        </label>

        <label class="field">
          <span>颜色</span>
          <span class="color-field">
            <input v-model="options.color" type="color" name="watermarkColor" />
            <code>{{ options.color.toUpperCase() }}</code>
          </span>
        </label>
        <label class="field">
          <span>透明 {{ Math.round(options.opacity * 100) }}%</span>
          <input v-model.number="options.opacity" type="range" min="0.06" max="1" step="0.01" name="opacity" />
        </label>
        <label class="field">
          <span>大小 {{ Math.round(options.scale * 100) }}%</span>
          <input v-model.number="options.scale" type="range" min="0.04" max="0.28" step="0.01" name="scale" />
        </label>
        <label class="field">
          <span>旋转 {{ options.rotation }}°</span>
          <input v-model.number="options.rotation" type="range" min="-60" max="60" step="1" name="rotation" />
        </label>
      </template>

      <div v-if="showHiddenControls" class="fit-panel fit-span">
        <label class="field">
          <span>隐藏标识 {{ payloadBytesUsed }}/{{ payloadByteLimit }}</span>
          <input
            :value="options.hiddenPayload"
            name="hiddenPayload"
            placeholder="订单号 / 创作者 ID"
            @input="onHiddenPayloadInput"
          />
        </label>
        <label class="field">
          <span>强度 {{ options.hiddenStrength }}</span>
          <input
            v-model.number="options.hiddenStrength"
            type="range"
            min="3"
            max="10"
            step="1"
            name="hiddenStrength"
          />
        </label>
      </div>

      <label class="field fit-export">
        <span>图片质量 {{ Math.round(options.imageQuality * 100) }}%</span>
        <input
          v-model.number="options.imageQuality"
          type="range"
          min="0.7"
          max="1"
          step="0.01"
          name="imageQuality"
        />
      </label>
      <label class="field fit-export">
        <span>视频编码</span>
        <select v-model="options.videoEncode" name="videoEncode">
          <option value="fast">更快</option>
          <option value="balanced">均衡</option>
          <option value="quality">更高画质</option>
        </select>
      </label>

      <details v-if="showVisibleControls" class="fit-more fit-span">
        <summary>PDF 字体等更多选项</summary>
        <div class="font-picker-row">
          <label class="font-picker">
            <input
              class="sr-only"
              type="file"
              accept=".ttf,.otf,font/ttf,font/otf"
              @change="setCustomFont"
            />
            <Type :size="15" stroke-width="1.8" />
            <span>
              <strong>{{ options.customFontFile?.name || '选择 TTF / OTF 字体' }}</strong>
              <small>{{ options.customFontFile ? '点击更换 · PDF 中文水印' : '可选 · 用于 PDF 中文水印' }}</small>
            </span>
          </label>
          <button
            v-if="options.customFontFile"
            class="text-button"
            type="button"
            aria-label="清除字体"
            @click="options.customFontFile = null"
          >
            <X :size="14" />
          </button>
        </div>
      </details>
    </div>
  </section>

  <!-- 完整版：给其它场景保留 -->
  <section
    v-else
    class="control-card"
    aria-labelledby="watermark-heading-full"
  >
    <div class="section-heading">
      <span class="step-index">02</span>
      <div>
        <p class="eyebrow">MARK DESIGN</p>
        <h2 id="watermark-heading-full">设计水印</h2>
      </div>
    </div>

    <div class="preset-row">
      <label class="field">
        <span>预设</span>
        <select
          name="presetFull"
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
      <button v-if="!savingPreset" class="secondary-button" type="button" @click="openPresetSave">
        <BookmarkPlus :size="15" /> 保存
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
        <input v-model="options.text" maxlength="80" name="watermarkTextFull" placeholder="输入品牌、姓名或版权信息" />
      </label>
      <label v-else class="logo-picker">
        <input class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="setLogo" />
        <ImagePlus :size="18" />
        <span>
          <strong>{{ options.logoFile?.name || '选择透明 Logo' }}</strong>
          <small>PNG / WebP</small>
        </span>
      </label>

      <div class="two-columns">
        <label class="field">
          <span>排列</span>
          <select v-model="options.placement" name="placementFull">
            <option value="single">单个</option>
            <option value="tile">平铺</option>
          </select>
        </label>
        <label class="field">
          <span>颜色</span>
          <span class="color-field">
            <input v-model="options.color" type="color" name="watermarkColorFull" />
            <code>{{ options.color.toUpperCase() }}</code>
          </span>
        </label>
      </div>

      <fieldset v-if="options.placement === 'single'" class="position-grid">
        <legend>
          位置
          <output>{{ positionLabel }}</output>
        </legend>
        <button
          v-for="position in positions"
          :key="position.value"
          type="button"
          :class="{ active: options.position === position.value }"
          :aria-label="position.label"
          :aria-pressed="options.position === position.value"
          :title="position.label"
          @click="options.position = position.value"
        />
      </fieldset>

      <div class="range-grid">
        <label>
          <span>透明度 <output>{{ Math.round(options.opacity * 100) }}%</output></span>
          <input v-model.number="options.opacity" type="range" min="0.06" max="1" step="0.01" name="opacityFull" />
        </label>
        <label>
          <span>大小 <output>{{ Math.round(options.scale * 100) }}%</output></span>
          <input v-model.number="options.scale" type="range" min="0.04" max="0.28" step="0.01" name="scaleFull" />
        </label>
        <label>
          <span>旋转 <output>{{ options.rotation }}°</output></span>
          <input v-model.number="options.rotation" type="range" min="-60" max="60" step="1" name="rotationFull" />
        </label>
        <label v-if="options.placement === 'tile'">
          <span>间距 <output>{{ options.gap }} px</output></span>
          <input v-model.number="options.gap" type="range" min="24" max="240" step="4" name="gapFull" />
        </label>
      </div>
    </template>

    <div v-if="showHiddenControls" class="hidden-panel active">
      <div class="switch-row">
        <span class="switch-icon"><ShieldCheck :size="18" /></span>
        <span>
          <strong>{{ options.embedStyle === 'hidden' ? '仅写入隐藏水印' : '写入隐藏水印' }}</strong>
          <small>DDWM v2</small>
        </span>
      </div>
      <label class="field">
        <span>隐藏标识 <output>{{ payloadBytesUsed }}/{{ payloadByteLimit }}</output></span>
        <input
          :value="options.hiddenPayload"
          name="hiddenPayloadFull"
          placeholder="订单号 / 创作者 ID"
          @input="onHiddenPayloadInput"
        />
      </label>
      <label class="hidden-strength">
        <span>强度 <output>{{ options.hiddenStrength }}</output></span>
        <input
          v-model.number="options.hiddenStrength"
          type="range"
          min="3"
          max="10"
          step="1"
          name="hiddenStrengthFull"
        />
      </label>
      <p class="boundary-note"><Eye :size="14" /> 上限 {{ payloadByteLimit }} 字节。</p>
    </div>

    <div class="range-grid">
      <label>
        <span>图片质量 <output>{{ Math.round(options.imageQuality * 100) }}%</output></span>
        <input
          v-model.number="options.imageQuality"
          type="range"
          min="0.7"
          max="1"
          step="0.01"
          name="imageQualityFull"
        />
      </label>
      <label class="field">
        <span>视频编码</span>
        <select v-model="options.videoEncode" name="videoEncodeFull">
          <option value="fast">更快</option>
          <option value="balanced">均衡</option>
          <option value="quality">更高画质</option>
        </select>
      </label>
    </div>
  </section>
</template>
