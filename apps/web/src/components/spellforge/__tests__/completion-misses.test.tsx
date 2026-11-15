// apps/web/src/components/spellforge/__tests__/completion-misses.test.tsx
// P-4 — SpellForge 완료 화면: 놓친 낱말을 뜻으로 다시 떠올리고(철자는 확인 버튼 뒤), 돌아갈 곳을 사실대로 부른다.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/scores/record-score', () => ({ useRecordGameScore: () => {} }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }), usePathname: () => '/spellforge/play' }))

import { MissedWordRow, SpellForgeCompletion, backLabel } from '../SpellForgeCompletion'

const W = (id: string, text: string, meaning: string) => ({ id, text, meaning })
const render = (backHref: string, missedWords = [] as Parameters<typeof SpellForgeCompletion>[0]['missedWords']) =>
  renderToString(
    <SpellForgeCompletion totalWords={3} correctCount={2} startedAt={new Date(0)} backHref={backHref} missedWords={missedWords} />,
  )

describe('backLabel', () => {
  it('글이면 「읽던 글로」 , 아니면 「돌아가기」', () => {
    expect(backLabel('/text/t1?mode=read')).toBe('읽던 글로 돌아가기')
    expect(backLabel('/spellforge')).toBe('돌아가기')
  })
})

describe('MissedWordRow', () => {
  it('처음엔 뜻만 — 철자는 가리고 확인 버튼은 44px·aria-expanded=false', () => {
    const html = renderToString(<ul><MissedWordRow miss={{ word: W('1', 'resilient', '회복력 있는'), kind: 'retried' }} /></ul>)
    expect(html).toContain('회복력 있는')
    expect(html).not.toContain('resilient')
    expect(html).toContain('틀린 뒤 다시 씀')
    expect(html).toMatch(/aria-expanded="false"[^>]*class="[^"]*min-h-\[44px\]/)
  })
})

describe('SpellForgeCompletion', () => {
  it('놓친 낱말이 있으면 목록, 없으면 목록 없음', () => {
    const withMiss = render('/spellforge', [{ word: W('1', 'resilient', '회복력 있는'), kind: 'skipped' }])
    expect((withMiss.match(/data-testid="sf-miss"/g) ?? []).length).toBe(1)
    expect(withMiss).toContain('건너뜀')
    expect(render('/spellforge')).not.toContain('data-testid="sf-miss"')
  })
  it('전체 단어장 · 사실대로 된 복귀 라벨', () => {
    const html = render('/text/t1?mode=read')
    expect(html).toContain('href="/wordvault"')
    expect(html).toContain('읽던 글로 돌아가기')
    expect(html).not.toContain('스크립트로 돌아가기')
  })
})
