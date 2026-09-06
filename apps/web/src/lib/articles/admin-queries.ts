// apps/web/src/lib/articles/admin-queries.ts
// ACP v1.0 — /admin/articles 서버 전용 데이터 fetch.
// (타입/순수 헬퍼는 ./types · ./console-view — client 측에서도 import 가능)
//
// ⚠️ 이 파일의 규칙 하나: **세는 일은 DB 가 한다.**
//   `library_articles` 는 87,968행이고 PostgREST 는 한 응답을 조용히 1,000행에서 자른다.
//   예전 `listAdminArticles()` 는 limit 도 상태 필터도 없이 전 컬럼을 `.order(updated_at)`
//   로 긁어, 최신 1,000행(거의 queued/ready)만 받아 왔다. 오류는 나지 않는다 —
//   대신 상단 타일이 "전체 1,000 · 게시됨 0" 이라 답하고, 발행 293건이 4발행 탭에서
//   통째로 사라지고, 커버리지 30칸이 전부 GAP 으로 칠해지고, 그 거짓 GAP 을 근거로
//   소스 추천까지 나갔다(2026-09-05 실측).
//
//   그래서 재고 집계는 **RPC 한 번**(`acp_article_rollup()` — 그룹 스캔 1회, 정확값)으로,
//   조건부 단건 카운트만 `count: 'estimated', head: true` 로, 목록은 상태·소스 필터 +
//   `.range()` 로 읽는다. 카운트를 38개 동시에 던지던 시절에는 서버가 몇 개를 **본문 없는
//   오류**로 돌려줘 화면이 콘솔에 오류를 14건 뱉었다(2026-09-06 런타임 훑기 실측).

import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pagedSelect } from '@/lib/supabase/paged-select'

import { CEFR_ORDER, REGISTERS, coverageKey } from './source-guide'
import {
  ALL_ARTICLE_STATUSES,
  emptyStatusCounts,
  type ArticleAdminRow,
  type ArticleStatus,
  type ArticleStatusCounts,
  type CoverageCounts,
  type SourceFeedHealth,
} from './types'

export type {
  ArticleAdminRow,
  ArticleStats,
  ArticleStatus,
  ArticleStatusCounts,
  CoverageCounts,
  SourceFeedHealth,
} from './types'
export {
  classifyArticleStatus,
  statsFromCounts,
  ARTICLE_IN_PROGRESS_STATUSES,
} from './types'

const TABLE = 'library_articles'

const LIST_COLUMNS =
  'id, source, source_id, source_url, title, author, cefr_level, cefr_confidence, word_count, ' +
  'reading_minutes, status, status_message, license, license_class, register, lexical_noise, ' +
  'display_only, audio_url, article_v_level, copyright_safe_in_kr, published_at, llm_cost_usd, ' +
  'created_at, updated_at'

// ── PostgREST 빌더의 최소 형태 ──────────────────
// @vocaflow/types 의 생성 타입은 이 표에 아직 좁게 물려 있어(기존 코드도 캐스팅했다)
// 필요한 체이닝만 선언해 쓴다. 반환 형태는 supabase-js 와 동일하다.

interface QueryResult {
  data: unknown[] | null
  count: number | null
  error: { message: string } | null
}

interface Builder extends PromiseLike<QueryResult> {
  eq(column: string, value: unknown): Builder
  in(column: string, values: readonly unknown[]): Builder
  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): Builder
  range(from: number, to: number): Builder
}

interface LooseDb {
  from(table: string): {
    select(columns: string, opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): Builder
  }
}

async function db(): Promise<LooseDb> {
  return (await createClient()) as unknown as LooseDb
}

/**
 * 서버 카운트 한 건.
 *
 * ⚠️ `count ?? 0` 로 접지 않는다 — 없는 테이블·권한 차단도 head 요청에는 204/count=null
 *    로 돌아온다. 0 으로 접으면 "데이터가 없다" 와 "못 읽었다" 가 같은 화면이 된다.
 *    실패는 던져서 admin 에러 경계(app/admin/error.tsx)가 메시지째 보여 주게 한다.
 */
async function countRows(
  build: (b: Builder) => Builder,
  label: string,
  sb: LooseDb,
): Promise<number> {
  // ⚠️ 재시도가 없으면 이 화면이 콘솔에 **오류 14건**을 뱉는다(런타임 훑기 실측 2026-09-06:
  //    `[uncaught] ACP queued 카운트 실패: ` — 메시지가 **빈 문자열**이었다).
  //    한 건은 빠르다(`status='queued'` 5.2만 행이 EXPLAIN 1.56초, 인덱스 스캔). 문제는
  //    **한꺼번에 던지는 수**다 — 커버리지는 31개를 동시에 보내고, 그러면 서버가 몇 개를
  //    본문 없는 오류로 돌려준다. 같은 함정을 `lib/admin/dict/queries.ts` 가 먼저 겪고
  //    백오프 재시도로 풀었다. 그 패턴을 그대로 쓴다.
  const backoffs = [0, 250, 700]
  let last = ''
  for (let attempt = 0; attempt < backoffs.length; attempt += 1) {
    const wait = backoffs[attempt] ?? 0
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    // ⚠️ `exact` 가 아니라 `estimated` — 재시도만으로는 못 고쳤다(실측 2026-09-06).
    //    `library_articles` 는 8.9만 행이고 `status='queued'` 만 5.2만이라, `exact` 는
    //    2만 행쯤부터 **아무 말 없이 시간초과**한다(오류 message 가 빈 문자열).
    //    세 번 다시 물어도 같다 — 느린 게 아니라 이 크기에서는 되지 않는다.
    //    `estimated` 는 작은 표엔 정확값을, 큰 표엔 플래너 추정치(오차 <1%)를 준다.
    //    `lib/admin/dashboard-stats.ts` 의 `head()` 주석에 세 모드 실측표가 있다.
    const { count, error } = await build(
      sb.from(TABLE).select('*', { count: 'estimated', head: true }),
    )
    if (!error && count != null) return count
    last = error?.message || '(오류 메시지 없음 — 동시 요청 과부하일 때 이렇게 온다)'
  }
  // 끝내 못 셌으면 던진다 — 0 으로 접으면 "글이 없다" 와 "못 읽었다" 가 같은 화면이 된다.
  throw new Error(`ACP ${label} 카운트 실패(3회 시도): ${last}`)
}

interface RollupRow {
  register: string | null
  cefr_level: string | null
  items: number
}

/**
 * 커버리지 집계 — **발행분만** 훑는 인덱스 스캔 1회(`acp_article_rollup()`).
 *
 * ── 왜 RPC 로 갔나 (2026-09-06) ──────────────────────────────────────
 * 예전에는 커버리지 31칸을 **카운트 31개로 동시에** 던졌다. 그러면 서버가 몇 개를 **본문 없는
 * 오류**로 돌려주고, 화면은 콘솔에 오류를 14건 뱉었다(런타임 훑기 실측). 재시도·동시성
 * 제한·`estimated` 모드를 차례로 넣었지만 증상이 줄되 다른 화면으로 옮겨 갔을 뿐이다.
 *
 * ⚠️ **첫 판은 틀렸다 — 두 번 고쳤다.**
 *   ① 전량(91,356행)을 `group by status, register, cefr_level` 로 훑는 함수를 만들었다.
 *      근거로 쓴 `EXPLAIN ANALYZE` 8,902ms 는 `postgres` 로 직접 잰 값이라 **실제 경로를
 *      대표하지 못했다.** PostgREST 경유로 재 보니 **29,816ms** 였고, `authenticator` 역할의
 *      `statement_timeout=8s` 에 걸려 `canceling statement due to statement timeout` 으로 죽었다.
 *   ② 더 근본적으로, 커버리지는 **발행분에만** 해당하는데 그 30칸을 채우려고 queued 5.2만
 *      행까지 훑고 있었다. `where status='published'` 로 좁히니 **75ms / 22ms**(재실행)다.
 *
 *   교훈은 하나다 — **재는 자리가 쓰는 자리와 같아야 한다.** 직접 SQL 로 잰 수를 근거로
 *   앱 경로의 성능을 말하면 안 된다.
 *
 * `cache()` 는 요청 단위 dedupe 용이다(같은 화면이 두 번 부르지 않게).
 */
const fetchRollup = cache(async (): Promise<RollupRow[]> => {
  // service_role — RPC 가 security definer 라 admin 게이트 뒤에서만 부른다(호출부가 지킨다).
  const sb = createAdminClient() as unknown as {
    rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  }
  const { data, error } = await sb.rpc('acp_article_rollup')
  if (error) {
    // 실패를 빈 배열로 바꾸지 않는다 — "글이 없다" 와 "못 읽었다" 가 같은 화면이 되면 안 된다.
    throw new Error(`ACP 재고 집계 실패: ${error.message || '(오류 메시지 없음)'}`)
  }
  return (data ?? []) as RollupRow[]
})

/**
 * 상태별 건수 — 상단 타일 · 상태 칩 · 페이지네이션 분모의 **유일한** 출처.
 *
 * 전체(total)를 상태 합으로 대신하지 않는다… 였는데, 롤업은 같은 스캔에서 둘을 함께 내므로
 * 이제 어긋날 수가 없다. 대신 **모르는 상태**가 오면 `total` 에만 세고 `byStatus` 에는 넣지
 * 않는다 — 그 차이가 "스키마에 새 상태가 생겼다" 는 신호로 남는다.
 */
export async function getArticleStatusCounts(): Promise<ArticleStatusCounts> {
  // ⚠️ 이것을 커버리지와 **한 함수에 몰아넣었다가 되돌렸다.** 상태별 건수는 `estimated` head
  //    카운트로 각 124ms 에 이미 되던 길이었는데(실측), 전량 group by 로 합치니 PostgREST
  //    경유 29.8초가 되어 통째로 죽었다. 합치는 것이 늘 싼 것은 아니다 —
  //    커버리지는 발행분 293행만 보면 되고 상태 카운트는 인덱스를 탄다. 각자 싸다.
  const sb = await db()
  const specs = ['전체' as const, ...ALL_ARTICLE_STATUSES]
  const results = await Promise.all(
    specs.map((s) =>
      s === '전체' ? countRows((b) => b, '전체', sb) : countRows((b) => b.eq('status', s), s, sb),
    ),
  )
  const [total, ...perStatus] = results

  const out = emptyStatusCounts()
  out.total = total ?? 0
  ALL_ARTICLE_STATUSES.forEach((s, i) => {
    out.byStatus[s] = perStatus[i] ?? 0
  })
  return out
}

/**
 * 커버리지 매트릭스 30칸의 발행 건수 — **위 롤업 한 번**에서 갈라 낸다.
 *
 * 예전에는 칸마다 카운트를 던져 31개였다. 발행분을 목록으로 받아 세지 않는 이유는 그대로다:
 * 발행이 293건인 지금은 맞지만 늘어나는 순간 1,000행 절단을 다시 밟는다.
 */
export async function getPublishedCoverage(): Promise<CoverageCounts> {
  const rollup = await fetchRollup()

  // 0 인 칸도 키가 있어야 한다 — 없으면 매트릭스가 그 칸을 GAP 이 아니라 "없는 칸" 으로 그린다.
  const cells: Record<string, number> = {}
  for (const r of REGISTERS) {
    for (const c of CEFR_ORDER) cells[coverageKey(r.key, c)] = 0
  }

  // 함수가 이미 `status='published'` 로 좁혀서 준다 — 여기서 또 거르지 않는다.
  let publishedTotal = 0
  let inMatrix = 0
  for (const row of rollup) {
    publishedTotal += row.items
    if (row.register == null || row.cefr_level == null) continue
    const key = coverageKey(row.register, row.cefr_level)
    if (!(key in cells)) continue // 표 밖 값(모르는 register·CEFR) — unclassified 로 흘러간다
    cells[key] = (cells[key] ?? 0) + row.items
    inMatrix += row.items
  }

  return {
    cells,
    publishedTotal,
    // 음수가 나올 수 없다 — 칸 합은 발행 전체의 부분집합이다. 그래도 접어 둔다.
    unclassified: Math.max(0, publishedTotal - inMatrix),
  }
}

export interface ListAdminArticlesOptions {
  /** 이 상태들만. 비우면 상태 조건 없음. */
  statuses?: readonly ArticleStatus[]
  /** library_articles.source 필터 (voa · nasa …). */
  source?: string | null
  /** 0-based 페이지. */
  page?: number
  /** 한 페이지 행 수 — PostgREST 상한(1,000) 이하만 의미가 있다. */
  pageSize?: number
}

/**
 * 지금 목록 조건(상태 + 소스)의 **전체 건수** — 페이지네이션의 분모.
 *
 * 상태 카운트로 대신할 수 없다: 소스를 고르면 분모가 달라지는데 상태 카운트는 소스를
 * 모른다. 분모가 크게 잡히면 "다음" 이 살아 있는 빈 쪽이 생기고, 작게 잡히면 남은
 * 글에 갈 길이 사라진다.
 */
export async function countAdminArticles(
  options: Pick<ListAdminArticlesOptions, 'statuses' | 'source'> = {},
): Promise<number> {
  const { statuses, source = null } = options
  const sb = await db()
  return countRows(
    (b) => {
      let q = b
      if (statuses && statuses.length > 0) q = q.in('status', statuses)
      if (source) q = q.eq('source', source)
      return q
    },
    `목록(${statuses?.join('/') ?? '전체'}${source ? ` · ${source}` : ''})`,
    sb,
  )
}

/**
 * 목록 한 페이지.
 *
 * 인자 없이 부르면 **여전히 잘린다** — 그래서 기본 pageSize 를 두어 "전부 달라" 를
 * 표현할 수 없게 만들었다. 전량이 필요하면 `pagedSelect` 를 쓰는 별도 함수를 만들 것.
 */
export async function listAdminArticles(
  options: ListAdminArticlesOptions = {},
): Promise<ArticleAdminRow[]> {
  const { statuses, source = null } = options
  const pageSize = Math.max(1, Math.min(options.pageSize ?? 100, 1000))
  const page = Math.max(0, options.page ?? 0)
  const from = page * pageSize

  const sb = await db()
  let q = sb.from(TABLE).select(LIST_COLUMNS)
  if (statuses && statuses.length > 0) q = q.in('status', statuses)
  if (source) q = q.eq('source', source)

  const { data, error } = await q
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) {
    throw new Error(
      `ACP 목록 조회 실패 (상태 ${statuses?.join('/') ?? '전체'} · ${page + 1}쪽): ${error.message}`,
    )
  }
  return (data ?? []) as ArticleAdminRow[]
}

/**
 * ACP §18 P2 — 소스/feed 별 후보 현황 집계 (SourceFeedList 용).
 * library_article_seed_catalog 를 JS 에서 집계 (2026-09-05 기준 135행 · 마이그레이션 불요).
 *
 * 행이 적어도 `pagedSelect` 로 읽는다 — 후보 풀은 GET 을 돌릴 때마다 자라고, 1,000행을
 * 넘는 날 조용히 틀린 후보 수를 보여 주면 "왜 GET 해도 안 늘지" 로만 보인다.
 */
export async function listSourceFeedHealth(): Promise<SourceFeedHealth[]> {
  const supabase = await createClient()
  const sb = supabase as unknown as {
    from: (t: string) => { select: (c: string) => Builder }
  }

  type Row = {
    source: string
    feed_id: string | null
    feed_label: string | null
    score_total: number | null
    has_audio: boolean | null
    imported_to_articles: boolean | null
  }

  const rows = await pagedSelect<Row>(
    (from, to) =>
      sb
        .from('library_article_seed_catalog')
        .select('source, feed_id, feed_label, score_total, has_audio, imported_to_articles')
        .range(from, to),
    'ACP 소스 피드 현황',
  )

  const byKey = new Map<string, { h: SourceFeedHealth; scoreSum: number }>()
  for (const r of rows) {
    const feedId = r.feed_id ?? '(default)'
    const key = `${r.source}|${feedId}`
    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        h: {
          source: r.source,
          feedId,
          feedLabel: r.feed_label ?? feedId,
          candidates: 0,
          pending: 0,
          audioN: 0,
          avgScore: 0,
        },
        scoreSum: 0,
      }
      byKey.set(key, entry)
    }
    entry.h.candidates += 1
    if (!r.imported_to_articles) entry.h.pending += 1
    if (r.has_audio) entry.h.audioN += 1
    entry.scoreSum += r.score_total ?? 0
  }

  return Array.from(byKey.values())
    .map(({ h, scoreSum }) => ({
      ...h,
      avgScore: h.candidates > 0 ? Math.round((scoreSum / h.candidates) * 100) / 100 : 0,
    }))
    .sort((a, b) => (a.source === b.source ? b.candidates - a.candidates : a.source.localeCompare(b.source)))
}
