import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/fonts')
const outFile = join(outDir, 'NotoSansSC-Regular.otf')
const url =
  'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@Sans2.004/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf'

mkdirSync(outDir, { recursive: true })
if (existsSync(outFile)) {
  console.log('字体已存在，跳过下载')
  process.exit(0)
}

console.log('正在下载 Noto Sans SC…')
const response = await fetch(url)
if (!response.ok || !response.body) {
  console.error(`下载失败: ${response.status}`)
  process.exit(1)
}
await pipeline(Readable.fromWeb(response.body), createWriteStream(outFile))
console.log(`已保存 ${outFile}`)
