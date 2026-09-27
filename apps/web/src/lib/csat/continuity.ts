// apps/web/src/lib/csat/continuity.ts
//
// **지속 학습 규칙 — 순수.** 브라우저도 DB 도 React 도 모른다. 시각은 늘 `now` 로 받는다.
//
// 설계: `docs/csat/ia-design.md` §2–§3. 이 모듈이 답하는 질문은 셋이다.
//   ① 이 학습자는 지금 **첫 방문 / 재방문 / 공백 복귀** 중 어디인가 — 홈 띠 위 카드가 이것으로 바뀐다.
//   ② 오늘 할 복습은 무엇인가 — 밀린 것이 많아도 **최대 3개**만 내놓고 나머지는 날짜를 뒤로 민다
//      (계획이 한 번 무너지면 통째로 포기하는 효과 — needs-research S9).
//   ③ 어디까지 덮었나 — 정답률 대신 **넓이**(본 유형 · 만난 함정 계열 · 공식)를 센다(brief A2).
// 그리고 기기 기록과 서버 기록을 **항목 단위로 합친다**(`mergeDissection`) — 통째 덮기는 한쪽 기기의
// 학습을 지운다.

import type { DissectionRecord } from './dissect'

export const DAY = 86_400_000
/** 이 날수 이상 비었다가 오면 「공백 복귀」다. */
export const COMEBACK_DAYS = 3
/** 한 번에 내놓는 복습 상한. */
export const REVIEW_CAP = 3

export type VisitState = 'first' | 'return' | 'comeback'

/** 학습 흔적이 남은 가장 최근 시각. 없으면 0. */
export function lastActivity(record: DissectionRecord): number {
  return Math.max(
    0,
    ...record.completed.map((c) => c.at),
    ...record.predictions.map((p) => p.at),
    ...(record.views ?? []).map((v) => v.at),
  )
}

/** 학습한 흔적이 하나라도 있나 — 온보딩 표시만 켠 기록은 첫 방문으로 본다. */
export function hasHistory(record: DissectionRecord): boolean {
  return record.completed.length > 0 || record.predictions.length > 0 || (record.views ?? []).length > 0 || Boolean(record.active)
}

export function gapDays(record: DissectionRecord, now: number): number {
  const last = lastActivity(record)
  return last > 0 ? Math.max(0, Math.floor((now - last) / DAY)) : 0
}

export function visitState(record: DissectionRecord, now: number): VisitState {
  if (!hasHistory(record)) return 'first'
  return gapDays(record, now) >= COMEBACK_DAYS ? 'comeback' : 'return'
}

export type QueueEntry = DissectionRecord['queue'][number]

/** 지금 할 수 있는 복습(오래 밀린 것부터). */
export function dueNow(record: DissectionRecord, now: number): QueueEntry[] {
  return record.queue.filter((q) => q.due <= now).sort((a, b) => a.due - b.due || a.tag.localeCompare(b.tag))
}

/**
 * 밀린 복습을 **오늘 몫 ≤ cap** 으로 압축한다. 가장 오래 밀린 cap 개는 그대로 두고,
 * 나머지는 내일부터 **하루에 cap 개씩** 뒤로 민다. 기록이 바뀌지 않으면 같은 객체를 돌려준다.
 */
export function compressDue(record: DissectionRecord, now: number, cap = REVIEW_CAP): DissectionRecord {
  const due = dueNow(record, now)
  if (due.length <= cap) return record
  const startOfTomorrow = Math.floor(now / DAY) * DAY + DAY
  const moved = new Map<string, number>()
  due.slice(cap).forEach((q, i) => moved.set(q.tag, startOfTomorrow + Math.floor(i / cap) * DAY))
  return { ...record, queue: record.queue.map((q) => (moved.has(q.tag) ? { ...q, due: moved.get(q.tag)! } : q)) }
}

/** 진행 중 세트 — 남은 문항 수와 대략의 남은 분(문항당 4분, 해부 세션의 예상 시간과 같은 기준). */
export function activeSet(record: DissectionRecord): { index: number; total: number; remaining: number; minutes: number; first: string } | null {
  const a = record.active
  if (!a || a.index >= a.items.length) return null
  const remaining = a.items.length - a.index
  return { index: a.index, total: a.items.length, remaining, minutes: remaining * 4, first: a.items[a.index] }
}

/** 문항 id → 유형 id. 넓이 계산에만 쓴다. */
export type TypeOf = (itemId: string) => string | undefined

export interface Coverage {
  /** 한 번이라도 연 문항(해부 완료 · 해설 열람 · 분석 먼저 읽기) */
  items: number
  /** 그 문항들의 유형 */
  types: number
  /** 예측에서 만난 오답 계열 */
  families: number
  formulas: number
  /** 유형별 본 문항 수 */
  byType: Map<string, number>
}

export function touchedItems(record: DissectionRecord): Set<string> {
  return new Set([...record.completed.map((c) => c.id), ...(record.views ?? []).map((v) => v.id), ...(record.inspected ?? [])])
}

export function coverage(record: DissectionRecord, typeOf: TypeOf): Coverage {
  const byType = new Map<string, number>()
  const items = touchedItems(record)
  for (const id of items) {
    const type = typeOf(id)
    if (type) byType.set(type, (byType.get(type) ?? 0) + 1)
  }
  const families = new Set(record.predictions.flatMap((p) => (p.family ? [p.family] : [])))
  return { items: items.size, types: byType.size, families: families.size, formulas: record.formulas.length, byType }
}

/** 최근 n일 중 학습한 날(오늘이 마지막 칸). 화면에 「연속 끊김」을 쓰지 않는다 — 칸만 칠한다. */
export function studyDays(record: DissectionRecord, now: number, days = 14): boolean[] {
  const stamps = new Set(
    [...record.completed.map((c) => c.at), ...record.predictions.map((p) => p.at), ...(record.views ?? []).map((v) => v.at)].map((t) =>
      Math.floor(t / DAY),
    ),
  )
  const today = Math.floor(now / DAY)
  return Array.from({ length: days }, (_, i) => stamps.has(today - (days - 1 - i)))
}

/** 앞으로의 복습 일정 — 오늘 · 내일 · 이번 주(오늘 포함 7일). */
export function upcoming(record: DissectionRecord, now: number): { today: number; tomorrow: number; week: number } {
  const endToday = Math.floor(now / DAY) * DAY + DAY
  return {
    today: record.queue.filter((q) => q.due < endToday).length,
    tomorrow: record.queue.filter((q) => q.due >= endToday && q.due < endToday + DAY).length,
    week: record.queue.filter((q) => q.due < endToday + 6 * DAY).length,
  }
}

/** 해설 열람을 남긴다. 같은 문항은 가장 최근 시각 하나만 둔다(최대 200개). */
export function withView(record: DissectionRecord, itemId: string, now: number): DissectionRecord {
  const rest = (record.views ?? []).filter((v) => v.id !== itemId)
  return { ...record, views: [...rest, { id: itemId, at: now }].slice(-200), updatedAt: now }
}

// ── 이벤트 속성 버킷(D3 — 닫힌 열거형만) ────────────────────────────────────

export function dueBucket(n: number): '0' | '1-3' | '4+' {
  return n === 0 ? '0' : n <= 3 ? '1-3' : '4+'
}

export function gapBucket(days: number): '0' | '1-2' | '3-6' | '7+' {
  return days === 0 ? '0' : days <= 2 ? '1-2' : days <= 6 ? '3-6' : '7+'
}

// ── 기기 ↔ 서버 병합 ────────────────────────────────────────────────────────
//
// ⚠️ `JSON.stringify` 로 같은지 보지 않는다 — DB 가 jsonb 키 순서를 바꾼다(AGENTS 「두 번 이상 고친 실수」).
//    같음은 `sameRecord` 가 항목 수와 키로 본다.

function uniqBy<T>(values: T[], key: (v: T) => string): T[] {
  const seen = new Map<string, T>()
  for (const v of values) seen.set(key(v), v)
  return [...seen.values()]
}

/**
 * 두 기록을 항목 단위로 합친다.
 * - 쌓이는 것(예측 · 완료 · 열람)은 합집합
 * - 공식은 tag 로 합치고 출처는 합집합
 * - 복습 큐는 tag 당 하나 — 겹치면 **최근에 고친 쪽**(updatedAt), 한쪽에만 있으면 살린다.
 *   (다른 기기에서 이미 끝낸 복습이 한 번 더 나올 수는 있다 — 학습이 사라지는 쪽보다 낫다.)
 * - 진행 중 세트 · 초안 · seed 도 최근에 고친 쪽
 */
export function mergeDissection(local: DissectionRecord, server: DissectionRecord): DissectionRecord {
  const newer = (server.updatedAt ?? 0) > (local.updatedAt ?? 0) ? server : local
  const older = newer === server ? local : server
  const formulas = new Map<string, DissectionRecord['formulas'][number]>()
  for (const f of [...older.formulas, ...newer.formulas]) {
    const prev = formulas.get(f.tag)
    formulas.set(f.tag, prev ? { ...f, sources: [...new Set([...prev.sources, ...f.sources])] } : { ...f, sources: [...f.sources] })
  }
  const olderOnlyQueue = older.queue.filter((q) => !newer.queue.some((n) => n.tag === q.tag))
  const views = new Map<string, number>()
  for (const v of [...(older.views ?? []), ...(newer.views ?? [])]) views.set(v.id, Math.max(views.get(v.id) ?? 0, v.at))
  return {
    ...newer,
    onboarded: local.onboarded || server.onboarded,
    predictions: uniqBy([...older.predictions, ...newer.predictions], (p) => `${p.item}|${p.step}|${p.at}`).sort((a, b) => a.at - b.at),
    completed: uniqBy([...older.completed, ...newer.completed], (c) => `${c.id}|${c.at}`).sort((a, b) => a.at - b.at),
    formulas: [...formulas.values()],
    queue: [...newer.queue, ...olderOnlyQueue],
    inspected: [...new Set([...(older.inspected ?? []), ...(newer.inspected ?? [])])],
    views: [...views.entries()].map(([id, at]) => ({ id, at })).sort((a, b) => a.at - b.at).slice(-200),
    drafts: { ...(older.drafts ?? {}), ...(newer.drafts ?? {}) },
    updatedAt: Math.max(local.updatedAt ?? 0, server.updatedAt ?? 0),
  }
}

/** 저장할 필요가 있을 만큼 달라졌나(개수 · 키로만 본다). */
export function sameRecord(a: DissectionRecord, b: DissectionRecord): boolean {
  return (
    a.predictions.length === b.predictions.length &&
    a.completed.length === b.completed.length &&
    a.formulas.length === b.formulas.length &&
    a.formulas.every((f, i) => f.tag === b.formulas[i]?.tag && f.sources.length === b.formulas[i]?.sources.length) &&
    a.queue.length === b.queue.length &&
    a.queue.every((q) => b.queue.some((r) => r.tag === q.tag && r.due === q.due && r.source === q.source)) &&
    (a.views ?? []).length === (b.views ?? []).length &&
    (a.inspected ?? []).length === (b.inspected ?? []).length &&
    a.onboarded === b.onboarded &&
    (a.active?.index ?? -1) === (b.active?.index ?? -1) &&
    (a.active?.items.join(',') ?? '') === (b.active?.items.join(',') ?? '')
  )
}
