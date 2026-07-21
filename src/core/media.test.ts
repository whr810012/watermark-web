import { describe, expect, it } from 'vitest'
import { detectMediaKind, outputName, validateMediaFile } from './media'

function mockFile(name: string, type: string, size = 1024) {
  return { name, type, size } as File
}

describe('media detection and limits', () => {
  it('detects supported media from MIME type or extension', () => {
    expect(detectMediaKind(mockFile('photo.png', 'image/png'))).toBe('image')
    expect(detectMediaKind(mockFile('document.pdf', ''))).toBe('pdf')
    expect(detectMediaKind(mockFile('clip.mov', 'video/quicktime'))).toBe('video')
  })

  it('rejects unknown and oversized files', () => {
    expect(validateMediaFile(mockFile('archive.zip', 'application/zip'))).toContain('暂不支持')
    expect(validateMediaFile(mockFile('huge.png', 'image/png', 41 * 1024 * 1024))).toContain('40 MB')
  })

  it('creates stable output names', () => {
    expect(outputName(mockFile('my.photo.jpeg', 'image/jpeg'), 'watermarked', 'jpg')).toBe(
      'my.photo-watermarked.jpg',
    )
  })
})
