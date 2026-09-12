// apps/web/src/lib/wordvault/__tests__/list-params.test.ts
//
// `?q=` · `?level=` 회귀 — **`filter=state:*` 와 똑같은 사고가 세 군데 더 있었다.**
//
// 허브의 세 자리(`WordPeekStrip` · `FindAndMore` · `CEFRDistribution`)가 이 파라미터를
// 걸어 보내는데 목적지에서 읽는 코드가 하나도 없었다(실측 2026-08-30). 단어를 눌러 놓고
// 전체 목록을 받는데 오류도 경고도 없다 — 링크를 만든 쪽에서는 영원히 안 보인다.
//
// 그래서 `state-filter.test.ts` 가 세운 두 축을 그대로 쓴다:
//   ① 판정이 맞는가
//   ② **저장소에 적힌 링크가 실제로 읽히는가** — ②가 이 파일의 핵심이다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  levelParamToClass,
  matchesLevel,
  matchesQuery,
  normalizeQuery,
  parseLevelParam,
} from '@/lib/wordvault/list-params'

const word = (level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', w = 'test', m = '시험') => ({
  level,
  levelClass: (level[0]!.toLowerCase() as 'a' | 'b' | 'c'),
  word: w,
  meaning: m,
})

describe('parseLevelParam', () => {
  it('묶음(a/b/c)을 받는다 — 화면 셀렉트가 쓰는 값', () => {
    expect(parseLevelParam('a')).toEqual({ kind: 'class', value: 'a' })
    expect(parseLevelParam('B')).toEqual({ kind: 'class', value: 'b' })
  })

  it('낱개 CEFR 을 받는다 — 허브 레벨 막대가 보내는 값', () => {
    expect(parseLevelParam('B1')).toEqual({ kind: 'cefr', value: 'B1' })
    expect(parseLevelParam('c2')).toEqual({ kind: 'cefr', value: 'C2' })
  })

  it('지정 안 함과 못 알아들음을 모두 null 로 — 호출부가 거르지 않는다', () => {
    expect(parseLevelParam(null)).toBeNull()
    expect(parseLevelParam('')).toBeNull()
    expect(parseLevelParam('all')).toBeNull()
    expect(parseLevelParam('B3')).toBeNull()
    expect(parseLevelParam('중급')).toBeNull()
  })
})

describe('matchesLevel', () => {
  it('낱개 CEFR 은 그 칸만 — 묶음보다 좁다', () => {
    const p = parseLevelParam('B1')
    expect(matchesLevel(word('B1'), p)).toBe(true)
    expect(matchesLevel(word('B2'), p)).toBe(false)
  })

  it('묶음은 두 칸 다', () => {
    const p = parseLevelParam('b')
    expect(matchesLevel(word('B1'), p)).toBe(true)
    expect(matchesLevel(word('B2'), p)).toBe(true)
    expect(matchesLevel(word('A2'), p)).toBe(false)
  })

  it('조건이 없으면 전부 통과', () => {
    expect(matchesLevel(word('C1'), null)).toBe(true)
  })
})

describe('levelParamToClass — 셀렉트 초기 표시', () => {
  it('낱개 CEFR 은 자기 묶음으로 환산된다', () => {
    expect(levelParamToClass(parseLevelParam('B1'))).toBe('b')
    expect(levelParamToClass(parseLevelParam('A2'))).toBe('a')
  })
  it('없으면 전체', () => {
    expect(levelParamToClass(null)).toBe('all')
  })
})

describe('matchesQuery — URL 검색과 손 검색이 같은 규칙', () => {
  it('단어와 뜻 양쪽을 본다 · 대소문자 무시', () => {
    expect(matchesQuery(word('B1', 'Abandon', '버리다'), 'aband')).toBe(true)
    expect(matchesQuery(word('B1', 'abandon', '버리다'), '버리')).toBe(true)
    expect(matchesQuery(word('B1', 'abandon', '버리다'), 'zzz')).toBe(false)
  })
  it('빈 검색어는 거르지 않는다', () => {
    expect(matchesQuery(word('B1'), '')).toBe(true)
    expect(matchesQuery(word('B1'), '   ')).toBe(true)
  })
  it('normalizeQuery 는 양끝 공백만 버린다', () => {
    expect(normalizeQuery('  hi  ')).toBe('hi')
    expect(normalizeQuery(null)).toBe('')
  })
})

// ── ② 고아 링크 감시 ─────────────────────────────────────────────────
describe('저장소가 거는 목록 파라미터는 모두 읽힌다', () => {
  const SRC = join(__dirname, '..', '..', '..')

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name === '__tests__') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.(ts|tsx)$/.test(name)) out.push(p)
    }
    return out
  }

  /** `/wordvault…?…level=<v>` 로 적힌 값들. 템플릿 치환(`${…}`)은 값을 모르므로 뺀다. */
  function writtenLevels(): Array<{ file: string; value: string }> {
    const out: Array<{ file: string; value: string }> = []
    for (const f of walk(SRC)) {
      const src = readFileSync(f, 'utf8')
      if (!src.includes('/wordvault')) continue
      for (const m of src.matchAll(/[?&]level=([A-Za-z0-9]+)/g)) {
        out.push({ file: f, value: m[1]! })
      }
    }
    return out
  }

  it('적혀 있는 level 값이 전부 유효하다', () => {
    const found = writtenLevels()
    // 링크가 하나도 없으면 이 테스트는 아무것도 지키지 않는다 — 그것도 회귀다.
    expect(found.length).toBeGreaterThan(0)
    const orphans = found.filter((f) => parseLevelParam(f.value) === null)
    expect(orphans.map((o) => `${o.value} @ ${o.file}`)).toEqual([])
  })

  it('`?q=` 를 거는 링크가 있으면 읽는 자가 있다', () => {
    // 읽는 자는 이 파일의 `matchesQuery` 하나다. 링크만 있고 읽는 자가 사라지면
    // 여기 import 가 깨져 곧바로 빨개진다 — 그게 이 단언의 목적이다.
    const writers = walk(SRC).filter((f) => {
      const src = readFileSync(f, 'utf8')
      return src.includes('/wordvault') && /[?&]q=/.test(src)
    })
    expect(writers.length, '허브가 ?q= 를 거는 자리가 사라졌다면 이 검사를 지울 것').toBeGreaterThan(0)
    expect(typeof matchesQuery).toBe('function')
  })
})
