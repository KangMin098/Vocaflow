// apps/web/src/components/library/vocab/__tests__/VocabColophon.test.tsx
//
// 판권면이 **지어내지 않는가**.
//
// 이 화면의 위험은 빈칸을 채우고 싶은 유혹이다 — "검수 0/0 통과" 나 "선정 근거: 없음" 은
// 없는 것보다 나쁘다(있는 척하는 것이라). 그래서 없는 줄은 **통째로 빠지는지**를 단언한다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { VOCAB_SERIES_BRAND } from '@vocaflow/library-pipeline/vocab-brand'

import type { PublishedVocabSet } from '@/lib/library/vocab/queries'
import { VocabColophon } from '../VocabColophon'

function set(overrides: Partial<PublishedVocabSet> = {}): PublishedVocabSet {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: '어원으로 익히는 1,500',
    description: null,
    category: 'etymology',
    categoryNode: null,
    additionalCategoryIds: [],
    cefrLevel: 'B1',
    coverEmoji: '🏛️',
    sortOrder: 0,
    wordCount: 1500,
    subscriberCount: 3,
    createdAt: '2026-08-30T00:00:00.000Z',
    kind: { label: '어원', principle: '어근 하나에 딸린 단어를 한 묶음으로' },
    coverImageUrl: null,
    coverImageMeta: null,
    brandFingerprint: null,
    ladderStep: null,
    imprintCode: null,
    qa: null,
    level: null,
    ...overrides,
  }
}

const render = (s: PublishedVocabSet) =>
  renderToString(<VocabColophon set={s} />).replace(/<!-- -->/g, '')

describe('판권면', () => {
  it('시리즈 이름을 상수에서 읽어 싣는다', () => {
    expect(render(set())).toContain(VOCAB_SERIES_BRAND)
  })

  it('판차·발행일을 싣는다', () => {
    const html = render(set())
    expect(html).toContain('초판 2026')
    expect(html).toContain('2026-08-30')
  })

  it('구성을 표제어 수 · 하루치 · 며칠로 적는다', () => {
    // B1 → V5 → 5단(고1), 하루 30 → 1500/30 = 50일
    expect(render(set())).toContain('표제어 1,500 · 하루 30 · 50일')
  })

  it('컴포저가 남긴 조직 원리를 선정 근거로 그대로 싣는다', () => {
    expect(render(set())).toContain('어근 하나에 딸린 단어를 한 묶음으로')
  })

  it('조직 원리가 없으면 그 줄을 통째로 뺀다 — 빈칸을 채우지 않는다', () => {
    const html = render(set({ kind: null }))
    expect(html).not.toContain('표제어 선정')
  })

  it('각인 전 세트는 검수 줄을 아예 빼 둔다 — 0/0 은 "검수 0 통과" 로 읽힌다', () => {
    expect(render(set())).not.toContain('자동 검수')
  })

  it('각인된 검수 실측은 판권면에 싣는다 — 시중 단어장의 "감수" 자리다', () => {
    const html = render(set({ qa: { checked: 1500, passed: 1487, at: '2026-08-30T00:00:00.000Z' } }))
    expect(html).toContain('자동 검수 1487/1500 통과')
  })

  it('판권 번호가 있으면 싣는다 — 학습자가 이 판을 특정해 인용할 수 있어야 한다', () => {
    expect(render(set({ imprintCode: 'VF-etymology-core-v3' }))).toContain('VF-etymology-core-v3')
  })

  it('판권 번호가 없으면 지어내지 않는다', () => {
    expect(render(set())).not.toContain('판권 번호')
  })

  it('사다리 밖이어도 각인된 대상 수준은 적는다 — 학령 계단이 없다고 수준이 없는 게 아니다', () => {
    const html = render(
      set({
        cefrLevel: 'C2',
        category: 'themed',
        level: { median: 9, min: 4, max: 11, measured: 1500 },
      }),
    )
    expect(html).toContain('대상 수준')
    expect(html).toContain('V9 (V4~V11 · 1,500낱말 실측)')
  })

  it('계단이 있는 권에는 대상 수준을 겹쳐 적지 않는다 — 단계 줄이 이미 말한다', () => {
    // B1 → 5단이 잡히므로 계단이 있다.
    const html = render(set({ level: { median: 5, min: 1, max: 9, measured: 1500 } }))
    expect(html).not.toContain('대상 수준')
  })

  it('출처 정책은 언제나 싣는다 — 법적 근거가 사라지면 안 된다', () => {
    expect(render(set())).toContain('공개 말뭉치')
  })

  it('사다리 띠에 현재 권이 대괄호로 선다', () => {
    expect(render(set())).toContain('1 2 3 4 [5] 6 7')
  })

  it('추정으로 정한 계단은 추정이라고 밝힌다', () => {
    expect(render(set())).toContain('수준·분류로 추정')
  })

  it('컴포저가 정한 계단이면 추정이라고 적지 않는다', () => {
    const html = render(set({ ladderStep: 3 }))
    expect(html).not.toContain('추정')
    expect(html).toContain('3단 · 중학 1-2학년')
  })

  it('저작된 계단이 카테고리·CEFR 추정을 이긴다', () => {
    // category=etymology + B1 이면 추정은 5단인데, 컴포저가 2단이라고 정해 두었다.
    const html = render(set({ ladderStep: 2 }))
    expect(html).toContain('2단')
    expect(html).not.toContain('5단')
  })

  it('사다리 밖이면 계단 줄과 띠를 그리지 않는다', () => {
    // C2 = 성인 수준이라 학령 사다리 밖이다.
    const html = render(set({ cefrLevel: 'C2', category: 'themed' }))
    // ⚠️ `[` 하나로 단언하면 안 된다 — Tailwind 클래스(`text-[11.5px]`)에도 들어 있어
    //    컴포넌트가 옳게 그려도 실패한다. **띠의 모양**으로 견준다.
    expect(html).not.toMatch(/\[\d\]/)
    expect(html).not.toContain('단계')
    // 계단이 없어도 나머지 판권면은 남는다 — 빈 화면이 되면 안 된다.
    expect(html).toContain('표제어 1,500')
  })

  it('표지 도판이 있으면 출처를 밝힌다 — CC 표기는 지켜야 하는 것이다', () => {
    const html = render(
      set({
        coverImageUrl: 'https://example.org/plate.jpg',
        coverImageMeta: {
          source: 'openverse',
          provider: 'wikimedia',
          license: 'pdm',
          license_url: null,
          creator: 'Anon',
          creator_url: null,
          page_url: null,
          query: 'q',
          family: 'structure',
        },
      }),
    )
    expect(html).toContain('wikimedia')
    expect(html).toContain('PDM')
    expect(html).toContain('Anon')
  })

  it('도판이 없으면 출처 줄을 그리지 않는다', () => {
    expect(render(set())).not.toContain('표지 도판')
  })
})
