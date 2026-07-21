<script setup lang="ts">
import { FilePlus2, FileText, Film, Image, Trash2, UploadCloud } from 'lucide-vue-next'
import { ref } from 'vue'
import { detectMediaKind, formatFileSize } from '../core/media'

defineProps<{ files: File[]; disabled?: boolean }>()
const emit = defineEmits<{
  add: [files: File[]]
  remove: [index: number]
  clear: []
}>()

const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

function pickFiles(event: Event) {
  const target = event.target as HTMLInputElement
  emit('add', Array.from(target.files ?? []))
  target.value = ''
}

function drop(event: DragEvent) {
  dragging.value = false
  emit('add', Array.from(event.dataTransfer?.files ?? []))
}

function iconFor(file: File) {
  const kind = detectMediaKind(file)
  return kind === 'video' ? Film : kind === 'pdf' ? FileText : Image
}
</script>

<template>
  <section class="drop-card" aria-labelledby="file-heading">
    <div class="section-heading">
      <span class="step-index">01</span>
      <div>
        <p class="eyebrow">LOCAL INPUT</p>
        <h2 id="file-heading">选择本地文件</h2>
      </div>
      <button v-if="files.length" class="text-button" type="button" @click="emit('clear')">
        清空
      </button>
    </div>

    <button
      class="drop-zone"
      :class="{ 'drop-zone--active': dragging, 'drop-zone--filled': files.length }"
      type="button"
      :disabled="disabled"
      @click="input?.click()"
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
        @change="pickFiles"
      />
      <span class="drop-icon"><UploadCloud :size="27" stroke-width="1.7" /></span>
      <strong>{{ files.length ? '继续添加或替换文件' : '把文件拖到这里' }}</strong>
      <span>或点击浏览 · 图片可批量 20 张</span>
      <small>PNG / JPEG / WebP · PDF · MP4 / WebM / MOV</small>
    </button>

    <ul v-if="files.length" class="file-list" aria-label="待处理文件">
      <li v-for="(file, index) in files" :key="`${file.name}-${file.lastModified}`">
        <component :is="iconFor(file)" :size="18" />
        <span class="file-copy">
          <strong>{{ file.name }}</strong>
          <small>{{ formatFileSize(file.size) }}</small>
        </span>
        <button type="button" :aria-label="`移除 ${file.name}`" @click="emit('remove', index)">
          <Trash2 :size="17" />
        </button>
      </li>
    </ul>

    <button v-if="files.length && detectMediaKind(files[0]) === 'image'" class="add-more" type="button" @click="input?.click()">
      <FilePlus2 :size="16" /> 添加更多图片
    </button>
  </section>
</template>
