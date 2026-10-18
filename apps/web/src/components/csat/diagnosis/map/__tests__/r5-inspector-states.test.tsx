// apps/web/src/components/csat/diagnosis/map/__tests__/r5-inspector-states.test.tsx
// R5 r.central_meaning TaskInspector 8 상태 — ISOLATED FIXTURE(합성 기록 · 고정 시각 · DB 0). 개발 DB · 실제 학습자 증거가 아니다.
// R5_STATES_OUT=<경로> 를 주면 상태별 관찰 DOM 문구 표를 그 파일에 쓴다(docs/research/r5-screen-states-20261018/STATES.md).
import { writeFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
vi.mock('@/lib/analytics/client', () => ({ track: () => {} }))
// 기존 단계 시트(learnerPath)는 MapModel 전체가 필요하다 — 이 시험의 대상(R5 끝단 경로)과 무관해 빈 경로로 둔다
vi.mock('@/lib/csat/map/learner-path', () => ({ learnerPath: () => ({ read: [], listen: [] }) }))

import { ledgerKey } from '@/lib/csat/map/v62/supply-ledger'

import { act, att, OTHER_TRANSFER_REF, pick, render, TASK, TRANSFER_REF, type Fixture } from './r5-inspector-fixture'

const IDS = ['inspector-ability', 'inspector-supply-bucket', 'inspector-fallback', 'inspector-principle-path', 'inspector-return-summary', 'inspector-fq'] as const
const eligible = (task: string, ref = TRANSFER_REF) => ({ ref, task, role: 'transfer', qualificationId: `q-${task}-${ref}` })

// 확인 문항 2개 독립 오답(직접 확인 · 보완 필요) → 같은 문항 바로잡기 성공 → 단계 = 다른 글에 적용
const verified = [att('2026#20', false, 10), att('2026#22', false, 11)]
const repaired = [act('2026#20', false, 10), act('2026#22', false, 11), act('2026#20', true, 13), act('2026#22', true, 13)]
const base = { goalSet: true, asOfDay: 14, saved: true } as const

const STATES: { id: string; name: string; f: Fixture }[] = [
  { id: '1', name: '목표 없음 · 기록 없음', f: { goalSet: false, attempts: [], activity: [], asOfDay: 12, saved: false, fq: { status: 'not_installed' } } },
  { id: '2', name: '목표 있음 · 자료 없음', f: { goalSet: true, attempts: [], activity: [], asOfDay: 12, saved: true, fq: { status: 'installed', eligible: [] } } },
  { id: '3', name: '적격 자료 있음', f: { ...base, attempts: verified, activity: repaired, fq: { status: 'installed', eligible: [eligible(TASK)] } } },
  {
    id: '4', name: '자료 납품됨(유효 납품 확인)',
    f: { ...base, attempts: verified, activity: repaired, fq: { status: 'installed', eligible: [] }, ledger: (d) => ({ status: 'installed', lines: { [ledgerKey(TASK, 'transfer', d)]: { order: { state: 'delivered', seq: 1 }, delivered: 1, requested: 1, validDelivered: 1 } } }) },
  },
  { id: '4b', name: '납품 행 있음 · 유효 수량 미확인(대조)', f: { ...base, attempts: verified, activity: repaired, fq: { status: 'installed', eligible: [] }, ledger: (d) => ({ status: 'installed', lines: { [ledgerKey(TASK, 'transfer', d)]: { order: { state: 'delivered', seq: 1 }, delivered: 1, requested: null, validDelivered: null } } }) } },
  // 해설을 먼저 본 풀이 = 수행 기록일 뿐 독립 근거 아님
  { id: '5', name: '학습 수행 기록 있음(독립 아님)', f: { goalSet: true, attempts: [att('2026#20', false, 10, 'viewed_first'), att('2026#22', true, 11, 'viewed_first')], activity: [act('2026#20', false, 10), act('2026#22', true, 11)], asOfDay: 12, saved: true, fq: { status: 'installed', eligible: [] } } },
  { id: '6', name: '복습 · 전이 대기(전이 단계 · 정식 자격 0)', f: { ...base, attempts: verified, activity: repaired, fq: { status: 'installed', eligible: [] } } },
  { id: '7a', name: 'PLAN 그대로 · 복귀', f: { ...base, attempts: verified, activity: repaired, fq: { status: 'installed', eligible: [] }, returned: [] } },
  { id: '7b', name: 'PLAN 갱신 뒤 복귀(v3→v4 · 목표 바뀜)', f: { ...base, planVersion: 4, attempts: verified, activity: repaired, fq: { status: 'installed', eligible: [] }, returned: [{ kind: 'plan_changed', from: 3, to: 4 }, { kind: 'goal_changed' }] } },
  // 적격이 철회돼 다른 TASK 적격만 남음 + 원장 납품이 모두 무효(validDelivered 0)
  {
    id: '8', name: '철회 · 대체됨(적격 제거 · 납품 무효)',
    f: { ...base, attempts: verified, activity: repaired, fq: { status: 'installed', eligible: [eligible('r.title_fit', TRANSFER_REF), eligible('r.title_fit', OTHER_TRANSFER_REF)] }, ledger: (d) => ({ status: 'installed', lines: { [ledgerKey(TASK, 'transfer', d)]: { order: { state: 'partial', seq: 2 }, delivered: 1, requested: 1, validDelivered: 0 } } }) },
  },
]

const R = Object.fromEntries(STATES.map((s) => [s.id, render(s.f)]))
const one = (id: string, testid: string) => pick(R[id].html, testid)
const buckets = (id: string) => one(id, 'inspector-supply-bucket').map((b) => b.attrs['data-bucket'])

describe('R5 TaskInspector — 공통 불변식(모든 상태)', () => {
  it.each(STATES.map((s) => [s.id, s.name]))('%s %s — 숙달 % 없음 · 능력 · FQ 줄이 있다', (id) => {
    const html = R[id].html
    expect(html).not.toMatch(/\d\s*%|숙달도|마스터/)
    expect(one(id, 'inspector-ability')).toHaveLength(1)
    expect(one(id, 'inspector-fq')).toHaveLength(1)
  })
  it.each(STATES.map((s) => [s.id, s.name]))('%s %s — unreviewed 는 「검수된 자료 있음 · 납품 완료」로 보이지 않고, 대안은 정식 공급이 없을 때만 숨는다', (id) => {
    for (const b of one(id, 'inspector-supply-bucket')) {
      if (b.attrs['data-bucket'] === 'unreviewed') expect(b.text).not.toMatch(/검수된 자료 있음|납품 완료|공급 완료/)
    }
    const formal = buckets(id).some((b) => b === 'qualified' || b === 'delivered')
    expect(one(id, 'inspector-fallback').length).toBe(formal ? 0 : 1)
    if (!formal) expect(one(id, 'inspector-ability')[0].attrs['data-progress']).toContain('goal_unconfirmable')
  })
})

describe('R5 TaskInspector — 상태별', () => {
  it('① 목표 없음 · 기록 없음 — 측정 전 · 목표 연결은 말하지 않음 · FQ 미설치', () => {
    const a = one('1', 'inspector-ability')[0]
    expect(a.attrs['data-progress']).toBe('not_measured goal_unconfirmable')
    expect(a.text).toContain('목표를 정하지 않아')
    expect(one('1', 'inspector-fq')[0]).toMatchObject({ attrs: { 'data-fq': 'not_installed' }, text: '정식 자격 기록이 아직 설치되지 않았어요' })
    expect(one('1', 'inspector-return-summary')).toEqual([])
  })
  it('② 목표 있음 · 자료 없음 — 필요하다고 말하되 측정 전 · 적격 0건 · 대안 행동', () => {
    const a = one('2', 'inspector-ability')[0]
    expect(a.text).toContain('지금 필요해요')
    expect(a.attrs['data-progress']).toBe('not_measured goal_unconfirmable')
    expect(buckets('2')).toEqual(['unreviewed'])
    expect(one('2', 'inspector-fq')[0].text).toBe('정식 자격 기록 설치됨 · 이 TASK 적격 자료 0건 · 자격 검증 대기')
    expect(one('2', 'inspector-fallback')[0].text).toContain('독립 근거로는 세지 않아요')
  })
  it('③ 적격 자료 있음(2020#24 전이) — qualified · 대안 숨김 · FQ 1건 · 목표 확인 불가 문구 없음', () => {
    expect(R['3'].ins.plan?.stage).toBe('transfer')
    expect(buckets('3')).toEqual(['qualified'])
    expect(one('3', 'inspector-supply-bucket')[0].text).toBe('검수된 자료 있음 · 지금 학습할 수 있어요')
    expect(one('3', 'inspector-fallback')).toEqual([])
    expect(one('3', 'inspector-fq')[0].text).toBe('정식 자격 기록 설치됨 · 이 TASK 적격 자료 1건')
    expect(one('3', 'inspector-ability')[0].attrs['data-progress']).toBe('independent_evidence')
  })
  it('④ 납품됨(유효 수량 = 요청 수량) — delivered · 대안 숨김 / ④b 유효 수량 미확인은 unreviewed · 대안 유지', () => {
    expect(buckets('4')).toEqual(['delivered'])
    expect(one('4', 'inspector-supply-bucket')[0].text).toBe('납품 완료 · 공급 완료')
    expect(one('4', 'inspector-fallback')).toEqual([])
    expect(one('4', 'inspector-fq')[0].text).toContain('적격 자료 0건')
    expect(buckets('4b')).toEqual(['unreviewed'])
    expect(one('4b', 'inspector-supply-bucket')[0].text).toBe('자격 검수 전 · 공급 기록 있음 · 수량 확인 전')
    expect(one('4b', 'inspector-fallback')).toHaveLength(1)
  })
  it('⑤ 학습 수행만(해설 먼저 봄) — practice_done 이지 independent_evidence 아님', () => {
    const p = one('5', 'inspector-ability')[0].attrs['data-progress'].split(' ')
    expect(p).toContain('practice_done')
    expect(p).not.toContain('independent_evidence')
    expect(R['5'].ins.now.observed?.independent ?? 0).toBe(0)
  })
  it('⑥ 전이 대기 — 전이 단계 · 자격 전 · 원리 경로 6단계 중 전이는 과제 링크', () => {
    expect(R['6'].ins.plan?.stage).toBe('transfer')
    expect(buckets('6')).toEqual(['unreviewed'])
    const p = one('6', 'inspector-principle-path')[0]
    expect(p.text).toContain('6. 처음 보는 지문에 적용')
    expect(R['6'].html).toMatch(/data-step="transfer"><a [^>]*data-testid="inspector-principle-link"/)
  })
  it('⑦ 복귀 — 계획 그대로면 버전과 함께 「그대로」, 바뀌었으면 「그대로」라고 하지 않는다', () => {
    const kept = one('7a', 'inspector-return-summary')
    expect(kept).toHaveLength(1)
    expect(kept[0].text).toContain('저장한 학습계획 v3 · 목표 v7 은 그대로예요')
    const changed = one('7b', 'inspector-return-summary')
    expect(changed).toHaveLength(1)
    expect(changed[0].text).not.toContain('그대로예요')
    expect(changed[0].text).toContain('기록됨: R5 확인 문항 풀이 2개')
  })
  it('⑧ 철회 · 대체 — 다른 TASK 적격은 세지 않고 무효 납품은 미검수로 돌아간다', () => {
    expect(buckets('8')).toEqual(['unreviewed'])
    expect(one('8', 'inspector-fq')[0].text).toBe('정식 자격 기록 설치됨 · 이 TASK 적격 자료 0건 · 자격 검증 대기')
    expect(one('8', 'inspector-fallback')).toHaveLength(1)
    expect(one('8', 'inspector-ability')[0].attrs['data-progress']).toContain('goal_unconfirmable')
  })
})

const out = process.env.R5_STATES_OUT
if (out) {
  it('상태 표 쓰기', () => {
    const cell = (s: string) => s.replace(/\|/g, '\\|')
    const rows = STATES.map((s) => {
      const parts = IDS.map((t) => {
        const hits = one(s.id, t)
        if (hits.length === 0) return `**${t}**: (없음)`
        return hits.map((h) => `**${t}**${h.attrs['data-bucket'] ? `[${h.attrs['data-bucket']}]` : ''}${h.attrs['data-progress'] ? `[${h.attrs['data-progress']}]` : ''}${h.attrs['data-fq'] ? `[${h.attrs['data-fq']}]` : ''}: ${h.text}`).join('<br>')
      })
      return `| ${s.id} | ${s.name} | ${R[s.id].ins.plan?.stage ?? '-'} | ${cell(parts.join('<br>'))} |`
    })
    writeFileSync(out, `${rows.join('\n')}\n`, 'utf8')
  })
}
