<script setup lang="ts">
import {
  FilePlus2,
  FileQuestion,
  FileText,
  Film,
  Image,
  LockKeyhole,
  ScanSearch,
  Trash2,
  UploadCloud,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { detectMediaKind, formatFileSize } from '../core/media'
import { wantsVisibleWatermark, type WatermarkOptions, type WorkflowMode } from '../core/types'

const props = defineProps<{
  files: File[]
  mode: WorkflowMode
  options: WatermarkOptions
  disabled?: boolean
}>()

const emit = defineEmits<{
  add: [files: File[]]
  remove: [index: number]
  clear: []
}>()

const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const objectUrl = ref('')
const logoUrl = ref('')

const file = computed(() => props.files[0] ?? null)
const kind = computed(() => (file.value ? detectMediaKind(file.value) : null))
const showVisiblePreview = computed(
  () => props.mode === 'embed' && Boolean(file.value) && wantsVisibleWatermark(props.options),
)

watch(
  file,
  (next) => {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = next ? URL.createObjectURL(next) : ''
  },
  { immediate: true },
)
watch(
  () => props.options.logoFile,
  (next) => {
    if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
    logoUrl.value = next ? URL.createObjectURL(next) : ''
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
})

const previewStyle = computed(() => ({
  opacity: props.options.opacity,
  color: props.options.color,
  transform: `rotate(${props.options.rotation}deg)`,
  fontSize: `${Math.max(0.75, props.options.scale * 8)}rem`,
}))

function pickFiles(event: Event) {
  const target = event.target as HTMLInputElement
  emit('add', Array.from(target.files ?? []))
  target.value = ''
}

function drop(event: DragEvent) {
  dragging.value = false
  if (props.disabled) return
  emit('add', Array.from(event.dataTransfer?.files ?? []))
}

function iconFor(item: File) {
  const media = detectMediaKind(item)
  return media === 'video' ? Film : media === 'pdf' ? FileText : Image
}

function openPicker() {
  if (!props.disabled) input.value?.click()
}
</script>

<template>
  <section class="media-stage" aria-labelledby="media-heading">
    <div class="section-heading section-heading--inverse">
      <span class="step-index">01</span>
      <div>
        <p class="eyebrow">LOCAL FILE + PREVIEW</p>
        <h2 id="media-heading">{{ mode === 'embed' ? '选择并预览' : '选择检测对象' }}</h2>
      </div>
      <button v-if="files.length" class="text-button text-button--on-dark" type="button" @click="emit('clear')">
        清空
      </button>
      <span class="privacy-badge"><LockKeyhole :size="14" /> 不上传</span>
    </div>

    <div
      class="preview-canvas media-stage__canvas"
      :class="{
        'media-stage__canvas--empty': !file,
        'media-stage__canvas--dragging': dragging,
        'media-stage__canvas--disabled': disabled,
      }"
      role="button"
      tabindex="0"
      :aria-disabled="disabled"
      :aria-label="file ? '更换文件或预览当前作品' : '拖拽或点击选择本地文件'"
      @click="openPicker"
      @keydown.enter.prevent="openPicker"
      @keydown.space.prevent="openPicker"
      @dragenter.prevent="dragging = true"
      @dragover.prevent
      @dragleave.prevent="dragging = false"
      @drop.prevent="drop"
    >
      <input
        ref="input"
        class="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4,video/webm,video/quicktime"
        multiple
        :disabled="disabled"
        @change="pickFiles"
        @click.stop
      />

      <template v-if="file">
        <img v-if="kind === 'image'" :src="objectUrl" :alt="file.name" @click.stop />
        <video
          v-else-if="kind === 'video'"
          :src="objectUrl"
          controls
          muted
          @click.stop
        />
        <iframe
          v-else-if="kind === 'pdf'"
          :src="objectUrl"
          :title="file.name"
          @click.stop
        />
        <div
          v-if="showVisiblePreview && options.placement === 'single'"
          class="live-mark"
          :class="`live-mark--${options.position}`"
          :style="previewStyle"
        >
          <img
            v-if="options.mode === 'logo' && options.logoFile"
            :src="logoUrl"
            alt="Logo 水印预览"
          />
          <span v-else>{{ options.text || 'DANDAN HUB' }}</span>
        </div>
        <div
          v-else-if="showVisiblePreview"
          class="tile-preview"
          :style="{ opacity: options.opacity }"
        >
          <span v-for="index in 12" :key="index" :style="previewStyle">{{
            options.text || 'DANDAN HUB'
          }}</span>
        </div>
        <div
          v-else-if="mode === 'embed' && options.embedStyle === 'hidden'"
          class="hidden-only-badge"
        >
          仅写入隐藏标记 · 画面上不会出现可见水印
        </div>
        <span class="file-ribbon">{{ kind?.toUpperCase() }}</span>
        <span class="media-stage__replace">点击或拖入可替换文件</span>
      </template>

      <div v-else class="preview-empty media-stage__empty">
        <span class="drop-icon"><UploadCloud :size="27" stroke-width="1.7" /></span>
        <component :is="mode === 'detect' ? ScanSearch : FileQuestion" :size="28" stroke-width="1.35" class="sr-only" />
        <strong>{{ dragging ? '松开即可添加' : '把文件拖到这里，或点击选择' }}</strong>
        <span>图片可批量 20 张 · PDF 最多 3 · 视频最多 2</span>
        <small>PNG / JPEG / WebP · PDF · MP4 / WebM / MOV</small>
      </div>
    </div>

    <ul v-if="files.length" class="file-list media-stage__files" aria-label="待处理文件">
      <li v-for="(item, index) in files" :key="`${item.name}-${item.lastModified}`">
        <component :is="iconFor(item)" :size="18" />
        <span class="file-copy">
          <strong>{{ item.name }}</strong>
          <small>{{ formatFileSize(item.size) }}</small>
        </span>
        <button type="button" :aria-label="`移除 ${item.name}`" @click="emit('remove', index)">
          <Trash2 :size="17" />
        </button>
      </li>
    </ul>

    <div class="media-stage__footer">
      <p class="preview-caption">
        {{
          file
            ? mode === 'embed' && options.embedStyle === 'hidden'
              ? '隐藏水印不会在预览中显示，将直接写入像素/图层。'
              : '预览用于确认布局；最终结果按原始分辨率本地生成。'
            : '文件只在浏览器内存中处理，不会上传。'
        }}
      </p>
      <button
        v-if="files.length && detectMediaKind(files[0]) === 'image'"
        class="add-more"
        type="button"
        :disabled="disabled"
        @click="openPicker"
      >
        <FilePlus2 :size="16" /> 添加更多图片
      </button>
    </div>
  </section>
</template>
