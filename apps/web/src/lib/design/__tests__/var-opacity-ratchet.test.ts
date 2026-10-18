// apps/web/src/lib/design/__tests__/var-opacity-ratchet.test.ts
//
// **변수 색에 붙은 /N 은 칠해지지 않는다**(Tailwind 3.4 — DD-82 · learner-tines-audit S3 ④).
// `bg-[var(--bd)]/55` 는 CSS 를 만들지 않아 조용히 투명하다 — 읽기 화면의 문장 듣기 점이 그래서 빈 틈으로 보였다.
// 2026-10-18 학습자 코드(관리자·테스트 제외)에 119곳 · 50파일이 있었고, 읽기 화면(components/workspace) 16곳을
// `scripts/design/var-opacity-codemod.mjs` 로 고쳤다. 나머지는 화면 묶음마다 눈으로 확인하며 고친다(S4).
// 이 테스트는 **늘지 않게만** 막는다(상한). 줄이면 상한을 같이 낮춘다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../../..')
const RE = /\[var\(--[a-z0-9-]+\)\]\/\d{1,3}(?![\d%])/g

/** 2026-10-18 기준선 103(= 119 − 읽기 화면 16 · 44파일). 고칠 때마다 낮춘다. */
const CEILING = 103

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'admin') continue
      walk(p, out)
    } else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p)
  }
  return out
}

describe('변수 색 /N 클래스(칠해지지 않음)', () => {
  const hits = walk(SRC).flatMap((f) => (readFileSync(f, 'utf8').match(RE) ?? []).map((m) => `${path.relative(SRC, f)}  ${m}`))

  it(`학습자 코드 전체 ${CEILING}곳을 넘지 않는다`, () => {
    expect(hits.length, hits.slice(0, 20).join('\n')).toBeLessThanOrEqual(CEILING)
  })

  it('읽기 화면(components/workspace)에는 하나도 없다', () => {
    expect(hits.filter((h) => h.startsWith(`components${path.sep}workspace`))).toEqual([])
  })
})
