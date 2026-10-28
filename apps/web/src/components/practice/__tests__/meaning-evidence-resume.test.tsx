// apps/web/src/components/practice/__tests__/meaning-evidence-resume.test.tsx
// T-0211 — 건너뛴 뒤 「다시 짚어 보기」: 같은 문항의 기존 후보로 돌아오는 단추(44px · 키보드). 기록 · 채점 · 이벤트 없음.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ seed: [] as unknown[] }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useState: (init: unknown) => actual.useState(h.seed.length ? h.seed.shift() : init) }
})

import { MeaningEvidence } from '../MeaningEvidence'

const SENTS = ['The bakery opens early.', 'People line up.', 'The owner bakes by hand.']
/** 상태 순서: picked · skipped · compareOpen · target · comparePicked · relation · resumes */
const render = (seed: unknown[]) => {
  h.seed = seed
  return renderToString(<MeaningEvidence sentences={SENTS} explanation="x" chosen={{ n: 1, text: 'a' }} correct choices={['a', 'b', 'c', 'd', 'e']} />)
}

describe('MeaningEvidence 건너뛰기 뒤 재개', () => {
  it('건너뛴 상태: 안내 + 「다시 짚어 보기」 단추(44px · type=button), 후보 목록은 없음', () => {
    const html = render([null, true])
    expect(html).toContain('근거 짚기는 건너뛰었어요')
    const btn = /<button[^>]*data-testid="meaning-evidence-resume"[^>]*>[^<]*<\/button>/.exec(html)?.[0] ?? ''
    expect(btn).toContain('다시 짚어 보기')
    expect(btn).toContain('min-h-[44px]')
    expect(btn).toContain('type="button"')
    expect(html).not.toContain('data-testid="meaning-evidence-list"')
  })
  it('재개 뒤(같은 문항): 같은 후보 목록 · 건너뛰기 단추가 다시 있고 짚은 문장은 비어 있다', () => {
    const html = render([null, false, false, null, null, null, 1])
    expect(html).toContain('data-testid="meaning-evidence-list"')
    for (const s of SENTS) expect(html).toContain(s)
    expect(html).toContain('data-testid="meaning-evidence-skip"')
    expect(html).not.toContain('aria-pressed="true"')
    expect(html).not.toContain('meaning-evidence-resume')
    // 초점 대상(근거 제목)은 프로그램으로만 받는 자리
    expect(html).toMatch(/data-testid="meaning-evidence-prompt"|tabindex="-1"[^>]*data-testid="meaning-evidence-prompt"/)
  })
  it('건너뛰지 않은 처음 상태에는 재개 단추가 없다', () => {
    expect(render([])).not.toContain('meaning-evidence-resume')
  })
})
