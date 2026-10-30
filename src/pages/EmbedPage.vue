<script setup lang="ts">
import { ArrowRight, Stamp } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import MediaStage from '../components/MediaStage.vue'
import ResultPanel from '../components/ResultPanel.vue'
import WatermarkControls from '../components/WatermarkControls.vue'
import { useWorkspaceStore } from '../stores/workspace'

const store = useWorkspaceStore()
const {
  files,
  options,
  status,
  progress,
  error,
  results,
  detections,
  canProcess,
  processBlockedReason,
  mediaKind,
} = storeToRefs(store)
const isCrossOriginIsolated = globalThis.crossOriginIsolated

onMounted(() => {
  store.setMode('embed')
})
</script>

<template>
  <div class="site-shell site-shell--embed">
    <div class="site-sky" aria-hidden="true" />
    <AppHeader active="embed" />

    <main class="workspace-main workspace-main--embed">
      <div class="workspace-grid workspace-grid--embed">
        <div class="workspace-pane workspace-pane--stage">
          <MediaStage
            :files="files"
            mode="embed"
            :options="options"
            :disabled="status === 'processing'"
            @add="(next) => store.addFiles(next, { append: true })"
            @replace="(next) => store.addFiles(next)"
            @remove="store.removeFile"
            @clear="store.clearFiles"
          />
          <ResultPanel
            class="result-panel--dock"
            mode="embed"
            :status="status"
            :progress="progress"
            :error="error"
            :results="results"
            :detections="detections"
            @cancel="store.cancel"
            @retry="store.processFiles"
            @download="store.downloadResult"
            @download-all="store.downloadAll"
          />
        </div>

        <div class="workspace-pane workspace-pane--controls">
          <div class="workspace-controls-scroll">
            <WatermarkControls v-model="options" :compact="true" />
          </div>
          <div class="workspace-cta">
            <p v-if="processBlockedReason && status !== 'processing'" class="process-hint">
              {{ processBlockedReason }}
            </p>
            <button
              class="process-button"
              type="button"
              :disabled="!canProcess"
              @click="store.processFiles"
            >
              <Stamp :size="18" />
              {{
                status === 'processing'
                  ? '正在处理…'
                  : `开始本地处理${files.length > 1 ? `（${files.length}）` : ''}`
              }}
              <ArrowRight :size="17" />
            </button>
            <p v-if="mediaKind === 'video' && !isCrossOriginIsolated" class="engine-note">
              未启用跨源隔离，视频将使用单线程模式。
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
