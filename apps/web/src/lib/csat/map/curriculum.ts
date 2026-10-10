// apps/web/src/lib/csat/map/curriculum.ts
// 학습 지도 기준 정본(2026-10-10 · 최종 목표 큰 틀) — 읽기 7단계 + 듣기 4단계마다
//   ① 학교급 권장 노출(정본 §15 — 잠금 아님) ② 확인 과제(FIND · 직접 확인 · CHECK 에 쓰는 과제 키)
//   ③ 바로잡기(REPAIR) = §13 기출 분석 Protocol 7단계 중 이 단계가 쓰는 절차 ④ 적용(TRANSFER) 방식 ⑤ 준비 상태와 그 이유.
// 순수 상수 · 함수(DB · 시계 없음). 처방은 직접 확인(skill-diagnosis) 뒤에만 연다 — 이 파일은 「무엇을 열지」 만 정한다.
// 준비 상태는 코드와 콘텐츠의 사실만 적는다. 실제 학습자 효과는 어느 단계도 확인되지 않았다(MC-12 UNKNOWN).
import type { StepKey } from './learner-path'
import { CHECK_ITEMS, EXPIRY_DAYS, VERIFY_ITEMS } from './skill-diagnosis'

/** FIND · CHECK 판정 기준(결정 D-1 · D-8 v1.1) — 단계마다 같은 값이지만 기준 정본은 여기다. 엔진(skill-diagnosis)이 같은 상수를 쓴다(테스트가 묶는다) */
export interface CheckCriteria {
  /** 직접 확인 — 맞힌 것 없이 막힌 서로 다른 확인 문항 수 */
  verifyItems: number
  /** 다시 확인 — 확정 뒤 처음 보는 확인 문항 연속 정답 수 */
  checkItems: number
  /** 확정 뒤 이 기간 안에 해소되지 않으면 다시 확인 */
  expiryDays: number
  /** 이 단계를 돌리려면 필요한 최소 확인 문항 수(직접 확인 + 다시 확인) */
  minConfirmItems: number
}
export const CRITERIA: CheckCriteria = { verifyItems: VERIFY_ITEMS, checkItems: CHECK_ITEMS, expiryDays: EXPIRY_DAYS, minConfirmItems: VERIFY_ITEMS + CHECK_ITEMS }

/** 단계의 판정 기준 — 확인 과제가 없는 단계(content_needed · blocked)는 null */
export function criteriaOf(step: StepKey): CheckCriteria | null {
  return CURRICULUM[step].taskKeys.length ? CRITERIA : null
}

/** §13 기출 분석 Task Protocol — 과제 **안** 절차(능력 노드가 아니다) */
export interface ProtocolStep {
  no: 1 | 2 | 3 | 4 | 5 | 6 | 7
  name: string
  /** 학생에게 하는 질문 하나 */
  ask: string
}

export const PROTOCOL: readonly ProtocolStep[] = [
  { no: 1, name: '문장 뜻', ask: '핵심 문장을 우리말 한 문장으로 정확히 옮겨 보세요. 누가 · 무엇을 · 어떻게가 다 들어갔나요?' },
  { no: 2, name: '문장 관계', ask: '이 문장은 앞 문장과 같은 말인가요, 반대인가요, 원인과 결과인가요? 이어 주는 말에 표시해 보세요.' },
  { no: 3, name: '글 구조', ask: '글이 어떤 순서로 흘러가나요? 문장을 「주장 · 근거 · 예시 · 반론」 같은 자리로 나눠 보세요.' },
  { no: 4, name: '핵심 압축', ask: '필자가 말하려는 것을 한 줄로 줄여 보세요.' },
  { no: 5, name: '문장 역할', ask: '나머지 문장은 그 핵심을 위해 무슨 일을 하나요?' },
  { no: 6, name: '선지 대응', ask: '정답 선지는 본문의 어떤 문장을 다른 말로 다시 말했나요? 그 문장 번호를 적어 보세요.' },
  { no: 7, name: '오답 비틀기', ask: '매력적인 오답은 그 문장에서 무엇을 바꿨나요? (범위 · 정도 · 주체 · 인과 중 하나로 이름 붙여 보세요)' },
]

export type SchoolBand = 'elementary' | 'middle' | 'high'
export const SCHOOL_BAND_LABEL: Record<SchoolBand, string> = { elementary: '초등 고학년', middle: '중등', high: '고등' }

/** 권장 노출 — core(중심) · preview(맛보기) · later(나중에). 잠금이 아니다: 경로는 진단 근거로 정한다(§15) */
export type Exposure = 'core' | 'preview' | 'later'
export const EXPOSURE_LABEL: Record<Exposure, string> = { core: '이 학교급의 중심', preview: '맛보기', later: '나중에 중심이 돼요' }

/**
 * 준비 상태(사실만):
 *   live            확인 과제가 학습자에게 열려 있고 직접 확인 → 처방이 돈다
 *   ready           코드(과제 · 채점 · 화면)는 있고 활성화(knowledge_applications) 승인만 남았다
 *   content_needed  확인 과제를 만들 콘텐츠(주석 · 문항)가 없다 — 관찰 · 진단 전 활동만
 *   blocked         정본이 의도적으로 미뤘다(§20) — 임의로 열지 않는다
 */
export type Readiness = 'live' | 'ready' | 'content_needed' | 'blocked'
export const READINESS_LABEL: Record<Readiness, string> = {
  live: '직접 확인 가능',
  ready: '확인 과제 준비됨',
  content_needed: '확인 과제 준비 중',
  blocked: '정본 보류',
}

export type TransferKind = 'practice' | 'item' | 'none'

export interface StepCurriculum {
  step: StepKey
  exposure: Record<SchoolBand, Exposure>
  /** 직접 확인 · CHECK 에 쓰는 문항 확인 과제(item-tasks 레지스트리 키) */
  taskKeys: readonly string[]
  /** 바로잡기 — 이 단계가 쓰는 §13 절차 번호(순서대로) */
  repair: readonly ProtocolStep['no'][]
  /** 다른 글에 적용 — practice(Practice 화면) · item(같은 과제가 있는 다른 기출) · none */
  transfer: TransferKind
  readiness: Readiness
  /** 준비 상태의 이유 · 다음 할 일(관리 화면 · 문서용) */
  note: string
}

export const CURRICULUM: Record<StepKey, StepCurriculum> = {
  vocab: {
    step: 'vocab', exposure: { elementary: 'core', middle: 'core', high: 'core' }, taskKeys: [], repair: [1], transfer: 'none', readiness: 'content_needed',
    note: '문맥 속 낱말 확인 과제(V 직접 확인)가 없다. 지금은 「어휘 vs 재진술」 가르기 활동(V_VS_RE)만 — 확인 문항 주석이 필요하다',
  },
  sentence: {
    step: 'sentence', exposure: { elementary: 'core', middle: 'core', high: 'preview' }, taskKeys: [], repair: [1], transfer: 'none', readiness: 'content_needed',
    note: '문장 뼈대 직접 확인 도구가 없다(S_DIRECT 는 진단 전 활동). 문장 단위 주석(주어 · 동사 위치)이 필요하다',
  },
  relation: {
    step: 'relation', exposure: { elementary: 'preview', middle: 'core', high: 'core' }, taskKeys: ['cohesion-link'], repair: [2, 1], transfer: 'item', readiness: 'ready',
    note: '「앞 문장과 이어 주는 단서」 과제 · 채점 · 화면 있음. 확인 문항 1개(2022#36) · 적용 draft — 확인 문항 2개 이상 + 노출 승인이 남았다',
  },
  structure: {
    step: 'structure', exposure: { elementary: 'later', middle: 'core', high: 'core' }, taskKeys: ['claim-support'], repair: [3, 4, 5], transfer: 'practice', readiness: 'live',
    note: '주장과 근거 — 확인 문항 9 · 직접 확인 → 처방 → 다시 확인이 돈다(합성 검증만)',
  },
  option: {
    step: 'option', exposure: { elementary: 'later', middle: 'preview', high: 'core' }, taskKeys: ['option-restate'], repair: [4, 6, 7], transfer: 'item', readiness: 'live',
    note: '「선지가 다시 말한 본문 문장」 — 합의 주석 6문항(주제 · 제목 · 요지) · 2026-10-10 사용자 승인 · 맹검 채택 2 · 적용 켬(A4-4)',
  },
  evidence: {
    step: 'evidence', exposure: { elementary: 'later', middle: 'preview', high: 'core' }, taskKeys: ['evidence-locate'], repair: [1, 6, 7], transfer: 'item', readiness: 'live',
    note: '「빈칸을 정하는 근거 문장」 — 합의 주석 5문항(빈칸) · 2026-10-10 사용자 승인 · 맹검 채택 2 · 적용 켬(A5-4)',
  },
  integrate: {
    step: 'integrate', exposure: { elementary: 'later', middle: 'later', high: 'core' }, taskKeys: [], repair: [1, 2, 3, 4, 5, 6, 7], transfer: 'none', readiness: 'blocked',
    note: 'X 실행 근거 모델 보류(§20-4) — 시간 조건 확인은 기록 관찰만',
  },
  'l-sound': { step: 'l-sound', exposure: { elementary: 'core', middle: 'core', high: 'core' }, taskKeys: [], repair: [], transfer: 'none', readiness: 'blocked', note: '듣기 세부 보류(§20-5)' },
  'l-sentence': { step: 'l-sentence', exposure: { elementary: 'core', middle: 'core', high: 'core' }, taskKeys: [], repair: [], transfer: 'none', readiness: 'blocked', note: '듣기 세부 보류(§20-5)' },
  'l-retain': { step: 'l-retain', exposure: { elementary: 'preview', middle: 'core', high: 'core' }, taskKeys: [], repair: [], transfer: 'none', readiness: 'blocked', note: '듣기 세부 보류(§20-5)' },
  'l-respond': { step: 'l-respond', exposure: { elementary: 'preview', middle: 'core', high: 'core' }, taskKeys: [], repair: [], transfer: 'none', readiness: 'blocked', note: '듣기 세부 보류(§20-5)' },
}

/** 이 단계의 바로잡기 절차(§13 순서 그대로가 아니라 이 단계가 고르는 순서) */
export function repairProtocol(step: StepKey): ProtocolStep[] {
  return CURRICULUM[step].repair.map((no) => PROTOCOL.find((p) => p.no === no)!).filter(Boolean)
}

/** 과제 키 → 그 과제를 쓰는 단계 */
export function stepOfTask(taskKey: string): StepKey | null {
  for (const c of Object.values(CURRICULUM)) if (c.taskKeys.includes(taskKey)) return c.step
  return null
}

/** 학교급 권장 노출 — 진단 근거가 있으면 그쪽이 먼저다(이 값은 표시 순서 · 문구에만 쓴다) */
export function exposureOf(step: StepKey, band: SchoolBand | null): Exposure | null {
  return band ? CURRICULUM[step].exposure[band] : null
}

export const SCHOOL_BANDS: readonly SchoolBand[] = ['elementary', 'middle', 'high']
export const isSchoolBand = (v: unknown): v is SchoolBand => typeof v === 'string' && (SCHOOL_BANDS as readonly string[]).includes(v)

/** 생애주기 4칸의 상태 — 직접 확인 결과(skill-diagnosis)에서만 계산한다. 화면 · 테스트가 같은 값을 쓴다 */
export type CycleState = 'done' | 'now' | 'open' | 'locked'
export interface CycleCell {
  stage: 'FIND' | 'REPAIR' | 'TRANSFER' | 'CHECK'
  state: CycleState
  note: string
}

export function lifecycleCells(skill: { status: 'unverified' | 'verified' | 'still_needed' | 'resolved' | 'expired'; check: { right: number; wrong: number; need: number } } | null, hasTargets: boolean): CycleCell[] {
  const s = skill?.status ?? 'unverified'
  const check = skill ? `${skill.check.right}/${skill.check.need}` : ''
  if (!hasTargets) {
    return [
      { stage: 'FIND', state: 'now', note: '확인 활동' },
      { stage: 'REPAIR', state: 'locked', note: '원인 확인 뒤' },
      { stage: 'TRANSFER', state: 'locked', note: '원인 확인 뒤' },
      { stage: 'CHECK', state: 'locked', note: '원인 확인 뒤' },
    ]
  }
  switch (s) {
    case 'verified':
      return [
        { stage: 'FIND', state: 'done', note: '직접 확인됨' },
        { stage: 'REPAIR', state: 'now', note: '지금 할 일' },
        { stage: 'TRANSFER', state: 'open', note: '열림' },
        { stage: 'CHECK', state: 'open', note: `맞힘 ${check}` },
      ]
    case 'still_needed':
      return [
        { stage: 'FIND', state: 'done', note: '직접 확인됨' },
        { stage: 'REPAIR', state: 'now', note: '한 번 더' },
        { stage: 'TRANSFER', state: 'open', note: '열림' },
        { stage: 'CHECK', state: 'now', note: `막힘 ${skill!.check.wrong}` },
      ]
    case 'resolved':
      return [
        { stage: 'FIND', state: 'done', note: '직접 확인됨' },
        { stage: 'REPAIR', state: 'done', note: '마침' },
        { stage: 'TRANSFER', state: 'done', note: '마침' },
        { stage: 'CHECK', state: 'done', note: '다시 확인 통과' },
      ]
    case 'expired':
      return [
        { stage: 'FIND', state: 'now', note: '다시 확인' },
        { stage: 'REPAIR', state: 'locked', note: '다시 확인 뒤' },
        { stage: 'TRANSFER', state: 'locked', note: '다시 확인 뒤' },
        { stage: 'CHECK', state: 'locked', note: '다시 확인 뒤' },
      ]
    default:
      return [
        { stage: 'FIND', state: 'now', note: '확인 문항 풀기' },
        { stage: 'REPAIR', state: 'locked', note: '원인 확인 뒤' },
        { stage: 'TRANSFER', state: 'locked', note: '원인 확인 뒤' },
        { stage: 'CHECK', state: 'locked', note: '원인 확인 뒤' },
      ]
  }
}

/** 다른 글에 적용(TRANSFER) 링크 — 과제 키마다. practice = Practice 화면 · item = 같은 유형의 다른 기출 목록 */
export const TRANSFER_HREF: Readonly<Record<string, string>> = {
  'claim-support': '/csat/practice/claim-support',
  'cohesion-link': '/csat/browse?type=R-ORDER',
  'option-restate': '/csat/browse?type=R-TOPIC',
  'evidence-locate': '/csat/browse?type=R-BLANK',
}
