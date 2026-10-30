<script setup lang="ts">
import { Download, Stamp, WifiOff } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref } from 'vue'

defineProps<{
  active?: 'home' | 'embed' | 'detect'
}>()

const canInstall = ref(false)
const engineCached = ref(false)
let deferredPrompt: BeforeInstallPromptEvent | null = null

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
}

function onBeforeInstall(event: Event) {
  event.preventDefault()
  deferredPrompt = event as BeforeInstallPromptEvent
  canInstall.value = true
}

async function installApp() {
  if (!deferredPrompt) return
  await deferredPrompt.prompt()
  deferredPrompt = null
  canInstall.value = false
}

onMounted(async () => {
  window.addEventListener('beforeinstallprompt', onBeforeInstall)
  if ('caches' in window) {
    const keys = await caches.keys()
    engineCached.value = keys.some((key) => key.includes('ffmpeg'))
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstall)
})
</script>

<template>
  <header class="topbar">
    <router-link class="brand" to="/" aria-label="加水印首页" active-class="" exact-active-class="">
      <span class="brand-mark"><Stamp :size="20" /></span>
      <span>
        <b>加水印</b>
        <small>DANDAN WATERMARK</small>
      </span>
    </router-link>

    <nav aria-label="页面导航">
      <div class="nav-pills">
        <router-link to="/" :class="{ active: active === 'home' }" active-class="" exact-active-class="">
          首页
        </router-link>
        <router-link
          to="/embed"
          :class="{ active: active === 'embed' }"
          active-class=""
          exact-active-class=""
        >
          打水印
        </router-link>
        <router-link
          to="/detect"
          :class="{ active: active === 'detect' }"
          active-class=""
          exact-active-class=""
        >
          识别水印
        </router-link>
      </div>
      <a class="hub-link" href="https://dandanhub.vip/">蛋蛋中心</a>
      <button v-if="canInstall" class="hub-link" type="button" @click="installApp">
        <Download :size="14" /> 安装应用
      </button>
      <span v-if="engineCached" class="offline-chip offline-chip--optional">引擎已缓存</span>
      <span class="offline-chip offline-chip--core"><WifiOff :size="14" /> 文件全程离线</span>
    </nav>
  </header>
</template>
