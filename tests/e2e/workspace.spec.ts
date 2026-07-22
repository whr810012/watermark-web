import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { PDFDocument, rgb } from 'pdf-lib'

async function makeFixture(page: import('@playwright/test').Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 680
    canvas.height = 510
    const context = canvas.getContext('2d')!
    context.fillStyle = '#7896b4'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#e8c77b'
    context.fillRect(0, 170, canvas.width, 170)
    context.fillStyle = '#638b72'
    context.fillRect(0, 340, canvas.width, 170)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  return Buffer.from(base64, 'base64')
}

async function makeVideoFixture(page: import('@playwright/test').Page) {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 340
    canvas.height = 340
    const context = canvas.getContext('2d')!
    const stream = canvas.captureStream(12)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data)
    recorder.start()
    for (let frame = 0; frame < 18; frame += 1) {
      context.fillStyle = '#718cad'
      context.fillRect(0, 0, 340, 340)
      context.fillStyle = '#e2c47c'
      context.fillRect(0, 110 + (frame % 4), 340, 110)
      await new Promise((resolve) => setTimeout(resolve, 70))
    }
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })
    recorder.stop()
    await stopped
    const blob = new Blob(chunks, { type: 'video/webm' })
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.readAsDataURL(blob)
    })
  })
  return Buffer.from(base64, 'base64')
}

test('loads the landing page with isolation headers', async ({ page }) => {
  const response = await page.goto('/watermark/')
  expect(response?.headers()['cross-origin-opener-policy']).toBe('same-origin')
  expect(response?.headers()['cross-origin-embedder-policy']).toBe('require-corp')
  await expect(page.getByRole('heading', { name: /让作品留下/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /进入打水印/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /进入识别/ })).toBeVisible()
  await expect(page.getByText('文件全程离线')).toHaveCount(1)
})

test('processes two images locally and exposes downloads', async ({ page }) => {
  const outboundWrites: string[] = []
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) outboundWrites.push(request.url())
  })
  await page.goto('/watermark/embed')
  const fixture = await makeFixture(page)
  await page.locator('input[type="file"]').first().setInputFiles([
    { name: 'sample-a.png', mimeType: 'image/png', buffer: fixture },
    { name: 'sample-b.png', mimeType: 'image/png', buffer: fixture },
  ])

  await expect(page.getByText('sample-a.png')).toBeVisible()
  await page.getByRole('button', { name: /开始本地处理/ }).click()
  await expect(page.getByText('2 个结果已在本地生成')).toBeVisible()
  await expect(page.getByRole('button', { name: '打包下载' })).toBeVisible()
  expect(outboundWrites).toEqual([])
})

test('embeds and detects a hidden watermark after JPEG resize', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', '完整编解码闭环仅在桌面项目运行')
  await page.goto('/watermark/embed')
  const fixture = await makeFixture(page)
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'hidden-source.png',
    mimeType: 'image/png',
    buffer: fixture,
  })
  await page.getByRole('button', { name: '仅隐藏' }).click()
  await page.getByPlaceholder('例如：订单号、创作者 ID').fill('e2e-owner-0721')
  await page.getByRole('button', { name: /开始本地处理/ }).click()
  await expect(page.getByText('1 个结果已在本地生成')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载' }).click()
  const download = await downloadPromise
  const outputPath = await download.path()
  expect(outputPath).not.toBeNull()
  const output = await readFile(outputPath!)
  const transformedBase64 = await page.evaluate(async (base64) => {
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * 0.8)
    canvas.height = Math.round(bitmap.height * 0.8)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
  }, output.toString('base64'))

  await page.goto('/watermark/detect')
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'compressed-resized.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(transformedBase64, 'base64'),
  })
  await page.getByRole('button', { name: /开始检测隐藏水印/ }).click()
  await expect(page.getByText('e2e-owner-0721')).toBeVisible()
  await expect(page.getByText('校验通过')).toBeVisible()
  await expect(page.getByText('写入时间', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /导出 JSON/ })).toBeVisible()
})

test('keeps navigation keyboard accessible across pages', async ({ page }) => {
  await page.goto('/watermark/')
  await page.getByRole('navigation', { name: '页面导航' }).getByRole('link', { name: '识别水印' }).focus()
  await expect(
    page.getByRole('navigation', { name: '页面导航' }).getByRole('link', { name: '识别水印' }),
  ).toBeFocused()
  await page.getByRole('navigation', { name: '页面导航' }).getByRole('link', { name: '识别水印' }).press('Enter')
  await expect(page.getByRole('heading', { name: '识别隐藏标记' })).toBeVisible()
  await expect(page.getByText(/未检出不等于确定没有水印/)).toBeVisible()
})

test('embeds and detects hidden marks across PDF pages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'PDF 闭环仅在桌面项目运行')
  const pdf = await PDFDocument.create()
  for (let index = 0; index < 2; index += 1) {
    const pdfPage = pdf.addPage([680, 960])
    pdfPage.drawRectangle({ x: 0, y: 0, width: 680, height: 960, color: rgb(0.86, 0.9, 0.82) })
    pdfPage.drawText(`Dandan PDF fixture ${index + 1}`, { x: 80, y: 800, size: 28 })
  }
  const source = Buffer.from(await pdf.save())

  await page.goto('/watermark/embed')
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'fixture.pdf',
    mimeType: 'application/pdf',
    buffer: source,
  })
  await page.getByRole('button', { name: '仅隐藏' }).click()
  await page.getByPlaceholder('例如：订单号、创作者 ID').fill('pdf-owner')
  await page.getByRole('button', { name: /开始本地处理/ }).click()
  await expect(page.getByText('1 个结果已在本地生成')).toBeVisible({ timeout: 20_000 })
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载' }).click()
  const outputPath = await (await downloadPromise).path()

  await page.goto('/watermark/detect')
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'fixture-watermarked.pdf',
    mimeType: 'application/pdf',
    buffer: await readFile(outputPath!),
  })
  await page.getByRole('button', { name: /开始检测隐藏水印/ }).click()
  await expect(page.getByText('pdf-owner')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/2 个页面样本/)).toBeVisible()
})

test('processes and samples a short video locally', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'FFmpeg 闭环仅在桌面项目运行')
  test.slow()
  const cdnHits: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('jsdelivr.net')) cdnHits.push(request.url())
  })
  await page.goto('/watermark/embed')
  const source = await makeVideoFixture(page)
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'fixture.webm',
    mimeType: 'video/webm',
    buffer: source,
  })
  await page.getByRole('button', { name: '仅隐藏' }).click()
  await page.getByPlaceholder('例如：订单号、创作者 ID').fill('video-owner')
  await page.getByRole('button', { name: /开始本地处理/ }).click()
  await expect(page.getByText('1 个结果已在本地生成')).toBeVisible({ timeout: 90_000 })
  expect(cdnHits).toEqual([])
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载' }).click()
  const outputPath = await (await downloadPromise).path()

  await page.goto('/watermark/detect')
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'fixture-watermarked.mp4',
    mimeType: 'video/mp4',
    buffer: await readFile(outputPath!),
  })
  await page.getByRole('button', { name: /开始检测隐藏水印/ }).click()
  await expect(page.getByText('video-owner')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/视频样本检出同源水印/)).toBeVisible()
})

test('shows a recoverable error for unsupported files', async ({ page }) => {
  await page.goto('/watermark/embed')
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'archive.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not-a-media-file'),
  })
  await expect(page.getByText('暂不支持该文件格式')).toBeVisible()
  await expect(page.getByRole('button', { name: /开始本地处理/ })).toBeDisabled()
})
