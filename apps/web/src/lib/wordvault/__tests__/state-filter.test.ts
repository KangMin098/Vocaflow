// apps/web/src/lib/wordvault/__tests__/state-filter.test.ts
//
// `?filter=state:*` 회귀 — 이 필터는 **2주 동안 조용히 무시되고 있었다.**
// 허브 CTA 가 `/wordvault/browse?filter=state:new` 로 보냈고, 읽는 코드는 0개였으며,
// 화면은 오류 없이 전체 목록을 열었다. 타입도 린트도 빌드도 잡지 못한다 —
// 문자열이 양쪽에서 따로 적혀 있었기 때문이다.
//
// 그래서 두 종류를 함께 잰다:
//   ① 판정이 맞는가 (R(t) 경계 · attention 합집합)
//   ② **저장소에 적힌 모든 `state:` 링크가 실제로 파싱되는가** — 고아 링크 재발 감시.
//      ②가 이 파일의 핵심이다. ①만 있으면 같은 사고가 다시 난다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { SrsCard } from '@/lib/srs/types'
import {
  filterByMemoryState,
  parseStateFilter,
  stateFilterLabel,
  stateFilterToken,
  toStateFilterValue,
  matchesStateFilter,
} from '@/lib/wordvault/state-filter'
import { filterRowsByState } from '@/lib/wordvault/study-queries'
import type { VocabRow } from '@/lib/wordvault/browse-queries'

const NOW = new Date('2026-08-29T00:00:00.000Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

/** R(t) = 0.9^(t/S) — 경계는 t/S 로 정해진다 (stable ≥0.95 → t/S ≤0.487 · risk <0.7 → t/S >3.385) */
function card(over: Partial<SrsCard> = {}): SrsCard {
  return {
    id: 'c',
    difficulty: 6,
    stability: 10,
    lastReviewAt: daysAgo(1),
    nextReviewAt: null,
    moduleHistory: [],
    reviewCount: 1,
    ...over,
  }
}

describe('parseStateFilter', () => {
  it('4상태 + attention 을 받는다', () => {
    for (const k of ['stable', 'shaky', 'risk', 'new', 'attention'] as const) {
      expect(parseStateFilter(`state:${k}`)).toBe(k)
    }
  })

  it('상태 필터가 아닌 값은 null — 기존 set:/text: 분기를 건드리지 않는다', () => {
    expect(parseStateFilter('all')).toBeNull()
    expect(parseStateFilter('set:abc')).toBeNull()
    expect(parseStateFilter('text:abc')).toBeNull()
    expect(parseStateFilter(null)).toBeNull()
    expect(parseStateFilter(undefined)).toBeNull()
    expect(parseStateFilter('')).toBeNull()
  })

  it('모르는 상태 키는 null — 오타가 "전체" 로 조용히 넘어가지 않게 호출부가 구분할 수 있다', () => {
    expect(parseStateFilter('state:')).toBeNull()
    expect(parseStateFilter('state:fresh')).toBeNull()
    expect(parseStateFilter('state:NEW')).toBeNull()
  })

  it('toStateFilterValue 는 parseStateFilter 의 역', () => {
    for (const k of ['stable', 'shaky', 'risk', 'new', 'attention'] as const) {
      expect(parseStateFilter(toStateFilterValue(k))).toBe(k)
    }
  })
})

describe('matchesStateFilter — R(t) 경계', () => {
  it('new: 복습 이력이 없거나 S=0', () => {
    expect(matchesStateFilter(card({ lastReviewAt: null }), 'new', NOW)).toBe(true)
    expect(matchesStateFilter(card({ stability: 0 }), 'new', NOW)).toBe(true)
    expect(matchesStateFilter(card({ lastReviewAt: daysAgo(1) }), 'new', NOW)).toBe(false)
  })

  it('stable: t/S 가 작아 R ≥ 0.95', () => {
    const c = card({ stability: 10, lastReviewAt: daysAgo(2) }) // R≈0.979
    expect(matchesStateFilter(c, 'stable', NOW)).toBe(true)
    expect(matchesStateFilter(c, 'shaky', NOW)).toBe(false)
  })

  it('shaky: 0.70 ≤ R < 0.95', () => {
    const c = card({ stability: 10, lastReviewAt: daysAgo(6) }) // R≈0.939
    expect(matchesStateFilter(c, 'shaky', NOW)).toBe(true)
    expect(matchesStateFilter(c, 'stable', NOW)).toBe(false)
    expect(matchesStateFilter(c, 'risk', NOW)).toBe(false)
  })

  it('risk: R < 0.70', () => {
    const c = card({ stability: 10, lastReviewAt: daysAgo(40) }) // R≈0.656
    expect(matchesStateFilter(c, 'risk', NOW)).toBe(true)
    expect(matchesStateFilter(c, 'shaky', NOW)).toBe(false)
  })

  it('attention = risk ∪ shaky — new·stable 은 들어오지 않는다', () => {
    expect(matchesStateFilter(card({ stability: 10, lastReviewAt: daysAgo(40) }), 'attention', NOW)).toBe(true)
    expect(matchesStateFilter(card({ stability: 10, lastReviewAt: daysAgo(6) }), 'attention', NOW)).toBe(true)
    expect(matchesStateFilter(card({ stability: 10, lastReviewAt: daysAgo(2) }), 'attention', NOW)).toBe(false)
    expect(matchesStateFilter(card({ lastReviewAt: null }), 'attention', NOW)).toBe(false)
  })
})

describe('filterByMemoryState', () => {
  const items = [
    { srs: card({ lastReviewAt: null }), tag: 'new' },
    { srs: card({ stability: 10, lastReviewAt: daysAgo(2) }), tag: 'stable' },
    { srs: card({ stability: 10, lastReviewAt: daysAgo(6) }), tag: 'shaky' },
    { srs: card({ stability: 10, lastReviewAt: daysAgo(40) }), tag: 'risk' },
  ]

  it('상태별로 정확히 하나씩 고른다', () => {
    expect(filterByMemoryState(items, 'new', NOW).map((i) => i.tag)).toEqual(['new'])
    expect(filterByMemoryState(items, 'stable', NOW).map((i) => i.tag)).toEqual(['stable'])
    expect(filterByMemoryState(items, 'shaky', NOW).map((i) => i.tag)).toEqual(['shaky'])
    expect(filterByMemoryState(items, 'risk', NOW).map((i) => i.tag)).toEqual(['risk'])
  })

  it('attention 은 둘, 순서는 원본 유지', () => {
    expect(filterByMemoryState(items, 'attention', NOW).map((i) => i.tag)).toEqual(['shaky', 'risk'])
  })

  it('srs 가 없는 단어는 new — 조용히 사라지지 않는다', () => {
    // WordItem.srs 는 선택 필드다(목업·TextViewer 인계 단어에는 없다).
    // 버리면 "새 단어 11" 을 누른 학습자가 11개보다 적게 받는다.
    const mixed = [{ srs: undefined, tag: 'no-srs' }, ...items]
    expect(filterByMemoryState(mixed, 'new', NOW).map((i) => i.tag)).toEqual(['no-srs', 'new'])
    expect(filterByMemoryState(mixed, 'risk', NOW).map((i) => i.tag)).toEqual(['risk'])
    expect(filterByMemoryState(mixed, 'attention', NOW).map((i) => i.tag)).toEqual(['shaky', 'risk'])
  })
})

describe('목록과 세션이 같은 판정을 쓴다', () => {
  // browse 는 BrowseWord.srs 로, study 는 VocabRow 로 거른다. 두 경로가 갈라지면
  // "이 단어로 학습 시작" 이 목록에 없던 단어를 내놓는다 — 다른 화면이 된다.
  const rows: VocabRow[] = [
    row('a', null, 0),
    row('b', daysAgo(2).toISOString(), 10),
    row('c', daysAgo(6).toISOString(), 10),
    row('d', daysAgo(40).toISOString(), 10),
  ]

  function row(id: string, last: string | null, stability: number): VocabRow {
    return {
      id,
      word: id,
      meaning: id,
      example_sentence: null,
      pronunciation: null,
      pos: null,
      cefr_level: null,
      difficulty: 6,
      stability,
      last_review_at: last,
      next_review_at: null,
      module_history: null,
      review_count: last ? 1 : 0,
      text_id: null,
      shared_set_id: null,
      created_at: null,
    }
  }

  it('같은 카드에 대해 두 경로의 결과가 일치한다', () => {
    for (const key of ['new', 'stable', 'shaky', 'risk', 'attention'] as const) {
      const viaRows = filterRowsByState(rows, key, NOW).map((r) => r.id)
      const viaItems = filterByMemoryState(
        rows.map((r) => ({
          srs: {
            id: r.id,
            difficulty: r.difficulty ?? 6,
            stability: r.stability ?? 0,
            lastReviewAt: r.last_review_at ? new Date(r.last_review_at) : null,
            nextReviewAt: null,
            moduleHistory: [],
            reviewCount: r.review_count ?? 0,
          } satisfies SrsCard,
          id: r.id,
        })),
        key,
        NOW,
      ).map((i) => i.id)
      expect(viaRows, `key=${key}`).toEqual(viaItems)
    }
  })
})

describe('이름은 화면에서 짓지 않는다', () => {
  it('4상태 라벨은 memory-labels 를 따른다', () => {
    expect(stateFilterLabel('new')).toBe('새 단어')
    expect(stateFilterLabel('risk')).toBe('흐릿함')
    expect(stateFilterLabel('shaky')).toBe('흔들림')
    expect(stateFilterLabel('stable')).toBe('안정')
  })

  it('attention 은 4상태 중 하나의 이름을 빌리지 않는다 — 합계에 구성요소 이름을 붙이면 수가 어긋난다', () => {
    const label = stateFilterLabel('attention')
    expect(label).toBe('다시 볼')
    expect([
      stateFilterLabel('new'),
      stateFilterLabel('risk'),
      stateFilterLabel('shaky'),
      stateFilterLabel('stable'),
    ]).not.toContain(label)
  })

  it('색은 언제나 --memory-* 토큰 — 하드코딩 금지', () => {
    for (const k of ['stable', 'shaky', 'risk', 'new', 'attention'] as const) {
      expect(stateFilterToken(k)).toMatch(/^--memory-/)
    }
  })
})

// ── ② 고아 링크 감시 — 이 사고를 실제로 잡았을 테스트 ──────────────────
describe('저장소에 적힌 state: 링크는 모두 파싱된다', () => {
  const SRC = join(__dirname, '..', '..', '..')

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      // 테스트 자신은 제외 — 이 파일이 예시로 적은 문자열까지 세면 스스로를 잡는다.
      if (name === 'node_modules' || name === '.next' || name === '__tests__') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.(ts|tsx)$/.test(name)) out.push(p)
    }
    return out
  }

  it('filter=state:X 로 적힌 X 가 전부 유효한 키다', () => {
    const files = walk(SRC)
    const found: Array<{ file: string; key: string }> = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/filter=state:([a-zA-Z_]+)/g)) {
        found.push({ file: f, key: m[1] })
      }
    }
    // 링크가 하나도 없으면 이 테스트는 아무것도 지키지 않는다 — 그것도 회귀다.
    expect(found.length).toBeGreaterThan(0)
    const orphans = found.filter((f) => parseStateFilter(`state:${f.key}`) === null)
    expect(orphans.map((o) => `${o.key} @ ${o.file}`)).toEqual([])
  })
})
