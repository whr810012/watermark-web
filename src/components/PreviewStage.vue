<script setup lang="ts">
import { FileQuestion, LockKeyhole, ScanSearch } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { detectMediaKind } from '../core/media'
import type { WatermarkOptions, WorkflowMode } from '../core/types'

const props = defineProps<{
  file: File | null
  mode: WorkflowMode
  options: WatermarkOptions
}>()

const objectUrl = ref('')
const logoUrl = ref('')
watch(
  () => props.file,
  (file) => {
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = file ? URL.createObjectURL(file) : ''
  },
  { immediate: true },
)
watch(
  () => props.options.logoFile,
  (file) => {
    if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
    logoUrl.value = file ? URL.createObjectURL(file) : ''
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  if (logoUrl.value) URL.revokeObjectURL(logoUrl.value)
})

const kind = computed(() => (props.file ? detectMediaKind(props.file) : null))
const previewStyle = computed(() => ({
  opacity: props.options.opacity,
  color: props.options.color,
  transform: `rotate(${props.options.rotation}deg)`,
  fontSize: `${Math.max(0.75, props.options.scale * 8)}rem`,
}))
</script>

<template>
  <section class="preview-card" aria-labelledby="preview-heading">
    <div class="section-heading section-heading--inverse">
      <span class="step-index">03</span>
      <div>
        <p class="eyebrow">LOCAL PREVIEW</p>
        <h2 id="preview-heading">{{ mode === 'embed' ? '画面预览' : '检测对象' }}</h2>
      </div>
      <span class="privacy-badge"><LockKeyhole :size="14" /> 不上传</span>
    </div>

    <div class="preview-canvas">
      <template v-if="file">
        <img v-if="kind === 'image'" :src="objectUrl" :alt="file.name" />
        <video v-else-if="kind === 'video'" :src="objectUrl" controls muted />
        <iframe v-else-if="kind === 'pdf'" :src="objectUrl" :title="file.name" />
        <div
          v-if="mode === 'embed' && options.placement === 'single'"
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
        <div v-else-if="mode === 'embed'" class="tile-preview" :style="{ opacity: options.opacity }">
          <span v-for="index in 12" :key="index" :style="previewStyle">{{ options.text || 'DANDAN HUB' }}</span>
        </div>
        <span class="file-ribbon">{{ kind?.toUpperCase() }}</span>
      </template>
      <div v-else class="preview-empty">
        <component :is="mode === 'detect' ? ScanSearch : FileQuestion" :size="42" stroke-width="1.35" />
        <strong>{{ mode === 'detect' ? '等待需要检测的文件' : '先添加一份作品' }}</strong>
        <span>文件只会出现在你的浏览器内存中</span>
      </div>
    </div>
    <p class="preview-caption">
      {{
        file
          ? '预览用于确认布局；最终结果按原始分辨率本地生成。'
          : '支持图片批量，PDF 与视频单文件处理。'
      }}
    </p>
  </section>
</template>
