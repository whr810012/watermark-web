import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkspaceStore } from './workspace'

function mockFile(name: string, type: string, size = 1024) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('workspace store embed guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('appends images instead of replacing when append is true', () => {
    const store = useWorkspaceStore()
    store.addFiles([mockFile('a.png', 'image/png'), mockFile('b.png', 'image/png')])
    store.addFiles([mockFile('c.png', 'image/png')], { append: true })
    expect(store.files.map((file) => file.name)).toEqual(['a.png', 'b.png', 'c.png'])
  })

  it('replaces the queue by default', () => {
    const store = useWorkspaceStore()
    store.addFiles([mockFile('a.png', 'image/png')])
    store.addFiles([mockFile('b.png', 'image/png')])
    expect(store.files.map((file) => file.name)).toEqual(['b.png'])
  })

  it('rejects append that would exceed the image batch limit', () => {
    const store = useWorkspaceStore()
    const firstBatch = Array.from({ length: 19 }, (_, index) =>
      mockFile(`img-${index}.png`, 'image/png'),
    )
    store.addFiles(firstBatch)
    store.addFiles(
      [mockFile('extra-1.png', 'image/png'), mockFile('extra-2.png', 'image/png')],
      { append: true },
    )
    expect(store.files).toHaveLength(19)
    expect(store.status).toBe('error')
    expect(store.error).toContain('最多处理 20')
  })

  it('requires hidden payload for both embed styles', () => {
    const store = useWorkspaceStore()
    store.addFiles([mockFile('a.png', 'image/png')])
    store.options.embedStyle = 'both'
    store.options.hiddenPayload = ''
    store.options.text = '品牌'
    expect(store.canProcess).toBe(false)
    expect(store.processBlockedReason).toContain('隐藏标识')

    store.options.hiddenPayload = 'order-1'
    expect(store.canProcess).toBe(true)
    expect(store.processBlockedReason).toBe('')
  })

  it('requires non-empty visible text when embed style includes visible marks', () => {
    const store = useWorkspaceStore()
    store.addFiles([mockFile('a.png', 'image/png')])
    store.options.embedStyle = 'visible'
    store.options.mode = 'text'
    store.options.text = '   '
    expect(store.canProcess).toBe(false)
    expect(store.processBlockedReason).toContain('水印文字')
  })
})
