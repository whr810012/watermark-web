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
  mediaKind,
} = storeToRefs(store)
const isCrossOriginIsolated = globalThis.crossOriginIsolated

onMounted(() => {
  store.setMode('embed')
})
</script>

<template>
  <div class="site-shell">
    <div class="site-sky" aria-hidden="true" />
    <AppHeader active="embed" />

    <main class="workspace-main">
      <section class="workspace-intro">
        <div>
          <p class="eyebrow">EMBED / 打水印</p>
          <h1>添加可见或隐藏水印</h1>
          <p>上传文件、调整样式，在浏览器本地生成结果。文件不会离开你的设备。</p>
        </div>
      </section>

      <section class="workspace-section">
        <div class="workspace-grid">
          <div class="workspace-column workspace-column--sticky">
            <MediaStage
              :files="files"
              mode="embed"
              :options="options"
              :disabled="status === 'processing'"
              @add="store.addFiles"
              @remove="store.removeFile"
              @clear="store.clearFiles"
            />
            <button
              class="process-button"
              type="button"
              :disabled="!canProcess"
              @click="store.processFiles"
            >
              <Stamp :size="20" />
              {{
                status === 'processing'
                  ? '正在处理…'
                  : `开始本地处理${files.length > 1 ? `（${files.length}）` : ''}`
              }}
              <ArrowRight :size="19" />
            </button>
            <p v-if="mediaKind === 'video' && !isCrossOriginIsolated" class="engine-note">
              当前响应头未启用跨源隔离，视频引擎将自动使用兼容单线程模式，速度会更慢。
            </p>
          </div>

          <div class="workspace-column">
            <WatermarkControls v-model="options" />
          </div>
        </div>

        <ResultPanel
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
      </section>
    </main>

    <footer class="site-footer">
      <div>
        <span class="footer-egg" aria-hidden="true" />
        <strong>蛋蛋中心 · 加水印</strong>
      </div>
      <p>结果仅保存在当前页面会话</p>
    </footer>
  </div>
</template>
