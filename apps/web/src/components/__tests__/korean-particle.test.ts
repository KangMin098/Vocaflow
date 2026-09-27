// apps/web/src/components/__tests__/korean-particle.test.ts
//
// **조사를 손으로 붙인 오류** 전역 가드 — 받침 없는 「스크립트」 뒤에 을/이/은 이 붙은 화면 문구.
// 파일마다 따로 막던 테스트(TodayFocus · DiscoveryFooter)가 있었는데도 다른 화면 네 곳에서 같은 오류가 살아 있었다
// (2026-09-21 발견: 약관 · 스크립트 퀴즈 2 · 읽기 빈 상태 · 보관함 빈 상태). 파일 하나씩이 아니라 저장소 전체를 본다.
// 주석 줄은 뺀다 — 오류 경위를 적은 주석이 예시로 이 글자를 담는다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../..')
const BAD = /스크립트(을|이 |은 )/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (name === '__tests__' || name === 'node_modules' || name.startsWith('.')) continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|mdx?)$/.test(name)) out.push(p)
  }
  return out
}

describe('받침 없는 「스크립트」 뒤 조사', () => {
  it('화면 문구에 스크립트을 · 스크립트이 · 스크립트은 이 없다', () => {
    const hits: string[] = []
    for (const f of walk(SRC)) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const t = line.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return
        if (BAD.test(line)) hits.push(`${path.relative(SRC, f)}:${i + 1}`)
      })
    }
    expect(hits, `조사 오류 — 를/가/는 으로:\n  ${hits.join('\n  ')}`).toEqual([])
  })
})
