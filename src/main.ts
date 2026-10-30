import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'

// 清掉本机曾注册的 SW，避免继续命中旧版加水印/隐藏水印脚本
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) void reg.unregister()
  })
}

createApp(App).use(createPinia()).use(router).mount('#app')
