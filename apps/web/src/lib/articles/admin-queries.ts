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
//   그래서 집계는 `count: 'exact', head: true`(행을 안 받는 서버 카운트)로,
//   목록은 상태·소스 필터 + `.range()` 로만 읽는다.

import 'server-only'

import { createClient } from '@/lib/supabase/server'
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
    select(columns: string, opts?: { count?: 'exact'; head?: boolean }): Builder
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
    const { count, error } = await build(sb.from(TABLE).select('*', { count: 'exact', head: true }))
    if (!error && count != null) return count
    last = error?.message || '(오류 메시지 없음 — 동시 요청 과부하일 때 이렇게 온다)'
  }
  // 끝내 못 셌으면 던진다 — 0 으로 접으면 "글이 없다" 와 "못 읽었다" 가 같은 화면이 된다.
  throw new Error(`ACP ${label} 카운트 실패(3회 시도): ${last}`)
}

/**
 * 동시 실행 수를 묶어 돌린다.
 *
 * `Promise.all` 로 31개를 한꺼번에 보내면 서버가 몇 개를 빈 오류로 돌려준다. 재시도만으로도
 * 대부분 넘어가지만, 애초에 몰아치지 않는 편이 재시도 횟수도 줄이고 전체 시간도 짧다
 * (실측: 한 건 ~1.5초라 6개씩 나누면 31개가 여섯 물결 ≈ 9초, 재시도 0회).
 */
async function mapPooled<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor
      cursor += 1
      if (i >= items.length) return
      out[i] = await fn(items[i] as T, i)
    }
  })
  await Promise.all(workers)
  return out
}

/**
 * 상태별 서버 카운트 — 상단 타일 · 상태 칩 · 페이지네이션 분모의 **유일한** 출처.
 *
 * 전체(total)를 상태 합으로 대신하지 않는다. 둘이 어긋나면 스키마에 우리가 모르는 상태가
 * 생겼다는 뜻이고, 그건 화면이 조용히 일부를 빠뜨리고 있다는 신호다.
 */
export async function getArticleStatusCounts(): Promise<ArticleStatusCounts> {
  const sb = await db()
  const specs = ['전체' as const, ...ALL_ARTICLE_STATUSES]
  const [total, ...perStatus] = await mapPooled(specs, 4, (s) =>
    s === '전체'
      ? countRows((b) => b, '전체', sb)
      : countRows((b) => b.eq('status', s), s, sb),
  )

  const out = emptyStatusCounts()
  out.total = total
  ALL_ARTICLE_STATUSES.forEach((s, i) => {
    out.byStatus[s] = perStatus[i] ?? 0
  })
  return out
}

/**
 * 커버리지 매트릭스 30칸의 발행 건수 — 칸마다 서버 카운트 한 번(30 + 1).
 *
 * 발행분만 훑어 세지 않는 이유: 발행이 293건인 지금은 그래도 맞지만, 늘어나는 순간
 * 같은 1,000행 절단을 다시 밟는다. 칸 수는 표 크기(5×6)로 고정이라 데이터가 아무리
 * 자라도 질의 수가 그대로다.
 */
export async function getPublishedCoverage(): Promise<CoverageCounts> {
  const sb = await db()
  const cellSpecs = REGISTERS.flatMap((r) => CEFR_ORDER.map((c) => ({ register: r.key, cefr: c })))

  // 31개를 한꺼번에 보내면 서버가 몇 개를 **본문 없는 오류**로 돌려준다(실측). 6개씩 나눈다.
  const all = await mapPooled(
    [null, ...cellSpecs] as const,
    6,
    (s) =>
      s === null
        ? countRows((b) => b.eq('status', 'published'), '발행', sb)
        : countRows(
            (b) => b.eq('status', 'published').eq('register', s.register).eq('cefr_level', s.cefr),
            `발행 ${s.register}×${s.cefr}`,
            sb,
          ),
  )
  const [publishedTotal, ...cellCounts] = all

  const cells: Record<string, number> = {}
  let inMatrix = 0
  cellSpecs.forEach((s, i) => {
    const n = cellCounts[i] ?? 0
    cells[coverageKey(s.register, s.cefr)] = n
    inMatrix += n
  })

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
