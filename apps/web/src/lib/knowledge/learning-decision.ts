// apps/web/src/lib/knowledge/learning-decision.ts
//
// 작업 2 — 원리 기반 학습 결정(2026-10-10). 학습 지도 단계마다 「확인된 학습 요구」에 따라 **다음 할 일**을 고른다.
//   입력: 그 단계의 확인 결과(find-outcome) + 그 단계에 연결된 살아 있는 원리 사슬(과제 → 방법 → 원리 · 항목 id · 버전)
//   출력: 행동 하나 + 추적 정보(관찰 근거 · 원리 id · 방법 id · 과제 id · 정책 버전 · 선택 이유)
// 결정은 순수 함수다 — 시계를 읽지 않고 DB 를 건드리지 않는다. 같은 입력이면 같은 결정(정책 버전으로 재현).
// 효과를 약속하지 않는다: 「원리 과제를 연습한다」는 처방은 채택된 원리를 쓰는 것이지 효과가 입증됐다는 뜻이 아니다.
import type { FindOutcome } from './find-outcome'

/** 정책을 바꾸면 버전을 올린다 — 기록된 결정이 어떤 규칙으로 나왔는지 다시 알 수 있게 */
export const DECISION_POLICY_VERSION = 'find-policy.v1'

export type DecisionAction =
  /** 확인 문항을 아직 안 풀었다 — 먼저 확인한다 */
  | 'start_check'
  /** 한 문항만 풀었거나 결과가 엇갈린다 — 아직 안 푼 다른 확인 문항으로 더 확인한다 */
  | 'check_more'
  /** 서로 다른 확인 문항에서 막혔다 — 그 단계의 원리 과제(방법)를 연습한다 */
  | 'practice_method'
  /** 확인 문항을 혼자 해냈다 — 이 단계 연습은 미루고 다음 단계로 */
  | 'move_on'
  /** 연결된 원리 사슬이 없다 — 원리 기반 결정을 하지 않는다(기존 지도 과제만) */
  | 'no_principle'

export interface ChainRef {
  id: string
  slug: string
  version: number
}

export interface StepChain {
  /** 실행 과제(practice) · 방법(method) · 원리(principle) — 사슬이 끊겼으면 null */
  task: ChainRef | null
  method: ChainRef | null
  principle: ChainRef | null
}

export interface ConfirmItem {
  itemRef: string
  href: string
  label: string
}

export interface DecisionInput {
  stepKey: string
  /** 지도 과제 id(B6-3 등) — 연결 적용의 키 */
  findTaskId: string
  outcome: FindOutcome | null
  chain: StepChain
  /** 그 단계의 확인 문항(출시된 것만) */
  confirm: readonly ConfirmItem[]
  /** 이미 독립 첫 시도로 푼 확인 문항 */
  triedItems: readonly string[]
  /** 원리 과제 연습 화면(방법을 익히는 곳) */
  practiceHref: string | null
}

export interface DecisionTrace {
  policyVersion: string
  stepKey: string
  findTaskId: string
  /** 관찰 근거 — 몇 문항을 확인해 몇 개가 막혔나(문항 id) */
  observation: { state: FindOutcome['state'] | 'none'; checked: number; wrong: number; right: number; items: string[] }
  principleId: string | null
  principleSlug: string | null
  methodId: string | null
  methodSlug: string | null
  taskId: string | null
  taskSlug: string | null
  /** 항목 버전 — 원리 · 방법이 개정되면 같은 행동이라도 다른 근거로 기록된다 */
  versions: { principle: number | null; method: number | null; task: number | null }
}

export interface LearningDecision {
  action: DecisionAction
  /** 학습자에게 보이는 한 문장(약점을 단정하지 않는다) */
  message: string
  /** 다음 화면(없으면 null) */
  href: string | null
  hrefLabel: string | null
  /** 사람이 읽는 선택 이유 — 관리자 · 감사용 */
  reason: string
  trace: DecisionTrace
}

export function decideStep(input: DecisionInput): LearningDecision {
  const o = input.outcome
  const c = input.chain
  const untried = input.confirm.filter((x) => !input.triedItems.includes(x.itemRef))
  const trace: DecisionTrace = {
    policyVersion: DECISION_POLICY_VERSION,
    stepKey: input.stepKey,
    findTaskId: input.findTaskId,
    // 관찰 근거 = 판정에 실제로 쓴 문항(적격 독립 첫 시도)만 — 해설 먼저 본 시도 등은 근거로 남기지 않는다(Codex P1)
    observation: { state: o?.state ?? 'none', checked: o?.checked ?? 0, wrong: o?.wrong ?? 0, right: o?.right ?? 0, items: [...(o?.items ?? [])] },
    principleId: c.principle?.id ?? null,
    principleSlug: c.principle?.slug ?? null,
    methodId: c.method?.id ?? null,
    methodSlug: c.method?.slug ?? null,
    taskId: c.task?.id ?? null,
    taskSlug: c.task?.slug ?? null,
    versions: { principle: c.principle?.version ?? null, method: c.method?.version ?? null, task: c.task?.version ?? null },
  }
  const out = (action: DecisionAction, message: string, href: string | null, hrefLabel: string | null, reason: string): LearningDecision =>
    ({ action, message, href, hrefLabel, reason, trace })

  if (!c.task || !c.principle) {
    return out('no_principle', '이 단계는 아직 원리 과제가 연결되지 않았어요. 지도 과제로 진행해요.', null, null,
      '살아 있는 원리 사슬(과제 → 방법 → 원리)이 없다 — 원리 기반 결정을 하지 않는다')
  }
  if (!o || o.state === 'untried') {
    const first = untried[0] ?? input.confirm[0] ?? null
    return out('start_check', '먼저 확인 문항 하나로 이 단계가 필요한지 확인해요.', first?.href ?? null, first?.label ?? null,
      '확인 기록 없음 — 한 번의 진단 관찰로 약점을 정하지 않고 확인 문항부터')
  }
  if (o.state === 'confirmed_need') {
    // 학습자 문구에는 관리자 항목 문장 · slug 를 넣지 않는다(연구 단서가 섞여 있다) — 추적 정보에만 남긴다
    return out('practice_method', `서로 다른 확인 문항 ${o.wrong}개에서 막혔어요. 이 단계의 원리 과제를 연습부터 해요.`,
      input.practiceHref, input.practiceHref ? '같은 원리로 연습하기' : null,
      `확인된 요구(서로 다른 ${o.wrong}문항 막힘 · 맞힌 문항 0) → 원리 ${c.principle.slug} 의 방법 ${c.method?.slug ?? '(없음)'} 과제 ${c.task.slug} 연습`)
  }
  if (o.state === 'not_needed') {
    return out('move_on', '확인 문항을 혼자 해냈어요. 이 단계 연습은 미루고 다음 단계로 가요.', null, null,
      `확인 문항 ${o.right}개 모두 독립 성공 — 이 원리 과제를 처방하지 않는다(과잉 연습 회피)`)
  }
  // in_progress · mixed — 아직 안 푼 다른 확인 문항으로 더 확인
  const next = untried[0] ?? null
  return out('check_more',
    next ? '한 번 더 다른 문항으로 확인해요.' : '확인 문항을 다 풀었어요. 결과가 엇갈려 연습과 다음 단계 중 고르면 돼요.',
    next?.href ?? input.practiceHref, next?.label ?? (input.practiceHref ? '같은 원리로 연습하기' : null),
    next ? `${o.state === 'mixed' ? '결과 엇갈림' : '한 문항만 확인'} — 아직 안 푼 확인 문항 ${next.itemRef} 로 더 확인`
      : '확인 문항 소진 · 결과 엇갈림 — 연습을 권하되 단정하지 않는다')
}
