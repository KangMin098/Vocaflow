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

/** TARGET <id> describe 블록 — 다음 describe 앞까지 */
export function targetBlock(src: string, id: string): string {
  const at = src.indexOf(`'TARGET ${id} `)
  if (at < 0) return ''
  const next = src.indexOf('\ndescribe', at)
  return src.slice(at, next < 0 ? undefined : next)
}
/** 실행 가능한 목표 — todo 가 없고 본문 있는 it 이 하나 이상 */
export const targetRunnable = (block: string) => !/\bit\.todo\(/.test(block) && /\bit(\.each\([^)]*\))?\(\s*'/.test(block)

describe('K 결함 등록부 정합', () => {
  // fixed 로 바꾸면 재현이 꺼지므로, 그때 목표가 todo 면 아무것도 검증하지 않은 채 PASS 가 된다(T-0155 K-R1 run 2)
  it('fixed 결함은 실행 가능한 목표 테스트가 있어야 한다', () => {
    for (const [id, g] of Object.entries(K_GAPS)) {
      if (g.status === 'fixed') expect(targetRunnable(targetBlock(targets, id)), `${id}: 목표가 todo 이거나 비어 있다 — fixed 불가`).toBe(true)
    }
  })
  it('가드 자가 검증: 현재 K6-a 목표는 todo 라 fixed 로 바꿀 수 없다, K4-a 는 실행 가능하다', () => {
    expect(targetRunnable(targetBlock(targets, 'K6-a'))).toBe(false)
    expect(targetRunnable(targetBlock(targets, 'K4-a'))).toBe(true)
  })

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
