// apps/web/src/components/csat/diagnosis/map/SkillPrescription.tsx
// 단계 시트의 「직접 확인 상태 + 처방(바로잡기 · 다른 글에 적용하기 · 다시 확인하기)」 — 기능 단위 직접 확인(skill-diagnosis) 뒤에만 연다(정본 §14).
// 확인 전에는 잠근 채 「원인이 확인되면 이어지는 학습」으로 보인다. 문구는 이번 확인 기준 · 약점 단정 없음.
// 상태 줄과 처방은 같은 view model(skillView)에서 상태 · 잠금 · 다시 확인 문항을 읽는다 — 화면마다 다시 분기하지 않는다.
import { Lock, Route } from 'lucide-react'

import type { SkillDiagnosis } from '@/lib/csat/map/skill-diagnosis'
import { skillMessage, skillView } from '@/lib/csat/map/skill-diagnosis'
import { STAGE_WORD } from '@/lib/csat/map/learner-path'
import type { PrescriptionStage } from '@/lib/csat/map/prescription'

import l from './learner.module.css'

const NEXT_LINK = { minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'underline' } as const

/** 원리(과제 키) → Practice 화면 — Practice 가 있는 원리만(지금은 주장과 근거 하나) */
export const PRACTICE_HREF: Readonly<Record<string, string>> = { 'claim-support': '/csat/practice/claim-support' }

export function SkillStatusLine({ skill }: { skill: SkillDiagnosis | null }) {
  if (!skill) return null
  const view = skillView(skill)
  if (view.status === 'unverified') return null
  return (
    <p className={l.text} data-testid="skill-diagnosis" data-status={view.status} data-stage={view.stage} data-action={view.action}>
      <strong>{view.label}</strong> — {skillMessage(skill)}
    </p>
  )
}

export interface PrescriptionGroup {
  stage: PrescriptionStage
  titles: string[]
}

export function SkillPrescription({ skill, groups, transferHref, checkLinks }: {
  skill: SkillDiagnosis | null
  groups: PrescriptionGroup[]
  transferHref: string | null
  /** 다시 확인 후보(이 단계의 확인 문항 전체) — view model 의 checkItems 로 걸러 미노출 문항만 쓴다 */
  checkLinks: { target: string; href: string; label: string }[]
}) {
  const view = skill ? skillView(skill) : null
  const opened = !!view && !view.locked
  const checks = view ? checkLinks.filter((c) => view.checkItems.includes(c.target)) : []
  return (
    <section className={l.block} data-testid="step-prescription" data-open={opened} data-status={view?.status ?? 'none'} data-action={view?.action ?? 'direct_check'}>
      <h3 className={l.blockH}><Route size={14} strokeWidth={1.9} aria-hidden="true" />{opened ? '확인된 학습 요구에 맞춘 학습' : '원인이 확인되면 이어지는 학습'}</h3>
      <ol className={l.next}>
        {groups.map((g) => (
          <li key={g.stage} className={l.nextStep} data-stage={g.stage} data-current={opened && view?.stage === g.stage ? 'true' : undefined}>
            <span className={l.nextName}>
              {!opened && <Lock size={12} strokeWidth={1.9} aria-hidden="true" />}
              {STAGE_WORD[g.stage]}
            </span>
            <span className={l.nextList}>{g.titles.length ? g.titles.slice(0, 3).join(' · ') : '—'}</span>
            {/* 처방은 직접 확인 뒤에만 연다 — 다른 글에 적용 = Practice · 다시 확인 = 확정에 쓰지 않은 · 아직 풀지 않은 확인 문항 */}
            {opened && g.stage === 'TRANSFER' && transferHref && (
              <a href={transferHref} style={NEXT_LINK} data-testid="rx-transfer">다른 글에 적용하기 →</a>
            )}
            {opened && g.stage === 'CHECK' && checks.slice(0, 2).map((c) => (
              <a key={c.target} href={c.href} style={NEXT_LINK} data-testid="rx-check" data-item={c.target}>다시 확인 — {c.label.replace(/으로 직접 확인$/, '')} →</a>
            ))}
            {opened && g.stage === 'CHECK' && checks.length === 0 && <span className={l.nextList}>다시 확인할 문항이 더 준비되면 이어서 볼게요.</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
