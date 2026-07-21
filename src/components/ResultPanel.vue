<script setup lang="ts">
import {
  AlertTriangle,
  Check,
  CircleX,
  Download,
  FileArchive,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-vue-next'
import type { DetectionResult, JobProgress, ProcessingResult, WorkflowMode } from '../core/types'

defineProps<{
  mode: WorkflowMode
  status: 'idle' | 'processing' | 'done' | 'error'
  progress: JobProgress
  error: string
  results: ProcessingResult[]
  detections: Array<DetectionResult & { fileName: string }>
}>()

const emit = defineEmits<{
  cancel: []
  retry: []
  download: [result: ProcessingResult]
  downloadAll: []
}>()

function confidence(value: number) {
  return `${Math.round(value * 100)}%`
}
</script>

<template>
  <section v-if="status !== 'idle'" class="result-panel" aria-live="polite">
    <template v-if="status === 'processing'">
      <div class="result-icon result-icon--working"><LoaderCircle :size="24" /></div>
      <div class="result-content">
        <strong>{{ progress.phase }}</strong>
        <span>请保持当前页面开启，原文件不会离开设备。</span>
        <div class="progress-track">
          <i :style="{ width: `${Math.round(progress.progress * 100)}%` }" />
        </div>
      </div>
      <button class="secondary-button" type="button" @click="emit('cancel')">
        <CircleX :size="16" /> 取消
      </button>
    </template>

    <template v-else-if="status === 'error'">
      <div class="result-icon result-icon--error"><AlertTriangle :size="24" /></div>
      <div class="result-content">
        <strong>这次没有处理成功</strong>
        <span>{{ error }}</span>
      </div>
      <button class="secondary-button" type="button" @click="emit('retry')">
        <RotateCcw :size="16" /> 重试
      </button>
    </template>

    <template v-else-if="mode === 'embed'">
      <div class="result-icon result-icon--success"><Check :size="24" /></div>
      <div class="result-content">
        <strong>{{ results.length }} 个结果已在本地生成</strong>
        <span>离开页面前记得下载，刷新后结果不会保留。</span>
        <ul class="result-files">
          <li v-for="result in results" :key="result.fileName">
            <span>{{ result.fileName }}</span>
            <button type="button" @click="emit('download', result)">
              <Download :size="15" /> 下载
            </button>
          </li>
        </ul>
      </div>
      <button v-if="results.length > 1" class="primary-button" type="button" @click="emit('downloadAll')">
        <FileArchive :size="17" /> 打包下载
      </button>
    </template>

    <template v-else>
      <div class="result-icon result-icon--scan"><ScanLine :size="24" /></div>
      <div class="result-content detection-list">
        <strong>检测完成</strong>
        <article v-for="item in detections" :key="item.fileName" :class="{ found: item.found }">
          <component :is="item.found ? ShieldCheck : ShieldAlert" :size="20" />
          <div>
            <b>{{ item.fileName }}</b>
            <span>{{ item.message }}</span>
            <dl v-if="item.found">
              <div><dt>隐藏标识</dt><dd>{{ item.payload || '空标识' }}</dd></div>
              <div><dt>置信度</dt><dd>{{ confidence(item.confidence) }}</dd></div>
              <div><dt>完整性</dt><dd>{{ item.integrity === 'valid' ? '校验通过' : '可能受损' }}</dd></div>
            </dl>
          </div>
        </article>
        <p class="detection-disclaimer">
          “未检出”只表示没有识别到本工具的有效 DDWM 信号，不代表文件确定没有其他水印。
        </p>
      </div>
    </template>
  </section>
</template>
