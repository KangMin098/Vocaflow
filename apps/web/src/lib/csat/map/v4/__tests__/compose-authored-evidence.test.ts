// apps/web/src/lib/csat/map/v4/__tests__/compose-authored-evidence.test.ts
// T-0076 — 실제 composeV4: 정본 확인 키가 없어도 창작 채점 키가 있는 TASK(보조 e.task_demand 등)의 근거 설명을 만든다.
//   R5 중심(r.central_meaning)은 그대로 · 키가 전혀 없는 TASK 는 여전히 생략 · 근거 설명의 읽기 키 = PLAN 근거 키(evidenceKeysOfTask)
import { describe, expect, it } from 'vitest'

import { DEFAULT_MAP_SETTINGS, type MapPageData } from '../../load'
import { composeV4 } from '../compose'
import { checkKeysOfTask, evidenceKeysOfTask, type TaskId } from '../definition'

const NOW = '2026-10-21T00:00:00Z'
const data = (o: Partial<MapPageData> = {}) => ({
  now: NOW,
  settings: DEFAULT_MAP_SETTINGS,
  practiceLinks: [],
  findAttempts: [],
  lifecycleActivity: [],
  instrumentHashes: {},
  model: { goal: 80, goalSet: true, lineRefItems: {}, nodes: {} },
  v4: { sessions: [], proxyCovers: [], refItems: [], transferItems: {}, transferTargets: {}, repairTargets: {}, saved: { byTemplate: {} } },
  ...o,
}) as unknown as MapPageData

describe('composeV4 근거 설명 범위(T-0076)', () => {
  it('보조 e.task_demand — 정본 확인 키 0 · 창작 키 있음 → 근거 설명 생성 · 대표 키 = 창작 키', () => {
    expect(checkKeysOfTask('e.task_demand')).toEqual([])
    expect(evidenceKeysOfTask('e.task_demand').length).toBeGreaterThan(0)
    const v = composeV4(data(), { score: 80, set: true })!
    const e = v.evidence?.['e.task_demand']
    expect(e, '창작 TASK 근거 설명이 통째로 빠지지 않는다').toBeTruthy()
    expect(e!.taskKey).toBe(evidenceKeysOfTask('e.task_demand')[0])
    expect(e!.delayedRetention.status).toBe('NOT_ESTABLISHED')
    expect(e!.learningEffect).toBe('NOT_EVALUATED')
  })
  it('R5 중심 r.central_meaning — 정본 확인 키가 대표 · 기존대로 생성', () => {
    const v = composeV4(data(), { score: 80, set: true })!
    expect(v.evidence?.['r.central_meaning']?.taskKey).toBe(checkKeysOfTask('r.central_meaning')[0])
  })
  it('근거 키가 전혀 없는 TASK 는 생략(새 근거를 만들지 않는다)', () => {
    const v = composeV4(data(), { score: 80, set: true })!
    for (const id of Object.keys(v.asIs.tasks) as TaskId[]) if (evidenceKeysOfTask(id).length === 0) expect(v.evidence?.[id], id).toBeUndefined()
  })
  // T-0078 — 이전 기대(원장 못 읽음 → 근거 설명 ledger unknown)는 바뀌었다: 필수 원장을 못 읽으면 compose 가 개인화 계산 자체를 하지 않는다(null · 복구 화면).
  //   이유: 0건으로 계산한 진단 · 계획이 저장 · 공급에 쓰였다(T-0078 반례). 가짜 [] 로 통과시키지 않는다
  it('원장 못 읽음 = 개인화 계산 없음(null)', () => {
    expect(composeV4(data({ lifecycleActivity: undefined } as never), { score: 80, set: true })).toBeNull()
  })
})
