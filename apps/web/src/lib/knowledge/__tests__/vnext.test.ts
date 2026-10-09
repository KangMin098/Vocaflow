// apps/web/src/lib/knowledge/__tests__/vnext.test.ts
//
// 학습 원리 vNext 회귀(2026-10-08) — 라벨 = 마이그레이션 CHECK · 업무 공간 라우팅(기존 8 URL 보존) · 운영실 요약 · 관계 지도 · 입력 검증.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  APPLICABILITY, APP_STATUSES, APP_SURFACES, EVIDENCE_LEVELS, INQUIRY_ROLES, INQUIRY_STATUSES, KINDS, KINDS_BY_LAYER, RESEARCH_DESIGNS,
  TRIAL_RESULTS, TRIAL_STATUSES, WORKSPACES, workspaceOf,
} from '../vnext-labels'
import { checkAppTransition, checkInquiry, checkResearchSource, checkTrialDesign, kindLanes, neighborhood, opsSummary, trialReportLevel } from '../vnext-rules'

const SQL = fs.readFileSync(path.resolve(__dirname, '../../../../../../supabase/migrations/20261008120000_knowledge_vnext.sql'), 'utf8')
const inList = (re: RegExp) => [...(SQL.match(re)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1])

describe('라벨 = 마이그레이션 CHECK', () => {
  it('kind · evidence_level · applicability · design · 탐구 · 적용 · trial 값', () => {
    expect(inList(/knowledge_items_kind_check check \(kind in \(([\s\S]*?)\)\)/)).toEqual([...KINDS])
    expect(inList(/evidence_level text not null default 'not_rated' check \(evidence_level in \(([\s\S]*?)\)\)/)).toEqual([...EVIDENCE_LEVELS])
    expect(inList(/applicability text not null default 'unknown' check \(applicability in \(([\s\S]*?)\)\)/)).toEqual([...APPLICABILITY])
    expect(inList(/design text not null check \(design in \(([\s\S]*?)\)\)/)).toEqual([...RESEARCH_DESIGNS])
    expect(inList(/status text not null default 'open' check \(status in \(([\s\S]*?)\)\)/)).toEqual([...INQUIRY_STATUSES])
    expect(inList(/role text not null check \(role in \(([\s\S]*?)\)\)/)).toEqual([...INQUIRY_ROLES])
    expect(inList(/surface text not null check \(surface in \(([\s\S]*?)\)\)/)).toEqual([...APP_SURFACES])
    expect(inList(/status text not null default 'draft' check \(status in \(([\s\S]*?)\)\)/)).toEqual([...APP_STATUSES])
    expect(inList(/status text not null default 'planned' check \(status in \(([\s\S]*?)\)\)/)).toEqual([...TRIAL_STATUSES])
    expect(inList(/result text check \(result in \(([\s\S]*?)\)\)/)).toEqual([...TRIAL_RESULTS])
  })
  it('층 ↔ 종류 대응 = knowledge_items_kind_layer_check', () => {
    expect(KINDS_BY_LAYER).toEqual({ essence: ['competency', 'essence_bundle'], principle: ['processing_mechanism', 'learning_mechanism'], method: ['method'], practice: ['task'] })
  })
})

describe('업무 공간 — 기존 8 URL 보존', () => {
  it('5개 공간', () => expect(WORKSPACES.map((w) => w.label)).toEqual(['원리 운영실', '역량 · 원리 지도', '탐구 · 근거 연구소', '학습 설계 · 검증', '제품 적용 · 품질']))
  it('기존 라우트는 모두 한 공간의 탭이거나 공간 안에 있다', () => {
    const old = ['/admin/knowledge/principles', '/admin/knowledge/methods', '/admin/knowledge/review', '/admin/knowledge/sources', '/admin/knowledge/sources/csat', '/admin/knowledge/experts', '/admin/knowledge/gaps', '/admin/methodology']
    for (const u of old) expect(workspaceOf(u)?.tabs.some((t) => t.href === u)).toBe(true)
    expect(workspaceOf('/admin/knowledge/item/x')?.key).toBe('map')
    expect(workspaceOf('/admin/knowledge/lab/q-1')?.key).toBe('lab')
    expect(workspaceOf('/admin/knowledge')?.key).toBe('ops')
    for (const u of old) expect(fs.existsSync(path.resolve(__dirname, '../../../app', `.${u}`, 'page.tsx'))).toBe(true)
  })
})

describe('운영실 요약', () => {
  const items = [
    { id: 'e', slug: 'e', title: '본질', layer: 'essence' as const, kind: 'essence_bundle' as const, status: 'in_review' as const, efficacy: 'not_assessed' },
    { id: 'p', slug: 'p', title: '과제', layer: 'practice' as const, kind: 'task' as const, status: 'extracted' as const, efficacy: 'not_assessed' },
    { id: 'u', slug: 'u', title: '미분류', layer: 'principle' as const, kind: null, status: 'in_review' as const, efficacy: 'not_assessed' },
  ]
  const evidence = [{ itemId: 'p', sourceType: 'external', evidenceLevel: 'practitioner_claim' as const, applicability: 'unknown' as const }]
  it('지금 DB 꼴(위층 근거 0 · 연구 0 · 질문 0) → 병목 = 탐구 · 우선 큐에 위층 근거 0 이 맨 앞', () => {
    const s = opsSummary({ items, evidence, inquiries: [], applications: [], openGaps: 2 })
    expect(s.bottleneck).toBe('inquiry')
    expect(s.queue[0]).toMatchObject({ severity: 1, title: '역량 · 기제 · 방법에 근거가 하나도 없다' })
    expect(s.queue.map((q) => q.title)).toEqual(expect.arrayContaining(['연구 근거 0', '종류 미분류 1개', '열린 탐구 질문 0', '검토 대기 3개', '열린 공백 2개']))
    expect(s.stages.find((x) => x.key === 'evidence')?.note).toContain('실무자 주장 1')
  })
  it('자동 중단된 적용 · 합성 trial 만 있는 active 적용을 큐에 올린다', () => {
    const s = opsSummary({ items, evidence, inquiries: [{ id: 'q', slug: 'q', question: '?', status: 'open', links: 0 }], openGaps: 0, applications: [
      { id: 'a', itemId: 'e', status: 'paused', surfaceRef: 'x', statusReason: '항목 in_review — 자동 중단', trials: [] },
      { id: 'b', itemId: 'e', status: 'active', surfaceRef: 'y', statusReason: null, trials: [{ status: 'planned', synthetic: true }] },
    ] })
    expect(s.queue[0].title).toContain('자동 중단된 적용 — x')
    expect(s.queue.some((q) => q.title.includes('실제 학습자 검증 계획 없는 적용 — y'))).toBe(true)
  })
})

describe('관계 지도', () => {
  const g = [
    { id: '1', slug: 'c', title: '역량', kind: 'competency' as const, layer: 'essence' as const, status: 'in_review' as const, skillIds: ['skill:reading'] },
    { id: '2', slug: 'm', title: '방법', kind: 'method' as const, layer: 'method' as const, status: 'in_review' as const, skillIds: ['skill:reading'] },
    { id: '3', slug: 'x', title: '미분류', kind: null, layer: 'principle' as const, status: 'in_review' as const, skillIds: [] },
  ]
  it('종류별 열 · 미분류 열 · 영역 필터', () => {
    const all = kindLanes(g, null)
    expect(all.map((l) => l.kind)).toEqual(['competency', 'processing_mechanism', 'learning_mechanism', 'method', 'task', 'essence_bundle', 'unclassified'])
    expect(kindLanes(g, 'skill:reading').flatMap((l) => l.items.map((i) => i.id))).toEqual(['1', '2'])
  })
  it('노드 주변 — 위 · 아래 · 옆', () => {
    const n = neighborhood('2', [{ fromId: '2', toId: '1', kind: 'implements' }, { fromId: '4', toId: '2', kind: 'implements' }, { fromId: '2', toId: '5', kind: 'contrasts' }])
    expect(n).toEqual({ up: ['1'], down: ['4'], side: [{ id: '5', kind: 'contrasts' }] })
  })
})

describe('입력 검증', () => {
  it('탐구 질문 · 연구 서지', () => {
    expect(checkInquiry({ slug: 'claim-evidence', question: '주장과 근거 관계는 어떻게 기르나' })).toBeNull()
    expect(checkInquiry({ slug: 'Bad Slug', question: '질문입니다' })).toMatch(/slug/)
    expect(checkResearchSource({ citation: 'Author (2020). Title.', doi: '10.1000/xyz', url: null, design: 'rct', year: 2020 })).toBeNull()
    expect(checkResearchSource({ citation: 'Author (2020). Title.', doi: 'xyz', url: null, design: 'rct', year: 2020 })).toMatch(/DOI/)
    expect(checkResearchSource({ citation: 'Author (2020). Title.', doi: null, url: null, design: 'blog', year: 2020 })).toMatch(/설계/)
  })
  it('적용 전이 · 이유', () => {
    expect(checkAppTransition('draft', 'active', '')).toMatch(/출시 승인/)
    expect(checkAppTransition('draft', 'active', '주석 맹검 합의 · 노출 범위 검토')).toBeNull()
    expect(checkAppTransition('active', 'paused', '')).toMatch(/이유/)
    expect(checkAppTransition('rolled_back', 'active', '')).toMatch(/허용되지 않는다/)
  })
  it('검증 프로토콜 — 사전 · 사후 필수 · 비교 조건 없으면 관찰된 변화', () => {
    const d = { pre: true, post: true, delayedDays: 14, transfer: true, comparison: null, minN: 30, measures: ['주장형 정답률'] }
    expect(checkTrialDesign(d)).toBeNull()
    expect(checkTrialDesign({ ...d, pre: false })).toMatch(/사전/)
    expect(trialReportLevel(d)).toMatch(/관찰된 변화/)
    expect(trialReportLevel({ ...d, comparison: '미연습 주장형 문항' })).toMatch(/비교 조건 있음/)
  })
})
