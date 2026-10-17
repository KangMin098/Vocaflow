// apps/web/src/lib/csat/map/v62/assessment-exposure.ts
//
// R5 연습 ↔ 독립 평가 경계(순수 · 쓰기 없음). PR #281 감사 E01 · E03 · E04 대응.
//   · 노출 = 그 학습자가 그 문항(또는 같은 정규화 지문)을 **어떤 경로로든** 본 기록 — 과제 키 · 활동 · phase 와 무관.
//     원장: G2 시도 · G2 세션(삭제된 세션 포함) · 함정 훈련 · 문제지 풀이 · 복습 큐 · 진단 응답.
//   · 원장 하나라도 못 읽었거나 지문 식별이 없으면 「미노출」이 아니라 unknown — 독립 평가로 공급하지 않는다(fail-closed).
//   · 독립 확인 · 전이로 예약된 문항은, 그 학습자가 아직 보지 않은 동안 연습 순환에서 뺀다(연습이 평가 자료를 소모하지 않게).
//   · 정식 자격(FQ) reader 가 설치돼 있지 않으면 not_installed 를 그대로 — 기존 공개 경로로 열 수 있음 ≠ 자격 검증.

export type ExposureSource = 'g2_attempt' | 'g2_session' | 'trap' | 'paper' | 'review_queue' | 'dx_response'

export const EXPOSURE_SOURCES: readonly ExposureSource[] = ['g2_attempt', 'g2_session', 'trap', 'paper', 'review_queue', 'dx_response']

export interface ExposureEvent {
  itemRef: string
  source: ExposureSource
  /** G2 원장만 — 다른 원장은 null */
  taskKey: string | null
  activity: string | null
  phase: string | null
  helpLevel: string | null
  sessionId: string | null
  contentHash: string | null
  /** 세션 삭제 뒤에도 노출은 남는다 — 지우면 다시 안 본 것으로 보이기 때문 */
  deleted: boolean
}

export type ExposureLedger =
  | { status: 'ok'; events: ExposureEvent[]; passageKeys: Record<string, string> }
  | { status: 'error'; failed: ExposureSource[] }

export type ExposureVerdict =
  | { state: 'unseen' }
  | { state: 'exposed'; via: ExposureSource[]; sameItem: boolean; samePassage: boolean }
  | { state: 'unknown'; reason: 'ledger_error' | 'passage_unknown' }

/** 그 학습자에게 이 문항이 독립 평가로 「처음」인가 — 같은 문항 · 같은 지문(공유 지문 포함)의 모든 노출을 본다 */
export function exposureOf(itemRef: string, ledger: ExposureLedger): ExposureVerdict {
  if (ledger.status !== 'ok') return { state: 'unknown', reason: 'ledger_error' }
  const passage = ledger.passageKeys[itemRef]
  if (!passage) return { state: 'unknown', reason: 'passage_unknown' }
  const via = new Set<ExposureSource>()
  let sameItem = false
  let samePassage = false
  for (const e of ledger.events) {
    if (e.itemRef === itemRef) { sameItem = true; via.add(e.source); continue }
    const p = ledger.passageKeys[e.itemRef]
    if (p && p === passage) { samePassage = true; via.add(e.source) }
  }
  if (!sameItem && !samePassage) return { state: 'unseen' }
  return { state: 'exposed', via: [...via].sort(), sameItem, samePassage }
}

/** 독립 평가에 쓸 수 있는 후보만 — unknown 은 빼고(unseen 으로 승격하지 않는다) 순서는 보존 */
export function unexposedForAssessment(items: readonly string[], ledger: ExposureLedger): { unseen: string[]; exposed: string[]; unknown: string[] } {
  const out = { unseen: [] as string[], exposed: [] as string[], unknown: [] as string[] }
  for (const i of items) {
    const v = exposureOf(i, ledger)
    out[v.state === 'unseen' ? 'unseen' : v.state === 'exposed' ? 'exposed' : 'unknown'].push(i)
  }
  return out
}

/**
 * 연습 순환에서 뺄 문항 — 독립 확인 · 전이로 예약된 문항 중 이 학습자에게 아직 노출이 없는(또는 모르는) 것.
 * 이미 어떤 경로로든 본 문항은 평가 자격을 이미 잃었으므로 연습으로 열어도 평가 재고를 소모하지 않는다.
 */
export function reservedFromPractice(reserved: readonly string[], ledger: ExposureLedger): Set<string> {
  const out = new Set<string>()
  for (const i of reserved) if (exposureOf(i, ledger).state !== 'exposed') out.add(i)
  return out
}

/**
 * 화면으로 보낼 최소 원장 — 후보 문항과 같은 문항 · 같은 지문인 노출만, 출처만 남긴다(다른 기록 · 해시 · 세션 id 는 화면에 안 보낸다).
 * exposureOf 결과는 원본 원장과 같다.
 */
export function compactLedger(ledger: ExposureLedger, candidates: readonly string[]): ExposureLedger {
  if (ledger.status !== 'ok') return ledger
  const items = new Set(candidates)
  const passages = new Set(candidates.map((c) => ledger.passageKeys[c]).filter((p): p is string => !!p))
  const keep = (ref: string) => items.has(ref) || passages.has(ledger.passageKeys[ref] ?? '')
  const events = ledger.events.filter((e) => keep(e.itemRef)).map((e) => ({ itemRef: e.itemRef, source: e.source, taskKey: null, activity: null, phase: null, helpLevel: null, sessionId: null, contentHash: null, deleted: e.deleted }))
  const passageKeys = Object.fromEntries(Object.entries(ledger.passageKeys).filter(([ref]) => items.has(ref) || events.some((e) => e.itemRef === ref)))
  return { status: 'ok', events, passageKeys }
}

export type AttemptRole = 'independent_check' | 'transfer' | 'practice' | 'helped' | 'unbound'

/**
 * 한 G2 시도가 무엇이었나 — phase 하나로 가르지 않는다(E03: 확인과 연습이 모두 phase=practice).
 * activity · TASK · 도움 · 세션 · 내용 해시를 함께 본다. 하나라도 빠지면 평가 수행으로 세지 않는다(unbound).
 */
export function attemptRole(e: Pick<ExposureEvent, 'activity' | 'phase' | 'taskKey' | 'helpLevel' | 'sessionId' | 'contentHash'>, expect: { taskKey: string; contentHash: string | null }): AttemptRole {
  if (!e.activity || !e.phase || !e.taskKey) return 'unbound'
  if (e.activity === 'practice') return 'practice'
  if (e.helpLevel !== 'independent') return 'helped'
  if (!e.sessionId || !e.contentHash || e.taskKey !== expect.taskKey || expect.contentHash === null || e.contentHash !== expect.contentHash) return 'unbound'
  if (e.activity === 'theater' && e.phase === 'practice') return 'independent_check'
  if (e.phase === 'transfer') return 'transfer'
  return 'unbound'
}

/** 정식 자격(I1 FQ) reader 상태 — 설치 전 · 조회 실패 · 설치됨(적격 목록)을 정상 0건과 구별한다 */
export type FqReader =
  | { status: 'not_installed' }
  | { status: 'error' }
  | { status: 'installed'; eligible: string[] }

export const FQ_READER_LABEL: Record<FqReader['status'], string> = {
  not_installed: '정식 자격 기록이 아직 설치되지 않았어요',
  error: '정식 자격 기록을 읽지 못했어요',
  installed: '정식 자격 기록 확인',
}
