// apps/web/src/lib/admin/pending-words/queue.ts
//
// pending_words 큐 조회 — /admin/pending-words 가 화면에 그리는 모든 수치의 유일한 출처.
//
// ── 왜 페이지에서 떼어 냈나 ────────────────────────────────────────────
// 화면이 직접 질의하던 동안 **세 질의 모두 `error` 를 버리고 있었다**. DB 장애·RLS 거부가
// 전부 `rows=[]` 로 내려앉아 화면은 "큐가 비어있습니다." + "대기 중 0" 을 띄웠고,
// 관리자는 할 일이 없다고 믿었다. 같은 사고를 이 저장소는 이미 두 번 겪었다
// (lib/textbook/console-stats.ts · lib/admin/dashboard-stats.ts 의 safeCount 주석 참조).
//
// 그래서 규약은 하나다:
//   **실패는 `null`(모름)이고, 0/[] 은 "정말 없다" 다.** 화면은 둘을 다르게 그려야 한다.
//   `count ?? 0` 은 금지 — head:true 카운트는 없는 테이블에도 204/count=null 을 준다.
//
// 분류(triage)도 마찬가지다. `unresolved_dict_words` RPC 가 실패하면 "해석되는 후보" 집합이
// 통째로 비고, 그러면 **모든 후보가 사전에 있는 것으로 뒤집혀** 진성 갭이 0 이 된다.
// 그 상태로 "철자 변이" 가 부풀면 관리자는 존재하지도 않는 해석기 버그를 고치러 간다.
// 여기서는 그때 분류를 아예 내지 않는다 — bucket = null(판정 불가).

import type { SupabaseClient } from '@supabase/supabase-js'

import { BUCKET_META, classifyPending, triageCandidates, type PendingBucket } from './triage'

/** pending_words.status CHECK 제약과 같은 5값 (20260812133000_restore_pending_words.sql). */
export const PENDING_STATUSES = [
  'pending',
  'reviewing',
  'auto-classify',
  'rejected',
  'added',
] as const

export type PendingWordStatus = (typeof PENDING_STATUSES)[number]

/** 목록 필터 — 'all' 은 상태를 가리지 않는다. 배열 순서가 화면 탭 순서다. */
export const STATUS_FILTERS = [
  'pending',
  'reviewing',
  'auto-classify',
  'added',
  'rejected',
  'all',
] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

/**
 * 기본 필터가 'pending' 인 이유: 처리한 행이 목록에 남아 자리를 잠식하면 26,000행짜리 큐의
 * 꼬리는 화면에 영영 도달하지 못한다. 기본값은 "아직 손대지 않은 것" 이어야 한다.
 */
export const DEFAULT_STATUS_FILTER: StatusFilter = 'pending'

export const DEFAULT_PAGE_SIZE = 100
export const MAX_PAGE_SIZE = 200

const COLUMNS =
  'id, lemma, surface, encounter_count, doc_freq, status, admin_note, created_at, updated_at'

export interface PendingWordRow {
  id: string
  lemma: string
  surface: string | null
  encounter_count: number
  doc_freq: number
  status: PendingWordStatus
  admin_note: string | null
  created_at: string
  updated_at: string
}

/** bucket = null → 분류 판정 불가(사전 조회 실패). 'genuine_gap' 으로 뭉개지 않는다. */
export interface ClassifiedPendingRow extends PendingWordRow {
  bucket: PendingBucket | null
}

/** 값 하나와 "왜 못 쟀는지". value === null 은 언제나 **모름**이다. */
export interface Measured<T> {
  value: T | null
  error: string | null
}

export interface PendingQueueQuery {
  status: StatusFilter
  /** 1-based */
  page: number
  pageSize: number
}

export interface PendingQueueView {
  query: PendingQueueQuery
  /** 이 페이지의 행. null = 목록을 못 읽었다(0행이 아니다). */
  rows: Measured<ClassifiedPendingRow[]>
  /** 필터에 걸린 전체 행 수. null = 모름 */
  matched: Measured<number>
  /** status='pending' 전체 카운트. null = 모름 */
  pendingCount: Measured<number>
  /** status='added' 누적 카운트. null = 모름 */
  addedCount: Measured<number>
  /** 사전 조회 실패 사유. null 이 아니면 이 페이지의 분류는 전부 판정 불가다. */
  triageError: string | null
  /** 이 페이지 안에서의 버킷 분포. triageError 가 있으면 null. */
  bucketCounts: Record<PendingBucket, number> | null
  /** matched 를 못 쟀으면 null. */
  totalPages: number | null
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** URL 쿼리 → 정규화된 질의. 이상한 값은 조용히 기본값으로 되돌린다(빈 화면 방지). */
export function parsePendingQueueQuery(
  params: Record<string, string | string[] | undefined> | undefined,
): PendingQueueQuery {
  const raw = params ?? {}

  const rawStatus = firstParam(raw.status)
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(rawStatus ?? '')
    ? (rawStatus as StatusFilter)
    : DEFAULT_STATUS_FILTER

  const rawPage = Number(firstParam(raw.page))
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1

  const rawSize = Number(firstParam(raw.size))
  const pageSize =
    Number.isFinite(rawSize) && rawSize >= 10
      ? Math.min(Math.floor(rawSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE

  return { status, page, pageSize }
}

/** 쿼리스트링 만들기 — 기본값은 URL 에 남기지 않는다(공유한 링크가 짧아진다). */
export function pendingQueueHref(query: PendingQueueQuery): string {
  const sp = new URLSearchParams()
  if (query.status !== DEFAULT_STATUS_FILTER) sp.set('status', query.status)
  if (query.page > 1) sp.set('page', String(query.page))
  if (query.pageSize !== DEFAULT_PAGE_SIZE) sp.set('size', String(query.pageSize))
  const qs = sp.toString()
  return qs ? `/admin/pending-words?${qs}` : '/admin/pending-words'
}

interface SettledResponse {
  data: unknown
  error: string | null
  count: number | null
}

function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

/**
 * 질의 하나를 "값 아니면 사유" 로 만든다.
 * ⚠️ 오류를 삼켜 빈 값으로 바꾸지 않는다 — 사유를 그대로 위로 올려 화면이 말하게 한다.
 */
async function settle(
  run: () => PromiseLike<{ data?: unknown; error?: unknown; count?: number | null }>,
): Promise<SettledResponse> {
  try {
    const res = await run()
    if (res?.error) return { data: null, error: messageOf(res.error), count: null }
    return { data: res?.data ?? null, error: null, count: res?.count ?? null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err), count: null }
  }
}

/**
 * head 카운트 응답 → Measured.
 * ⚠️ `count ?? 0` 금지. head:true 요청은 **없는 테이블에도 204 · error=null · count=null** 을
 * 돌려준다(실측: reports). 0 으로 뭉개면 "대기 0건" 이라는 거짓 안심이 화면에 박힌다.
 */
function measuredCount(res: SettledResponse): Measured<number> {
  if (res.error) return { value: null, error: res.error }
  if (res.count === null) {
    return { value: null, error: '카운트를 세지 못했습니다 (테이블 부재 또는 권한 차단).' }
  }
  return { value: res.count, error: null }
}

/** 분류에 필요한 사전 조회 결과. resolvable = null 이면 판정 불가. */
export interface TriageLookup {
  resolvable: Set<string> | null
  error: string | null
}

/**
 * 후보를 한 번의 배치 RPC 로 조회한다 (N+1 회피).
 * 실패하면 빈 집합이 아니라 **null** 을 돌려준다 — 빈 집합은 "아무것도 해석 안 됨" 이라는
 * 정반대 결론이고, 그러면 하이픈/철자/파생이 전부 진성 갭으로 뒤집힌다.
 */
export async function lookupResolvable(
  client: SupabaseClient,
  candidates: string[],
): Promise<TriageLookup> {
  if (candidates.length === 0) return { resolvable: new Set<string>(), error: null }

  const res = await settle(() =>
    client.rpc('unresolved_dict_words' as never, { p_words: candidates } as never),
  )
  if (res.error) return { resolvable: null, error: res.error }
  if (!Array.isArray(res.data)) {
    return { resolvable: null, error: 'unresolved_dict_words 가 목록을 돌려주지 않았습니다.' }
  }

  const resolvable = new Set(candidates)
  for (const w of res.data as unknown[]) resolvable.delete(String(w))
  return { resolvable, error: null }
}

/** 페이지 안의 버킷 분포. 판정 불가(bucket=null)는 세지 않는다. */
export function countBuckets(rows: ClassifiedPendingRow[]): Record<PendingBucket, number> {
  const acc: Record<PendingBucket, number> = {
    genuine_gap: 0,
    derived_form: 0,
    spelling_variant: 0,
    hyphen_compound: 0,
  }
  for (const r of rows) {
    if (r.bucket) acc[r.bucket] += 1
  }
  return acc
}

/**
 * 화면 한 장에 필요한 것을 전부 읽는다.
 *
 * 목록 질의에 `count: 'exact'` 를 함께 걸어 **필터에 걸린 전체 행 수**를 같은 왕복에서 얻는다
 * — 마지막 페이지 번호가 여기서 나온다.
 */
export async function loadPendingQueue(
  client: SupabaseClient,
  query: PendingQueueQuery,
): Promise<PendingQueueView> {
  const from = (query.page - 1) * query.pageSize
  const to = from + query.pageSize - 1

  const [listRes, pendingRes, addedRes] = await Promise.all([
    settle(() => {
      let q = client.from('pending_words').select(COLUMNS, { count: 'exact' })
      if (query.status !== 'all') q = q.eq('status', query.status)
      // 넓이(몇 편에 나왔나) 먼저, 총량은 그다음 — 한 문서에서 반복된 토큰이 총량만으로 위에
      // 오는 것을 막는다(2026-08-25: 한 편에서 107번 나온 비영어 토큰이 12편에 걸친 실단어보다
      // 위에 있었다). doc_freq 0 = 미집계라 기존 행끼리는 종전과 같은 순서로 남는다.
      return q
        .order('doc_freq', { ascending: false })
        .order('encounter_count', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)
    }),
    settle(() =>
      client
        .from('pending_words')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ),
    settle(() =>
      client.from('pending_words').select('*', { count: 'exact', head: true }).eq('status', 'added'),
    ),
  ])

  const listError =
    listRes.error ?? (Array.isArray(listRes.data) ? null : '목록 응답이 배열이 아닙니다.')
  const rawList = listError ? [] : ((listRes.data ?? []) as PendingWordRow[])

  // ── 조치별 분류 ──
  //   후보는 **해석 가능성**으로 물어야 한다 (표제어 직접 존재가 아니라).
  //   표제어 존재로 검사하면 굴절형이 전부 미스난다 — "kilowatt-hours" 의 hours,
  //   "mislabeled" 의 labeled 가 표제어가 아니라 오분류됐다(실측).
  const candidates = [...new Set(rawList.flatMap((r) => triageCandidates(r.lemma)))]
  const lookup: TriageLookup = listError
    ? { resolvable: null, error: null }
    : await lookupResolvable(client, candidates)

  const resolvable = lookup.resolvable
  const classified: ClassifiedPendingRow[] = rawList.map((r) => ({
    ...r,
    bucket: resolvable ? classifyPending(r.lemma, resolvable) : null,
  }))

  // 등재 1순위(진성 갭)를 위로. 판정 불가일 때는 DB 정렬을 그대로 둔다 —
  // 근거 없는 순서를 만들어 "위에 있는 게 급한 것" 이라는 오해를 주지 않기 위함이다.
  if (resolvable) {
    classified.sort((a, b) => {
      const pa = a.bucket ? BUCKET_META[a.bucket].priority : Number.MAX_SAFE_INTEGER
      const pb = b.bucket ? BUCKET_META[b.bucket].priority : Number.MAX_SAFE_INTEGER
      return pa - pb
    })
  }

  const matched: Measured<number> = listError
    ? { value: null, error: listError }
    : {
        value: listRes.count,
        error: listRes.count === null ? '전체 행 수를 세지 못했습니다.' : null,
      }

  const totalPages =
    matched.value === null ? null : Math.max(1, Math.ceil(matched.value / query.pageSize))

  return {
    query,
    rows: listError ? { value: null, error: listError } : { value: classified, error: null },
    matched,
    pendingCount: measuredCount(pendingRes),
    addedCount: measuredCount(addedRes),
    triageError: lookup.error,
    bucketCounts: resolvable ? countBuckets(classified) : null,
    totalPages,
  }
}
