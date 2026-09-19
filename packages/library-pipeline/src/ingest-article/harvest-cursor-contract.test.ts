// packages/library-pipeline/src/ingest-article/harvest-cursor-contract.test.ts
//
// **커서 없는 수확기를 말없이 붙일 수 없게 한다.**
//
// ── 왜 (실측 2026-09-07) ────────────────────────────────────────────────
// FrYM 은 offset 으로 훑으면서 커서를 남기지 않았다. 매 실행이 최신 `--limit` 편만 보고
// **오류 없이 정상 종료**했고, 미방문 1,667편에 한 번도 닿지 않았다. 화면에도 로그에도
// 이상이 없다 — "새 것 0" 은 다 캔 것과 구별되지 않는다.
//
// 이 테스트가 요구하는 것은 하나다: **모든 목록기가 등록부에 있고, 깊이 캐면서 커서가
// 없으면 그 이유를 글로 적어야 한다.** 이유를 적는 순간 사람이 읽고 판단할 수 있다.
//
// ⚠️ 목록은 소스에서 읽는다. 손으로 적으면 이 파일이 두 번째 사본이 된다.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  HARVEST_CURSOR_REGISTRY,
  HARVEST_CURSOR_VERSION,
  emptyHarvestCursor,
  harvestCursorPath,
  markSeen,
} from './harvest-cursor'
import { UNGOVERNED_KNOWN_DIVERGENCE } from './source-key'

const DIR = __dirname
const REPO = path.resolve(DIR, '../../../..')

/**
 * **스크립트 목록기** — `.ts` 어댑터가 아니라 `scripts/**\/*.mjs` 로 사는 수확기.
 *
 * ⚠️ 이 부류가 오래 검사 밖에 있었다. `scripts/csat/harvest-gutenberg.mjs` 는 5만 권짜리
 *   카탈로그를 훑으면서 규약 밖 커서를 썼는데, 등록부는 `.ts` 어댑터만 세고 있어서
 *   **한 번도 걸리지 않았다.** 자동 발견(파일명 규칙)으로 하지 않고 **파일이 스스로
 *   선언**하게 하는 이유는 하나다 — 남의 세션이 짓는 중인 수확기를 이 검사가 먼저
 *   깨뜨리면, 고치는 대신 검사를 끄게 된다.
 */
function scriptListers(): Array<{ file: string; source: string }> {
  const out: Array<{ file: string; source: string }> = []
  const roots = path.join(REPO, 'scripts')
  if (!existsSync(roots)) return out
  for (const dir of readdirSync(roots)) {
    const sub = path.join(roots, dir)
    if (!statSync(sub).isDirectory()) continue
    for (const f of readdirSync(sub)) {
      if (!f.endsWith('.mjs')) continue
      const src = readFileSync(path.join(sub, f), 'utf8')
      const key = src.match(/@harvest-source:\s*([a-z0-9_]+)/)?.[1]
      if (key) out.push({ file: `scripts/${dir}/${f}`, source: key })
    }
  }
  return out
}

/** 어댑터 파일 → 그 파일이 담당하는 소스 키. `listXxxFeed` 를 export 하는 파일만 센다. */
function listerFiles(): Array<{ file: string; source: string }> {
  const out: Array<{ file: string; source: string }> = [...scriptListers()]
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts') || f.startsWith('_')) continue
    const src = readFileSync(path.join(DIR, f), 'utf8')
    if (!/export\s+(async\s+)?function\s+list[A-Z]\w*Feed\b/.test(src)) continue
    // `source_id: \`<key>:` 또는 `source: '<key>'` 에서 소스 키를 읽는다.
    const key =
      src.match(/source_id:\s*`([a-z0-9_]+):/)?.[1] ??
      src.match(/source:\s*'([a-z0-9_]+)'/)?.[1] ??
      src.match(/sourceKey\('([a-z0-9_]+)'/)?.[1] ??
      null
    if (key) out.push({ file: f, source: key })
  }
  return out
}

const LISTERS = listerFiles()

describe('수확기 등록부 — 커서 없는 목록기를 말없이 못 붙인다', () => {
  it('목록기 파일을 실제로 읽었다', () => {
    // 0건 비교로 통과하는 것을 막는다 — 0 은 성과일 수도, 측정 실패일 수도 있다.
    expect(LISTERS.length, '목록기를 하나도 못 찾았다 — 이 가드가 아무것도 안 지킨다').toBeGreaterThan(10)
  })

  it('모든 목록기가 등록부에 있다', () => {
    const missing = LISTERS.filter((l) => !(l.source in HARVEST_CURSOR_REGISTRY))
    expect(
      missing.map((m) => `${m.source} (${m.file})`),
      '등록부에 없는 목록기 — `harvest-cursor.ts` 의 HARVEST_CURSOR_REGISTRY 에 ' +
        '{ deepPaged, cursorFile, reason } 을 더할 것. 깊이 캐는데 커서를 안 둘 거면 **이유를 글로** 적어야 한다',
    ).toEqual([])
  })

  it('깊이 캐면서 커서가 없으면 이유가 있어야 한다', () => {
    const silent = Object.entries(HARVEST_CURSOR_REGISTRY)
      .filter(([, e]) => e.deepPaged && !e.cursorFile && !e.reason?.trim())
      .map(([k]) => k)
    expect(
      silent,
      '커서 없이 깊이 캐는 수확기 — 매 실행이 같은 창만 보고 조용히 끝난다(FrYM 이 그랬다). ' +
        '커서를 두거나 reason 을 적을 것',
    ).toEqual([])
  })

  it('스크립트 수확기도 등록부 검사에 들어온다 — `@harvest-source:` 선언', () => {
    // 이 검사가 0건 통과하면 위의 「등록부에 있다」가 스크립트 수확기를 하나도 안 지킨다.
    const scripts = scriptListers()
    expect(scripts.length, '`@harvest-source:` 를 선언한 스크립트가 없다').toBeGreaterThan(0)
    expect(scripts.map((s) => s.source)).toContain('gutenberg')
    expect(HARVEST_CURSOR_REGISTRY.gutenberg?.cursorFile, 'Gutenberg 커서가 사라졌다').toBeTruthy()
  })

  it('2026-09-07 에 고친 셋은 이유가 아니라 커서 파일을 갖는다', () => {
    // 이 셋만은 "이유를 적었다" 로 넘어가면 안 된다 — 고쳤다는 주장이 여기서 검증된다.
    expect(HARVEST_CURSOR_REGISTRY.frym.cursorFile, 'FrYM 커서가 사라졌다').toBeTruthy()
    expect(HARVEST_CURSOR_REGISTRY.frym.reason ?? '').toBe('')
    expect(HARVEST_CURSOR_REGISTRY.wikipedia.cursorFile, 'Wikipedia 커서가 사라졌다').toBeTruthy()
  })

  it('등록부에만 있고 코드에 없는 소스가 없다', () => {
    const known = new Set(LISTERS.map((l) => l.source))
    const extra = Object.keys(HARVEST_CURSOR_REGISTRY).filter((k) => !known.has(k))
    expect(extra, '등록부에만 있는 소스 — 어댑터가 지워졌으면 여기서도 지울 것').toEqual([])
  })
})

describe('커서 형식 — 위치와 모양이 한 벌이다', () => {
  it('위치는 scripts/<pipeline>/data/<source>[-<feed>]-cursor.json', () => {
    expect(harvestCursorPath('textbook', 'frym', 'recent', '/repo').replace(/\\/g, '/')).toBe(
      '/repo/scripts/textbook/data/frym-recent-cursor.json',
    )
    expect(harvestCursorPath('csat', 'plos', null, '/repo').replace(/\\/g, '/')).toBe(
      '/repo/scripts/csat/data/plos-cursor.json',
    )
  })

  it('피드가 파일 이름에 들어간다 — 한 피드의 전진이 다른 피드를 덮지 않는다', () => {
    const a = harvestCursorPath('acp', 'wikipedia', 'featured', '/repo')
    const b = harvestCursorPath('acp', 'wikipedia', 'good', '/repo')
    expect(a).not.toBe(b)
  })

  it('빈 커서는 "아직 아무것도 안 봤다" 를 말한다 (소진이 아니다)', () => {
    const c = emptyHarvestCursor('frym', 'recent')
    expect(c.version).toBe(HARVEST_CURSOR_VERSION)
    expect(c.token).toBeNull()
    expect(c.exhausted).toBe(false)
    expect(c.seen).toEqual([])
  })

  it('seen 은 중복을 만들지 않는다 — 거절한 편도 적는다', () => {
    const c = markSeen(markSeen(emptyHarvestCursor('frym', 'recent'), ['a', 'b']), ['b', 'c'])
    expect(c.seen).toEqual(['a', 'b', 'c'])
  })
})

describe('아직 이관 안 한 곳 — 목록에서 조용히 사라지지 않는다', () => {
  it('simple_wikipedia 의 3갈래 열쇠가 기록돼 있다', () => {
    // 지우면 다음 사람이 "이미 정리됐다" 로 읽는다. 해소하면 이 테스트도 함께 지운다.
    expect(Object.keys(UNGOVERNED_KNOWN_DIVERGENCE)).toContain('simple_wikipedia')
  })
})
