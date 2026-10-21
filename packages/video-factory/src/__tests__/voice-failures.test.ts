// packages/video-factory/src/__tests__/voice-failures.test.ts
import { beforeEach, expect, it, vi } from 'vitest'
import type { VideoSpec } from '../spec/types'
const mock = vi.hoisted(() => ({ files: new Map<string, string>(), calls: vi.fn(), plans: [] as Array<'ok' | 'denied' | 'empty'> }))
vi.mock('node:fs', () => ({ default: {
  mkdirSync: () => undefined,
  existsSync: (p: string) => mock.files.has(p),
  statSync: (p: string) => ({ size: mock.files.get(p)?.length ?? 0 }),
  readFileSync: (p: string) => mock.files.get(p),
  writeFileSync: (p: string, text: string) => { mock.files.set(p, text) },
  unlinkSync: (p: string) => { mock.files.delete(p) },
  renameSync: (from: string, to: string) => { mock.files.set(to, mock.files.get(from) ?? ''); mock.files.delete(from) },
} }))
vi.mock('@andresaya/edge-tts', () => ({ EdgeTTS: class {
  plan = mock.plans.shift() ?? 'ok'
  async synthesize() { mock.calls(); if (this.plan === 'denied') throw new Error('Unexpected server response: 403') }
  async toFile(p: string) { mock.files.set(p + '.mp3', this.plan === 'empty' ? '' : 'owned-audio-bytes') }
  getWordBoundaries() { return [{ offset: 0, duration: 10_000_000, text: '검증' }] }
} }))
import { manifestPath, synthesizeSpec, VOICE_DIR } from '../voice/edge-tts'
const spec: VideoSpec = { id: 'request-owned-unit', kind: 'request', audience: 'learner', title: '검증', subtitle: '검증', accent: 'brand', evidence: [], formats: ['wide'], scenes: [{ kind: 'hook', line: '검증', caption: '검증' }] }
beforeEach(() => { mock.files.clear(); mock.calls.mockClear(); mock.plans.length = 0 })
it('reports permanent provider denial once and leaves the scene incomplete', async () => {
  mock.plans.push('denied')
  expect(await synthesizeSpec(spec)).toMatchObject({ made: 0, failed: 1, complete: false, manifest: {} })
  expect(mock.calls).toHaveBeenCalledTimes(1)
})
it('does not accept a zero-byte clip as a successful synthesis', async () => {
  mock.plans.push('empty')
  expect(await synthesizeSpec(spec)).toMatchObject({ made: 0, failed: 1, complete: false })
})
it('regenerates a zero-byte cached clip instead of skipping the missing audio', async () => {
  const first = await synthesizeSpec(spec)
  const full = [...mock.files.keys()].find(p => p.startsWith(VOICE_DIR) && p.endsWith('.mp3'))!
  expect(first.complete).toBe(true)
  mock.files.set(full, '')
  expect(await synthesizeSpec(spec)).toMatchObject({ made: 1, skipped: 0, failed: 0, complete: true })
  expect(mock.calls).toHaveBeenCalledTimes(2)
})
it('keeps the valid previous clip when forced regeneration fails and still reports the failure', async () => {
  const first = await synthesizeSpec(spec)
  const previous = mock.files.get(manifestPath(spec.id))
  mock.plans.push('denied')
  const retry = await synthesizeSpec(spec, { force: true })
  expect(retry).toMatchObject({ made: 0, failed: 1, retained: 1, complete: true, manifest: first.manifest })
  expect(mock.files.get(manifestPath(spec.id))).toBe(previous)
})
