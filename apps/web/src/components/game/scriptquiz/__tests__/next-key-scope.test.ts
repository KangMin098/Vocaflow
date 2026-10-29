// apps/web/src/components/game/scriptquiz/__tests__/next-key-scope.test.ts
// @vitest-environment node
// T-0269 — 답한 뒤 전역 Enter/Space 가 단추 · 링크 같은 기본 조작부의 키를 가로채 다음 문항으로 넘기지 않는다(근거 문장 버튼 반례).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/scriptquiz/grade-actions', () => ({ gradeScriptQuizAnswer: vi.fn() }))
vi.mock('@/lib/scores/record-score', () => ({ recordGameScore: vi.fn() }))
vi.mock('@/lib/recommend/use-next-action', () => ({ useNextAction: () => null }))

import { nextKeyAdvances } from '../ScriptQuiz'

/** closest(selector) 만 흉내 내는 대상 — 단추/링크 조상이 있으면 그 요소를 돌려준다 */
const el = (owner: boolean) => ({ closest: () => (owner ? {} : null), isContentEditable: false }) as unknown as EventTarget

describe('nextKeyAdvances', () => {
  it('본문(조작부 아님)의 Enter · Space 는 다음으로', () => {
    expect(nextKeyAdvances({ key: 'Enter', target: el(false) })).toBe(true)
    expect(nextKeyAdvances({ key: ' ', target: el(false) })).toBe(true)
    expect(nextKeyAdvances({ key: 'Enter', target: null })).toBe(true)
  })
  it('근거 문장 단추 · 다음 단추 · 링크(기본 조작부)의 Enter · Space 는 그 요소가 처리 — 전역 전진 0', () => {
    expect(nextKeyAdvances({ key: 'Enter', target: el(true) })).toBe(false)
    expect(nextKeyAdvances({ key: ' ', target: el(true) })).toBe(false)
  })
  it('다른 키는 다음으로 넘기지 않는다', () => {
    for (const key of ['a', '1', 'Tab', 'Escape', 'ArrowRight']) expect(nextKeyAdvances({ key, target: el(false) })).toBe(false)
  })
})

describe('배선 — 답한 뒤 핸들러가 nextKeyAdvances 를 거친다', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../ScriptQuiz.tsx'), 'utf8')
  const effect = src.slice(src.indexOf('// ── 답한 뒤 Enter/Space 로 다음 ──'), src.indexOf('// ── 키보드 단축키 (1~4 / O,X) ──'))
  it('Enter/Space 직접 비교 대신 nextKeyAdvances(e) 로 판정하고 그때만 goNext', () => {
    expect(effect).toMatch(/if \(nextKeyAdvances\(e\)\) \{\s+e\.preventDefault\(\)\s+goNext\(\)/)
    expect(effect).not.toMatch(/e\.key === 'Enter' \|\| e\.key === ' '/)
    expect(src).toContain("import { nativeControlOwnsKey } from '@/lib/ui/learner-keyboard-scope'")
  })
})
