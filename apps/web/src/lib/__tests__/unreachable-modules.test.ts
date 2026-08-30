// apps/web/src/lib/__tests__/unreachable-modules.test.ts
//
// **어느 화면에서도 도달할 수 없는 모듈**을 센다 — 늘지 못하게 잠그는 래칫.
//
// ── 왜 (실측 2026-08-30) ─────────────────────────────────────────────
// `components/wordvault/hub/` 에서 렌더되지 않는 컴포넌트 8개(1,278줄)를 발견하고
// 저장소 전체를 세어 봤다. **49파일 · 6,299줄**이 Next 진입점(page·layout·route·
// middleware…)에서 import 를 따라가도 닿지 않았다.
//
// 죽은 코드가 조용한 것이 아니다. 그 안에는 이런 것이 들어 있었다:
//   · 하드코딩된 진행 수치(`pendingCount = 12, todayGoal = 15, todayDone = 8`)
//   · 목적지가 읽지 않는 링크(`/flashcard?mode=review`)
//   · 교체됐는데 안 지워진 v1 대시보드 6종(살아 있는 화면은 다른 6종을 쓴다)
//   · `lib/supabase/middleware.ts` — 실제 `middleware.ts` 는 자기 안에서 클라이언트를
//     만든다. 남겨 두면 **낡은 인증 경로를 누군가 import 한다**
// 읽는 사람에게 이것들은 "구현된 기능" 으로 보인다. 그게 이 파일이 막으려는 것이다.
//
// ── 왜 0 이 아니라 래칫인가 ──────────────────────────────────────────
// 40개가 남아 있고 그중 상당수는 그 영역을 아는 사람이 판단해야 한다
// (pairflip·wordblitz·echo…). 한 커밋에 전부 지우는 것은 정상 milestone 이 아니다
// (CLAUDE.md "파일 ≥30 개 변경"). 그래서 **늘지 않는 것만 강제**하고 수치를 남긴다.
// 줄이면 이 상수를 함께 내린다 — 올리는 방향으로 고치는 것은 이 검사를 끄는 것과 같다.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative, resolve, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '..', '..')

/**
 * 도달 불가 상한. **실측으로만 내린다.**
 * 2026-08-30: 49 → (v1 대시보드 6 · 목업 2 · 낡은 supabase 미들웨어 1 삭제) → 40
 */
const MAX_UNREACHABLE = 40

/**
 * import 로는 안 닿지만 **설정이 부르는** 파일 — 죽은 코드가 아니다.
 * 여기에 더할 때는 **누가 부르는지**를 함께 적을 것.
 */
const CONFIG_ENTRYPOINTS = new Set([
  'test/server-only-stub.ts', // vitest.config.ts 의 `server-only` alias 가 가리킨다
])

const rel = (f: string) => relative(SRC, f).split(sep).join('/')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

/**
 * ⚠️ 경로를 **정규화해서** 돌려준다.
 *    `base + '/index.ts'` 를 그대로 쓰면 윈도우에서 구분자가 섞여(`…\brief/index.ts`)
 *    walk 결과와 문자열이 안 맞고, **배럴 파일이 전부 죽은 것으로 잡힌다**(첫 판이 그랬다).
 */
function resolveImport(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else return null
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const c = normalize(base + ext)
    if (existsSync(c)) return c
  }
  return existsSync(base) && statSync(base).isFile() ? normalize(base) : null
}

function importsOf(f: string): string[] {
  const src = readFileSync(f, 'utf8')
  const out: string[] = []
  for (const re of [
    /from\s+['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]/g,
  ]) {
    for (const m of src.matchAll(re)) {
      const r = resolveImport(f, m[1]!)
      if (r) out.push(r)
    }
  }
  return out
}

/** Next 가 스스로 부르는 파일 + 테스트. 여기서부터 import 를 따라간다. */
function isEntry(f: string): boolean {
  const p = rel(f)
  return (
    /(^|\/)(page|layout|route|template|loading|error|not-found|global-error|default)\.(ts|tsx)$/.test(p) ||
    /(^|\/)(sitemap|robots|opengraph-image|twitter-image|icon|apple-icon|manifest)\.(ts|tsx)$/.test(p) ||
    p === 'middleware.ts' ||
    p.includes('__tests__/') ||
    /\.test\.(ts|tsx)$/.test(p) ||
    CONFIG_ENTRYPOINTS.has(p)
  )
}

function unreachable(): string[] {
  const all = walk(SRC).map(normalize)
  const entries = all.filter(isEntry)
  const reach = new Set<string>()
  const q = [...entries]
  while (q.length) {
    const f = q.shift()
    if (!f || reach.has(f)) continue
    reach.add(f)
    for (const i of importsOf(f)) if (!reach.has(i)) q.push(i)
  }
  return all.filter((f) => !reach.has(f)).map(rel).sort()
}

describe('도달할 수 없는 모듈', () => {
  it('스캔이 비어 있으면 이 테스트는 아무것도 지키지 않는다', () => {
    expect(walk(SRC).length).toBeGreaterThan(500)
    expect(walk(SRC).filter(isEntry).length).toBeGreaterThan(100)
  })

  it(`진입점에서 닿지 않는 파일이 ${MAX_UNREACHABLE}개보다 늘지 않는다`, () => {
    const dead = unreachable()
    expect(
      dead.length,
      `도달 불가 ${dead.length}개 (상한 ${MAX_UNREACHABLE}). 늘었다면 새로 만든 것이 ` +
        `어디에도 배선되지 않았다는 뜻이다:\n${dead.join('\n')}`,
    ).toBeLessThanOrEqual(MAX_UNREACHABLE)
  })

  it('상한이 실제보다 크게 앞서 있지 않다 — 줄였으면 함께 내린다', () => {
    // 여유를 5 이상 두면 그만큼 조용히 늘 수 있다. 지우고 나서 상수를 안 내리면
    // 이 검사는 그 순간부터 아무것도 안 지킨다.
    expect(MAX_UNREACHABLE - unreachable().length).toBeLessThanOrEqual(4)
  })
})
