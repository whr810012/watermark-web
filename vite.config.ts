import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Pages 单文件 25MiB：生产默认从 unpkg 拉 FFmpeg，避免打进 dist
  const ffmpegCdn =
    env.VITE_FFMPEG_CDN?.trim() || (mode === 'production' ? 'https://unpkg.com' : '')

  return {
    base: '/watermark/',
    define: ffmpegCdn
      ? {
          'import.meta.env.VITE_FFMPEG_CDN': JSON.stringify(ffmpegCdn),
        }
      : undefined,
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        base: '/watermark/',
        scope: '/watermark/',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: '加水印',
          short_name: '加水印',
          description: '浏览器本地图片 / PDF / 视频水印工具',
          start_url: '/watermark/',
          scope: '/watermark/',
          display: 'standalone',
          background_color: '#f0ebe3',
          theme_color: '#5969df',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: '/watermark/index.html',
          globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.pathname.includes('/watermark/ffmpeg/') || url.href.includes('@ffmpeg/core'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'ffmpeg-wasm',
                expiration: {
                  maxEntries: 16,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.includes('/watermark/fonts/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'watermark-fonts',
                expiration: {
                  maxEntries: 8,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
