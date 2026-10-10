// apps/web/src/components/csat/diagnosis/map/__tests__/skill-prescription.test.tsx
// 직접 확인 → 처방 개방 → 다시 확인 → 통과 — 화면(정적 렌더)
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { MapPageData } from '@/lib/csat/map/load'
import { skillDiagnosis, type SkillAttempt } from '@/lib/csat/map/skill-diagnosis'

import { DIRECT_CHECK_TEXT, NEXT_STEP_HREF, SKILL_BADGE, SkillBadge, SkillPrescription, SkillStatusLine, stepSkillProjection } from '../SkillPrescription'

const T = ['a', 'b', 'c', 'd'].map((i) => ({ itemRef: i, taskKey: 'claim-support' }))
const now = new Date('2026-10-20T00:00:00Z')
const at = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString()
const att = (item: string, ok: boolean, when: string): SkillAttempt => ({ userId: 'u', itemRef: item, taskKey: 'claim-support', phase: 'practice', isCorrect: ok, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, answeredAt: when })
const groups = [{ stage: 'REPAIR' as const, titles: ['주장 문장 표시하기'] }, { stage: 'TRANSFER' as const, titles: ['새 글에 적용'] }, { stage: 'CHECK' as const, titles: ['다시 풀기'] }]
const links = T.map((t) => ({ target: t.itemRef, href: `/csat/item/${t.itemRef}#principle`, label: `${t.itemRef}번으로 직접 확인` }))
// 후보 전체를 넘긴다 — 미노출 문항 거르기는 컴포넌트가 view model 로 한다
const render = (attempts: SkillAttempt[], when = now) => {
  const skill = skillDiagnosis(T, attempts, when)
  return renderToStaticMarkup(<><SkillStatusLine skill={skill} /><SkillPrescription skill={skill} groups={groups} transferHref="/csat/practice/claim-support" checkLinks={links} /></>)
}
const BEFORE = '원인이 확인되면 이어지는 학습'

describe('처방 개방은 직접 확인 뒤에만', () => {
  it('확인 전 — 잠금 · 링크 없음 · 상태 줄 없음', () => {
    const html = render([att('a', false, at(10))])
    expect(html).toContain('data-open="false"')
    expect(html).toContain('원인이 확인되면 이어지는 학습')
    expect(html).not.toContain('rx-transfer')
    expect(html).not.toContain('rx-check')
    expect(html).not.toContain('skill-diagnosis')
  })
  it('직접 확인 — 열림 · 다른 글에 적용 · 확정에 쓰지 않은 문항으로 다시 확인', () => {
    const html = render([att('a', false, at(10)), att('b', false, at(11))])
    expect(html).toContain('data-status="verified"')
    expect(html).toContain('data-open="true"')
    expect(html).toContain('확인된 학습 요구에 맞춘 학습')
    expect(html).toContain('href="/csat/practice/claim-support"')
    expect(html).toContain('data-item="c"')
    expect(html).toContain('data-item="d"')
    expect(html).not.toContain('data-item="a"')
  })
  it('다시 확인에서 막히면 계속 열림(still_needed) · 남은 문항만', () => {
    const html = render([att('a', false, at(10)), att('b', false, at(11)), att('c', false, at(15))])
    expect(html).toContain('data-status="still_needed"')
    expect(html).toContain('data-open="true"')
    expect(html).toContain('data-item="d"')
    expect(html).not.toContain('data-item="c"')
  })
  it('다시 확인 통과 — 처방 닫힘 · 통과 문구(능력 판정 아님)', () => {
    const html = render([att('a', false, at(10)), att('b', false, at(11)), att('c', true, at(15)), att('d', true, at(16))])
    expect(html).toContain('data-status="resolved"')
    expect(html).toContain('data-open="false"')
    expect(html).toContain('판정은 아니에요')
    expect(html).toContain('data-action="next_step"')
    expect(html).toContain('다음 단계로 넘어가도 돼요')
    expect(html).not.toContain('rx-check')
    expect(html).not.toContain('rx-transfer')
  })
})

describe('상태 · CTA 는 같은 view model 에서(T-0016)', () => {
  it('[1] unverified — 처방 링크 없음 · 직접 확인 행동', () => {
    const html = render([att('a', false, at(10))])
    expect(html).toContain('data-status="unverified"')
    expect(html).toContain('data-action="direct_check"')
    expect(html).not.toContain('href=')
  })
  it('[2] verified — REPAIR 가 첫 행동 · 확정 전 문구 없음', () => {
    const html = render([att('a', false, at(10)), att('b', false, at(11))])
    expect(html).toMatch(/data-stage="REPAIR" data-current="true"/)
    expect(html).toContain('data-action="repair"')
    expect(html).not.toContain(BEFORE)
  })
  it('[3] still_needed — 다시 확인 단계 · 남은 미노출 문항 링크만', () => {
    const html = render([att('a', false, at(10)), att('b', false, at(11)), att('c', false, at(15))])
    expect(html).toMatch(/data-stage="CHECK" data-current="true"/)
    expect(html).toContain('href="/csat/item/d#principle"')
    expect(html).not.toMatch(/href="\/csat\/item\/[abc]#principle"/)
    expect(html).not.toContain(BEFORE)
  })
  it('[2][5] verified — 주 행동 = 바로잡기(막혔던 문항 원리 해설) · 처방 링크보다 먼저', () => {
    const html = render([att('a', false, at(10)), att('b', false, at(11))])
    expect(html).toMatch(/<a href="\/csat\/item\/a#principle"[^>]*data-testid="rx-primary" data-action="repair">바로잡기 시작/)
    expect(html.indexOf('rx-primary')).toBeLessThan(html.indexOf('rx-transfer'))
    expect(html.indexOf('rx-primary')).toBeLessThan(html.indexOf('rx-check'))
  })
  it('[3][5] still_needed — 주 행동 = 남은 미노출 문항으로 다시 확인', () => {
    const html = render([att('a', false, at(10)), att('b', false, at(11)), att('c', false, at(15))])
    expect(html).toMatch(/<a href="\/csat\/item\/d#principle"[^>]*data-testid="rx-primary" data-action="recheck">바로잡은 뒤 다시 확인하기/)
  })
  it('[4][5] resolved — 주 행동 = 다음 단계 링크 · 확인 전 제목 없음', () => {
    const html = render([att('a', false, at(10)), att('b', false, at(11)), att('c', true, at(15)), att('d', true, at(16))])
    expect(html).toMatch(/<a href="\/csat\/diagnosis\?tab=records&amp;modal=new"[^>]*data-testid="rx-primary" data-action="next_step">다음 단계/)
    expect(html).toContain('이 원리는 다시 확인을 통과했어요')
    expect(html).not.toContain(BEFORE)
  })
  it('[1][4] unverified · expired — 주 행동 링크 없음(직접 확인은 FIND 칸이 맡는다)', () => {
    expect(render([att('a', false, at(10))])).not.toContain('rx-primary')
    expect(render([att('a', false, at(10)), att('b', false, at(11))], new Date('2027-03-01T00:00:00Z'))).not.toContain('rx-primary')
  })
  it('[4] expired — 이전 확정을 근거로 쓰지 않음 · 처방 잠금 · 직접 확인 재개', () => {
    const html = render([att('a', false, at(10)), att('b', false, at(11))], new Date('2027-03-01T00:00:00Z'))
    expect(html).toContain('data-status="expired"')
    expect(html).toContain('data-open="false"')
    expect(html).toContain('data-action="direct_check"')
    expect(html).not.toContain('rx-check')
    expect(html).not.toContain('rx-transfer')
    expect(html).not.toContain('확인된 학습 요구에 맞춘 학습')
  })
})

// 지도 카드 · 단계 시트 공동 투영(T-0017) — FIND 과제 f1 · 다른 단계 과제 r1 · 다른 라인 과제 x1
vi.mock('@/lib/csat/map/prescription', async (orig) => ({ ...(await orig<object>()), stageOf: (id: string) => (id.startsWith('f') || id.startsWith('x') ? 'FIND' : 'REPAIR') }))
const mapData = (findAttempts: SkillAttempt[] | undefined, when = now) => ({
  now: when.toISOString(),
  tasks: [{ id: 'f1', line_code: 'L1' }, { id: 'r1', line_code: 'L1' }, { id: 'x1', line_code: 'L9' }],
  practiceLinks: {
    f1: { taskKey: 'claim-support', confirm: T.map((t) => ({ target: t.itemRef, taskKey: t.taskKey, href: `/csat/item/${t.itemRef}#principle`, label: `${t.itemRef}번으로 직접 확인` })) },
    x1: { taskKey: 'other', confirm: [{ target: 'z', taskKey: 'other', href: '/z', label: 'z번으로 직접 확인' }] },
  },
  findAttempts,
}) as unknown as MapPageData
const step = { lines: ['L1'] }
const card = (findAttempts: SkillAttempt[] | undefined, when = now) => renderToStaticMarkup(<SkillBadge px={stepSkillProjection(mapData(findAttempts, when), step)} />)
const sheet = (findAttempts: SkillAttempt[] | undefined, when = now) => {
  const px = stepSkillProjection(mapData(findAttempts, when), step)
  return renderToStaticMarkup(<SkillPrescription skill={px.skill} groups={groups} transferHref={px.transferHref} checkLinks={px.confirmLinks} />)
}
const CASES: [string, SkillAttempt[], Date][] = [
  ['unverified', [], now],
  ['verified', [att('a', false, at(10)), att('b', false, at(11))], now],
  ['still_needed', [att('a', false, at(10)), att('b', false, at(11)), att('c', false, at(15))], now],
  ['resolved', [att('a', false, at(10)), att('b', false, at(11)), att('c', true, at(15)), att('d', true, at(16))], now],
  ['expired', [att('a', false, at(10)), att('b', false, at(11))], new Date('2027-03-01T00:00:00Z')],
]
const attr = (html: string, name: string) => html.match(new RegExp(`${name}="([^"]*)"`))?.[1]

describe('stepSkillProjection — 지도 카드와 단계 시트의 단일 출처(T-0017)', () => {
  it('[0] 이 단계 라인의 FIND 과제만 · 확인 대상 · 다시 확인 후보 · Practice 를 한 번에', () => {
    const px = stepSkillProjection(mapData([]), step)
    expect(px.lineTasks.map((t) => t.id)).toEqual(['f1', 'r1'])
    expect(px.find.map((t) => t.id)).toEqual(['f1'])
    expect(px.findTargets).toEqual(T)
    expect(px.confirmLinks.map((c) => c.target)).toEqual(['a', 'b', 'c', 'd'])
    expect(px.transferHref).toBe('/csat/practice/claim-support')
  })
  it('[3] findAttempts undefined → unavailable · 상태 · CTA 없음 / 빈 배열만 unverified', () => {
    const none = stepSkillProjection(mapData(undefined), step)
    expect(none.available).toBe(false)
    expect(none.skill).toBeNull()
    expect(none.primary).toBeNull()
    expect(card(undefined)).toBe('')
    const empty = stepSkillProjection(mapData([]), step)
    expect(empty.available).toBe(true)
    expect(empty.view?.status).toBe('unverified')
  })
  it.each(CASES)('[1][2][4] %s — 카드 배지 · 행동 · 대상이 시트 data-status · data-action · rx-primary 와 같다', (status, attempts, when) => {
    const c = card(attempts, when)
    const s = sheet(attempts, when)
    expect(attr(c, 'data-status')).toBe(status)
    expect(c).toContain(SKILL_BADGE[status as keyof typeof SKILL_BADGE])
    expect(attr(s, 'data-status')).toBe(status)
    expect(attr(c, 'data-action')).toBe(attr(s, 'data-action'))
    const primaryHref = s.match(/<a href="([^"]*)"[^>]*data-testid="rx-primary"/)?.[1]?.replace(/&amp;/g, '&') ?? ''
    expect(attr(c, 'data-target')?.replace(/&amp;/g, '&')).toBe(primaryHref)
  })
  it('[2] 상태별 연결 — 직접 확인 · 바로잡기 · 남은 미노출 CHECK · 다음 단계 · 이전 확정 미사용', () => {
    const [u, v, sn, r, e] = CASES.map(([, a, w]) => card(a, w))
    expect(attr(u, 'data-action')).toBe('direct_check')
    expect(u).toContain(DIRECT_CHECK_TEXT)
    expect(attr(u, 'data-target')).toBe('')
    expect(attr(v, 'data-action')).toBe('repair')
    expect(attr(v, 'data-target')).toBe('/csat/item/a#principle')
    expect(attr(sn, 'data-action')).toBe('recheck')
    expect(attr(sn, 'data-target')).toBe('/csat/item/d#principle')
    expect(attr(r, 'data-action')).toBe('next_step')
    expect(attr(r, 'data-target')?.replace(/&amp;/g, '&')).toBe(NEXT_STEP_HREF)
    expect(attr(e, 'data-action')).toBe('direct_check')
    expect(attr(e, 'data-target')).toBe('')
    expect(stepSkillProjection(mapData(CASES[4][1], CASES[4][2]), step).view?.locked).toBe(true)
  })
})
