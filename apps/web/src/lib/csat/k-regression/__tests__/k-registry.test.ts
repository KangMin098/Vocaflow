// apps/web/src/lib/csat/k-regression/__tests__/k-registry.test.ts
// 등록부 · 재현 · 목표 · 대응표가 같은 결함 목록을 말하는지 — 한쪽만 고쳐 open 결함이 PASS 로 보이는 일을 막는다.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { K_GAPS } from '../gaps'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const repro = read('./k-repro.test.ts')
const targets = read('./k-targets.test.ts')
const matrix = read('../../../../../../../docs/csat-k-regression/RISK_MATRIX.md')

describe('K 결함 등록부 정합', () => {
  for (const [id, g] of Object.entries(K_GAPS)) {
    it(`${id}: 재현 · 목표 테스트가 모두 있다`, () => {
      expect(repro).toContain(`REPRO ${id} `)
      expect(repro).toContain(`isOpen('${id}')`)
      expect(targets).toContain(`TARGET ${id} `)
      expect(targets).toContain(`isOpen('${id}')`)
    })
    it(`${id}: 대응표 상태가 등록부와 같다(${g.status})`, () => {
      const row = matrix.split('\n').find((l) => l.startsWith(`| ${id} |`))
      expect(row, `RISK_MATRIX 에 ${id} 행이 없다`).toBeDefined()
      expect(row).toContain(g.status === 'open' ? 'KNOWN_GAP' : 'PASS')
    })
  }
  it('대응표의 KNOWN_GAP 행은 모두 등록부에 있다', () => {
    const ids = matrix.split('\n').filter((l) => /^\| K\d-[a-z] \|.*KNOWN_GAP/.test(l)).map((l) => l.split('|')[1].trim())
    expect(ids.sort()).toEqual(Object.keys(K_GAPS).filter((id) => K_GAPS[id as keyof typeof K_GAPS].status === 'open').sort())
  })
})
