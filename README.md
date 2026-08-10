# 加水印（watermark-web）

浏览器本地为图片、PDF、视频添加可见/隐藏水印（文件不上传）。

## 本地开发

```bash
npm install
npm run dev
```

开发地址带 base：`/watermark/`。视频引擎使用本地复制的 FFmpeg WASM（`npm run predev`）。

## 部署（Cloudflare Pages）

Pages 单文件上限 25MiB，FFmpeg multi-thread wasm ~31MiB，**不能打进 dist**。

1. Create → **Pages** → 导入 `watermark-web`
2. 构建：

| 项 | 值 |
|----|-----|
| Build command | `npm run build:cf` |
| Build output directory | `dist` |

3. 生产构建默认从 `unpkg` 加载 FFmpeg（`vite.config`）；可用环境变量 `VITE_FFMPEG_CDN` 覆盖。
4. 部署后自测：`https://<project>.pages.dev/watermark/`
5. Hub：`WATERMARK_ORIGIN=https://<project>.pages.dev`（无末尾 `/`）

COOP/COEP 见 [`public/_headers`](public/_headers)；经 Hub 反代时 Worker 会再补一层。

### 历史：Netlify

见 [`netlify.toml`](netlify.toml)。`npm run build` 仍会本地打包 FFmpeg（大文件），Netlify 不限 25MiB 时可用。
