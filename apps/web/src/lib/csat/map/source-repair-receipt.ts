// apps/web/src/lib/csat/map/source-repair-receipt.ts
// 2D — 원문 안내 연습(source-lesson v3 · 요지 → 제목 → 주제) 수행 사실을 지도 loader 의 바로잡기 자료 · 수행으로 잇는 투영(서버 전용 · 순수).
//
// 입력은 서버 RPC source_lesson_repair_receipts(p_as_of) 의 닫힌 결과뿐이다(본인 · 같은 목표 · 원문/판본 · 납품 유효 · 실제 채점 영수증 ·
// 설명 저장을 SQL 이 확인). 클라이언트 값 · 권한 값 · 「맞았다」 주장은 받지 않는다.
//   · 이 투영은 **수행 사실**이다 — 독립 능력 · 향상 근거가 아니다. 창작(authored) 로 위장하지 않고(itemRef `dcp:` 접두사),
//     Gold · G2(learning_task_attempts · workspace_delivery_attempt)를 만들지 않는다. repairRole 은 isInstructional 로 적용 · 다시 확인에서 빠진다.
//   · 완료 조건 = 세 단계 모두 설명 저장(SQL complete). 미완료 주문의 단계는 isCorrect=null(시도 중)이라 repairSuccess 성공이 아니다.
//     완료 주문의 단계 정오 = 그 설명이 가리킨 실제 채점기 정오 그대로(설명 문장은 채점하지 않는다).
//   · 시각 의미: answeredAt = receivedAt = 그 단계 설명의 서버 수신 시각(교수 활동을 마친 시각). 원장 시각을 새로 만들거나 고치지 않는다.
//     asOf 뒤의 수신은 SQL 이 빼고, 여기서도 다시 뺀다(과거 asOf 에 미래 완료가 들어오지 않게 · 이중 방어).
//   · current=false(같은 목표의 다음 계획이 저장돼 구계획이 됨) = 이미 끝난 사실은 남기되 바로잡기 **자료 링크**(새로 열기)는 싣지 않는다.

import type { ActivityRow } from './lifecycle-evidence'

export const SOURCE_LESSON_STEPS = ['main_point', 'title', 'topic'] as const
type Step = (typeof SOURCE_LESSON_STEPS)[number]

export interface ReceiptStep { step: Step; deliveryId: string; dcpItemId: string; attemptId: string; isCorrect: boolean; attemptReceivedAt: string; reflectedAt: string }
export interface RepairReceipt { workspaceId: string; orderId: string; taskId: 'r.central_meaning'; current: boolean; complete: boolean; completedAt: string | null; steps: ReceiptStep[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isTime = (x: unknown): x is string => typeof x === 'string' && !Number.isNaN(Date.parse(x))
const ms = (x: string) => Date.parse(x)

/** RPC 결과의 닫힌 모양 검사 — 하나라도 어긋나면 전체 null(fail-closed: 성공 근거로 쓰지 않는다) */
export function parseRepairReceipts(raw: unknown): RepairReceipt[] | null {
  if (!Array.isArray(raw)) return null
  const out: RepairReceipt[] = []
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object' || !UUID.test(String(r.workspace_id)) || !UUID.test(String(r.order_id)) || r.task_id !== 'r.central_meaning') return null
    if (typeof r.current !== 'boolean' || typeof r.complete !== 'boolean' || !Array.isArray(r.steps)) return null
    const steps: ReceiptStep[] = []
    for (const s of r.steps as Record<string, unknown>[]) {
      if (!s || !SOURCE_LESSON_STEPS.includes(s.step as Step) || !UUID.test(String(s.delivery_id)) || !UUID.test(String(s.dcp_item_id)) || !UUID.test(String(s.attempt_id))) return null
      if (typeof s.is_correct !== 'boolean' || !isTime(s.attempt_received_at) || !isTime(s.reflected_at) || ms(s.attempt_received_at) > ms(s.reflected_at)) return null
      // 시각은 ISO(Z)로 정규화 — 원장 값의 의미는 그대로(같은 순간). lifecycle 의 일부 판정이 문자열 비교라 오프셋 표기(+09:00)가 섞이면 순서가 틀어진다
      steps.push({ step: s.step as Step, deliveryId: String(s.delivery_id), dcpItemId: String(s.dcp_item_id), attemptId: String(s.attempt_id), isCorrect: s.is_correct, attemptReceivedAt: new Date(s.attempt_received_at).toISOString(), reflectedAt: new Date(s.reflected_at).toISOString() })
    }
    if (new Set(steps.map((s) => s.step)).size !== steps.length) return null
    const complete = SOURCE_LESSON_STEPS.every((k) => steps.some((s) => s.step === k))
    if (complete !== r.complete) return null
    const completedAt = complete ? steps.map((s) => s.reflectedAt).sort((a, b) => ms(a) - ms(b))[steps.length - 1] : null
    if (complete && (!isTime(r.completed_at) || ms(r.completed_at) !== ms(completedAt!))) return null
    out.push({ workspaceId: String(r.workspace_id), orderId: String(r.order_id), taskId: 'r.central_meaning', current: r.current, complete, completedAt, steps })
  }
  return out
}

/** RPC 가 아직 설치되지 않음(공유 DB 미적용) — 정상적인 「영수증 기능 없음」. 그 밖의 오류와 구분한다 */
const NOT_INSTALLED = new Set(['42883', 'PGRST202'])

/**
 * 2E — source_lesson_repair_receipts(p_user, p_as_of). 본인 세션(auth.uid = p_user) 또는 진짜 service_role(서버가 인증한 userId)만 SQL 이 허용한다.
 * 미설치 = 빈 목록(기능 없음). 권한 거절(42501) · 그 밖의 DB 오류 · 모양 불일치 = **던진다** — 끝낸 바로잡기가 조용히 사라진 「정상 빈 결과」가 되지 않게.
 */
export async function loadSourceRepairReceipts(db: { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> }, userId: string, now: Date): Promise<RepairReceipt[]> {
  if (!UUID.test(userId)) throw new Error('source_repair_receipts: bad_user')
  const { data, error } = await db.rpc('source_lesson_repair_receipts', { p_user: userId, p_as_of: now.toISOString() })
  if (error) {
    if (NOT_INSTALLED.has(error.code ?? '')) return []
    throw new Error(`source_repair_receipts: ${error.code ?? 'error'} ${error.message}`)
  }
  const parsed = parseRepairReceipts(data)
  if (!parsed) throw new Error('source_repair_receipts: bad_shape')
  return parsed
}

/**
 * 지도 loader 의 lifecycleActivity 에 더할 행. taskKey 는 그 TASK 의 창작/교수 증거 키(authoredKeysOf) — 키가 없으면 행 없음.
 * asOf 뒤 수신은 뺀다. 완료가 asOf 뒤면(일부 단계만 asOf 앞) 그 주문은 미완료로 본다.
 */
export function receiptActivity(receipts: readonly RepairReceipt[], keysOf: (task: string) => string[], asOf: Date): ActivityRow[] {
  const cut = asOf.getTime()
  return receipts.flatMap((r) => {
    const key = keysOf(r.taskId)[0]
    if (!key) return []
    const seen = r.steps.filter((s) => ms(s.reflectedAt) <= cut && ms(s.attemptReceivedAt) <= cut)
    const complete = SOURCE_LESSON_STEPS.every((k) => seen.some((s) => s.step === k))
    if (!seen.length) return []
    // 2E — 활동 단위 판정: 정오는 **마지막 단계 행(전체 완료 시각)에만** 싣는다(세 단계 모두 맞았을 때 true). 앞 단계 행은 늘 null —
    // 그래서 이 행들을 더 이른 asOf 로 다시 읽어도(composeV4 의 과거 회차 재생) 완료 전 시각에 성공이 생기지 않는다. 시각은 원장 그대로.
    const last = seen.reduce((a, b) => (ms(b.reflectedAt) > ms(a.reflectedAt) ? b : a))
    const startedAt = seen.map((s) => s.attemptReceivedAt).sort((a, b) => ms(a) - ms(b))[0]
    // 기존 의미 유지 — 완료된 활동에서 채점기 정답이 하나라도 있으면 정답(이전에는 그 단계 시각에 성공했고, 지금은 완료 시각에 성공한다)
    const anyRight = seen.some((s) => s.isCorrect)
    return seen.map((s): ActivityRow => ({
      attemptId: `factory_dcp:${s.attemptId}`, sessionId: null, itemRef: `dcp:${s.dcpItemId}`, taskKey: key, phase: 'practice',
      isCorrect: complete && s === last ? anyRight : null, answeredAt: s.reflectedAt, receivedAt: s.reflectedAt,
      activity: 'source_lesson', helpLevel: 'guided', synthetic: false, repairRole: 'guided_practice', lessonStartedAt: startedAt,
    }))
  })
}

/** 바로잡기 자료 링크 — 지금 열 수 있는(current) 주문만. 구계획 주문은 사실만 남고 새로 열지 않는다 */
export function receiptTargets(receipts: readonly RepairReceipt[], keysOf: (task: string) => string[]): Record<string, { target: string; href: string; label: string; role: 'guided_practice' }[]> {
  const out: Record<string, { target: string; href: string; label: string; role: 'guided_practice' }[]> = {}
  for (const r of receipts) {
    if (!r.current) continue
    const first = r.steps[0]
    if (!first) continue
    for (const key of keysOf(r.taskId)) (out[key] ??= []).push({ target: `dcp:${first.dcpItemId}`, href: `/csat/factory/${first.deliveryId}`, label: '바로잡기 · 원문 안내 연습', role: 'guided_practice' })
  }
  return out
}
