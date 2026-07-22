import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function copyDir(from, to) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name)
    const target = join(to, entry.name)
    if (entry.isDirectory()) copyDir(source, target)
    else copyFileSync(source, target)
  }
}

const coreFrom = join(root, 'node_modules/@ffmpeg/core/dist/esm')
const coreMtFrom = join(root, 'node_modules/@ffmpeg/core-mt/dist/esm')
if (!existsSync(coreFrom) || !existsSync(coreMtFrom)) {
  console.error('缺少 @ffmpeg/core 依赖，请先 npm install')
  process.exit(1)
}

copyDir(coreFrom, join(root, 'public/ffmpeg/core'))
copyDir(coreMtFrom, join(root, 'public/ffmpeg/core-mt'))
console.log('已复制 FFmpeg WASM 到 public/ffmpeg/')
