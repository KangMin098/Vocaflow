// apps/web/src/lib/learner/today-status.ts
//
// 상태 띠(StatusRibbon)의 **순수 계산부** — ADR 0006 D2.
//
// ⚠️ 이 파일에 `server-only` 를 넣지 말 것. 클라이언트 컴포넌트가 이 계산을 import 하는 순간
//    모듈 그래프가 깨져 **앱의 모든 라우트가 500** 이 된다(v08.x 에서 실제로 발생 — CHANGELOG
//    "모듈 허브 3개 목업 제거" 참조). 서버 조회는 `today-status-query.ts` 가 따로 맡는다.
//
// 무엇을 계산하는가:
//   셸 최상단이 답해야 하는 질문은 셋뿐이다 — 오늘 끝나려면 얼마나 남았나 / 지금 조치할 것이
//   있나 / 며칠째인가. 이 파일은 그 셋을 만들고, **셋이 전부 0인지**를 함께 판정한다.
//
// "오늘 N/M" 의 정의 (근거 있는 값만 쓴다):
//   M = prescribe_today 가 오늘 낸 블록 중 **실행 가능한 것**의 수
//   N = 그중 오늘 `daily_activity.by_module` 에 **활동 기록이 실재하는** 블록의 수
//   → 둘 다 실데이터다. "완료 처리" 같은 별도 상태를 만들지 않는다(두 시스템은 반드시 어긋난다).

/** 처방 블록 — 학습자에게 보이는 오늘의 갈래. */
export type TodayBlockId = 'review' | 'read' | 'listen' | 'practice'

export interface TodayBlock {
  id: TodayBlockId
  /** 학습자에게 보이는 한국어 이름 */
  label: string
  /** 오늘 이 갈래에 활동 기록이 있는가 */
  done: boolean
}

export interface TodayStatus {
  blocks: TodayBlock[]
  /** 오늘 활동 기록이 있는 블록 수 */
  done: number
  /** 오늘 실행 가능한 블록 수 */
  total: number
  /** 지금 조치할 것 — risk + shaky. `stable`·`new` 는 조치 불가라 띠에 넣지 않는다 */
  attention: number
  streak: number
  /**
   * 세 지표가 전부 0인가.
   *
   * true 면 띠는 **숫자를 하나도 그리지 않고** 문장 하나로 바뀐다 — ADR 0006 D2 의 핵심 규칙.
   * 0을 나열하는 것은 "당신은 아무것도 하지 않았다" 를 반복하는 것과 같다(철학 ③).
   */
  isEmpty: boolean
}

export const BLOCK_LABEL: Record<TodayBlockId, string> = {
  review: '복습',
  read: '읽기',
  listen: '듣기',
  practice: '연습',
}

/**
 * 블록 → 그 블록의 활동으로 인정하는 `by_module` 키.
 *
 * 값은 실측 모듈 id 다(`learning_records.module` · `daily_activity.by_module` 2026-08-14).
 * `practice` 는 목록을 갖지 않는다 — 아케이드 19종이 계속 늘기 때문에, **다른 셋에 속하지
 * 않는 모든 모듈**을 연습으로 본다. 목록을 들면 게임이 추가될 때마다 여기가 낡는다.
 */
export const BLOCK_MODULES: Record<Exclude<TodayBlockId, 'practice'>, readonly string[]> = {
  review: ['flashcard', 'wordvault', 'pairflip', 'spellforge', 'wordblitz'],
  read: ['textviewer', 'scriptquiz'],
  listen: ['echo', 'dictation'],
}

const NON_PRACTICE = new Set<string>([
  ...BLOCK_MODULES.review,
  ...BLOCK_MODULES.read,
  ...BLOCK_MODULES.listen,
])

/** 오늘 `by_module` 에 이 블록의 활동이 있는가. */
export function blockHasActivity(
  id: TodayBlockId,
  byModule: Readonly<Record<string, number>>,
): boolean {
  const keys = Object.keys(byModule).filter((k) => (byModule[k] ?? 0) > 0)
  if (id === 'practice') return keys.some((k) => !NON_PRACTICE.has(k))
  return keys.some((k) => BLOCK_MODULES[id].includes(k))
}

export interface TodayStatusInput {
  /** 오늘 실행 가능한 블록 — 처방이 낸 것만 */
  available: readonly TodayBlockId[]
  /** 오늘 모듈별 활동 수 (`daily_activity.by_module`) */
  byModule: Readonly<Record<string, number>>
  /** R(t) 기반 기억 분포 — risk + shaky 만 쓴다 */
  memory: { risk: number; shaky: number }
  streak: number
}

const ORDER: TodayBlockId[] = ['review', 'read', 'listen', 'practice']

export function computeTodayStatus(input: TodayStatusInput): TodayStatus {
  const availableSet = new Set(input.available)
  const blocks: TodayBlock[] = ORDER.filter((id) => availableSet.has(id)).map((id) => ({
    id,
    label: BLOCK_LABEL[id],
    done: blockHasActivity(id, input.byModule),
  }))

  const done = blocks.filter((b) => b.done).length
  const total = blocks.length
  const attention = Math.max(0, input.memory.risk) + Math.max(0, input.memory.shaky)
  const streak = Math.max(0, input.streak)

  return {
    blocks,
    done,
    total,
    attention,
    streak,
    isEmpty: total === 0 && attention === 0 && streak === 0,
  }
}
