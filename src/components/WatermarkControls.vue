<script setup lang="ts">
import { Eye, Grid3X3, ImagePlus, ShieldCheck, Type } from 'lucide-vue-next'
import type { WatermarkOptions, WatermarkPosition } from '../core/types'

const options = defineModel<WatermarkOptions>({ required: true })

const positions: Array<{ value: WatermarkPosition; label: string }> = [
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'center', label: '居中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
]

function setLogo(event: Event) {
  options.value.logoFile = (event.target as HTMLInputElement).files?.[0] ?? null
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
      <input v-model="options.text" maxlength="80" name="watermarkText" placeholder="输入品牌、姓名或版权信息" />
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

    <div class="hidden-panel" :class="{ active: options.hiddenEnabled }">
      <label class="switch-row">
        <span class="switch-icon"><ShieldCheck :size="18" /></span>
        <span>
          <strong>同时写入隐藏水印</strong>
          <small>工具专属 DDWM 标记，可在检测页读取</small>
        </span>
        <input v-model="options.hiddenEnabled" type="checkbox" role="switch" name="hiddenEnabled" />
      </label>
      <template v-if="options.hiddenEnabled">
        <label class="field">
          <span>隐藏标识</span>
          <input v-model="options.hiddenPayload" maxlength="32" name="hiddenPayload" placeholder="例如：订单号、创作者 ID" />
        </label>
        <label class="hidden-strength">
          <span>嵌入强度 <output>{{ options.hiddenStrength }}</output></span>
          <input v-model.number="options.hiddenStrength" type="range" min="3" max="10" step="1" name="hiddenStrength" />
        </label>
        <p class="boundary-note">
          <Eye :size="15" />
          可抵抗轻度压缩与等比例缩放；不承诺抵抗明显裁剪、旋转、截图或恶意清除。
        </p>
      </template>
    </div>

    <div class="control-footnote">
      <Grid3X3 :size="15" />
      所有参数只在本机浏览器内参与计算。
    </div>
  </section>
</template>
