// apps/web/src/components/csat/diagnosis/map/__tests__/lifecycle-records.test.tsx
// 실기록 모양 격리 E2E(2026-10-10 · MC-07 · MC-08b · MC-11) — 공유 DB 에 비합성 계정을 만들지 않고,
// G2 원장 행 모양(첫 시도 뷰 → FindAttemptRow, 전체 시도 → ActivityRow)을 시간 순서로 쌓아
// 직접 확인 → 처방 개방 → 바로잡기 → 다른 글 적용 → 미노출 재확인 → 해소 → 지도 갱신을 단계마다 화면(정적 렌더)으로 확인한다.
// 합성 계정 기록은 직접 확인에서 빠지는 것(게이트)도 같은 기록으로 확인한다. 교육 효과 근거가 아니다.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { lifecycleEvidence, type ActivityRow } from '@/lib/csat/map/lifecycle-evidence'
import { skillDiagnosis, type SkillAttempt } from '@/lib/csat/map/skill-diagnosis'

import { LifecycleStrip, SkillPrescription, SkillStatusLine } from '../SkillPrescription'

const KEY = 'evidence-locate'
const ITEMS = ['2026#31', '2026#32', '2026#33', '2026#34', '2025#32']
const targets = ITEMS.map((itemRef) => ({ itemRef, taskKey: KEY }))
const links = ITEMS.map((t) => ({ target: t, href: `/csat/item/${t.replace('#', '-')}#principle`, label: `${t}으로 직접 확인` }))
const groups = [{ stage: 'REPAIR' as const, titles: ['고른 이유 출처 확인'] }, { stage: 'TRANSFER' as const, titles: [] }, { stage: 'CHECK' as const, titles: [] }]
const now = new Date('2026-11-01T00:00:00Z')
const at = (d: number, h = 0) => new Date(Date.UTC(2026, 9, d, h)).toISOString()

/** 원장 한 줄 — 같은 시도를 두 뷰(첫 시도 · 전체)로. 첫 시도 여부는 문항 · 과제마다 가장 이른 것 */
interface Ledger { item: string; ok: boolean; at: string; phase?: string; help?: 'independent' | 'viewed_first'; synthetic?: boolean }
function views(ledger: Ledger[]) {
  const first = new Map<string, Ledger>()
  for (const r of [...ledger].sort((a, b) => a.at.localeCompare(b.at))) if (!first.has(r.item)) first.set(r.item, r)
  const findAttempts: SkillAttempt[] = [...first.values()].map((r) => ({
    userId: 'u', itemRef: r.item, taskKey: KEY, phase: (r.phase ?? 'practice') as SkillAttempt['phase'], isCorrect: r.ok,
    synthetic: r.synthetic ?? false, helpLevel: r.help ?? 'independent', afterViewedFirst: false, afterExplanation: false, answeredAt: r.at,
  }))
  const activity: ActivityRow[] = ledger.map((r) => ({ itemRef: r.item, taskKey: KEY, phase: r.phase ?? 'practice', isCorrect: r.ok, answeredAt: r.at }))
  return { findAttempts, activity }
}
function screen(ledger: Ledger[]) {
  const { findAttempts, activity } = views(ledger)
  const skill = skillDiagnosis(targets, findAttempts, now)
  const ev = lifecycleEvidence(skill, targets, activity)
  const html = renderToStaticMarkup(
    <>
      <SkillStatusLine skill={skill} />
      <LifecycleStrip skill={skill} hasTargets ev={ev} />
      <SkillPrescription skill={skill} groups={groups} transferHref="/csat/browse?type=R-BLANK" step="evidence" ev={ev}
        checkLinks={links.filter((c) => skill.check.remaining.includes(c.target))}
        repairLinks={links.filter((c) => skill.verifiedItems.includes(c.target))} />
    </>,
  )
  const cycle = [...html.matchAll(/data-stage="(\w+)" data-s="(\w+)"/g)].map((m) => `${m[1]}:${m[2]}`).join(' ')
  return { skill, ev, html, cycle }
}

describe('실기록 생애주기 — 근거 판단(evidence-locate)', () => {
  const find: Ledger[] = [{ item: '2026#31', ok: false, at: at(10) }, { item: '2026#32', ok: false, at: at(11) }]

  it('① 확인 문항 1개만 막힘 — 확인 중 · 처방 잠김', () => {
    const s = screen(find.slice(0, 1))
    expect(s.skill.status).toBe('unverified')
    expect(s.html).toContain('data-open="false"')
    expect(s.cycle).toBe('FIND:now REPAIR:locked TRANSFER:locked CHECK:locked')
  })
  it('② 서로 다른 확인 문항 2개 막힘 — 직접 확인 · 처방 열림 · 지금 할 일 = 바로잡기(막힌 문항 링크)', () => {
    const s = screen(find)
    expect(s.skill.status).toBe('verified')
    expect(s.html).toContain('data-open="true"')
    expect(s.html).toContain('data-next="repair"')
    expect(s.cycle).toBe('FIND:done REPAIR:now TRANSFER:open CHECK:open')
    expect([...s.html.matchAll(/data-testid="rx-repair" data-item="([^"]+)"/g)].map((m) => m[1])).toEqual(['2026#31', '2026#32'])
  })
  it('③ 해설을 보고 막힌 문항을 다시 처리 — 틀리면 「바로잡는 중」, 맞히면 바로잡기 마침 → 지금 할 일 = 적용', () => {
    const trying = screen([...find, { item: '2026#31', ok: false, at: at(12), help: 'viewed_first' }])
    expect(trying.html).toContain('다시 처리하는 중이에요')
    expect(trying.cycle).toContain('REPAIR:now')
    const repaired = screen([...find, { item: '2026#31', ok: false, at: at(12), help: 'viewed_first' }, { item: '2026#31', ok: true, at: at(13), help: 'viewed_first' }])
    expect(repaired.ev.repairAt).toBe(at(13))
    expect(repaired.cycle).toBe('FIND:done REPAIR:done TRANSFER:now CHECK:open')
    expect(repaired.html).toContain('data-next="transfer"')
    // 재시도는 첫 시도가 아니다 — 직접 확인 판정은 그대로(바로잡기가 진단을 바꾸지 않는다)
    expect(repaired.skill.status).toBe('verified')
  })
  const repaired: Ledger[] = [...find, { item: '2026#31', ok: true, at: at(13), help: 'viewed_first' }]
  it('④ 확인 묶음 밖 같은 유형 문항에 적용 — 적용 마침 → 지금 할 일 = 다시 확인(미노출 문항 링크)', () => {
    const s = screen([...repaired, { item: '2024#33', ok: false, at: at(14) }])
    expect(s.ev.transferAt).toBe(at(14))
    expect(s.cycle).toBe('FIND:done REPAIR:done TRANSFER:done CHECK:now')
    expect([...s.html.matchAll(/data-testid="rx-check" data-item="([^"]+)"/g)].map((m) => m[1])).toEqual(['2026#33', '2026#34'])
  })
  const applied: Ledger[] = [...repaired, { item: '2024#33', ok: false, at: at(14) }]
  it('⑤ 미노출 문항에서 다시 막힘 — 아직 연습 필요 · 바로잡기를 한 번 더(막힌 문항 다시 처리) → 그 뒤 다시 확인', () => {
    const s = screen([...applied, { item: '2026#33', ok: false, at: at(15) }])
    expect(s.skill.status).toBe('still_needed')
    expect(s.cycle).toBe('FIND:done REPAIR:now TRANSFER:done CHECK:open')
    const again = screen([...applied, { item: '2026#33', ok: false, at: at(15) }, { item: '2026#33', ok: true, at: at(15, 6), help: 'viewed_first' }])
    expect(again.cycle).toBe('FIND:done REPAIR:done TRANSFER:done CHECK:now')
  })
  it('⑥ 미노출 문항 연속 2개 정답 — 해소 · 처방 닫힘 · 지도 상태 「다시 확인 통과」', () => {
    const s = screen([...applied, { item: '2026#33', ok: false, at: at(15) }, { item: '2026#34', ok: true, at: at(16) }, { item: '2025#32', ok: true, at: at(17) }])
    expect(s.skill.status).toBe('resolved')
    expect(s.html).toContain('data-status="resolved"')
    expect(s.html).toContain('data-open="false"')
    expect(s.cycle).toBe('FIND:done REPAIR:done TRANSFER:done CHECK:done')
  })
  it('합성 계정 기록은 직접 확인에서 빠진다 — 같은 순서라도 처방이 열리지 않는다', () => {
    const s = screen(find.map((r) => ({ ...r, synthetic: true })))
    expect(s.skill.status).toBe('unverified')
    expect(s.html).toContain('data-open="false"')
  })
  it('해설을 먼저 본 첫 시도는 직접 확인 근거가 아니다', () => {
    expect(screen(find.map((r) => ({ ...r, help: 'viewed_first' as const }))).skill.status).toBe('unverified')
  })
})
