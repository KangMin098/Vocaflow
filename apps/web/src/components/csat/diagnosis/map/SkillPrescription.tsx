// apps/web/src/components/csat/diagnosis/map/SkillPrescription.tsx
// 단계 시트의 「직접 확인 상태 + 처방(바로잡기 · 다른 글에 적용하기 · 다시 확인하기)」 — 기능 단위 직접 확인(skill-diagnosis) 뒤에만 연다(정본 §14).
// 확인 전에는 잠근 채 「원인이 확인되면 이어지는 학습」으로 보인다. 문구는 이번 확인 기준 · 약점 단정 없음.
import { Lock, Route } from 'lucide-react'

import { CURRICULUM, READINESS_LABEL, TRANSFER_HREF, lifecycleCells, repairProtocol } from '@/lib/csat/map/curriculum'
import type { SkillDiagnosis, SkillStatus } from '@/lib/csat/map/skill-diagnosis'
import { skillMessage } from '@/lib/csat/map/skill-diagnosis'
import { STAGE_WORD, type StepKey } from '@/lib/csat/map/learner-path'
import type { PrescriptionStage } from '@/lib/csat/map/prescription'

import l from './learner.module.css'

const NEXT_LINK = { minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'underline' } as const

/** 원리(과제 키) → 다른 글에 적용하기 화면 — 정본은 curriculum.ts TRANSFER_HREF(Practice 또는 같은 유형 다른 기출) */
export const PRACTICE_HREF: Readonly<Record<string, string>> = TRANSFER_HREF

export const SKILL_LABEL: Record<SkillStatus, string> = {
  unverified: '',
  verified: '직접 확인됨 · 이 원리 연습 필요',
  still_needed: '다시 확인 · 아직 연습 필요',
  resolved: '다시 확인 통과',
  expired: '다시 확인 필요(기한 지남)',
}

export function SkillStatusLine({ skill }: { skill: SkillDiagnosis | null }) {
  if (!skill || skill.status === 'unverified') return null
  return (
    <p className={l.text} data-testid="skill-diagnosis" data-status={skill.status}>
      <strong>{SKILL_LABEL[skill.status]}</strong> — {skillMessage(skill)}
    </p>
  )
}

export interface PrescriptionGroup {
  stage: PrescriptionStage
  titles: string[]
}

/** 생애주기 4칸 — 확인하기 → 바로잡기 → 다른 글에 적용하기 → 다시 확인하기의 지금 상태(직접 확인 결과에서만) */
export function LifecycleStrip({ skill, hasTargets }: { skill: SkillDiagnosis | null; hasTargets: boolean }) {
  return (
    <ol className={l.cycle} data-testid="step-lifecycle" aria-label="학습 순서와 지금 상태">
      {lifecycleCells(skill, hasTargets).map((c) => (
        <li key={c.stage} className={l.cycleCell} data-stage={c.stage} data-s={c.state}>
          <strong>{STAGE_WORD[c.stage]}</strong>
          <span>{c.state === 'locked' ? '잠김 · ' : ''}{c.note}</span>
        </li>
      ))}
    </ol>
  )
}

/** 확인 문항이 아직 없는 단계 — 준비 상태를 사실대로(정본 보류 · 준비 중) */
export function StepReadiness({ step }: { step: StepKey }) {
  const c = CURRICULUM[step]
  const text =
    c.readiness === 'blocked'
      ? '이 단계는 아직 직접 확인을 열지 않아요. 지금은 기출 기록으로 보이는 모습만 알려 드려요.'
      : c.readiness === 'content_needed'
        ? '이 단계의 직접 확인 문항을 준비하고 있어요. 그 전에는 아래 확인 활동으로 어디서 막혔는지 먼저 살펴봐요.'
        : '이 단계의 직접 확인 문항이 곧 열려요. 그 전에는 아래 확인 활동을 먼저 해 봐요.'
  return <p className={l.ready} data-testid="step-readiness" data-readiness={c.readiness}><strong>{READINESS_LABEL[c.readiness]}</strong> — {text}</p>
}

export function SkillPrescription({ skill, groups, transferHref, checkLinks, step }: {
  step?: StepKey
  skill: SkillDiagnosis | null
  groups: PrescriptionGroup[]
  transferHref: string | null
  checkLinks: { target: string; href: string; label: string }[]
}) {
  const opened = !!skill?.verified
  return (
    <section className={l.block} data-testid="step-prescription" data-open={opened}>
      <h3 className={l.blockH}><Route size={14} strokeWidth={1.9} aria-hidden="true" />{opened ? '확인된 학습 요구에 맞춘 학습' : '원인이 확인되면 이어지는 학습'}</h3>
      <ol className={l.next}>
        {groups.map((g) => (
          <li key={g.stage} className={l.nextStep} data-stage={g.stage}>
            <span className={l.nextName}>
              {!opened && <Lock size={12} strokeWidth={1.9} aria-hidden="true" />}
              {STAGE_WORD[g.stage]}
            </span>
            <span className={l.nextList}>{g.titles.length ? g.titles.slice(0, 3).join(' · ') : '—'}</span>
            {/* 바로잡기 = 정본 §13 기출 분석 Protocol 중 이 단계의 절차 — 확인된 문항을 다시 처리하는 질문(과제 안 절차) */}
            {opened && g.stage === 'REPAIR' && step && repairProtocol(step).length > 0 && (
              <ol className={l.proto} data-testid="rx-repair-protocol">
                {repairProtocol(step).map((p) => (
                  <li key={p.no} className={l.protoItem} data-no={p.no}>{p.name} <span>— {p.ask}</span></li>
                ))}
              </ol>
            )}
            {/* 처방은 직접 확인 뒤에만 연다 — 다른 글에 적용 = Practice · 다시 확인 = 확정에 쓰지 않은 · 아직 풀지 않은 확인 문항 */}
            {opened && g.stage === 'TRANSFER' && transferHref && (
              <a href={transferHref} style={NEXT_LINK} data-testid="rx-transfer">다른 글에 적용하기 →</a>
            )}
            {opened && g.stage === 'CHECK' && checkLinks.slice(0, 2).map((c) => (
              <a key={c.target} href={c.href} style={NEXT_LINK} data-testid="rx-check" data-item={c.target}>다시 확인 — {c.label.replace(/으로 직접 확인$/, '')} →</a>
            ))}
            {opened && g.stage === 'CHECK' && checkLinks.length === 0 && <span className={l.nextList}>다시 확인할 문항이 더 준비되면 이어서 볼게요.</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
