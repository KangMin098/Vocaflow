// apps/web/src/components/library/reader/__tests__/word-lookup-wordweb.test.tsx
//
// 읽기 중 낱말 조회 창의 **낱말 그물**(파생어·유의어·반의어)이 학습자에게 그려지는가.
//
// ── 왜 이 스펙이 필요한가 ───────────────────────────────────────────
// 이 셋은 사전에 있었는데 어느 화면도 읽지 않았다(실측 2026-08-30). 플래시카드 정답면에
// 올린 데 이어 읽기 창에도 올리는데, **두 곳이 같은 것을 보여 주는지**가 중요하다 —
// 읽다가 만난 낱말과 카드에서 만난 낱말이 다르게 보이면 학습자는 두 곳을 다른 사전으로
// 여긴다.
//
// 툴팁은 읽기를 끊고 뜬 창이라 카드보다 더 절제한다(줄마다 2개, 카드는 3개).
// 그 차이가 의도된 것임을 여기서 못 박는다 — 나중에 "왜 다르지" 로 흔들리지 않게.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FoundBody } from '../WordLookupPopover'
import type { WordLookup } from '@/lib/library/reader-queries'

const base: WordLookup = {
  found: true,
  resolvedWord: 'develop',
  meaningKo: '발전하다',
  pos: 'verb',
  cefrLevel: 'B1',
  vLevel: 3,
  exampleEn: 'The company is developing a new software product.',
  matchVia: 'exact',
  wordRegister: null,
  collocations: null,
  exampleKo: null,
  derived: null,
  synonyms: null,
  antonyms: null,
  lang: 'en',
} as WordLookup

const render = (o: Partial<WordLookup>) =>
  renderToString(<FoundBody result={{ ...base, ...o }} surface="develop" />)
    .replace(/<!-- -->/g, '')

describe('WordLookupPopover — 낱말 그물', () => {
  it('파생어를 그린다', () => {
    const html = render({ derived: ['development'] })
    expect(html).toContain('파생')
    expect(html).toContain('development')
  })

  it('유의어와 반의어를 이름표로 갈라 그린다 — 색만으로 가르지 않는다', () => {
    const html = render({ synonyms: ['grow'], antonyms: ['shrink'] })
    expect(html).toContain('비슷')
    expect(html).toContain('grow')
    expect(html).toContain('반대')
    expect(html).toContain('shrink')
  })

  it('줄마다 2개까지만 — 읽기를 끊고 뜬 창이라 카드(3개)보다 절제한다', () => {
    const html = render({ derived: ['a1', 'b2', 'c3'] })
    expect(html).toContain('a1')
    expect(html).toContain('b2')
    expect(html).not.toContain('c3')
  })

  it('셋 다 없으면 블록을 그리지 않는다', () => {
    const html = render({})
    expect(html).not.toContain('파생')
    expect(html).not.toContain('비슷')
    expect(html).not.toContain('반대')
  })

  it('있는 줄만 그린다', () => {
    const html = render({ synonyms: ['grow'] })
    expect(html).toContain('비슷')
    expect(html).not.toContain('파생')
    expect(html).not.toContain('반대')
  })
})
