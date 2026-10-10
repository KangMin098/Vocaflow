// apps/web/src/components/csat/diagnosis/map/__tests__/skill-prescription.test.tsx
// 직접 확인 → 처방 개방 → 다시 확인 → 통과 — 화면(정적 렌더)
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { skillDiagnosis, type SkillAttempt } from '@/lib/csat/map/skill-diagnosis'

import { LifecycleStrip, SkillPrescription, SkillStatusLine, StepReadiness } from '../SkillPrescription'

const T = ['a', 'b', 'c', 'd'].map((i) => ({ itemRef: i, taskKey: 'claim-support' }))
const now = new Date('2026-10-20T00:00:00Z')
const at = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString()
const att = (item: string, ok: boolean, when: string): SkillAttempt => ({ userId: 'u', itemRef: item, taskKey: 'claim-support', phase: 'practice', isCorrect: ok, synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, answeredAt: when })
const groups = [{ stage: 'REPAIR' as const, titles: ['주장 문장 표시하기'] }, { stage: 'TRANSFER' as const, titles: ['새 글에 적용'] }, { stage: 'CHECK' as const, titles: ['다시 풀기'] }]
const links = T.map((t) => ({ target: t.itemRef, href: `/csat/item/${t.itemRef}#principle`, label: `${t.itemRef}번으로 직접 확인` }))
const render = (attempts: SkillAttempt[]) => {
  const skill = skillDiagnosis(T, attempts, now)
  const checkLinks = links.filter((c) => skill.check.remaining.includes(c.target))
  return renderToStaticMarkup(<><SkillStatusLine skill={skill} /><SkillPrescription skill={skill} groups={groups} transferHref="/csat/practice/claim-support" checkLinks={checkLinks} /></>)
}

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
  })
})

describe('생애주기 4칸 · 바로잡기 절차 · 준비 상태(2026-10-10)', () => {
  const strip = (attempts: SkillAttempt[]) => renderToStaticMarkup(<LifecycleStrip skill={skillDiagnosis(T, attempts, now)} hasTargets />)
  it('확인 전에는 확인하기만 지금 할 일 · 나머지 잠김', () => {
    const html = strip([att('a', false, at(10))])
    expect(html).toContain('data-stage="FIND" data-s="now"')
    expect(html).toContain('data-stage="REPAIR" data-s="locked"')
  })
  it('직접 확인 뒤 바로잡기가 지금 할 일 — 처방 칸에 §13 절차(글 구조 → 핵심 압축 → 문장 역할)', () => {
    expect(strip([att('a', false, at(10)), att('b', false, at(11))])).toContain('data-stage="REPAIR" data-s="now"')
    const skill = skillDiagnosis(T, [att('a', false, at(10)), att('b', false, at(11))], now)
    const html = renderToStaticMarkup(<SkillPrescription skill={skill} groups={groups} transferHref={null} checkLinks={[]} step="structure" />)
    expect(html).toContain('rx-repair-protocol')
    expect(html.indexOf('data-no="3"')).toBeLessThan(html.indexOf('data-no="4"'))
    expect(html).toContain('data-no="5"')
  })
  it('확인 전에는 절차를 보이지 않는다', () => {
    const skill = skillDiagnosis(T, [att('a', false, at(10))], now)
    expect(renderToStaticMarkup(<SkillPrescription skill={skill} groups={groups} transferHref={null} checkLinks={[]} step="structure" />)).not.toContain('rx-repair-protocol')
  })
  it('확인 문항이 없는 단계는 준비 상태를 사실대로 — 듣기는 정본 보류', () => {
    expect(renderToStaticMarkup(<StepReadiness step="l-sound" />)).toContain('data-readiness="blocked"')
    expect(renderToStaticMarkup(<StepReadiness step="vocab" />)).toContain('data-readiness="content_needed"')
  })
})
