// apps/web/src/components/csat/diagnosis/map/SkillPrescription.tsx
// 단계 시트의 「직접 확인 상태 + 처방(바로잡기 · 다른 글에 적용하기 · 다시 확인하기)」 — 기능 단위 직접 확인(skill-diagnosis) 뒤에만 연다(정본 §14).
// 확인 전에는 잠근 채 「원인이 확인되면 이어지는 학습」으로 보인다. 문구는 이번 확인 기준 · 약점 단정 없음.
// 상태 줄과 처방은 같은 view model(skillView)에서 상태 · 잠금 · 다시 확인 문항을 읽는다 — 화면마다 다시 분기하지 않는다.
import { Lock, Route } from 'lucide-react'

import type { SkillDiagnosis, SkillTarget, SkillView } from '@/lib/csat/map/skill-diagnosis'
import { SKILL_LABEL, skillDiagnosis, skillMessage, skillView } from '@/lib/csat/map/skill-diagnosis'
import { STAGE_WORD, type StepView } from '@/lib/csat/map/learner-path'
import type { MapPageData } from '@/lib/csat/map/load'
import { stageOf, type PrescriptionStage } from '@/lib/csat/map/prescription'

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

/** 통과 뒤 다음 단계 — 새 기출을 풀고 기록해 목표 대비 변화를 본다(학습 순환의 다음 칸) */
export const NEXT_STEP_HREF = '/csat/diagnosis?tab=records&modal=new'

const HEADING: Record<SkillView['action'], string> = {
  direct_check: '원인이 확인되면 이어지는 학습',
  repair: '확인된 학습 요구에 맞춘 학습',
  recheck: '확인된 학습 요구에 맞춘 학습',
  next_step: '이 원리는 다시 확인을 통과했어요',
}

const itemWord = (label: string) => label.replace(/으로 직접 확인$/, '')

export interface CheckLink { target: string; href: string; label: string }

/** 지금 할 행동(주 행동) — view.action 하나로 고른다. 바로잡기 = 막혔던(확정에 쓴) 문항의 원리 해설 다시 읽기.
 *  직접 확인(unverified · expired)은 링크가 아니라 FIND 칸이 맡으므로 null — 지도 카드와 단계 시트가 같은 값을 쓴다 */
export function skillPrimary(skill: SkillDiagnosis | null, checkLinks: readonly CheckLink[]): { action: SkillView['action']; href: string; text: string } | null {
  if (!skill) return null
  const view = skillView(skill)
  const checks = checkLinks.filter((c) => view.checkItems.includes(c.target))
  const repair = view.action === 'repair' ? checkLinks.find((c) => skill.verifiedItems.includes(c.target)) : undefined
  return view.action === 'repair' && repair ? { action: view.action, href: repair.href, text: `바로잡기 시작 — ${itemWord(repair.label)} 원리 다시 읽기 →` }
    : view.action === 'recheck' && checks[0] ? { action: view.action, href: checks[0].href, text: `바로잡은 뒤 다시 확인하기 — ${itemWord(checks[0].label)} →` }
      : view.action === 'next_step' ? { action: view.action, href: NEXT_STEP_HREF, text: '다음 단계 — 새 기출을 풀고 기록해 목표 대비 변화 보기 →' }
        : null
}

/** 지도 카드 배지 — 다섯 상태 모두(unverified 는 상태 줄이 비어 있으므로 배지 말만 따로) */
export const SKILL_BADGE: Record<SkillView['status'], string> = { ...SKILL_LABEL, unverified: '직접 확인 전' }

/** 직접 확인 행동 문구 — 이전 확정을 쓰지 않는다(expired 도 처음부터) */
export const DIRECT_CHECK_TEXT = '직접 확인 시작'

export interface StepSkillProjection {
  /** 확인 기록을 못 읽었으면(undefined) unavailable — 상태 · 처방 CTA 를 보이지 않는다 */
  available: boolean
  lineTasks: MapPageData['tasks']
  find: MapPageData['tasks']
  findTargets: SkillTarget[]
  confirmLinks: CheckLink[]
  skill: SkillDiagnosis | null
  view: SkillView | null
  primary: ReturnType<typeof skillPrimary>
  transferHref: string | null
}

/** 주 행동을 실행할 문항이 없을 때(예: still_needed 인데 미노출 CHECK 소진) — 카드와 시트가 같은 안내를 쓴다 */
export const CHECK_PENDING_TEXT = '다시 확인할 문항이 더 준비되면 이어서 볼게요.'

/** 지도 카드에 쓰는 단일 다음 행동 문구 — 직접 확인은 view.action=direct_check 일 때만. 그 밖에 주 행동이 없으면 문항 준비 안내 */
export function skillActionText(px: Pick<StepSkillProjection, 'view' | 'primary'>): string {
  if (px.primary) return px.primary.text.replace(/ →$/, '')
  return px.view?.action === 'direct_check' ? DIRECT_CHECK_TEXT : CHECK_PENDING_TEXT
}

/** 지도 카드(읽기 StepNode · FocusStep) 배지 — 상태 + 단일 다음 행동. 판정이 없으면(unavailable 포함) 아무것도 보이지 않는다 */
export function SkillBadge({ px }: { px: Pick<StepSkillProjection, 'view' | 'primary'> }) {
  if (!px.view) return null
  return (
    <span className={l.stepBadge} data-testid="step-skill" data-status={px.view.status} data-action={px.view.action} data-target={px.primary?.href ?? ''}>
      {SKILL_BADGE[px.view.status]} · {skillActionText(px)}
    </span>
  )
}

/** 단계 하나의 직접 확인 투영(순수) — 단계 과제 · FIND 제한 · 확인 대상 · 시도 판정의 단일 출처. 지도 카드와 단계 시트가 같이 쓴다 */
export function stepSkillProjection(data: MapPageData, step: Pick<StepView, 'lines'>): StepSkillProjection {
  const lineTasks = data.tasks.filter((t) => step.lines.includes(t.line_code))
  const find = lineTasks.filter((t) => stageOf(t.id) === 'FIND')
  // 확인 문항 결과 → 확인된 학습 요구(서로 다른 확인 문항 2개 이상 · 독립 첫 시도). 연결된 확인 문항이 있을 때만
  const findTargets = find.map((t) => data.practiceLinks?.[t.id]).filter((x): x is NonNullable<typeof x> => !!x).flatMap((x) => (x.confirm ?? [x]).map((c) => ({ itemRef: c.target, taskKey: c.taskKey })))
  const available = data.findAttempts !== undefined
  // 기능 단위 직접 확인 — 확인 기록을 못 읽었거나 서버 시각이 없으면 판정하지 않는다(「아직 확인 안 함」으로 잘못 보이지 않게)
  const skill = findTargets.length && data.findAttempts && data.now ? skillDiagnosis(findTargets, data.findAttempts, new Date(data.now)) : null
  const confirmLinks = find.flatMap((t) => data.practiceLinks?.[t.id]?.confirm ?? [])
  // 다른 글에 적용(Practice) — 이 단계 확인 문항의 원리에 Practice 가 있을 때만
  const stepKeys = [...new Set(findTargets.map((t) => t.taskKey))]
  const transferHref = stepKeys.length === 1 ? PRACTICE_HREF[stepKeys[0]] ?? null : null
  return { available, lineTasks, find, findTargets, confirmLinks, skill, view: skill ? skillView(skill) : null, primary: skillPrimary(skill, confirmLinks), transferHref }
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
  const primary = skillPrimary(skill, checkLinks)
  return (
    <section className={l.block} data-testid="step-prescription" data-open={opened} data-status={view?.status ?? 'none'} data-action={view?.action ?? 'direct_check'}>
      <h3 className={l.blockH}><Route size={14} strokeWidth={1.9} aria-hidden="true" />{HEADING[view?.action ?? 'direct_check']}</h3>
      {primary && <a href={primary.href} style={NEXT_LINK} data-testid="rx-primary" data-action={view?.action}>{primary.text}</a>}
      {/* 주 행동이 있어야 할 상태인데 실행할 문항이 없으면 — 카드와 같은 안내(직접 확인으로 잘못 보내지 않는다) */}
      {opened && !primary && <p className={l.text} data-testid="rx-pending" data-action={view?.action}>{CHECK_PENDING_TEXT}</p>}
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
              <a key={c.target} href={c.href} style={NEXT_LINK} data-testid="rx-check" data-item={c.target}>다시 확인 — {itemWord(c.label)} →</a>
            ))}
            {opened && g.stage === 'CHECK' && checks.length === 0 && <span className={l.nextList}>{CHECK_PENDING_TEXT}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
