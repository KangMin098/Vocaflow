// apps/web/src/lib/csat/item-finder.ts
//
// **기출 찾기 팝업의 선택 모델 · 주소 · 응답 모양 — 순수.** (기출 찾기 FND1 · FND3)
//
// 서가(`CsatWorkspace`)와 팝업이 **같은 조건 모델**을 쓴다. 조건은 `BrowseFilter` 하나가 아니라
// `BrowseFilter` + `BrowsePurpose` 다 — 서가의 「킬러 유형」 은 필터 밖의 별도 상태이고
// `browseHref(filter, purpose)` 의 두 번째 인자로 주소에 실린다. 필터만 복사하면 팝업을 열고
// 닫는 사이 목적이 조용히 빠진다(계획 검토 P2). 그래서 둘을 한 값(`FinderSelection`)으로 묶는다.
//   · killer  — 필터 밖. `killerTypeIds()` 의 유형만 남긴다
//   · evidence · recent — 옛 목적 별칭. 조건(status=map · from=RECENT_FROM)으로 펼친다(서가와 같은 변환)
//
// ⚠️ 서버 모듈을 import 하지 않는다(클라이언트 · 회귀가 쓴다). 원문 · 정답 · 해설은 이 모양에 없다.

import { EMPTY_FILTER, filterBrowse, type BrowseCatalog, type BrowseExam, type BrowseFilter, type BrowseItem, type BrowseType } from './browse-model'
import { QUERY_MAX } from './browse-search'
import { browseHref, browseReturn, parseBrowseParams, type BrowseParams, type BrowsePurpose } from './browse-url'
import { fromItemSlug, toItemSlug } from './item-slug'
import { killerTypeIds } from './space-model'
import { RECENT_FROM } from './trap-atlas'

export interface FinderSelection {
  filter: BrowseFilter
  /** 필터 밖 목적 — 지금은 killer 만 별도 상태다(evidence · recent 는 조건 자체) */
  purpose: BrowsePurpose | null
}

export const EMPTY_SELECTION: FinderSelection = { filter: EMPTY_FILTER, purpose: null }

/**
 * 주소 조건 → 선택. 서가의 첫 상태와 팝업의 시작 조건이 같은 변환을 쓴다.
 * 카탈로그에 없는 유형 · 회차는 「전체」 로(서가의 기존 동작).
 */
export function selectionFromParams(entry: BrowseParams, catalog?: Pick<BrowseCatalog, 'types' | 'exams'>): FinderSelection {
  const typeOk = (id: string | undefined) => (id && (!catalog || catalog.types.some((t) => t.id === id)) ? id : 'all')
  const examOk = (id: string | undefined) => (id && (!catalog || catalog.exams.some((e) => e.id === id)) ? id : 'all')
  const filter: BrowseFilter = {
    ...EMPTY_FILTER,
    type: typeOk(entry.type),
    status: entry.status ?? 'all',
    from: entry.from ?? 'all',
    exam: examOk(entry.exam),
    query: entry.query ?? '',
    kind: entry.kind ?? 'all',
    year: entry.year ?? 'all',
    grade: entry.grade ?? 'all',
  }
  // 옛 목적 링크(?purpose=evidence · recent)는 조건으로 펼친다 — 주소의 status · from 보다 목적이 우선(서가의 기존 동작)
  if (entry.purpose === 'evidence') filter.status = 'map'
  if (entry.purpose === 'recent') filter.from = RECENT_FROM
  return { filter, purpose: entry.purpose === 'killer' ? 'killer' : null }
}

/** 검증된 서가 주소(`ret`) → 선택. 서가 주소가 아니면 null */
export function selectionFromBrowseHref(href: string | null | undefined, catalog?: Pick<BrowseCatalog, 'types' | 'exams'>): FinderSelection | null {
  const safe = browseReturn(href)
  if (!safe) return null
  const q = new URLSearchParams(safe.split('?')[1] ?? '')
  return selectionFromParams(parseBrowseParams(Object.fromEntries(q.entries())), catalog)
}

/** 선택 → 서가 주소 */
export function selectionHref(sel: FinderSelection): string {
  return browseHref(sel.filter, sel.purpose)
}

export function sameSelection(a: FinderSelection, b: FinderSelection): boolean {
  return selectionHref(a) === selectionHref(b)
}

export function selectionIsEmpty(sel: FinderSelection): boolean {
  return sameSelection(sel, EMPTY_SELECTION)
}

/**
 * 팝업의 회차 열 ↔ 서가의 `exam` 조건. 팝업은 회차를 조건 대신 **회차 열의 선택**으로 보인다
 * (조건으로 두면 회차 열에 그 회차 하나만 남아 다른 회차로 옮길 수 없다). 시작할 때 꺼내고, 확정할 때 다시 싣는다.
 */
export function splitExam(sel: FinderSelection): { sel: FinderSelection; examId: string | null } {
  const exam = sel.filter.exam && sel.filter.exam !== 'all' ? sel.filter.exam : null
  return { sel: { ...sel, filter: { ...sel.filter, exam: 'all' } }, examId: exam }
}

export function withExam(sel: FinderSelection, examId: string | null): FinderSelection {
  return { ...sel, filter: { ...sel.filter, exam: examId ?? 'all' } }
}

let killerSet: Set<string> | null = null
const killers = () => (killerSet ??= new Set(killerTypeIds()))

/** 선택에 맞는 문항 — 필터(AND) 뒤 목적(killer) 제한. 서가와 팝업이 같은 함수를 쓴다 */
export function applySelection(catalog: BrowseCatalog, sel: FinderSelection): BrowseItem[] {
  const all = filterBrowse(catalog, sel.filter)
  return sel.purpose === 'killer' ? all.filter((i) => killers().has(i.type_id)) : all
}

/** 결과 집합의 회차 묶음(최근 회차부터 · 회차 안은 번호 순) */
export function finderExams(catalog: BrowseCatalog, items: BrowseItem[]): { exam: BrowseExam; count: number }[] {
  const n = new Map<string, number>()
  for (const i of items) n.set(i.exam_id, (n.get(i.exam_id) ?? 0) + 1)
  return catalog.exams.filter((e) => n.has(e.id)).map((e) => ({ exam: e, count: n.get(e.id)! }))
}

/** 회차 열 → 문항 열. 회차를 안 골랐으면 일치 문항 전부(회차 순 · 번호 순) */
export function finderItems(catalog: BrowseCatalog, items: BrowseItem[], examId: string | null): BrowseItem[] {
  const order = new Map(catalog.exams.map((e, i) => [e.id, i]))
  return items
    .filter((i) => !examId || i.exam_id === examId)
    .sort((a, b) => (order.get(a.exam_id) ?? 0) - (order.get(b.exam_id) ?? 0) || a.no - b.no)
}

/**
 * 조건 · 검색이 바뀐 뒤 선택을 다시 맞춘다 — 결과에 없는 회차 · 문항 선택은 해제한다
 * (안 그러면 이전 요약이 보이는데 목록에는 없는 문항을 「탐구 열기」 할 수 있다).
 */
export function reconcilePick(items: BrowseItem[], examId: string | null, itemId: string | null): { examId: string | null; itemId: string | null } {
  const exam = examId && items.some((i) => i.exam_id === examId) ? examId : null
  const item = itemId && items.some((i) => i.id === itemId && (!exam || i.exam_id === exam)) ? itemId : null
  return { examId: exam, itemId: item }
}

// ── 응답 모양(서버 → 팝업) ─────────────────────────────────────────────────

/** 팝업이 받는 문항 한 줄 — 메타데이터만. 정답 · 발문 · 지문 · 선지 · 분석 · 대본 · 개인 기록은 없다 */
export interface FinderItem {
  id: string
  exam_id: string
  no: number
  type_id: string
  points: number | null
  lecture: boolean
  sec: number
  map: boolean
}

export const FINDER_ITEM_KEYS = ['id', 'exam_id', 'no', 'type_id', 'points', 'lecture', 'sec', 'map'] as const
export const FINDER_EXAM_KEYS = ['id', 'label', 'kind', 'year', 'month', 'grade', 'items'] as const
export const FINDER_TYPE_KEYS = ['id', 'name', 'status', 'items'] as const

export interface FinderCatalog {
  items: FinderItem[]
  exams: BrowseExam[]
  types: BrowseType[]
}

const pick = <T extends object, K extends readonly string[]>(o: T, keys: K) =>
  Object.fromEntries(keys.map((k) => [k, (o as Record<string, unknown>)[k]])) as Record<K[number], unknown>

/**
 * 공개 가능한 집합만 남겨 응답 모양으로 — 보류 문항을 빼고 회차 · 유형 개수를 **다시 센다**
 * (원본 카탈로그의 개수를 그대로 쓰면 보류 회차가 「0문항」 이나 틀린 수로 남는다). 키는 allowlist 로만 싣는다.
 */
export function projectFinderCatalog(catalog: BrowseCatalog, held: (itemId: string) => boolean): FinderCatalog {
  const items = catalog.items.filter((i) => !held(i.id)).map((i) => pick(i, FINDER_ITEM_KEYS) as unknown as FinderItem)
  const examN = new Map<string, number>()
  const typeN = new Map<string, number>()
  for (const i of items) {
    examN.set(i.exam_id, (examN.get(i.exam_id) ?? 0) + 1)
    typeN.set(i.type_id, (typeN.get(i.type_id) ?? 0) + 1)
  }
  return {
    items,
    exams: catalog.exams.filter((e) => examN.has(e.id)).map((e) => ({ ...(pick(e, FINDER_EXAM_KEYS) as unknown as BrowseExam), items: examN.get(e.id)! })),
    types: catalog.types.filter((t) => typeN.has(t.id)).map((t) => ({ ...(pick(t, FINDER_TYPE_KEYS) as unknown as BrowseType), items: typeN.get(t.id)! })),
  }
}

/** 팝업 응답 → 서가 카탈로그 모양(같은 필터 함수를 쓰려고) */
export function asBrowseCatalog(c: FinderCatalog): BrowseCatalog {
  return { items: c.items, exams: c.exams, types: c.types, error: null }
}

/** 열기 직전 재검증 결과 */
export type FinderVerify = 'open' | 'held' | 'missing' | 'error'

/** 문항 id 형식 — 회차 id 문법(exam-id) + `#` + 1~2자리 번호. 아니면 null */
export function parseFinderItemId(raw: string | null | undefined): string | null {
  if (!raw) return null
  return /^(?:\d{4}[AB]?|M\d{4}|H\d{4}G[123])#\d{1,2}$/.test(raw) ? raw : null
}

// ── 이동 주소 ─────────────────────────────────────────────────────────────

/**
 * 찾기로 고른 다른 문항의 주소. 언제나 기본 장면(`scene=task`)에서 시작한다.
 * 실어 가는 것은 **검증된 복귀 문맥뿐**이다 — 서가 조건 `ret`(browseReturn) · 지도 복귀 `from=map` + task/ws/step(호출부가 검증한 조각).
 * 비교 `pair` · `back`, 원문 이해 `meaning` · `rel` · `depth` · `bridge`, 독립 확인 `check` 는 넘기지 않는다
 * (다른 문항을 원래 확인 과제의 수행으로 세지 않는다).
 */
export function finderItemHref(itemId: string, ctx: { ret?: string | null; fromMap?: boolean; mapCtxQuery?: string }): string {
  const q = ['scene=task']
  const ret = browseReturn(ctx.ret)
  if (ret) q.push(`ret=${encodeURIComponent(ret)}`)
  if (ctx.fromMap) q.push('from=map')
  const tail = ctx.fromMap && ctx.mapCtxQuery && /^(&(task|ws|step)=[^&#]*)*$/.test(ctx.mapCtxQuery) ? ctx.mapCtxQuery : ''
  return `/csat/item/${toItemSlug(itemId)}?${q.join('&')}${tail}`
}

/** 원래 문항 주소에 남겨도 되는 쿼리 키(상태 복원용) — check 는 없다 */
const RETURN_KEYS = new Set(['scene', 'judgmentView', 'meaning', 'depth', 'rel', 'bridge', 'pair', 'back', 'ret', 'from', 'task', 'ws', 'step'])

/**
 * 「찾기 전 문항으로」 주소 — 내부 문항 경로 + 허용 쿼리만. 외부 · `javascript:` · 다중 인코딩 · 다른 경로는 null.
 * 값은 다시 인코딩한다(원래 값을 문자열로 이어 붙이지 않는다).
 */
export function safeItemReturn(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 1000) return null
  if (!raw.startsWith('/csat/item/') || raw.startsWith('//') || /[\\\s]/.test(raw)) return null
  let u: URL
  try {
    u = new URL(raw, 'http://x')
  } catch {
    return null
  }
  if (u.origin !== 'http://x') return null
  const m = u.pathname.match(/^\/csat\/item\/([A-Za-z0-9]+-\d{1,2})$/)
  if (!m || !parseFinderItemId(fromItemSlug(m[1]))) return null
  const out = new URLSearchParams()
  for (const [k, v] of u.searchParams) {
    if (!RETURN_KEYS.has(k)) continue
    if (/[\u0000-\u001f]/.test(v) || v.length > 300) return null
    // 서가 주소는 그 자체가 인코딩된 검색어를 품는다 — 서가 경로 검증(browseReturn)만 통과하면 된다
    if (k === 'ret') {
      if (browseReturn(v)) out.set(k, v)
      continue
    }
    // 다중 인코딩 — 한 번 풀어도 %XX 가 남으면 버린다
    if (/%[0-9a-f]{2}/i.test(v)) return null
    out.set(k, v)
  }
  const s = out.toString()
  return `${u.pathname}${s ? `?${s}` : ''}`
}

// ── 탭 메모리: 「찾기 전 문항으로」 ────────────────────────────────────────
// 모듈 변수다 — 클라이언트 라우트 전환에는 살아 있고, 새로 고침 · 탭 종료에는 사라진다(보장하지 않는다고 안내).
// 주소만 담는다(노트 · 초안 원문은 담지 않는다). sessionStorage · 이벤트 · API 로 보내지 않는다.

let origin: { to: string; href: string } | null = null

/** 찾기로 다른 문항에 갈 때 — 원래 문항 주소(검증한 것만)와 도착 문항을 적어 둔다 */
export function rememberFinderOrigin(fromHref: string, toItemId: string): void {
  const href = safeItemReturn(fromHref)
  origin = href ? { to: toItemId, href } : null
}

/** 지금 문항이 찾기로 도착한 곳이면 원래 문항 주소. 아니면 null */
export function finderOriginFor(itemId: string): string | null {
  return origin && origin.to === itemId ? origin.href : null
}

export function clearFinderOrigin(): void {
  origin = null
}

/** 검색어 상한(입력 maxLength) */
export const FINDER_QUERY_MAX = QUERY_MAX
