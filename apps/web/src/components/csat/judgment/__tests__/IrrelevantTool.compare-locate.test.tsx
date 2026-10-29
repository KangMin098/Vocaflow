// apps/web/src/components/csat/judgment/__tests__/IrrelevantTool.compare-locate.test.tsx
// @vitest-environment node
// T-0270 — U02 무관 문장 비교표의 「해설 요청 당시」 · 「지금」 중심 화제 문장을 원문에서 가리키기.
// 실제 unit id 로만 푼다(표시 문자열 역추정 없음) · 지운 당시 선택도 원문에 있으면 가리킨다 · 없는 id · 고정 없음은 단추 0.
// 클릭 흐름(위치 칩 · 화제 고정 불변 · 호출 수)은 PC 하네스(pd-t270-r1)가 실제 컴포넌트로 잰다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { initialState, toggleTopic } from '@/lib/csat/judgment/r-irrelevant'
import { compareRows, topicTargets } from '../IrrelevantTool'

const units = [{ id: 'u1', n: 1 }, { id: 'u2', n: 2 }, { id: 'u3', n: 3 }, { id: 'u4', n: 4 }]

describe('topicTargets — 실제 id → 원문 문장', () => {
  it('문장 번호 순 · 원문에 있으면 unit', () => {
    expect(topicTargets(['u3', 'u1'], units)).toEqual([{ kind: 'unit', id: 'u1', n: 1 }, { kind: 'unit', id: 'u3', n: 3 }])
  })
  it('원문에 없는 id 는 unknown(가리키기 없음) · 고정 없음은 빈 배열', () => {
    expect(topicTargets(['gone', 'u2'], units)).toEqual([{ kind: 'unit', id: 'u2', n: 2 }, { kind: 'unknown', id: 'gone' }])
    expect(topicTargets([], units)).toEqual([])
  })
  it('당시 선택을 지금 지워도 당시 칸은 원문에서 가리킬 수 있다 · 비교 문구 · 바뀜 판정은 그대로', () => {
    const asked = toggleTopic(toggleTopic(initialState(), 'u1'), 'u3')
    const now = toggleTopic(asked, 'u1') // u1 해제
    expect(topicTargets(asked.topic, units).map((t) => t.kind === 'unit' && t.n)).toEqual([1, 3])
    expect(topicTargets(now.topic, units).map((t) => t.kind === 'unit' && t.n)).toEqual([3])
    const row = compareRows(asked, now, { n: 3, nextId: 'u4' }, units).find((r) => r.key === 'topic')!
    expect(row).toMatchObject({ asked: '1번·3번', now: '3번', changed: true })
  })
})

describe('배선', () => {
  const c = fs.readFileSync(path.join(__dirname, '../IrrelevantTool.tsx'), 'utf8')
  it('비교표에 기존 onRef 를 넘기고, 화제 칸만 단추로 그린다', () => {
    expect(c).toContain('<CompareTable asked={asked} now={state} slot={slot} units={units} onPoint={onRef} />')
    expect(c).toContain("{r.key === 'topic' ? topicCell(asked, '해설 요청 당시') : r.asked}")
    expect(c).toContain("{r.key === 'topic' ? topicCell(now, '지금') : r.now}")
  })
  it('단추는 onPoint(id) 만 부른다 — 화제 고정(toggleTopic) · 스냅샷 · 해설 요청 호출 없음', () => {
    const cell = c.slice(c.indexOf('const topicCell'), c.indexOf('const changed = rows.filter'))
    expect(cell).toContain('onClick={() => onPoint(t.id)}')
    expect(cell).not.toMatch(/toggleTopic|setState|setAsked|request\(|ask\(/)
    expect(cell).toContain("if (ts.length === 0) return '고정 없음'")
  })
})
