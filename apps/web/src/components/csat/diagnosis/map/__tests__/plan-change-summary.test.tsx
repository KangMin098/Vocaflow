// apps/web/src/components/csat/diagnosis/map/__tests__/plan-change-summary.test.tsx
// T-0077 — 실제 PlanSection: 저장본 → 지금 제안(저장 전) · 저장된 변화 · 이력의 단계 + 계획량. Codex NEXT-PLAN-CHANGE probe(1 fail · 2 pass) 이식 + 대조
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))

import { CANON_VERSION } from '@/lib/csat/map/v4/definition'

import { PlanSection } from '../PlanSection'

const task = 'r.central_meaning', workspace = 'ws.central-meaning', at = '2026-10-20T00:00:00Z'
const ver = (version: number, stage: string, o: { goal?: number | null; planned?: number | null; available?: number | null } = {}) => ({
  version, canon: CANON_VERSION, goalVersionId: o.goal === undefined ? 10 : o.goal, reason: version === 1 ? 'initial' : 'check_result', createdAt: at, asOf: at, note: null, restoredFrom: null,
  plan: { order: [task], tasks: [{ task, stage, planned: o.planned === undefined ? 2 : o.planned, available: o.available === undefined ? 2 : o.available, rule: stage === 'check' ? 'unseen_check_items' : 'blocked_items' }] },
})
function html(stage: string, versions: unknown[] | null, o: { error?: boolean; available?: number | null; goal?: number; past?: boolean } = {}) {
  const row = { task, name: '중심 의미', goal: 'g', criterion: 'c', basis: 'direct_check', evidence: 'verified_need', need: 'REPAIR', stage, quantity: { unit: '문항', available: o.available === undefined ? 2 : o.available, planned: 2, done: 0, remaining: 2, rule: 'blocked_items' }, achievement: 'need_confirmed', unresolved: [], next: null }
  const goalHistory = [{ id: 10, score: 80, exam: 'kice6', grade: null, date: null, createdAt: at }, { id: 11, score: 90, exam: 'kice6', grade: null, date: null, createdAt: at }]
  const saved = { status: 'installed', error: !!o.error, goalVersionId: o.goal ?? 10, goalHistory, byTemplate: versions ? { [workspace]: { workspaceId: '11111111-2222-4333-8444-555555555555', template: workspace, latest: versions[0], history: versions } } : {} }
  return renderToStaticMarkup(<PlanSection view={{ workspace, core: [task], tasks: [row], progress: { planned: 2, done: 0 } } as never} saved={saved as never} viewer="fixture" goal={80} past={!!o.past} reason={null} />)
}
const part = (h: string, id: string) => { const i = h.indexOf(`data-testid="${id}"`); return i < 0 ? '' : h.slice(i, h.indexOf('</div>', i)) }

describe('T-0077 계획 변화 설명', () => {
  it('반례 — 이력: 같은 2문항의 확인 · 바로잡기를 단계 라벨로 구분', () => {
    const h = html('repair', [ver(2, 'repair'), ver(1, 'check')])
    const history = h.slice(h.indexOf('data-testid="plan-history"'))
    const v1 = history.slice(history.indexOf('data-version="1"'))
    expect(v1).toContain('확인하기 2문항')
    expect(history.slice(history.indexOf('data-version="2"'), history.indexOf('data-version="1"'))).toContain('바로잡기 2문항')
  })
  it('저장된 변화 한 번 — 버전 1 → 2 · 저장 사유 · 단계 확인 → 바로잡기', () => {
    const s = part(html('repair', [ver(2, 'repair'), ver(1, 'check')]), 'plan-change-saved')
    expect(s).toContain('버전 1 → 2')
    expect(s).toContain('단계 확인하기 → 바로잡기')
    expect(s).not.toMatch(/실력|향상|숙달/)
  })
  it('저장 check2 → 제안 repair2 = 아직 저장 안 한 제안으로 단계 변화 표시 · 저장됨 아님', () => {
    const h = html('repair', [ver(1, 'check')])
    const p = part(h, 'plan-change-proposal')
    expect(p).toContain('지금 제안(아직 저장하지 않았어요)')
    expect(p).toContain('단계 확인하기 → 바로잡기')
    expect(h).not.toContain('data-state="saved"')
  })
  it('대조 — 같은 저장본이면 저장됨 · 제안 비교 없음(새 버전 자동 생성 없음)', () => {
    const h = html('check', [ver(1, 'check')])
    expect(h).toContain('data-state="saved"')
    expect(h).not.toContain('plan-change-proposal')
  })
  it('가용 null = 미정 그대로', () => {
    const p = part(html('check', [ver(1, 'check')], { available: null }), 'plan-change-proposal')
    expect(p).toContain('쓸 수 있는 자료 2문항 → 미정')
  })
  it('목표만 변경 = 그때 · 지금 목표 기준 + 단계 · 계획량 같음', () => {
    const h = html('check', [ver(1, 'check')], { goal: 11 })
    const p = part(h, 'plan-change-proposal')
    expect(p).toContain('그때 목표 80점')
    expect(p).toContain('지금 목표 90점')
    expect(p).toContain('단계 · 계획량 · 순서가 같아요')
  })
  it('저장본 없음 · 조회 실패 · 잘린 이력 · 과거 보기', () => {
    expect(html('check', null)).toContain('plan-change-none')
    const failed = html('repair', [ver(2, 'repair'), ver(1, 'check')], { error: true })
    expect(failed).toContain('plan-change-unavailable')
    expect(failed).not.toContain('plan-history')
    expect(failed).not.toContain('plan-change-saved')
    expect(html('repair', [ver(3, 'repair'), ver(1, 'check')])).toContain('plan-change-saved-unknown')
    const past = html('repair', [ver(1, 'check')], { past: true })
    expect(past).not.toContain('plan-change-proposal')
    expect(past).not.toContain('plan-change-none')
  })
})
