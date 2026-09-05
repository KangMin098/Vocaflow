// apps/web/src/lib/admin/dashboard-stats.ts
//
// /admin 대시보드 실측 집계 — 화면에 뜨는 모든 숫자의 유일한 출처.
//
// 왜 이 파일이 있나:
//   v06.34 까지 /admin 대시보드는 KPI·활동 로그가 전부 코드 상수(목업)였다.
//   "총 사용자 1,247" 같은 값이 실제 3 명과 400 배 어긋난 채 운영 화면 첫 장에 떠 있었다.
//   숫자를 하드코딩하면 반드시 다시 낡으므로, 대시보드는 상수를 쓰지 않는다 — 여기서만 읽는다.
//
// 권한 모델:
//   호출자가 requireAdmin() 을 통과한 뒤 createAdminClient()(service_role) 를 넘긴다.
//   RLS-bound 클라이언트로는 DEV_ADMIN_BYPASS 환경에서 auth.uid()=NULL 이라 전부 빈 값이 된다.
//
// 실패 처리:
//   테이블이 없거나(예: reports — 미구현) 권한이 막히면 해당 항목만 null 을 돌려준다.
//   화면은 null 을 "0" 이 아니라 "미구현/조회 불가" 로 렌더해야 한다 — 0 으로 뭉개면
//   "신고 0건" 처럼 사실이 아닌 안심을 준다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

type AdminClient = SupabaseClient

/** 파이프라인 진행 중(=사람이 기다리는 중) 상태. library_books / library_articles 공통. */
const IN_FLIGHT_BOOK = ['queued', 'ingesting', 'normalizing', 'segmenting', 'analyzing', 'curating']
const IN_FLIGHT_ARTICLE = ['queued', 'ingesting', 'normalizing', 'analyzing', 'curating']
/** PDCP 는 취득→복원→분할→OCR→현대화 5 단계가 전부 "진행 중". review 는 사람 차례라 제외. */
const IN_FLIGHT_PD = ['queued', 'acquired', 'restored', 'segmented', 'ocr', 'modernized']

// ─────────────────────────────────────────────
// 결과 타입
// ─────────────────────────────────────────────

/** null = 조회 실패(테이블 없음 · 권한 차단). 0 과 구분해서 렌더할 것. */
export type Count = number | null

export interface RecentEvent {
  /** ISO timestamp */
  at: string
  /** 파이프라인 약칭 — 뱃지 텍스트 */
  kind: string
  accent: string
  title: string
  detail: string
  href: string
}

export interface DashboardStats {
  books: { published: Count; ready: Count; inFlight: Count; failed: Count; seeds: Count }
  articles: { published: Count; ready: Count; inFlight: Count; failed: Count; seeds: Count }
  comics: { published: Count; draft: Count }
  pdComics: { published: Count; review: Count; inFlight: Count; failed: Count }
  jobs: { pending: Count; running: Count; awaitingMapping: Count; failed: Count }
  vcb: { pending: Count; exported: Count; enriched: Count; flagged: Count; failed: Count }
  vrl: { openConcerns: Count; classified: Count }
  words: { dict: Count; pending: Count; judgments: Count; chapterQuiz: Count }
  learners: { total: Count; activeToday: Count }
  texts: Count
  qualityLastMeasuredAt: string | null
  /** null = reports 테이블 자체가 없음(신고/문의 미구현) */
  reportsOpen: Count
  recent: RecentEvent[]
}

// ─────────────────────────────────────────────
// 저수준 헬퍼
// ─────────────────────────────────────────────

/** supabase-js count 응답의 최소 형태 — 성공/실패 variant 양쪽에 존재하는 필드만 요구. */
interface CountLike {
  count: number | null
  error: unknown
}

/**
 * ⚠️ `count ?? 0` 금지. head:true 요청은 없는 테이블에도 **204 No Content · error=null · count=null**
 * 을 돌려준다 (실측: reports → 404 는 non-head 에서만 뜬다). 0 으로 뭉개면 "미처리 0건" 이라는
 * 거짓 안심이 화면에 박힌다. 실제로 0 행이면 PostgREST 는 count=0 을 준다 — null 은 언제나 "모름".
 */
async function safeCount(query: () => PromiseLike<CountLike>): Promise<Count> {
  // ⚠️ **팩토리를 받는다**(이미 만들어진 쿼리가 아니라). 재시도하려면 다시 만들어야 하기
  //    때문이다 — PostgREST 빌더는 한 번 await 하면 끝이다.
  //
  //    왜 재시도가 필요한가 (실측 2026-09-06): 이 함수는 카운트 **36개를 한꺼번에** 던졌고,
  //    그러면 가장 큰 표들이 오류도 없이 `count=null` 로 돌아온다. 통합 테스트가 두 번
  //    같은 자리를 잡았다 — `articles.ready` · `articles.inFlight` · `vrl.classified` ·
  //    `words.dict`(각각 8.9만·4.9만 행). 화면에서는 그 네 파이프라인이 조용히 「—」가 된다.
  //    한 건씩은 빠르다(1.5초). 문제는 **동시에 던지는 수**다.
  const backoffs = [0, 400, 1200, 2500]
  for (let attempt = 0; attempt < backoffs.length; attempt += 1) {
    const wait = backoffs[attempt] ?? 0
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    await acquire()
    try {
      const { count, error } = await query()
      if (!error && count != null) return count
      // ⚠️ **여기서 즉시 포기하면 안 된다.** 시간초과는 `error` 로 오는데 그 `message` 가
      //    **빈 문자열**이다(실측). 처음엔 "오류면 재시도해도 같다" 며 바로 null 을 돌려줬고,
      //    그래서 재시도를 넣고도 실패 수가 안 줄었다. 다시 물으면 달라지지 않는 것은
      //    **구조적 실패**(없는 표·권한)뿐이라, 그때만 끊는다.
      if (isStructuralError(error)) return null
    } catch {
      return null
    } finally {
      release()
    }
  }
  return null // 끝까지 못 셌다 — 여기서도 0 으로 접지 않는다
}

/** 다시 물어도 같은 답이 오는 실패인가 — 없는 표·권한. 시간초과는 여기 해당하지 않는다. */
function isStructuralError(error: unknown): boolean {
  const msg =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message ?? '')
      : ''
  if (!msg) return false // 빈 메시지 = 시간초과 계열 → 재시도할 값이 있다
  return /does not exist|permission denied|schema cache|relation .* not found/i.test(msg)
}

/**
 * 동시 실행 수 제한 — 호출부는 그대로 `Promise.all` 을 쓰고, **여기서** 물결을 만든다.
 *
 * 왜 호출부를 안 고치나: 36개를 `pooled([...])` 로 바꾸면 배열이 이종(Count · string[] ·
 * RecentEvent[])이라 구조분해가 유니온으로 뭉개져 40곳의 타입이 무너진다. 게이트를
 * `safeCount` 안에 두면 타입도 호출부도 그대로고, 새로 추가되는 카운트도 **자동으로**
 * 이 규칙을 따른다(잊어버릴 수가 없다).
 *
 * 8로 잡은 근거: 한 건이 ~1.5초(실측 `library_articles` status 인덱스 스캔)이므로 36개가
 * 다섯 물결 ≈ 7초. 예전 "다 같이 던지고 큰 것 넷은 포기" 보다 느리지만 **결과가 온전하다**.
 */
const COUNT_CONCURRENCY = 3
let inFlight = 0
const waiting: (() => void)[] = []

async function acquire(): Promise<void> {
  if (inFlight < COUNT_CONCURRENCY) {
    inFlight += 1
    return
  }
  await new Promise<void>((resolve) => waiting.push(resolve))
  inFlight += 1
}

function release(): void {
  inFlight -= 1
  const next = waiting.shift()
  if (next) next()
}

/** 목록 응답 — supabase-js 의 row 타입 추론을 요구하지 않고 호출자가 T 를 명시한다. */
async function safeList<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  try {
    const { data, error } = await query
    if (error || !Array.isArray(data)) return []
    return data as T[]
  } catch {
    return []
  }
}

/**
 * 카운트 질의 — **`exact` 가 아니라 `estimated`** 를 쓴다.
 *
 * ── 왜 (실측 2026-09-06, 같은 서버·같은 순간) ────────────────────────
 *   library_articles ready(19,063행)  exact 19,063 / **3,944ms**  · estimated 18,574 / 124ms
 *   shared_dictionary(49,244행)       exact **null / 8,119ms · 오류 메시지 빈 문자열**
 *                                     estimated 48,969 / 1,260ms
 *   library_books published(312행)    exact 312 / 241ms          · estimated **312** / 53ms
 *
 * 즉 `exact` 는 2만 행쯤부터 시간초과로 **아무 말 없이 null** 을 준다. 대시보드에서는 그것이
 * 「—」로 보였고, 통합 테스트가 `articles.ready`·`articles.inFlight`·`vrl.classified`·
 * `words.dict` 넷을 반복해서 잡았다 — 하필 **가장 큰 파이프라인 넷**이다.
 *
 * `estimated` 는 Supabase 의 혼합 모드다: 작은 표는 **정확값 그대로**(위 312 가 그 증거),
 * 큰 표만 플래너 추정치(사전 48,969 vs 실제 49,244 = 0.56% 차)를 준다.
 * 「모름」보다 「≈49,000」이 낫다 — 이 화면은 어디를 볼지 고르는 분류 화면이지
 * 정산 화면이 아니다. 대신 **추정치라는 사실을 화면과 도움말이 말한다**(footnote).
 *
 * ⚠️ 정확한 수가 필요한 곳(발행 게이트·정산 등)에서는 이 함수를 쓰지 말 것.
 */
function head(client: AdminClient, table: string) {
  return client.from(table).select('*', { count: 'estimated', head: true })
}

/** KST 기준 오늘 날짜 (daily_activity.date 는 KST 캘린더 날짜로 적재). */
function kstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────
// 최근 변경 피드
// ─────────────────────────────────────────────

const BOOK_STATUS_KO: Record<string, string> = {
  queued: '대기열 등록',
  ingesting: '원문 수집',
  normalizing: '정규화',
  segmenting: '챕터 분할',
  analyzing: '난이도 분석',
  curating: '큐레이션',
  ready: '검수 대기',
  published: '공개',
  archived: '보관',
  failed: '실패',
}

const JOB_STATUS_KO: Record<string, string> = {
  pending: '대기',
  running: '진행 중',
  awaiting_mapping: '매핑 대기',
  done: '완료',
  failed: '실패',
}

const JOB_TASK_KO: Record<string, string> = {
  quiz_gen: '챕터 퀴즈 생성',
  voice_map: 'LibriVox 챕터 매핑',
  vocab_audit: '단어 추출 감사',
  comic_gen: '만화 컷 생성',
}

const ACCENT = {
  lcp: 'var(--p)',
  acp: 'var(--info)',
  vcb: '#8B5CF6',
  ccp: 'var(--warning)',
  pdcp: 'var(--warning)',
  job: 'var(--success)',
} as const

interface TimestampedRow {
  updated_at: string | null
}

async function fetchRecent(client: AdminClient): Promise<RecentEvent[]> {
  const recentQuery = (table: string, columns: string, limit: number) =>
    client
      .from(table)
      .select(columns)
      .not('updated_at', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(limit)

  const [books, articles, jobs, pd, runs] = await Promise.all([
    safeList<TimestampedRow & { id: string; title: string | null; status: string }>(
      recentQuery('library_books', 'id,title,status,updated_at', 4),
    ),
    safeList<TimestampedRow & { id: string; title: string | null; status: string }>(
      recentQuery('library_articles', 'id,title,status,updated_at', 4),
    ),
    safeList<
      TimestampedRow & {
        id: string
        task_type: string | null
        status: string
        chapters_done: number | null
        chapters_total: number | null
      }
    >(
      recentQuery(
        'book_curation_jobs',
        'id,task_type,status,chapters_done,chapters_total,updated_at',
        4,
      ),
    ),
    safeList<TimestampedRow & { id: string; title: string | null; status: string }>(
      recentQuery('pd_comic_issues', 'id,title,status,updated_at', 3),
    ),
    safeList<TimestampedRow & { id: number; collection_title: string | null; status: string }>(
      recentQuery('vocab_runs', 'id,collection_title,status,updated_at', 3),
    ),
  ])

  const events: RecentEvent[] = [
    ...books.map((b) => ({
      at: b.updated_at as string,
      kind: 'LCP',
      accent: ACCENT.lcp,
      title: b.title ?? '(제목 없음)',
      detail: BOOK_STATUS_KO[b.status] ?? b.status,
      href: `/admin/curation/preview/${b.id}`,
    })),
    ...articles.map((a) => ({
      at: a.updated_at as string,
      kind: 'ACP',
      accent: ACCENT.acp,
      title: a.title ?? '(제목 없음)',
      detail: BOOK_STATUS_KO[a.status] ?? a.status,
      href: `/admin/articles/preview/${a.id}`,
    })),
    ...jobs.map((j) => {
      const task = JOB_TASK_KO[j.task_type ?? ''] ?? j.task_type ?? '큐레이션 작업'
      const progress =
        j.chapters_total && j.chapters_total > 0
          ? ` ${j.chapters_done ?? 0}/${j.chapters_total}`
          : ''
      return {
        at: j.updated_at as string,
        kind: '드레인 큐',
        accent: ACCENT.job,
        title: task,
        detail: `${JOB_STATUS_KO[j.status] ?? j.status}${progress}`,
        href: '/admin/curation',
      }
    }),
    ...pd.map((p) => ({
      at: p.updated_at as string,
      kind: 'PDCP',
      accent: ACCENT.pdcp,
      title: p.title ?? '(제목 없음)',
      detail: BOOK_STATUS_KO[p.status] ?? p.status,
      href: '/admin/pd-comics',
    })),
    ...runs.map((r) => ({
      at: r.updated_at as string,
      kind: 'VCB',
      accent: ACCENT.vcb,
      title: r.collection_title ?? `run #${r.id}`,
      detail: r.status,
      href: `/admin/vocab/runs/${r.id}`,
    })),
  ]

  return events
    .filter((e) => Boolean(e.at))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, 8)
}

// ─────────────────────────────────────────────
// 진입점
// ─────────────────────────────────────────────

export async function getAdminDashboardStats(client: AdminClient): Promise<DashboardStats> {
  const today = kstToday()

  const [
    booksPublished,
    booksReady,
    booksInFlight,
    booksFailed,
    bookSeeds,
    articlesPublished,
    articlesReady,
    articlesInFlight,
    articlesFailed,
    articleSeeds,
    comicPublished,
    comicDraft,
    pdPublished,
    pdReview,
    pdInFlight,
    pdFailed,
    jobsPending,
    jobsRunning,
    jobsAwaiting,
    jobsFailed,
    vcbPending,
    vcbExported,
    vcbEnriched,
    vcbFlagged,
    vcbFailed,
    vrlOpen,
    vrlClassified,
    dict,
    pendingWords,
    judgments,
    chapterQuiz,
    learnersTotal,
    activeToday,
    texts,
    reportsOpen,
    qualityRows,
    recent,
  ] = await Promise.all([
    safeCount(() => head(client, 'library_books').eq('status', 'published')),
    safeCount(() => head(client, 'library_books').eq('status', 'ready')),
    safeCount(() => head(client, 'library_books').in('status', IN_FLIGHT_BOOK)),
    safeCount(() => head(client, 'library_books').eq('status', 'failed')),
    safeCount(() => head(client, 'library_seed_catalog').eq('imported_to_books', false)),

    safeCount(() => head(client, 'library_articles').eq('status', 'published')),
    safeCount(() => head(client, 'library_articles').eq('status', 'ready')),
    safeCount(() => head(client, 'library_articles').in('status', IN_FLIGHT_ARTICLE)),
    safeCount(() => head(client, 'library_articles').eq('status', 'failed')),
    safeCount(() => head(client, 'library_article_seed_catalog').eq('imported_to_articles', false)),

    safeCount(() => head(client, 'comic_books').eq('status', 'published')),
    safeCount(() => head(client, 'comic_books').eq('status', 'draft')),

    safeCount(() => head(client, 'pd_comic_issues').eq('status', 'published')),
    safeCount(() => head(client, 'pd_comic_issues').eq('status', 'review')),
    safeCount(() => head(client, 'pd_comic_issues').in('status', IN_FLIGHT_PD)),
    safeCount(() => head(client, 'pd_comic_issues').eq('status', 'failed')),

    safeCount(() => head(client, 'book_curation_jobs').eq('status', 'pending')),
    safeCount(() => head(client, 'book_curation_jobs').eq('status', 'running')),
    safeCount(() => head(client, 'book_curation_jobs').eq('status', 'awaiting_mapping')),
    safeCount(() => head(client, 'book_curation_jobs').eq('status', 'failed')),

    safeCount(() => head(client, 'vocab_enrichment_queue').eq('status', 'pending')),
    safeCount(() => head(client, 'vocab_enrichment_queue').eq('status', 'exported')),
    safeCount(() => head(client, 'vocab_enrichment_queue').eq('status', 'enriched')),
    safeCount(() => head(client, 'vocab_enrichment_queue').eq('status', 'enriched_flagged')),
    safeCount(() => head(client, 'vocab_enrichment_queue').eq('status', 'failed')),

    safeCount(() => head(client, 'vrl_data_integrity_concerns').eq('resolved', false)),
    safeCount(() => head(client, 'shared_dictionary').not('v_level', 'is', null)),

    safeCount(() => head(client, 'shared_dictionary')),
    safeCount(() => head(client, 'pending_words').in('status', ['pending', 'reviewing'])),
    safeCount(() => head(client, 'extraction_judgments')),
    safeCount(() => head(client, 'library_chapter_quiz')),

    safeCount(() => head(client, 'user_profiles')),
    safeCount(() => head(client, 'daily_activity').eq('date', today)),
    safeCount(() => head(client, 'texts')),

    safeCount(() => head(client, 'reports').eq('status', 'open')),

    safeList<{ measured_at: string }>(
      client
        .from('quality_metrics')
        .select('measured_at')
        .order('measured_at', { ascending: false })
        .limit(1),
    ),

    fetchRecent(client),
  ])

  return {
    books: {
      published: booksPublished,
      ready: booksReady,
      inFlight: booksInFlight,
      failed: booksFailed,
      seeds: bookSeeds,
    },
    articles: {
      published: articlesPublished,
      ready: articlesReady,
      inFlight: articlesInFlight,
      failed: articlesFailed,
      seeds: articleSeeds,
    },
    comics: { published: comicPublished, draft: comicDraft },
    pdComics: { published: pdPublished, review: pdReview, inFlight: pdInFlight, failed: pdFailed },
    jobs: {
      pending: jobsPending,
      running: jobsRunning,
      awaitingMapping: jobsAwaiting,
      failed: jobsFailed,
    },
    vcb: {
      pending: vcbPending,
      exported: vcbExported,
      enriched: vcbEnriched,
      flagged: vcbFlagged,
      failed: vcbFailed,
    },
    vrl: { openConcerns: vrlOpen, classified: vrlClassified },
    words: { dict, pending: pendingWords, judgments, chapterQuiz },
    learners: { total: learnersTotal, activeToday },
    texts,
    qualityLastMeasuredAt: qualityRows[0]?.measured_at ?? null,
    reportsOpen,
    recent,
  }
}

// ─────────────────────────────────────────────
// 표시 헬퍼 (page.tsx 공용)
// ─────────────────────────────────────────────

/** null(조회 실패) 은 '—' 로. 0 은 '0' 으로 — 둘을 섞으면 거짓 안심을 준다. */
export function fmt(n: Count): string {
  return n === null ? '—' : n.toLocaleString('ko-KR')
}

/** null 을 0 취급하지 않고 합산 — 하나라도 null 이면 합계도 null(불완전). */
export function sum(...values: Count[]): Count {
  let total = 0
  for (const v of values) {
    if (v === null) return null
    total += v
  }
  return total
}

export function relativeKo(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  })
}
