<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Fingerprint,
  Github,
  ScanSearch,
  Shield,
  Sparkles,
  Stamp,
  WifiOff,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import FileDropZone from '../components/FileDropZone.vue'
import PreviewStage from '../components/PreviewStage.vue'
import ResultPanel from '../components/ResultPanel.vue'
import WatermarkControls from '../components/WatermarkControls.vue'
import { useWorkspaceStore } from '../stores/workspace'

const store = useWorkspaceStore()
const {
  mode,
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
</script>

<template>
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="/">
        <span class="brand-mark"><Stamp :size="21" /></span>
        <span><b>加水印</b><small>DANDAN LOCAL LAB</small></span>
      </a>
      <nav aria-label="页面导航">
        <a href="/"><ArrowLeft :size="15" /> 蛋蛋中心</a>
        <span><WifiOff :size="14" /> 文件全程离线</span>
      </nav>
    </header>

    <main>
      <section class="hero-section">
        <div class="hero-copy">
          <p class="hero-kicker"><span>NO UPLOAD</span> BROWSER-NATIVE WATERMARK STUDIO</p>
          <h1>让作品留下<br /><em>你的痕迹。</em></h1>
          <p class="hero-lead">
            在浏览器内为图片、PDF 与视频添加可见或隐藏水印。文件不上传，不经过服务器，也不留下副本。
          </p>
          <ul class="hero-proof">
            <li><CheckCircle2 :size="16" /> 本地计算</li>
            <li><CheckCircle2 :size="16" /> 批量图片</li>
            <li><CheckCircle2 :size="16" /> DDWM 隐藏标记</li>
          </ul>
        </div>
        <div class="hero-seal" aria-hidden="true">
          <div class="seal-ring"><Fingerprint :size="74" stroke-width="1" /></div>
          <span>100%</span>
          <small>LOCAL</small>
        </div>
        <span class="hero-number">#03</span>
      </section>

      <section class="workspace-section">
        <div class="workflow-tabs" role="tablist" aria-label="工作流">
          <button
            role="tab"
            type="button"
            :aria-selected="mode === 'embed'"
            :class="{ active: mode === 'embed' }"
            @click="store.setMode('embed')"
          >
            <Stamp :size="19" />
            <span><b>添加水印</b><small>可见水印 + 隐藏标记</small></span>
          </button>
          <button
            role="tab"
            type="button"
            :aria-selected="mode === 'detect'"
            :class="{ active: mode === 'detect' }"
            @click="store.setMode('detect')"
          >
            <ScanSearch :size="19" />
            <span><b>检测水印</b><small>读取本工具隐藏标记</small></span>
          </button>
        </div>

        <div class="workspace-grid">
          <div class="workspace-column">
            <FileDropZone
              :files="files"
              :disabled="status === 'processing'"
              @add="store.addFiles"
              @remove="store.removeFile"
              @clear="store.clearFiles"
            />

            <WatermarkControls v-if="mode === 'embed'" v-model="options" />
            <section v-else class="detect-guide" aria-labelledby="detect-guide-heading">
              <div class="section-heading">
                <span class="step-index">02</span>
                <div>
                  <p class="eyebrow">DDWM SCANNER</p>
                  <h2 id="detect-guide-heading">识别隐藏标记</h2>
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
                检测仅针对 DDWM 格式。未检出不等于确定没有水印，也不识别第三方隐藏方案。
              </div>
            </section>
          </div>

          <div class="workspace-column workspace-column--sticky">
            <PreviewStage :file="files[0] ?? null" :mode="mode" :options="options" />
            <button
              class="process-button"
              type="button"
              :disabled="!canProcess"
              @click="store.processFiles"
            >
              <component :is="mode === 'embed' ? Stamp : ScanSearch" :size="20" />
              {{
                status === 'processing'
                  ? '正在处理…'
                  : mode === 'embed'
                    ? `开始本地处理${files.length > 1 ? `（${files.length}）` : ''}`
                    : '开始检测隐藏水印'
              }}
              <ArrowRight :size="19" />
            </button>
            <p v-if="mediaKind === 'video' && !isCrossOriginIsolated" class="engine-note">
              当前响应头未启用跨源隔离，视频引擎将自动使用兼容单线程模式，速度会更慢。
            </p>
          </div>
        </div>

        <ResultPanel
          :mode="mode"
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

      <section class="local-manifesto">
        <span class="manifesto-icon"><Shield :size="28" /></span>
        <div>
          <p class="eyebrow">PRIVACY BY ARCHITECTURE</p>
          <h2>不是“承诺不上传”，而是没有上传入口。</h2>
        </div>
        <p>
          Canvas、PDF.js 与 FFmpeg WebAssembly 在浏览器本地完成任务。服务器只提供页面代码，无法接触你的文件内容。
        </p>
      </section>
    </main>

    <footer>
      <span>蛋蛋中心实验室 · 加水印</span>
      <span><Download :size="14" /> 结果仅保存在当前页面会话</span>
      <a href="https://github.com/" target="_blank" rel="noreferrer"><Github :size="14" /> 开源组件</a>
    </footer>
  </div>
</template>
