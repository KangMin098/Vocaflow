// apps/web/src/components/csat/judgment/__tests__/OrderTool.compare-locate.test.tsx
// T-0264 — 비교표 「해설 요청 당시 · 지금」 연결 셀에서 원문 문장을 가리키기. 유효한 문장만 단추, 없는 연결은 「연결 없음」, 원문에 없는 id 는 가리키기 없음.
// 클릭 · 키보드 · 자동 스크롤 0 · 위치 칩은 PC 하네스(pc-t264)가 실제 OrderTool 로 잰다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/csat/lecture/store', () => ({ lectureMeta: () => null }))

import { compareTarget, orderCompareRows, type OrderSnapshot } from '../OrderTool'
import type { Link } from '@/lib/csat/judgment/r-order'

const unitN = (id: string) => ({ u1: 1, u2: 2, u3: 3 } as Record<string, number>)[id]
const L = (cueId: string, antecedent: string): Link => ({ cueId, para: 'B', cueText: `cue-${cueId}`, kind: 'demonstrative' as Link['kind'], antecedent, antecedentPara: 'G' })
const S = (links: Link[]): OrderSnapshot => ({ arr: ['A', 'B', 'C'], links })

describe('compareTarget', () => {
  it('연결 없음 · 원문 문장 · 원문에 없는 id 를 가른다', () => {
    expect(compareTarget(null, unitN)).toEqual({ kind: 'none' })
    expect(compareTarget('u2', unitN)).toEqual({ kind: 'unit', id: 'u2', n: 2 })
    expect(compareTarget('gone', unitN)).toEqual({ kind: 'unknown', id: 'gone' })
  })
  it('당시 · 지금 각각 — 지움 · 대상 바꿈 · 새 연결 · 없는 id', () => {
    const rows = orderCompareRows(S([L('B-1', 'u1'), L('C-1', 'u3'), L('A-1', 'gone')]), S([L('B-1', 'u2'), L('A-2', 'u1')]))
    const cells = rows.map((r) => [r.cueId, compareTarget(r.asked, unitN).kind, compareTarget(r.now, unitN).kind])
    expect(cells).toEqual([
      ['B-1', 'unit', 'unit'], // 대상 바꿈 — 당시 1번 · 지금 2번 둘 다 가리킬 수 있다
      ['C-1', 'unit', 'none'], // 지움 — 당시 3번은 가리키고 지금은 「연결 없음」
      ['A-1', 'unknown', 'none'], // 원문에 없는 id — 가리키기 없음
      ['A-2', 'none', 'unit'], // 새 연결 — 당시 「연결 없음」
    ])
  })
})

describe('배선 — 기존 setFocus 만 쓰고 자동 스크롤 · 스냅샷 변경 없음', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../OrderTool.tsx'), 'utf8')
  const cmp = src.slice(src.indexOf('function OrderCompare('), src.indexOf('export function OrderTool('))
  it('비교표 단추는 onPoint → setFocus([id]) · scrollIntoView 없음 · 스냅샷 · 연결을 바꾸지 않는다', () => {
    expect(src).toContain('onPoint={(id) => setFocus([id])}')
    expect(cmp).toMatch(/onClick=\{\(\) => onPoint\(t\.id\)\}/)
    expect(cmp).not.toMatch(/scrollIntoView|scrollTo\(|setLinks|setArr|setAsked/)
    expect(cmp).toMatch(/if \(t\.kind === 'none'\) return '연결 없음'/)
  })
  it('단추는 공통 judgment 단추 클래스(44px · 보이는 초점)를 쓴다', () => {
    expect(cmp).toMatch(/className=\{`\$\{js\.button\} \$\{s\.linkGo\}`\}/)
  })
})
