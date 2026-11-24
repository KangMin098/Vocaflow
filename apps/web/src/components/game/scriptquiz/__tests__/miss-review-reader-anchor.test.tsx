// apps/web/src/components/game/scriptquiz/__tests__/miss-review-reader-anchor.test.tsx
// T-0209 — 「글에서 이 문장 보기」: 확인된 읽던 글 문맥 + 정답 공개 뒤 + 유일한 근거일 때만. 주소에는 글 id 만.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ seed: [] as unknown[] }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useState: (init: unknown) => actual.useState(h.seed.length ? h.seed.shift() : init) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }), usePathname: () => '/scriptquiz/play' }))

import { MissReviewItem } from '../MissReview'
import { EvidenceReaderProvider } from '@/lib/scriptquiz/reader-anchor-context'

const PASSAGE = 'The boy walked to the old mill. He found a small key under the stone. Then he ran home to tell his sister.'
const DUP = PASSAGE + ' He found a small key under the stone.'
const SNIPPET = 'He found a small key under the stone.'
const Q = { id: 'q1', type: 'multiple' as const, question: 'What did he find?', options: [{ text: 'A coin' }, { text: 'A key' }, { text: 'A map' }] }
const A = (snippet: string) => ({ questionId: 'q1', selectedIndex: 0, correctIndex: 1, isCorrect: false, sourceSnippet: snippet, timeMs: 1000 })

/** 상태 순서: open · repick */
function render(opts: { reader?: { textId: string } | null; repick?: number | 'reveal' | null; passage?: string; snippet?: string }) {
  h.seed = [true, opts.repick === undefined ? 1 : opts.repick]
  return renderToString(
    <EvidenceReaderProvider value={opts.reader === undefined ? { textId: 'text-own-1' } : opts.reader}>
      <MissReviewItem question={Q} answer={A(opts.snippet ?? SNIPPET)} passage={opts.passage ?? PASSAGE} />
    </EvidenceReaderProvider>,
  )
}

describe('MissReview 「글에서 이 문장 보기」', () => {
  it('확인된 글 · 다시 고른 뒤(정답 공개) · 유일 근거 → 링크, 주소는 글 id 뿐', () => {
    const html = render({})
    expect(html).toContain('data-testid="miss-reader-anchor"')
    expect(html).toContain('href="/text/text-own-1"')
    expect(html).toContain('글에서 이 문장 보기')
    expect(html).toContain('min-h-[44px]')
    const href = html.match(/href="([^"]*)"[^>]*data-testid="miss-reader-anchor"/)?.[1] ?? ''
    expect(href).not.toMatch(/key|stone|q1|snippet|answer/)
  })
  it('「정답 보기」 로 공개해도 링크', () => {
    expect(render({ repick: 'reveal' })).toContain('miss-reader-anchor')
  })
  it('정답 공개 전에는 없다', () => {
    expect(render({ repick: null })).not.toContain('miss-reader-anchor')
  })
  it('확인된 글 문맥이 없으면(도서 입구 · 데모) 없다', () => {
    expect(render({ reader: null })).not.toContain('miss-reader-anchor')
  })
  it('근거가 중복 · 여러 문장 · 미매칭이면 없다(첫머리 복귀만)', () => {
    expect(render({ passage: DUP })).not.toContain('miss-reader-anchor')
    expect(render({ snippet: 'walked to the old mill ... ran home to tell his sister' })).not.toContain('miss-reader-anchor')
    expect(render({ snippet: 'A girl painted a red barn by the river.' })).not.toContain('miss-reader-anchor')
  })
})
