// apps/web/src/lib/csat/session/model.ts
//
// **오늘의 세션 — 규칙은 전부 여기 있다.** 화면은 이 함수들의 결과를 그릴 뿐이다.
//
//   · 세션 = 문항 3개(약 10분 안). 약한 유형 1 + 다음 순서 유형 1 + 복습 1 — 복습이 비면 신규 1
//   · 틀렸거나 「헷갈려요」면 복습 큐 → 3일 뒤 → (맞히면) 10일 뒤 → (또 맞히면) 졸업
//   · 스트릭은 숫자 하나. 끊겨도 벌하지 않는다(화면이 「다시 시작」 한 줄만 말한다)
//
// 학습과학 근거(CLAUDE.md 7원칙): 먼저 풀고 본다(1 인출) · 간격을 둔 복습(2) ·
// 유형을 섞는다(3 바람직한 어려움 — 교차 연습) · 세션 3문항(6 인지 부하) · 「헷갈려요」 자기 판정(메타인지).
//
// ⚠️ 순수 모듈이다 — 시각은 인자로 받는다(`now`). 테스트가 시간을 옮겨 「3일 뒤」를 검사한다(F7).
// ⚠️ 저장은 여기서 하지 않는다. 기록을 받아 새 기록을 돌려준다 — 저장소는 `store.ts` 가 맡는다.

/** 세션이 고를 수 있는 문항 한 줄 — **글자가 없다**(원문은 학습자 PDF 에서 온다). */
export interface CatalogItem {
  /** `2026#31` */
  id: string
  exam_id: string
  no: number
  type_id: string
  points: number | null
}

export interface CatalogType {
  id: string
  name: string
  /** 권장 풀이 시간(초) — 유형 리포트 값. 없으면 null */
  time_budget_sec: number | null
}

export interface SessionCatalog {
  items: CatalogItem[]
  /** **순서가 곧 「다음 순서 유형」이다** — 최근 출제가 많은 순(은퇴 유형 제외) */
  types: CatalogType[]
  /** 회차 → 사람이 읽는 이름 */
  exams: Record<string, { label: string; order: number }>
}

export interface Attempt {
  item_id: string
  type_id: string
  /** null = 고르지 않고 넘어감 */
  correct: boolean | null
  confused: boolean
  /** ISO 시각 */
  at: string
  sec: number
}

export interface ReviewEntry {
  item_id: string
  type_id: string
  /** ISO 시각 — 이 시각 이후 세션에 나온다 */
  due: string
  /** 1 = 3일 뒤 차례 · 2 = 10일 뒤 차례 */
  stage: 1 | 2
}

export interface LearnerRecord {
  version: 1
  attempts: Attempt[]
  reviews: ReviewEntry[]
  onboarded: boolean
}

export const EMPTY_RECORD: LearnerRecord = { version: 1, attempts: [], reviews: [], onboarded: false }

export const SESSION_SIZE = 3
export const REVIEW_DAYS = [3, 10] as const
/** 약한 유형을 가르는 창 — 최근 이만큼의 풀이 */
export const WEAK_WINDOW = 20
/** 문항 하나에서 「이해·한 줄」에 드는 시간 어림(초) — 풀이 시간 위에 얹는다. 세 문항이 10분 안에 들게(지시문 B) */
export const UNDERSTAND_SEC = 60

const DAY = 24 * 60 * 60 * 1000
const addDays = (now: Date, d: number) => new Date(now.getTime() + d * DAY).toISOString()

/** 한 문항을 마친 결과를 기록에 반영한다 — **복습 큐 규칙이 여기 하나뿐이다.** */
export function applyResult(
  record: LearnerRecord,
  r: { item: CatalogItem; correct: boolean | null; confused: boolean; sec: number },
  now: Date,
): LearnerRecord {
  const attempt: Attempt = {
    item_id: r.item.id,
    type_id: r.item.type_id,
    correct: r.correct,
    confused: r.confused,
    at: now.toISOString(),
    sec: Math.max(0, Math.round(r.sec)),
  }
  const shaky = r.correct !== true || r.confused
  const existing = record.reviews.find((x) => x.item_id === r.item.id)
  const rest = record.reviews.filter((x) => x.item_id !== r.item.id)

  let next: ReviewEntry | null
  if (shaky) {
    // 틀렸거나 헷갈렸다 — 처음부터(3일 뒤). 정답이어도 「헷갈려요」면 들어간다(지시문 B)
    next = { item_id: r.item.id, type_id: r.item.type_id, due: addDays(now, REVIEW_DAYS[0]), stage: 1 }
  } else if (existing && existing.stage === 1) {
    // 3일 뒤 복습을 맞혔다 — 10일 뒤 한 번 더
    next = { ...existing, due: addDays(now, REVIEW_DAYS[1]), stage: 2 }
  } else {
    // 처음 맞혔거나 10일 뒤 복습까지 맞혔다 — 큐에 없다(졸업)
    next = null
  }
  return { ...record, attempts: [...record.attempts, attempt], reviews: next ? [...rest, next] : rest }
}

/** 지금 나올 차례인 복습 — 오래 기다린 것부터 */
export function dueReviews(record: LearnerRecord, now: Date): ReviewEntry[] {
  const t = now.getTime()
  return record.reviews.filter((r) => Date.parse(r.due) <= t).sort((a, b) => Date.parse(a.due) - Date.parse(b.due))
}

/** 유형별 정확도 — 고르지 않고 넘어간 것은 틀린 것으로 센다(모르는 것이다) */
export function typeAccuracy(attempts: Attempt[]): Map<string, { n: number; correct: number; rate: number }> {
  const m = new Map<string, { n: number; correct: number; rate: number }>()
  for (const a of attempts) {
    const cur = m.get(a.type_id) ?? { n: 0, correct: 0, rate: 0 }
    cur.n += 1
    if (a.correct === true) cur.correct += 1
    cur.rate = cur.correct / cur.n
    m.set(a.type_id, cur)
  }
  return m
}

/**
 * 약한 유형 — 최근 20문항 안에서 정확도가 가장 낮은 유형.
 * 동률이면 더 많이 푼 쪽(근거가 두꺼운 쪽), 그래도 같으면 순서표 앞쪽. 기록이 없으면 null.
 */
export function weakestType(record: LearnerRecord, order: string[]): string | null {
  const recent = record.attempts.slice(-WEAK_WINDOW)
  const acc = typeAccuracy(recent)
  let best: { id: string; rate: number; n: number; pos: number } | null = null
  for (const [id, v] of acc) {
    const pos = order.indexOf(id)
    if (pos < 0) continue
    const cand = { id, rate: v.rate, n: v.n, pos }
    if (
      !best ||
      cand.rate < best.rate ||
      (cand.rate === best.rate && (cand.n > best.n || (cand.n === best.n && cand.pos < best.pos)))
    ) {
      best = cand
    }
  }
  return best?.id ?? null
}

/** 다음 순서 유형 — 마지막으로 「순서 칸」에서 푼 유형의 다음. 처음이면 첫 유형. */
export function nextOrderType(record: LearnerRecord, order: string[], skip: string[] = []): string | null {
  if (!order.length) return null
  const seen = new Set(record.attempts.map((a) => a.type_id))
  // 순서표를 따라가되 **아직 안 만난 유형이 먼저다** — 한 바퀴를 돌아야 약한 유형이 드러난다
  const last = [...record.attempts].reverse().find((a) => order.includes(a.type_id))
  const start = last ? (order.indexOf(last.type_id) + 1) % order.length : 0
  const rotated = [...order.slice(start), ...order.slice(0, start)].filter((t) => !skip.includes(t))
  return rotated.find((t) => !seen.has(t)) ?? rotated[0] ?? null
}

export type SlotKind = 'weak' | 'order' | 'review' | 'new'

export interface SessionSlot {
  kind: SlotKind
  item: CatalogItem
}

export interface SessionPlan {
  slots: SessionSlot[]
  /** 이 세션이 필요로 하는 회차 — 기기에 없는 것이 「받기」 안내가 된다 */
  exams: string[]
  /** 약 N분 */
  minutes: number
}

/**
 * 한 유형에서 문항 하나를 고른다.
 * ① 안 푼 것 ② 이미 고른 회차(PDF 하나로 끝나게) ③ 기기에 있는 회차 ④ 최근 회차 ⑤ 번호 순.
 */
function pickFrom(
  cat: SessionCatalog,
  typeId: string,
  opts: { taken: Set<string>; attempted: Set<string>; preferExams: string[]; cached: Set<string> },
): CatalogItem | null {
  const cands = cat.items.filter((i) => i.type_id === typeId && !opts.taken.has(i.id))
  if (!cands.length) return null
  const order = (e: string) => cat.exams[e]?.order ?? 0
  const score = (i: CatalogItem) => [
    opts.attempted.has(i.id) ? 1 : 0,
    opts.preferExams.includes(i.exam_id) ? 0 : 1,
    opts.cached.has(i.exam_id) ? 0 : 1,
    -order(i.exam_id),
    i.no,
  ]
  return [...cands].sort((a, b) => {
    const x = score(a)
    const y = score(b)
    for (let k = 0; k < x.length; k += 1) if (x[k] !== y[k]) return x[k] - y[k]
    return 0
  })[0]
}

/**
 * **오늘의 세션을 짠다.** 약한 유형 1 + 다음 순서 유형 1 + 복습 1(비면 신규 1).
 *
 * 약한 유형을 아직 모르면(기록 없음) 그 칸도 순서표에서 받는다 — 단, **앞 칸과 다른 유형**이다
 * (유형을 섞는다). 복습 문항이 고른 회차를 먼저 쓰게 해서 필요한 PDF 수를 줄인다.
 */
export function composeSession(
  cat: SessionCatalog,
  record: LearnerRecord,
  now: Date,
  cachedExams: string[] = [],
): SessionPlan {
  const order = cat.types.map((t) => t.id)
  const byId = new Map(cat.items.map((i) => [i.id, i]))
  const attempted = new Set(record.attempts.map((a) => a.item_id))
  const cached = new Set(cachedExams)
  const taken = new Set<string>()
  const slots: SessionSlot[] = []
  const preferExams: string[] = []
  const add = (kind: SlotKind, item: CatalogItem | null) => {
    if (!item) return
    slots.push({ kind, item })
    taken.add(item.id)
    if (!preferExams.includes(item.exam_id)) preferExams.push(item.exam_id)
  }

  // 복습을 먼저 정한다(문항이 이미 정해져 있다) — 다른 칸이 그 회차를 따라가게
  const review = dueReviews(record, now)
    .map((r) => byId.get(r.item_id))
    .find((i): i is CatalogItem => Boolean(i))
  // 복습 문항을 다른 칸이 먼저 집어 가지 않게 미리 잡아 둔다
  if (review) taken.add(review.id)
  const opts = () => ({ taken, attempted, preferExams, cached })

  const weak = weakestType(record, order)
  const firstType = weak ?? nextOrderType(record, order)
  const pickedTypes: string[] = []
  const weakItem = firstType ? pickFrom(cat, firstType, { ...opts(), preferExams: review ? [review.exam_id] : [] }) : null
  if (weakItem) pickedTypes.push(weakItem.type_id)

  const orderType = nextOrderType(record, order, weak ? [] : pickedTypes)
  const orderItem = orderType
    ? pickFrom(cat, orderType, {
        ...opts(),
        taken: new Set([...taken, ...(weakItem ? [weakItem.id] : [])]),
        preferExams: [...(review ? [review.exam_id] : []), ...(weakItem ? [weakItem.exam_id] : [])],
      })
    : null

  add(weak ? 'weak' : 'order', weakItem)
  add('order', orderItem)

  if (review) {
    add('review', review)
  } else {
    // 복습이 비었다 — 신규 1. 앞 두 칸과 **다른 유형**에서(교차)
    const used = slots.map((s) => s.item.type_id)
    const newType = nextOrderType(
      { ...record, attempts: [...record.attempts, ...slots.map((s) => fakeAttempt(s.item))] },
      order,
      used,
    )
    add('new', newType ? pickFrom(cat, newType, opts()) : null)
  }

  const budget = new Map(cat.types.map((t) => [t.id, t.time_budget_sec ?? 120]))
  const sec = slots.reduce((a, s) => a + (budget.get(s.item.type_id) ?? 120) + UNDERSTAND_SEC, 0)
  return {
    slots: slots.slice(0, SESSION_SIZE),
    exams: [...new Set(slots.map((s) => s.item.exam_id))],
    minutes: Math.max(1, Math.round(sec / 60)),
  }
}

function fakeAttempt(i: CatalogItem): Attempt {
  return { item_id: i.id, type_id: i.type_id, correct: true, confused: false, at: '', sec: 0 }
}

/** 기기 시간대의 날짜 열쇠(YYYY-MM-DD) */
export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 스트릭 — 오늘(또는 어제)까지 하루도 안 빠지고 푼 날 수.
 * 오늘 아직 안 풀었으면 어제까지를 센다 — 아침에 열자마자 0 이 되면 그게 압박이다.
 */
export function streak(record: LearnerRecord, now: Date): { days: number; broken: boolean } {
  const days = new Set(record.attempts.map((a) => dayKey(new Date(a.at))))
  if (!days.size) return { days: 0, broken: false }
  const cursor = new Date(now)
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (days.has(dayKey(cursor))) {
    n += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return { days: n, broken: n === 0 }
}

/** 이번 주(월요일부터) 푼 문항 수 */
export function weekCount(record: LearnerRecord, now: Date): number {
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return record.attempts.filter((a) => Date.parse(a.at) >= monday.getTime()).length
}

/** 세션 요약 한 줄에 쓰는 이름 — 「빈칸 2 + 복습 1」 */
export function planLabel(plan: SessionPlan, types: CatalogType[]): string {
  const name = new Map(types.map((t) => [t.id, shortTypeName(t.name)]))
  const parts = new Map<string, number>()
  for (const s of plan.slots) {
    const k = s.kind === 'review' ? '복습' : (name.get(s.item.type_id) ?? s.item.type_id)
    parts.set(k, (parts.get(k) ?? 0) + 1)
  }
  // 복습은 맨 뒤
  const entries = [...parts].sort((a, b) => (a[0] === '복습' ? 1 : 0) - (b[0] === '복습' ? 1 : 0))
  return entries.map(([k, n]) => `${k} ${n}`).join(' + ')
}

/**
 * 카드 한 줄에 들어가는 유형 약칭 — 「빈칸 추론」→「빈칸」.
 *
 * ⚠️ 첫 낱말만 자르면 「글의 목적」이 「글의」가 된다(실측 2026-09-17 홈 카드). 뜻이 남는 약칭은
 *    규칙으로 안 나와서 **표로 둔다.** 표에 없는 이름은 괄호·가운뎃점 뒤를 걷은 전체 이름.
 */
const SHORT_TYPE: Record<string, string> = {
  '빈칸 추론': '빈칸',
  '안내문 일치': '안내문',
  '글의 순서': '순서',
  '문장 삽입': '삽입',
  '심경·분위기': '심경',
  '필자 주장': '주장',
  '글의 목적': '목적',
  '내용 일치(글)': '내용 일치',
  '어휘(문맥)': '어휘',
  '함축 의미': '함축',
  '요약문 완성': '요약',
  '무관한 문장': '무관 문장',
  '장문 내용 일치': '장문 일치',
}

export function shortTypeName(name: string): string {
  return SHORT_TYPE[name] ?? (name.replace(/\(.*?\)/g, '').split('·')[0].trim() || name)
}

/** 회차 id → 정렬 열쇠(클수록 최근). `2026` = 2026학년도 수능, `M2706` = 2027학년도 6월 모평. */
export function examOrder(examId: string): number {
  const m = examId.match(/^M(\d{2})(\d{2})$/)
  if (m) return (2000 + Number(m[1])) * 100 + Number(m[2])
  const y = examId.match(/^(\d{4})/)
  if (!y) return 0
  return Number(y[1]) * 100 + 11 + (examId.endsWith('B') ? 0.5 : 0)
}
