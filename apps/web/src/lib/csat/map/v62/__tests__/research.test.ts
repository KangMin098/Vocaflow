// apps/web/src/lib/csat/map/v62/__tests__/research.test.ts
// v6.2 P-M3 — 연구 v1.4 스냅샷 반입 가드: 원문 · Gold 미반입, 연구 판정의 승격 금지, 학습 행동의 제품 과제 실재
import { describe, expect, it } from 'vitest'

import { ITEM_TASKS } from '@/lib/knowledge/item-tasks'

import { tasks } from '../../v4/definition'
import RESEARCH from '../research-v14.data.json'
import { BEHAVIORS, researchFor, researchLinks } from '../research'

describe('연구 v1.4 스냅샷', () => {
  it('수치 = 연구 최종 게이트(활동 12 · 채점 기준 48 · R3 승인 0 · 공개 보류)', () => {
    expect(RESEARCH.tasks.reduce((s, t) => s + t.activities.length, 0)).toBe(12)
    expect(RESEARCH.tasks.reduce((s, t) => s + t.activities.reduce((x, a) => x + a.facets, 0), 0)).toBe(48)
    expect(RESEARCH.status).toMatchObject({ release: 'hold', r3Approved: 0, humanValidation: 0, studentValidation: 0 })
    for (const t of RESEARCH.tasks) expect(t.gate).toMatchObject({ R2_content: false, R3_scoring_independence: false, R4_learner: false, R5_effect: false })
  })
  it('원문 · 선지 · 정답 · Gold · 판정 이유를 옮기지 않았다(허용 키만)', () => {
    const allowed = new Set(['task', 'item', 'type', 'first', 'second', 'agree'])
    for (const l of RESEARCH.links) expect(Object.keys(l).every((k) => allowed.has(k))).toBe(true)
    const text = JSON.stringify(RESEARCH)
    expect(text).not.toMatch(/"(passage|options|answer|gold|why|prompt)"\s*:/i)
  })
  it('TASK id 는 영구 30 안에 있다', () => {
    const ids = new Set(tasks().map((t) => t.id))
    for (const t of RESEARCH.tasks) expect(ids.has(t.task)).toBe(true)
    for (const l of RESEARCH.links) expect(ids.has(l.task)).toBe(true)
  })
})

describe('연구 판정의 승격 금지', () => {
  it('검토 행은 relevance=unknown · R1 · 두 AI 일치일 때만 후보', () => {
    const links = researchLinks()
    expect(links).toHaveLength(RESEARCH.links.length)
    expect(links.every((l) => l.relevance === 'unknown' && l.tier === 'R1' && l.source === 'research_ai_reviewed')).toBe(true)
    const split = RESEARCH.links.filter((l) => !l.agree).map((l) => `${l.task}|${l.item}`)
    expect(links.filter((l) => split.includes(`${l.task}|${l.item}`)).every((l) => l.candidateRelevance === null)).toBe(true)
  })
  it('Inspector 용 보기는 문항 링크를 주지 않는다(노출 원장 보호)', () => {
    const r = researchFor('r.central_meaning')!
    expect(JSON.stringify(r)).not.toMatch(/\/csat\/item\//)
    expect(r.reviews.length).toBeGreaterThan(0)
  })
})

describe('학습 행동 — 「지금 할 수 있어요」는 실제 제품 과제가 있을 때만', () => {
  it('available 이면 그 과제 키가 문항 과제 등록부에 있고, 없으면 design_only', () => {
    const keys = new Set(ITEM_TASKS.map((t) => t.key))
    for (const list of Object.values(BEHAVIORS)) for (const b of list) {
      if (b.status === 'available') expect(b.productKey && keys.has(b.productKey)).toBe(true)
      else expect(b.productKey).toBeNull()
    }
  })
  it('E3 는 정답 찾기(AI)와 다섯 선지 전체 검증(FOV)을 따로 두고, FOV 는 아직 제품에 없다', () => {
    const e3 = BEHAVIORS['e.option_correspondence']
    expect(e3.find((b) => b.id === 'e3-ai')?.status).toBe('available')
    expect(e3.find((b) => b.id === 'e3-fov')?.status).toBe('design_only')
  })
})
