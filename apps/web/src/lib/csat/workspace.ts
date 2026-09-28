// apps/web/src/lib/csat/workspace.ts
//
// **학습 Workspace — 학습자가 기출의 단위(유형 · 함정 · 회차 · 문항)를 골라 담은 자기만의 학습 묶음.**
// (2026-09-29 · 설계 docs/csat-learner/workspace-design.md)
//
// 저장은 `DissectionRecord.workspaces` 한 칸이다 — 기기(IndexedDB)와 서버(`csat_learner_state.record`)에
// 이미 함께 가는 기록이라 **저장용 마이그레이션이 없다.** 여기 있는 것은 전부 순수 함수이고, 시각은
// 인자로 받는다(AGENTS: 시계를 직접 읽지 않는다).
//
// 기출 데이터는 읽기만 한다. 문항 풀 · 진행 · 약점은 **저장하지 않고 매번 센다** — 저장하면 기록과 어긋난다.

import type { DissectionRecord, Prediction } from './dissect'

// ── 모양 ─────────────────────────────────────────────────────────────────

/** 만들 때 고른 출발점 — 레일 「목적별」 5개 + 「내 약점으로」 */
export type WorkspaceStarter = 'start' | 'killer' | 'trap' | 'evidence' | 'recent' | 'weakness'

export interface WorkspaceScope {
  /** 유형 id(`R-BLANK` …) */
  types: string[]
  /** 오답 계열 이름(함정 32) */
  traps: string[]
  /** 회차 id(`2026` · `M2609` …) */
  exams: string[]
  /** 낱개로 더한 문항 id(`2026#24`) — 위 조건과 상관없이 들어간다 */
  items: string[]
  /** 지문 지도(근거 문장 자리)가 있는 문항만 */
  mappedOnly?: boolean
}

export interface WorkspaceIntent {
  /** 목표 한 줄(학습자가 쓴 글 — 계측에 보내지 않는다) */
  goal: string
  /** 계획 — 주당 학습 세트 수 · 기한(YYYY-MM-DD) */
  plan?: { perWeek: number; until?: string }
  /** 방향 — 목적별 출발점 중 하나 */
  direction?: WorkspaceStarter
  /** 학습자가 약점이라고 고른 유형 id · 함정 이름 */
  weak?: string[]
}

export interface Workspace {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  starter: WorkspaceStarter
  intent: WorkspaceIntent
  scope: WorkspaceScope
  archived?: boolean
  /** 지운 시각 — **묘비로 남긴다.** 지우고 바로 빼면 다른 기기의 사본이 병합 때 되살린다 */
  deletedAt?: number
}

/** 풀을 셀 때 쓰는 문항 색인 — 해부 카탈로그에서 서버가 만들어 넘긴다(지문 원문 없음) */
export interface WorkspaceIndexItem {
  id: string
  type_id: string
  exam_id: string
  /** 이 문항 오답 선지들의 계열(함정) — 최신 published 분석의 `choice_analysis[].trap`, 지도에 오른 이름만 */
  families: string[]
  /** 지문 지도가 있나 */
  mapped: boolean
  /** 학년도 */
  year: number
}

export const EMPTY_SCOPE: WorkspaceScope = { types: [], traps: [], exams: [], items: [] }

// ── 문항 풀 ──────────────────────────────────────────────────────────────

/**
 * **담은 것 → 실제 문항.** 같은 칸 안은 「또는」, 칸과 칸 사이는 「그리고」다.
 * 「빈칸 + 최근 회차」 는 최근 회차의 빈칸이다(합집합이면 빈칸 전부 + 최근 회차 전부가 돼 뜻이 달라진다).
 * 낱개 문항(`items`)은 조건과 상관없이 더한다. 조건이 하나도 없으면 낱개 문항만 남는다.
 */
export function poolOf(scope: WorkspaceScope, index: readonly WorkspaceIndexItem[]): WorkspaceIndexItem[] {
  const types = new Set(scope.types)
  const traps = new Set(scope.traps)
  const exams = new Set(scope.exams)
  const hasFacet = types.size > 0 || traps.size > 0 || exams.size > 0 || !!scope.mappedOnly
  const picked = new Set(scope.items)
  return index.filter((it) => {
    if (picked.has(it.id)) return true
    if (!hasFacet) return false
    if (types.size && !types.has(it.type_id)) return false
    if (traps.size && !it.families.some((f) => traps.has(f))) return false
    if (exams.size && !exams.has(it.exam_id)) return false
    if (scope.mappedOnly && !it.mapped) return false
    return true
  })
}

/** 계측용 풀 크기 구간 — 문항 수를 그대로 보내지 않는다 */
export function poolBucket(n: number): 'none' | 'lt10' | 'lt30' | 'lt100' | 'gte100' {
  return n === 0 ? 'none' : n < 10 ? 'lt10' : n < 30 ? 'lt30' : n < 100 ? 'lt100' : 'gte100'
}

export const scopeSize =(s: WorkspaceScope) => s.types.length + s.traps.length + s.exams.length + s.items.length + (s.mappedOnly ? 1 : 0)

// ── 병합(기기 ↔ 서버) ────────────────────────────────────────────────────

/** 키 순서와 상관없는 직렬화 — 같은 시각에 고친 두 사본을 **결정적으로** 가른다 */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * Workspace 목록 둘을 id 로 합친다.
 * - 한쪽에만 있으면 살린다.
 * - 둘 다 있으면 `updatedAt` 이 늦은 쪽. **같으면 직렬화가 큰 쪽**(어느 기기에서 돌려도 같은 결과).
 * - 묘비(`deletedAt`)는 남긴다 — 지운 뒤에 고친 사본(`updatedAt > deletedAt`)만 되살아난다.
 * 한계: Workspace **한 벌 단위**로 늦은 쪽을 고른다. 두 기기에서 같은 Workspace 의 다른 칸을 동시에
 * 고치면 한쪽 변경이 사라진다(칸별 시각을 두지 않았다 — 설계 문서 §4).
 */
export function mergeWorkspaces(a: readonly Workspace[] | undefined, b: readonly Workspace[] | undefined): Workspace[] {
  const out = new Map<string, Workspace>()
  for (const w of [...(a ?? []), ...(b ?? [])]) {
    const prev = out.get(w.id)
    if (!prev) {
      out.set(w.id, w)
      continue
    }
    const pick =
      w.updatedAt !== prev.updatedAt ? (w.updatedAt > prev.updatedAt ? w : prev) : stable(w) > stable(prev) ? w : prev
    const other = pick === w ? prev : w
    // 묘비는 잃지 않는다 — 늦게 고친 쪽이 묘비를 모르면 묘비를 옮겨 붙인다(단 묘비 뒤에 고친 것이면 살린다)
    const deletedAt = Math.max(pick.deletedAt ?? 0, other.deletedAt ?? 0) || undefined
    out.set(w.id, deletedAt && deletedAt >= pick.updatedAt ? { ...pick, deletedAt } : pick)
  }
  return [...out.values()].sort((x, y) => x.createdAt - y.createdAt || x.id.localeCompare(y.id))
}

/** 화면에 보일 것 — 묘비 제외 */
export const liveWorkspaces = (list: readonly Workspace[] | undefined, withArchived = false) =>
  (list ?? []).filter((w) => !w.deletedAt && (withArchived || !w.archived))

/** 저장이 필요할 만큼 달라졌나 — id · 시각 · 묘비로만 본다 */
export function sameWorkspaces(a: readonly Workspace[] | undefined, b: readonly Workspace[] | undefined): boolean {
  const x = a ?? []
  const y = b ?? []
  if (x.length !== y.length) return false
  const key = (w: Workspace) => `${w.id}|${w.updatedAt}|${w.deletedAt ?? 0}`
  const ys = new Set(y.map(key))
  return x.every((w) => ys.has(key(w)))
}

// ── 진행 ────────────────────────────────────────────────────────────────

export interface WorkspaceProgress {
  pool: number
  /** 이 풀에서 한 번이라도 연(해부 · 해설 · 예측) 문항 — **만들기 전 학습도 포함** */
  touched: number
  /** 만든 뒤에 연 문항 */
  touchedSince: number
  /**
   * 이번 주(월요일 0시부터) · 만든 뒤에 이 풀에서 학습한 문항 수(해설을 열거나 · 예측하거나 · 해부를 끝낸 문항,
   * 문항당 한 번) — 계획(주당 학습 문항)의 분자. 만들기 전 학습은 넣지 않는다.
   */
  studiedThisWeek: number
  /** 계획의 주당 세트 수(없으면 null) */
  perWeek: number | null
  /** 기한까지 남은 날(없거나 지났으면 null · 지났으면 0) */
  daysLeft: number | null
}

const DAY = 86_400_000

/** 그 주 월요일 0시(UTC 기준 — 기기 시간대를 읽지 않는다. 경계가 몇 시간 어긋나는 것은 받아들인다) */
export function weekStart(now: number): number {
  const d = Math.floor(now / DAY)
  const dow = (d + 3) % 7 // 1970-01-01 은 목요일 → 월=0
  return (d - dow) * DAY
}

function touchTimes(record: DissectionRecord): Map<string, number[]> {
  const m = new Map<string, number[]>()
  const add = (id: string, at: number) => m.set(id, [...(m.get(id) ?? []), at])
  for (const c of record.completed) add(c.id, c.at)
  for (const v of record.views ?? []) add(v.id, v.at)
  for (const p of record.predictions) add(p.item, p.at)
  return m
}

export function progressOf(ws: Workspace, pool: readonly WorkspaceIndexItem[], record: DissectionRecord, now: number): WorkspaceProgress {
  const times = touchTimes(record)
  const ids = new Set(pool.map((p) => p.id))
  let touched = 0
  let touchedSince = 0
  for (const id of ids) {
    const t = times.get(id)
    if (!t) continue
    touched += 1
    if (t.some((at) => at >= ws.createdAt)) touchedSince += 1
  }
  const monday = weekStart(now)
  const from = Math.max(monday, ws.createdAt)
  let studiedThisWeek = 0
  for (const id of ids) if (times.get(id)?.some((at) => at >= from)) studiedThisWeek += 1
  let daysLeft: number | null = null
  if (ws.intent.plan?.until) {
    const until = Date.parse(`${ws.intent.plan.until}T23:59:59Z`)
    if (Number.isFinite(until)) daysLeft = Math.max(0, Math.ceil((until - now) / DAY))
  }
  return { pool: ids.size, touched, touchedSince, studiedThisWeek, perWeek: ws.intent.plan?.perWeek ?? null, daysLeft }
}

// ── 약점 변화(예측 적중) ──────────────────────────────────────────────────

/**
 * 무엇을 맞혔나 — 예측 단계별 대상이 다르다. 화면은 이 이름을 **함께** 보여 준다(무엇의 적중인지 모르면 수가 뜻이 없다).
 *   1수 = 정답 근거가 놓인 문장 · 2수 = 오답의 제조 계열 · 3수 = 설계 가설
 */
export const STEP_TARGET: Record<1 | 2 | 3, string> = { 1: '근거 자리', 2: '오답 계열', 3: '설계 가설' }

/** 판단에 필요한 최소 표본 — 이보다 적으면 약점·추세를 말하지 않는다 */
export const MIN_JUDGE = 6
/** 추세는 최근 창과 그 앞 창을 비교한다 — 각 창의 크기 */
export const TREND_WINDOW = 5

export type TrendVerdict = 'insufficient' | 'up' | 'down' | 'flat'

export interface WeakRow {
  /** 유형 id 또는 함정 이름 */
  key: string
  axis: 'type' | 'trap'
  step: 1 | 2 | 3
  n: number
  hits: number
  /** 최근 창 · 앞 창(예측 수 · 적중 수). 둘 다 창을 못 채우면 null */
  recent: { n: number; hits: number } | null
  before: { n: number; hits: number } | null
  verdict: TrendVerdict
}

function trend(list: Prediction[]): Pick<WeakRow, 'recent' | 'before' | 'verdict'> {
  if (list.length < MIN_JUDGE) return { recent: null, before: null, verdict: 'insufficient' }
  const sorted = [...list].sort((a, b) => a.at - b.at)
  const recentL = sorted.slice(-TREND_WINDOW)
  const beforeL = sorted.slice(-2 * TREND_WINDOW, -TREND_WINDOW)
  const recent = { n: recentL.length, hits: recentL.filter((p) => p.hit).length }
  if (beforeL.length < TREND_WINDOW) return { recent, before: null, verdict: 'insufficient' }
  const before = { n: beforeL.length, hits: beforeL.filter((p) => p.hit).length }
  // 창 5개에서 2개 이상 차이가 날 때만 방향을 말한다 — 한 문항 차이는 우연과 가를 수 없다
  const diff = recent.hits - before.hits
  return { recent, before, verdict: diff >= 2 ? 'up' : diff <= -2 ? 'down' : 'flat' }
}

/**
 * 이 풀 안의 예측을 유형 · 함정별로 센다. 유형 축은 1수(근거 자리), 함정 축은 2수(오답 계열)를 본다 —
 * 약점이 「어디서 근거를 못 찾나」 와 「어떤 오답에 끌리나」 로 갈리기 때문이다.
 */
export function weakRows(pool: readonly WorkspaceIndexItem[], record: DissectionRecord): WeakRow[] {
  const byId = new Map(pool.map((p) => [p.id, p]))
  const groups = new Map<string, { axis: 'type' | 'trap'; step: 1 | 2; list: Prediction[] }>()
  for (const p of record.predictions) {
    const it = byId.get(p.item)
    if (!it) continue
    if (p.step === 1) {
      const k = `type|${it.type_id}`
      const g = groups.get(k) ?? { axis: 'type' as const, step: 1 as const, list: [] }
      g.list.push(p)
      groups.set(k, g)
    } else if (p.step === 2) {
      // 2수 예측이 가리킨 오답의 계열(`Prediction.family`). 없으면(옛 기록) 함정 축에 넣지 않는다 —
      // 문항에 계열이 여럿이라 어느 것인지 짐작하면 지어낸 수가 된다
      if (!p.family) continue
      const k = `trap|${p.family}`
      const g = groups.get(k) ?? { axis: 'trap' as const, step: 2 as const, list: [] }
      g.list.push(p)
      groups.set(k, g)
    }
  }
  return [...groups.entries()]
    .map(([k, g]) => ({ key: k.slice(k.indexOf('|') + 1), axis: g.axis, step: g.step, n: g.list.length, hits: g.list.filter((p) => p.hit).length, ...trend(g.list) }))
    .sort((a, b) => (a.verdict === 'insufficient' ? 1 : 0) - (b.verdict === 'insufficient' ? 1 : 0) || a.hits / a.n - b.hits / b.n || b.n - a.n || a.key.localeCompare(b.key))
}

/**
 * 기록 전체에서 **약점 후보** — 만들기 가이드 「내 약점으로」 가 미리 고를 것.
 * 표본이 `MIN_JUDGE` 이상이고 적중이 절반 미만인 것만. 없으면 빈 배열(단정하지 않는다).
 */
export function weakCandidates(index: readonly WorkspaceIndexItem[], record: DissectionRecord, limit = 3): WeakRow[] {
  return weakRows(index, record)
    .filter((r) => r.n >= MIN_JUDGE && r.hits / r.n < 0.5)
    .slice(0, limit)
}

// ── 다음 세트 ────────────────────────────────────────────────────────────

/**
 * 풀에서 다음에 풀 3문항. 안 연 문항부터, 그다음은 약한 유형 · 계열의 문항, 그다음은 오래전에 본 문항.
 * 같은 순위는 id 로 — 같은 기록이면 언제나 같은 세트(결정적).
 */
export function nextSet(pool: readonly WorkspaceIndexItem[], record: DissectionRecord, size = 3): string[] {
  const times = touchTimes(record)
  const weak = new Map<string, number>()
  for (const r of weakRows(pool, record)) if (r.verdict !== 'insufficient') weak.set(`${r.axis}|${r.key}`, r.hits / r.n)
  const score = (it: WorkspaceIndexItem) => {
    const seen = times.get(it.id)
    if (!seen) return [0, 0]
    const w = Math.min(weak.get(`type|${it.type_id}`) ?? 1, ...it.families.map((f) => weak.get(`trap|${f}`) ?? 1))
    return [1 + w, Math.max(...seen)]
  }
  return [...pool]
    .map((it) => ({ it, s: score(it) }))
    .sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1] || a.it.id.localeCompare(b.it.id))
    .slice(0, size)
    .map((x) => x.it.id)
}

// ── 가이드 — 출발점이 미리 채우는 구성 ─────────────────────────────────────

export interface StarterContext {
  /** 최근 출제가 많은 순의 유형 id */
  typesByRecent: string[]
  /** 킬러 유형(빈칸 · 순서 · 삽입) — `space-model.killerTypeIds` */
  killer: string[]
  /** 여러 유형에 걸치는 함정(많은 순) — `trap-atlas.UNIVERSAL` */
  universalTraps: string[]
  /** 최근 기출의 기준 학년도 — `trap-atlas.RECENT_FROM` */
  recentFrom: number
  /** 회차 id · 학년도 */
  exams: { id: string; year: number }[]
  /** 기록에서 찾은 약점 후보(`weakCandidates`) */
  weak: WeakRow[]
}

export const STARTER_LABEL: Record<WorkspaceStarter, string> = {
  start: '처음 시작하기',
  killer: '킬러 유형 잡기',
  trap: '오답 선지 설계 보기',
  evidence: '근거 문장 찾기',
  recent: '최근 기출부터',
  weakness: '내 약점으로',
}

/** 출발점이 미리 담는 것과 그 이유 한 줄 — 학습자는 이것을 고쳐서 저장한다 */
export function starterScope(starter: WorkspaceStarter, ctx: StarterContext): { scope: WorkspaceScope; why: string } {
  switch (starter) {
    case 'start':
      return { scope: { ...EMPTY_SCOPE, types: ctx.typesByRecent.slice(0, 3) }, why: '최근 출제가 가장 많은 유형 셋으로 시작합니다.' }
    case 'killer':
      return { scope: { ...EMPTY_SCOPE, types: ctx.killer }, why: '빈칸 · 순서 · 삽입 — 3점이 몰리는 유형입니다.' }
    case 'trap':
      return { scope: { ...EMPTY_SCOPE, traps: ctx.universalTraps.slice(0, 4) }, why: '유형을 가리지 않고 가장 많이 쓰인 오답 제조법 넷입니다.' }
    case 'evidence':
      return { scope: { ...EMPTY_SCOPE, mappedOnly: true, exams: ctx.exams.filter((e) => e.year >= ctx.recentFrom).map((e) => e.id) }, why: '지문 지도로 근거 문장 자리를 확인할 수 있는 최근 문항입니다.' }
    case 'recent':
      return { scope: { ...EMPTY_SCOPE, exams: ctx.exams.filter((e) => e.year >= ctx.recentFrom).map((e) => e.id) }, why: `${ctx.recentFrom}학년도 이후 수능 · 모의평가입니다.` }
    case 'weakness': {
      const types = ctx.weak.filter((w) => w.axis === 'type').map((w) => w.key)
      const traps = ctx.weak.filter((w) => w.axis === 'trap').map((w) => w.key)
      // 칸 사이는 「그리고」 라 유형과 함정을 함께 넣으면 좁아진다 — 표본이 더 큰 축 하나만 담는다
      const useTypes = types.length > 0 && (traps.length === 0 || ctx.weak.find((w) => w.axis === 'type')!.n >= ctx.weak.find((w) => w.axis === 'trap')!.n)
      return ctx.weak.length
        ? { scope: { ...EMPTY_SCOPE, ...(useTypes ? { types } : { traps }) }, why: '예측 기록에서 적중이 절반 미만이었던 곳입니다(표본 6회 이상).' }
        : { scope: EMPTY_SCOPE, why: '약점을 말할 만큼 예측 기록이 아직 없습니다.' }
    }
  }
}

// ── 만들기 ───────────────────────────────────────────────────────────────

/** 문자열 id — 계측에 보내지 않는다(자유 문자열 · 식별자). 난수는 주입 */
export function newWorkspaceId(now: number, rand: number): string {
  return `ws-${now.toString(36)}-${Math.floor(rand * 1e9).toString(36)}`
}

export function createWorkspace(input: {
  name: string
  starter: WorkspaceStarter
  intent: WorkspaceIntent
  scope: WorkspaceScope
  now: number
  rand: number
}): Workspace {
  return {
    id: newWorkspaceId(input.now, input.rand),
    name: input.name.trim().slice(0, 40) || '이름 없는 Workspace',
    createdAt: input.now,
    updatedAt: input.now,
    starter: input.starter,
    intent: { ...input.intent, goal: input.intent.goal.trim().slice(0, 120) },
    scope: input.scope,
  }
}

/** 고친다 — 시각을 올린다(병합의 기준) */
export function editWorkspace(ws: Workspace, patch: Partial<Pick<Workspace, 'name' | 'intent' | 'scope' | 'archived'>>, now: number): Workspace {
  return { ...ws, ...patch, updatedAt: Math.max(now, ws.updatedAt + 1) }
}

/** 지운다 — 묘비(병합에서 되살아나지 않게) */
export function deleteWorkspace(ws: Workspace, now: number): Workspace {
  const t = Math.max(now, ws.updatedAt + 1)
  return { ...ws, deletedAt: t, updatedAt: t }
}

/** 기록에 넣거나 바꾼다 */
export function putWorkspace(record: DissectionRecord, ws: Workspace): DissectionRecord {
  const rest = (record.workspaces ?? []).filter((w) => w.id !== ws.id)
  return { ...record, workspaces: [...rest, ws] }
}
