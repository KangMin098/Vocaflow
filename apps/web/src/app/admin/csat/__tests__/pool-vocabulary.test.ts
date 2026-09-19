// apps/web/src/app/admin/csat/__tests__/pool-vocabulary.test.ts
//
// **「조판」 두 수를 같은 이름으로 부르지 않는다.**
//
// 2026-09-16 감사 실측: 「조판 풀」이라는 낱말이 두 화면에서 **2.9배 다른 수**를 가리켰다.
//
//   · 현황판 ④ · 소재 화면  — `pool.n` 87,556 = `ready`+`published` 중 화면 전용을 뺀 것(적격 판정 전)
//   · 원문 적격 화면        — 7축 적격 통과분(「조판 가능」 30,508)
//
// 조판기(`scripts/textbook/volume-pool.mjs`)는 기본값에서 **적격 통과분만** 싣는다. 그러니 앞의 수를
// 「조판 풀」이라 부르면 관리자는 재료가 세 배 있다고 읽는다. 이름을 둘로 갈랐다 —
// **조판 후보**(판정 전)와 **조판 가능**(조판기가 싣는 것).
//
// 이 시험은 화면·도움말의 **보이는 글자**에 옛 낱말이 돌아오는 것을 막는다. 주석은 경위를 적느라
// 옛 이름을 인용하므로 뺀다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../../../..')

/** 화면·도움말 파일 전부 — 시험 파일은 뺀다(시험은 옛 이름을 인용해 경위를 적는다). */
function files(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__') continue
      out.push(...files(p))
    } else if (/\.(tsx?|mts)$/.test(name)) out.push(p)
  }
  return out
}

/** 주석 줄을 뺀 본문. 블록 주석 안쪽(`*` 로 시작)과 줄 주석(`//`)을 버린다. */
function visibleLines(src: string): { n: number; text: string }[] {
  return src
    .split(/\r?\n/)
    .map((text, i) => ({ n: i + 1, text }))
    .filter(({ text }) => {
      const t = text.trim()
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*'))
    })
}

const TARGETS = [
  path.join(SRC, 'app/admin/csat'),
  path.join(SRC, 'lib/admin/help'),
  path.join(SRC, 'lib/csat/factory.ts'),
]

describe('「조판」 두 수의 이름', () => {
  const all = TARGETS.flatMap((t) => (statSync(t).isDirectory() ? files(t) : [t]))

  it('화면·도움말의 보이는 글자에 「조판 풀」이 없다', () => {
    const hits: string[] = []
    for (const f of all) {
      for (const { n, text } of visibleLines(readFileSync(f, 'utf8'))) {
        // 도움말은 경위를 적느라 「이 칸은 … 「조판 풀」이라 불렸는데」 처럼 **따옴표 안에서** 옛 이름을 든다.
        if (/조판 풀/.test(text) && !/「조판 풀」이라 불렸/.test(text)) {
          hits.push(`${path.relative(SRC, f)}:${n}  ${text.trim().slice(0, 80)}`)
        }
      }
    }
    expect(hits, `옛 이름이 돌아왔다 — 「조판 후보」(판정 전) 또는 「조판 가능」(조판기가 싣는 것)으로:\n${hits.join('\n')}`).toEqual([])
  })

  it('현황판 ④의 후보 눈금은 「적격 판정 전」임을 이름에 박고, 조판기가 싣는 수를 옆에 적는다', () => {
    const src = readFileSync(path.join(SRC, 'lib/csat/factory.ts'), 'utf8')
    expect(src).toContain(`label: '조판 후보 원문 (적격 판정 전)'`)
    // 노트는 판정에 안 들어간다 — 사람이 돌리는 스캔이 낡아도 공정 상태가 흔들리지 않는다.
    expect(src).toMatch(/note: `그중 조판기가 싣는 「조판 가능」/)
  })
})
