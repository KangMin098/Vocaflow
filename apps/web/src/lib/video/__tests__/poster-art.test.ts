// apps/web/src/lib/video/__tests__/poster-art.test.ts
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { KIND_ORDER, videosByKind } from '../catalog'
import { videoPosterArt } from '../poster-art'

describe('PC video explanatory artwork', () => {
  it('every published video resolves to a real local WebP, without an external asset dependency', () => {
    for (const videos of Object.values(videosByKind())) for (const video of videos) {
      const asset = videoPosterArt(video)
      expect(asset).toMatch(/^\/illustrations\/tines\/[a-z0-9-]+\.webp$/)
      expect(fs.existsSync(path.join(process.cwd(), 'public', asset))).toBe(true)
    }
  })
  it('different benefit messages have distinguishable pictures, regardless of display order', () => {
    const videos = videosByKind().benefit
    expect(videos.length).toBeGreaterThan(1)
    const original = new Map(videos.map(v => [v.id, videoPosterArt(v)]))
    expect(new Set(original.values()).size).toBe(videos.length)
    for (const video of [...videos].reverse()) expect(videoPosterArt(video)).toBe(original.get(video.id))
  })
  it('new IDs use their declared content kind and prototype names cannot select unintended paths', () => {
    for (const kind of KIND_ORDER) {
      expect(videoPosterArt({ id: '__proto__', kind })).toBe(videoPosterArt({ id: 'future-video', kind }))
      expect(fs.existsSync(path.join(process.cwd(), 'public', videoPosterArt({ id: 'future-video', kind })))).toBe(true)
    }
  })
})
