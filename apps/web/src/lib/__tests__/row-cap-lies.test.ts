// apps/web/src/lib/__tests__/row-cap-lies.test.ts
//
// **`.limit(N)` 에서 N > 1,000 은 거짓말이다** — 그만큼 오지 않는다.
//
// ── 왜 (실측 2026-08-30) ─────────────────────────────────────────────
// PostgREST 는 한 응답에 `db-max-rows` 까지만 준다. 이 프로젝트는 **1,000** 이다.
// 그보다 크게 요청해도 **오류가 아니라 조용히 1,000행**이 온다:
//
//     supabase.from('vocabularies').select('id').limit(10000)  →  받은 행 1000
//
// 그래서 `.limit(10000)` 은 "넉넉히 받겠다" 가 아니라 **"1,000에서 끊기는 것을 모르고 있다"**
// 는 표시다. 이 하루에만 같은 결함을 여섯 번 만났고 전부 오류 없이 화면만 틀렸다:
//   · 도서 카탈로그 "단어장 N" 배지 · 계획 자료 선택기 · 학습 자산(hub)
//   · **상태 띠의 기억 분포**(`growth-stats` — 모든 화면 최상단에 뜬다)
//   · **둘러보기 목록**(`browse-queries` — 1,000을 넘는 단어는 아예 안 보였다)
//   · **상태 필터 학습 세션**(`study-queries` — "새 단어 N개로 시작" 이 N 보다 적게 열렸다)
// 이미 `vocabularies` 가 1,945행인 계정이 있다. 잠재적 위험이 아니라 지금 일어나는 일이다.
//
// 전량이 필요하면 `lib/supabase/paged-select.ts` 를 쓴다. 표시용 상위 N개처럼 **일부러**
// 자르는 곳은 `.limit()` 을 쓰되 1,000 이하여야 한다 — 그래야 적은 수가 곧 받는 수다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { PAGE_SIZE } from '@/lib/supabase/paged-select'

const SRC = join(__dirname, '..', '..')
const rel = (f: string) => relative(SRC, f).split(sep).join('/')

const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

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
 * `.limit(<숫자>)` 중 상한을 넘는 것.
 *
 * ⚠️ 주석을 걷어내고 센다 — 이 저장소는 "여기 있던 `.limit(10000)` 은 효과가 없었다" 처럼
 *    **고친 경위를 주석에 남긴다.** 안 걷으면 고친 파일이 계속 빨간불이 된다.
 */
function overCapLimits(): string[] {
  const out: string[] = []
  for (const f of walk(SRC)) {
    if (rel(f).includes('__tests__/')) continue
    const src = strip(readFileSync(f, 'utf8'))
    src.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/\.limit\(\s*(\d+)\s*\)/g)) {
        const n = Number(m[1])
        if (n > PAGE_SIZE) out.push(`${rel(f)}:${i + 1}  .limit(${n})`)
      }
    })
  }
  return out
}

describe('행 상한을 넘겨 요청하지 않는다', () => {
  it('상한 상수가 실제 플랫폼 값과 같다', () => {
    // 이 값이 틀리면 아래 검사 전체가 엉뚱한 것을 잰다.
    expect(PAGE_SIZE).toBe(1000)
  })

  it('스캔이 비어 있으면 이 테스트는 아무것도 지키지 않는다', () => {
    const anyLimit = walk(SRC)
      .filter((f) => !rel(f).includes('__tests__/'))
      .some((f) => /\.limit\(\s*\d+\s*\)/.test(strip(readFileSync(f, 'utf8'))))
    expect(anyLimit, '`.limit(N)` 을 하나도 못 찾았다 — 스캐너가 깨졌다').toBe(true)
  })

  it(`.limit(N) 의 N 이 ${1000} 을 넘지 않는다`, () => {
    const offenders = overCapLimits()
    expect(
      offenders,
      '요청한 만큼 오지 않는다(조용히 1,000행에서 끊긴다). 전량이 필요하면 ' +
        '`lib/supabase/paged-select.ts` 를 쓸 것:\n' +
        offenders.join('\n'),
    ).toEqual([])
  })
})
