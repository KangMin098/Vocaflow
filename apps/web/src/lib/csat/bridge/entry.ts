// apps/web/src/lib/csat/bridge/entry.ts
//
// H1 · H2 — 목표 · NeedRank · TASK 에서 실제 기출 문항으로 들어가는 연결 어댑터 + 추천 이유 계약(순수).
//   후보 선정은 기존 판정을 재사용한다: studyItemsFor(이미 푼 확인 문항 · 연구 합의 사례만, 안 푼 확인 · 전이 문항은 링크를 만들지 않는다)
//   + reservedPracticePool(독립 확인 · 전이로 남겨 둘 문항과 **같은 지문**도 보호). 원장을 못 읽으면 연구 사례를 모두 보류한다(fail-closed).
//   추천 이유는 사실만 — NeedRank 의 요구 · 근거 확정 여부 · 정본 유형 조건 · 목표 관련도(문항 수 · 배점). 점수 상승을 약속하지 않는다.

import { reservedPracticePool, type ExposureLedger } from '../map/v62/assessment-exposure'
import type { NeedRankEntry } from '../map/v62/rank'
import { studyItemsFor, type StudyItem } from '../map/v62/study-items'
import type { AsIsTask } from '../map/v4/as-is'
import type { TaskId } from '../map/v4/definition'
import { NEED_LABEL, type ConfirmLink, type Need } from '../map/v4/to-be'

import RESEARCH from '../map/v62/research-v14.data.json'

import { bridgeItemHref, type BridgeCtx } from './round-trip'
import { itemFitsTask, skillOfType, skillsOfTask, type ThinkingSkill } from './skill-map'

export interface EntryInput {
  task: TaskId
  need: NeedRankEntry | null
  /** To-Be 요구(목표 관련도) — 목표가 없으면 null */
  goalNeed: Pick<Need, 'relevance' | 'reason'> | null
  goalSet: boolean
  check: AsIsTask['check']
  confirm: readonly ConfirmLink[]
  transfer: readonly ConfirmLink[]
  ledger: ExposureLedger
  /** 문항 → 평가원 유형 코드(모르면 null) */
  typeOf: (itemRef: string) => string | null
  ctx: BridgeCtx
}

export interface EntryRationale {
  /** 왜 이 기출인가 */
  why: { need: string; confirmed: boolean; basis: StudyItem['basis'] }
  /** 어떤 판단 능력을 학습하는가 — 문항 유형으로 정한 기능(유형을 모르면 TASK 의 기능들, 그것도 없으면 빈 배열) */
  skills: ThinkingSkill[]
  fit: 'fits' | 'other' | 'unknown'
  /** 목표 달성에서의 역할 — 사실(목표 시험에서 이 TASK 가 걸린 문항 수 · 배점)만. 목표 미설정이면 goal_not_set */
  goalRole: { status: 'linked'; items: number; pointsPerExam: number } | { status: 'goal_not_set' } | { status: 'unknown' }
  /** 이 진입으로 생기는 기록의 의미 — 분석 열람은 독립 수행이 아니다 */
  recordMeaning: 'analysis_is_help_not_independent'
}

export interface Entry {
  task: TaskId
  item: string
  href: string
  purpose: 'analysis'
  rationale: EntryRationale
}

export interface EntryResult {
  entries: Entry[]
  /** 보호 때문에 지금 열지 않는 문항 수(안 푼 확인 · 전이 · 같은 지문 · 원장 미확인) */
  withheld: number
  ledger: ExposureLedger['status']
}

const norm = (id: string) => id.replace('-', '#')

const RESEARCH_TYPE: ReadonlyMap<string, string> = new Map(RESEARCH.links.map((l) => [l.item, l.type] as const))

/** 연구 v1.4 에 기록된 문항 유형(없으면 null — 화면이 유형을 추정하지 않는다) */
export const researchTypeOf = (itemRef: string): string | null => RESEARCH_TYPE.get(norm(itemRef)) ?? null

export function entriesFor(input: EntryInput): EntryResult {
  const study = studyItemsFor(input.task, input.check, input.confirm, input.transfer)
  const protectedTargets = [...new Set([...input.confirm, ...input.transfer].map((l) => norm(l.target)))]
  const research = study.items.filter((s) => s.basis === 'research_case').map((s) => s.item)
  const reserved = reservedPracticePool(protectedTargets, research, input.ledger)
  const keep = study.items.filter((s) => s.basis === 'attempted_check_item' || !reserved.has(s.item))
  const entries = keep.map((s): Entry => {
    const type = input.typeOf(s.item)
    const own = skillOfType(type)
    return {
      task: input.task,
      item: s.item,
      href: bridgeItemHref(s.item, { ...input.ctx, mapTask: input.ctx.mapTask ?? input.task }),
      purpose: 'analysis',
      rationale: {
        why: { need: input.need ? (input.need.need === 'RELEVANCE_UNKNOWN' ? '목표와의 관련 판단 보류' : NEED_LABEL[input.need.need]) : '지도 요구 없음', confirmed: input.need?.confirmed ?? false, basis: s.basis },
        skills: own ? [own] : skillsOfTask(input.task),
        fit: itemFitsTask(type, input.task),
        goalRole: !input.goalSet ? { status: 'goal_not_set' } : input.goalNeed ? { status: 'linked', items: input.goalNeed.relevance.items, pointsPerExam: input.goalNeed.relevance.pointsPerExam } : { status: 'unknown' },
        recordMeaning: 'analysis_is_help_not_independent',
      },
    }
  })
  // 「다른 유형」 문항은 TASK 기능 연습이 아니다 — 뒤로 보내되 빼지는 않는다(연구 합의 사례라 근거는 있다)
  entries.sort((a, b) => (a.rationale.fit === 'other' ? 1 : 0) - (b.rationale.fit === 'other' ? 1 : 0))
  return { entries, withheld: study.withheld + (study.items.length - keep.length), ledger: input.ledger.status }
}
