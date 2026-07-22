<script setup lang="ts">
import { CheckCircle2, Fingerprint, ScanSearch, Shield, Stamp } from 'lucide-vue-next'
import AppHeader from '../components/AppHeader.vue'
</script>

<template>
  <div class="site-shell">
    <div class="site-sky" aria-hidden="true" />
    <AppHeader active="home" />

    <main class="landing-main">
      <section class="landing-hero">
        <div class="landing-hero__copy">
          <p class="landing-kicker"><span /> NO UPLOAD · LOCAL LAB</p>
          <h1>
            让作品留下
            <span>你的痕迹。</span>
          </h1>
          <p class="landing-lead">
            在浏览器本地为图片、PDF 与视频添加可见或隐藏水印，也能检测本工具生成的 DDWM 标记。文件不上传、不经服务器。
          </p>
          <ul class="landing-proof">
            <li><CheckCircle2 :size="16" /> 本地计算</li>
            <li><CheckCircle2 :size="16" /> 批量图片</li>
            <li><CheckCircle2 :size="16" /> DDWM 隐藏标记</li>
          </ul>
        </div>

        <div class="landing-seal" aria-hidden="true">
          <span class="landing-seal__orbit" />
          <div class="landing-seal__core">
            <Fingerprint :size="54" stroke-width="1.2" />
            <strong>100%</strong>
            <small>LOCAL</small>
          </div>
        </div>
      </section>

      <section class="landing-products" aria-labelledby="tools-title">
        <div class="section-head">
          <div>
            <p>TOOLS / 01</p>
            <h2 id="tools-title">选择你要做的事</h2>
          </div>
          <span>打水印与识别分开，流程更清楚</span>
        </div>

        <div class="product-grid">
          <router-link class="product-card product-card--embed" to="/embed">
            <div class="product-card__top">
              <span>01</span>
              <span class="product-card__state"><i />网页本地处理</span>
            </div>
            <div class="product-card__art" aria-hidden="true">
              <Stamp :size="48" stroke-width="1.25" />
            </div>
            <div class="product-card__body">
              <p class="product-card__eyebrow">EMBED WATERMARK</p>
              <h3>打水印</h3>
              <p>为图片、PDF、视频添加文字 / Logo 可见水印，或写入可检测的隐藏标记。</p>
              <ul>
                <li>可见水印</li>
                <li>隐藏 DDWM</li>
                <li>批量图片</li>
              </ul>
              <span class="product-card__action">进入打水印 <i>↗</i></span>
            </div>
          </router-link>

          <router-link class="product-card product-card--detect" to="/detect">
            <div class="product-card__top">
              <span>02</span>
              <span class="product-card__state"><i />仅识别本工具标记</span>
            </div>
            <div class="product-card__art product-card__art--detect" aria-hidden="true">
              <ScanSearch :size="48" stroke-width="1.25" />
            </div>
            <div class="product-card__body">
              <p class="product-card__eyebrow">DETECT WATERMARK</p>
              <h3>识别水印</h3>
              <p>扫描本工具写入的隐藏水印，返回标识、置信度与完整性校验结果。</p>
              <ul>
                <li>图片扫描</li>
                <li>PDF 多页</li>
                <li>视频抽样</li>
              </ul>
              <span class="product-card__action">进入识别 <i>↗</i></span>
            </div>
          </router-link>
        </div>
      </section>

      <section class="local-manifesto">
        <span class="manifesto-icon"><Shield :size="26" /></span>
        <div>
          <p class="eyebrow">PRIVACY BY ARCHITECTURE</p>
          <h2>不是“承诺不上传”，而是没有上传入口。</h2>
        </div>
        <p>
          Canvas、PDF.js 与 FFmpeg WebAssembly 在浏览器本地完成任务。服务器只提供页面代码，无法接触你的文件内容。
        </p>
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
