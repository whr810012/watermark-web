<script setup lang="ts">
import { ArrowRight, Fingerprint, ScanSearch, Shield, Sparkles } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import MediaStage from '../components/MediaStage.vue'
import ResultPanel from '../components/ResultPanel.vue'
import { defaultWatermarkOptions } from '../core/types'
import { useWorkspaceStore } from '../stores/workspace'

const store = useWorkspaceStore()
const {
  files,
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
const previewOptions = defaultWatermarkOptions
const resultAnchor = ref<HTMLElement | null>(null)

const guideTitle = computed(() => (status.value === 'done' ? '检测参考' : '识别说明'))
const showReadyHint = computed(() => status.value === 'idle' && files.value.length > 0)

onMounted(() => {
  store.setMode('detect')
})

watch(status, async (next, prev) => {
  if (prev !== 'processing') return
  if (next !== 'done' && next !== 'error') return
  await nextTick()
  resultAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})
</script>

<template>
  <div class="site-shell">
    <div class="site-sky" aria-hidden="true" />
    <AppHeader active="detect" />

    <main class="workspace-main">
      <section class="workspace-intro">
        <div>
          <p class="eyebrow">DETECT / 识别水印</p>
          <h1>识别隐藏标记</h1>
          <p>检测本工具生成的 DDWM 隐藏水印。未检出不等于确定没有其他水印。</p>
        </div>
      </section>

      <section class="workspace-section">
        <div class="workspace-grid">
          <div class="workspace-column workspace-column--sticky">
            <MediaStage
              :files="files"
              mode="detect"
              :options="previewOptions"
              :disabled="status === 'processing'"
              @add="(next) => store.addFiles(next, { append: true })"
              @replace="(next) => store.addFiles(next)"
              @remove="store.removeFile"
              @clear="store.clearFiles"
            />
            <p v-if="processBlockedReason && status !== 'processing'" class="process-hint">
              {{ processBlockedReason }}
            </p>
            <button
              class="process-button"
              type="button"
              :disabled="!canProcess"
              @click="store.processFiles"
            >
              <ScanSearch :size="20" />
              {{ status === 'processing' ? '正在处理…' : '开始检测隐藏水印' }}
              <ArrowRight :size="19" />
            </button>
            <p v-if="mediaKind === 'video' && !isCrossOriginIsolated" class="engine-note">
              当前响应头未启用跨源隔离，视频引擎将自动使用兼容单线程模式，速度会更慢。
            </p>
          </div>

          <div class="workspace-column">
            <div
              v-if="showReadyHint"
              class="result-panel result-panel--ready"
              role="status"
            >
              <div class="result-icon result-icon--scan"><ScanSearch :size="24" /></div>
              <div class="result-content">
                <strong>已选 {{ files.length }} 个文件</strong>
                <span>点击左侧「开始检测隐藏水印」，结果会显示在这里。</span>
              </div>
            </div>

            <div ref="resultAnchor">
              <ResultPanel
                class="result-panel--inline"
                mode="detect"
                :status="status"
                :progress="progress"
                :error="error"
                :results="results"
                :detections="detections"
                @cancel="store.cancel"
                @retry="store.processFiles"
                @download="store.downloadResult"
                @download-all="store.downloadAll"
                @export-json="store.exportDetections('json')"
                @export-csv="store.exportDetections('csv')"
              />
            </div>

            <section class="detect-guide" aria-labelledby="detect-guide-heading">
              <div class="section-heading">
                <span class="step-index step-index--muted">?</span>
                <div>
                  <p class="eyebrow">DDWM SCANNER</p>
                  <h2 id="detect-guide-heading">{{ guideTitle }}</h2>
                </div>
              </div>
              <div class="scan-graphic">
                <ScanSearch :size="46" stroke-width="1.2" />
                <i /><i /><i />
              </div>
              <h3>检测本工具生成的隐藏水印</h3>
              <p>
                图片将执行归一化网格相关扫描；PDF 检查多个页面；视频抽取多个时间点并多数投票。
              </p>
              <ul>
                <li><Shield :size="15" /> 返回隐藏标识、写入时间与完整性</li>
                <li><Fingerprint :size="15" /> CRC 校验降低随机误报</li>
                <li><Sparkles :size="15" /> 兼容轻度压缩和等比例缩放</li>
              </ul>
              <div class="boundary-callout">
                检测仅针对 DDWM 格式（含 v1/v2）。未检出不等于确定没有水印，也不识别第三方隐藏方案。
              </div>
            </section>
          </div>
        </div>
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
