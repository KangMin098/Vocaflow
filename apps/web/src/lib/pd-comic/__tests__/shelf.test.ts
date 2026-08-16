// apps/web/src/lib/pd-comic/__tests__/shelf.test.ts
//
// 서가 접기(fold) 회귀 — RPC 의 평면 (유형, 시리즈) 행이 화면이 그리는 2단 묶음이 되는 지점.
//
// 왜 여기를 잠그나: 이 변환이 틀려도 화면은 **에러 없이 그려진다**. 유형이 쪼개지거나
// 순서가 뒤집히거나 권수 합계가 어긋난 채로 그냥 뜬다 — 사람이 목록을 세어보기 전에는 모른다.
// 특히 순서는 RPC(SQL ORDER BY)가 정하고 fold 는 그것을 **보존만** 해야 한다.
// 두 곳이 각자 정렬하면 언젠가 어긋난다.

import { describe, expect, it } from 'vitest'

import { foldShelf } from '../queries'
import { pdBasisLabel } from '../model'

/** RPC 가 돌려주는 모양 그대로 — kind_sort 오름차순, 같은 유형 안에서는 발행수 내림차순. */
const ROWS = [
  {
    kind: 'superhero', kind_label: '슈퍼히어로', kind_blurb: '골든에이지 영웅물.',
    kind_learner_note: '짧은 명령문이 많습니다.', kind_sort: 2,
    series_key: 'whiz-comics', series_title: 'Whiz Comics', publisher: 'Fawcett',
    series_blurb: null, year_from: 1940, year_to: 1953,
    issues_published: 113, panels_total: 4520, cover_url: 'https://x/1.jpg',
  },
  {
    kind: 'superhero', kind_label: '슈퍼히어로', kind_blurb: '골든에이지 영웅물.',
    kind_learner_note: '짧은 명령문이 많습니다.', kind_sort: 2,
    series_key: 'master-comics', series_title: 'Master Comics', publisher: 'Fawcett',
    series_blurb: null, year_from: 1940, year_to: 1952,
    issues_published: 98, panels_total: 3900, cover_url: null,
  },
  {
    kind: 'western', kind_label: '서부', kind_blurb: '개척지 이야기.',
    kind_learner_note: '방언과 축약형이 많습니다.', kind_sort: 6,
    series_key: 'rocky-lane-western', series_title: 'Rocky Lane Western', publisher: 'Fawcett',
    series_blurb: null, year_from: 1949, year_to: 1954,
    issues_published: 12, panels_total: 500, cover_url: null,
  },
]

describe('foldShelf', () => {
  it('같은 유형의 시리즈를 한 묶음으로 접는다', () => {
    const shelf = foldShelf(ROWS)
    expect(shelf).toHaveLength(2)
    expect(shelf[0].kind).toBe('superhero')
    expect(shelf[0].series.map((s) => s.seriesKey)).toEqual(['whiz-comics', 'master-comics'])
    expect(shelf[1].series).toHaveLength(1)
  })

  it('유형 권수는 시리즈 합계다 — 화면이 다시 세지 않게', () => {
    const shelf = foldShelf(ROWS)
    expect(shelf[0].issuesPublished).toBe(113 + 98)
    expect(shelf[1].issuesPublished).toBe(12)
  })

  it('RPC 순서를 보존한다 (fold 가 재정렬하면 두 곳이 순서를 정하게 된다)', () => {
    const shelf = foldShelf(ROWS)
    expect(shelf.map((k) => k.kind)).toEqual(['superhero', 'western'])
    expect(shelf[0].series[0].issuesPublished).toBeGreaterThan(shelf[0].series[1].issuesPublished)
  })

  it('유형 메타(학습 노트)를 묶음 수준으로 올린다', () => {
    const shelf = foldShelf(ROWS)
    expect(shelf[0].learnerNote).toBe('짧은 명령문이 많습니다.')
    expect(shelf[0].label).toBe('슈퍼히어로')
  })

  it('빈 결과는 빈 배열 — 발행본 0이어도 터지지 않는다', () => {
    expect(foldShelf([])).toEqual([])
  })

  it('연도 미상 시리즈(Ace 실측)도 접힌다', () => {
    const shelf = foldShelf([{ ...ROWS[0], year_from: null, year_to: null }])
    expect(shelf[0].series[0].yearFrom).toBeNull()
  })
})

describe('pdBasisLabel — 저작권 근거 문구는 한 곳에서만 정한다', () => {
  it('알려진 근거를 한국어로 옮긴다', () => {
    expect(pdBasisLabel('no-renewal')).toContain('갱신')
    expect(pdBasisLabel('pre-1929')).toContain('1929')
  })

  it('근거가 없으면 빈칸이 아니라 상태를 말한다', () => {
    expect(pdBasisLabel(null)).toBe('근거 확인 중')
  })

  it('모르는 값은 그대로 보여준다 (조용히 삼키면 잘못된 안심을 준다)', () => {
    expect(pdBasisLabel('some-new-basis')).toBe('some-new-basis')
  })
})
