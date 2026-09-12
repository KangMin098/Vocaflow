// apps/web/src/lib/__tests__/orphan-query-params.test.ts
//
// **거는데 읽는 자가 없는 쿼리 파라미터**를 저장소 전체에서 훑는다.
//
// ── 왜 (실측 2026-08-29 ~ 30, 같은 사고 네 번) ───────────────────────
// 링크를 쓰는 쪽과 읽는 쪽이 **문자열로만** 이어져 있으면, 읽는 분기가 없어도
// 타입·린트·빌드가 전부 통과하고 화면은 오류 없이 뜬다. 대신 말한 것과 다른 것이 온다.
//
//   · `?filter=state:new`  — 허브 CTA 가 2주 동안 보냈는데 읽는 코드 0개.
//                            "새 단어 익히기 11" 이 252개 전체를 열었다
//   · `?q=<단어>`          — 허브에서 단어를 눌러도 전체 목록
//   · `?level=B1`          — 레벨 막대를 눌러도 전체 목록
//   · `/flashcard?word=<id>` — `/flashcard` 는 searchParams 를 한 줄도 안 읽는다
//   · `/signup?plan=pro` · `/signup?invited=true` — 받는 쪽이 만들어진 적 없다
//
// 앞의 셋은 각각 자기 자리에서 막았다(`state-filter.test.ts` · `list-params.test.ts`).
// 그런데 **다른 화면에 같은 구멍이 있는지는 아무도 몰랐다.** 그래서 전수로 옮긴다.
//
// ── 판정을 좁게 잡는 이유 ────────────────────────────────────────────
// "이 라우트가 이 파라미터를 읽는가" 를 정확히 풀려면 라우트별 컴포넌트 그래프가 필요하다.
// 대신 **이름이 저장소 어디에서도 읽히지 않는 것**만 잡는다 — 오탐이 없고, 우리가 네 번
// 밟은 사고가 전부 이 모양이었다. (라우트 단위 정밀화는 이 판이 안정된 뒤에.)

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..')

/**
 * 훑지 않는 곳 — **이유가 있는 것만.** 길어지면 커버리지가 아니라 면제 목록이 자란다.
 *   · `__tests__`  — 픽스처 주소는 제품이 거는 링크가 아니다
 *   · `*.mock.ts`  — 같은 이유
 *   · `seed-fetchers` — **외부 API** URL 을 만든다(`?per_page=` 는 남의 서버가 읽는다)
 *   · `hub-lab`    — 재설계 실험용. 학습자 동선이 아니다(`SKIP_ROUTES` 와 같은 판단)
 */
function skipped(path: string): boolean {
  const p = relative(SRC, path).split(sep).join('/')
  return (
    p.includes('__tests__/') ||
    p.endsWith('.mock.ts') ||
    p.includes('lib/library/seed-fetchers/') ||
    p.includes('hub-lab/')
  )
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !skipped(p)) out.push(p)
  }
  return out
}

const FILES = walk(SRC)
const rel = (f: string) => relative(SRC, f).split(sep).join('/')

/**
 * 주석을 걷어낸 소스.
 *
 * ⚠️ 이게 없으면 **"예전에 `/flashcard?word=<id>` 로 보내고 있었다" 는 설명 주석**까지
 *    링크로 세어 방금 고친 것을 다시 신고한다(첫 판이 그랬다). 이 저장소는 결함의 경위를
 *    주석에 길게 적으므로 그 안에 옛 주소가 그대로 남는다 — 코드만 본다.
 */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** 내부 경로(`/…`)에 붙여 쓴 쿼리 파라미터. 외부 URL(`https://`)은 잡히지 않는다. */
function writtenParams(): Array<{ name: string; file: string; route: string }> {
  const out: Array<{ name: string; file: string; route: string }> = []
  const link = /["'`](\/[A-Za-z0-9\-_/[\]$;{}.]*)\?([^"'`]+)["'`]/g
  for (const f of FILES) {
    const src = code(readFileSync(f, 'utf8'))
    for (const m of src.matchAll(link)) {
      for (const pair of m[2]!.split('&')) {
        const name = pair.split('=')[0]!
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) continue
        out.push({ name, file: rel(f), route: m[1]! })
      }
    }
  }
  return out
}

/**
 * 읽는 쪽. **별칭을 반드시 함께 본다** — 서버 컴포넌트는 `searchParams` 를 통째로 받아
 * `sp.period` 처럼 다른 이름으로 쓴다. 그것을 놓치면 멀쩡한 파라미터를 고아로 신고한다
 * (첫 판이 `/arcade/ranking?period=` 를 그렇게 잡았다).
 */
function readParams(): Set<string> {
  const out = new Set<string>()
  for (const f of FILES) {
    const src = code(readFileSync(f, 'utf8'))
    // ① `searchParams.get('x')` · `sp.get('x')` · `url.searchParams.get('x')`
    for (const m of src.matchAll(/\.get\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g)) out.add(m[1]!)
    // ② `searchParams: { x?: string }` — 서버 컴포넌트 props 타입 선언
    for (const m of src.matchAll(/searchParams\s*[:?]\s*\{([\s\S]*?)\}/g)) {
      for (const k of m[1]!.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\??\s*:/g)) out.add(k[1]!)
    }
    // ③ `sp.period` · `searchParams.tab` — 별칭 포함 속성 접근
    for (const m of src.matchAll(
      /\b(?:searchParams|sp|params|query)\??\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
    )) {
      out.add(m[1]!)
    }
  }
  return out
}

describe('쿼리 파라미터에는 읽는 자가 있다', () => {
  it('스캔이 비어 있으면 이 테스트는 아무것도 지키지 않는다', () => {
    expect(writtenParams().length).toBeGreaterThan(20)
    expect(readParams().size).toBeGreaterThan(20)
  })

  it('저장소가 내부 링크에 거는 파라미터는 모두 어딘가에서 읽힌다', () => {
    const reads = readParams()
    const orphans = new Map<string, Set<string>>()
    for (const w of writtenParams()) {
      if (reads.has(w.name)) continue
      if (!orphans.has(w.name)) orphans.set(w.name, new Set())
      orphans.get(w.name)!.add(`${w.route} @ ${w.file}`)
    }
    const lines = [...orphans.entries()].map(
      ([name, uses]) => `?${name}=  ← ${[...uses].join(' , ')}`,
    )
    expect(
      lines,
      '거는데 읽는 자가 없는 파라미터(화면은 오류 없이 뜨고 조건만 조용히 버려진다):\n' +
        lines.join('\n'),
    ).toEqual([])
  })
})
