// apps/web/src/lib/csat/map/v4/__tests__/definition.test.ts
// rev4.0 정의 무결성(scripts/csat/map/v4/__tests__/codebook.test.mjs 의 Vitest 이식) + 생성물 최신 여부.
// 기준 실측: docs/csat-learner/v4/asis-snapshot.json(라인 54 · 활동 183 — 개발 DB 읽기 전용 스냅샷).

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { V4_DATA } from '../definition.data'
import { checkKeysOfTask, checkedTaskOfKey, isHold, linesOfTask, tasksOfActivity } from '../definition'

const ROOT = path.resolve(__dirname, '../../../../../../../..')
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v4/asis-snapshot.json'), 'utf8')) as {
  nodes: { code: string; kind: string }[]
  tasks: { id: string; line_code: string }[]
}
const lineCodes = snap.nodes.filter((n) => n.kind === 'line').map((n) => n.code).sort()
const activityIds = snap.tasks.map((t) => t.id).sort()
const ids = new Set(V4_DATA.tasks.map((t) => t.id))

describe('rev4 정의 — 기존 자산 전수 보존', () => {
  it('생성물이 원천 JSON 과 같다(gen-definition --check)', () => {
    expect(() => execFileSync(process.execPath, [path.join(ROOT, 'scripts/csat/map/v4/gen-definition.mjs'), '--check'], { stdio: 'pipe' })).not.toThrow()
  })

  it('라인 54 · 활동 183 — 누락 · 남는 것 없음', () => {
    expect(Object.keys(V4_DATA.lines).sort()).toEqual(lineCodes)
    expect(Object.keys(V4_DATA.activityClass).sort()).toEqual(activityIds)
  })

  it('TASK 30 · id 유일 · 모든 대응이 존재하는 TASK 를 가리킨다', () => {
    expect(V4_DATA.tasks).toHaveLength(30)
    expect(ids.size).toBe(30)
    for (const l of Object.values(V4_DATA.lines)) for (const t of l.v4) expect(ids.has(t)).toBe(true)
    for (const a of activityIds) for (const t of tasksOfActivity(a)) expect(ids.has(t)).toBe(true)
    for (const t of V4_DATA.tasks) expect(linesOfTask(t.id).length + Object.values(V4_DATA.activityTaskOverride).filter((v) => v.includes(t.id)).length).toBeGreaterThan(0)
  })

  it('보류 TASK 는 직접 확인 blocked · 확인 과제 키가 없다(실행 콘텐츠로 승격되지 않는다)', () => {
    for (const t of V4_DATA.tasks.filter((x) => x.status === 'hold')) {
      expect(isHold(t.id)).toBe(true)
      expect(t.direct_check).toBe('blocked')
      expect(checkKeysOfTask(t.id)).toEqual([])
    }
  })

  it('확인 과제 키는 live/ready Workspace 의 중심 TASK 하나만 가리킨다', () => {
    expect(checkedTaskOfKey('claim-support')).toBe('r.central_meaning')
    expect(checkedTaskOfKey('option-restate')).toBe('e.option_correspondence')
    expect(checkedTaskOfKey('evidence-locate')).toBe('e.evidence_location')
    expect(checkedTaskOfKey('cohesion-link')).toBe('r.relation')
    expect(checkedTaskOfKey('unknown')).toBeNull()
  })

  it('관계 — 승인은 정본이 구성을 명시한 PART_OF(S · R · E) 14개뿐', () => {
    const approved = V4_DATA.relations.filter((r) => r.status === 'approved')
    expect(approved).toHaveLength(14)
    for (const r of approved) {
      expect(r.type).toBe('PART_OF')
      expect(r.basis).toBe('canon_rev2.1')
      expect(r.to.charAt(0)).not.toBe('x')
    }
    expect(V4_DATA.relations.filter((r) => r.status === 'proposed')).toHaveLength(20)
  })

  it('Workspace 준비 상태는 중심 TASK 의 직접 확인 상태보다 높지 않다 · 보류 템플릿 표시가 맞다', () => {
    const rank = { blocked: 0, content_needed: 1, ready: 2, live: 3 } as const
    const byId = new Map(V4_DATA.tasks.map((t) => [t.id, t]))
    for (const w of V4_DATA.templates) {
      const low = Math.min(...w.core.map((c) => rank[byId.get(c)!.direct_check]))
      expect(rank[w.readiness]).toBe(low)
      expect(w.hold).toBe(w.core.some((c) => byId.get(c)!.status === 'hold'))
    }
  })
})
