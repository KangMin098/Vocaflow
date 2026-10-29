// apps/web/src/lib/learner/plan-actions.ts
//
// 학습 계획(study_plan_items) server actions.
// P1 리치 구성: 자료 4종(도서/스크립트=article/공용단어장/내 스크립트) × 활동 + 도서 챕터 + 요일.
// 다중 엔트리(2026-07-06): 한 자료를 여러 배치(요일×챕터)로 — UNIQUE 제거, save 는 id 왕복.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import {
  fetchPlanBooks,
  fetchPlanCuratedSets,
  fetchPlanChapterSets,
} from '@/lib/learner/plan-material-queries'

import {
  activitiesForType,
  articleSourceLabel,
  cefrToVLevel,
  materialHref,
  type MaterialType,
  type PlanActivity,
} from './plan-activities'

/** 요일 정제 — 1=월..7=일, 중복 제거 + 정렬. */
function sanitizeWeekdays(days: number[] | null | undefined): number[] {
  return Array.from(new Set((days ?? []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))).sort(
    (a, b) => a - b,
  )
}

/** study_plan_* 는 생성 타입 미반영 — 느슨한 client 로 접근. */
function loose(c: unknown): SupabaseClient {
  return c as SupabaseClient
}

export interface PlanItem {
  id: string
  materialType: MaterialType
  materialId: string
  modules: PlanActivity[]
  title: string
  subtitle: string | null
  /** 자료 열기 라우트 (materialHref) */
  href: string
  /** word_set 의 slug — 활동 launch 라우트 재구성용 */
  slug: string | null
  vLevel: number | null
  /** 도서 선택 챕터 idx (빈 배열=전체) */
  chapters: number[]
  /** 학습 요일 1=월..7=일 (빈=미정) */
  weekdays: number[]
  /** 도서 전체 챕터 수 (book 외 0) */
  chapterCount: number
  /** 도서 표지 url */
  coverUrl: string | null
  /** 공용단어장 이모지 */
  coverEmoji: string | null
  /** 스크립트(article) 소스 */
  source: string | null
}

export interface MaterialOption {
  id: string
  title: string
  subtitle: string | null
  slug: string | null
  vLevel: number | null
  coverUrl: string | null
  coverEmoji: string | null
  source: string | null
  /** 공용단어장 category (주제 필터/그룹) */
  category: string | null
  chapterCount: number
  /** 챕터 종속 단어장(library_book) — 소속 도서 id (책별 분류 레일용) */
  bookId: string | null
  /** 챕터 종속 단어장 — 챕터 번호 (챕터순 정렬/표시용) */
  chapterIdx: number | null
  /** 스크립트(article) 프로그램/시리즈 (예: VOA "As It Is (Level 2)") — 소스 하위 분류용 */
  feedLabel: string | null
}

export interface AvailableMaterials {
  books: MaterialOption[]
  articles: MaterialOption[]
  wordSets: MaterialOption[]
  scripts: MaterialOption[]
}

interface PlanRow {
  id: string
  material_type: MaterialType
  material_id: string
  modules: string[] | null
  chapters: number[] | null
  weekdays: number[] | null
}
interface BookRow {
  id: string
  title: string | null
  author: string | null
  book_v_level: number | null
  cover_image_url: string | null
  chapter_count: number | null
}
interface ArticleRow {
  id: string
  title: string | null
  author: string | null
  source: string | null
  article_v_level: number | null
  word_count: number | null
  feed_label: string | null
}
interface ScriptRow {
  id: string
  title: string | null
  author: string | null
  text_v_level: number | null
  source: string | null
  library_book_id: string | null
  chapter_idx: number | null
}
interface SetRow {
  id: string
  title: string | null
  slug: string | null
  category: string | null
  word_count: number | null
  cover_emoji: string | null
  cefr_level: string | null
  curation_query?: { book_id?: string; chapter_idx?: number } | null
}

const EMPTY_EXTRAS = {
  slug: null as string | null,
  chapters: [] as number[],
  chapterCount: 0,
  coverUrl: null as string | null,
  coverEmoji: null as string | null,
  source: null as string | null,
}

/**
 * 학습 계획 읽기 결과(/plan 전용 facade · T-0240) — 목록과 함께 **읽기에 실패했는가**와 **누구의 계획인가**를 준다.
 *   failed: 주 목록 오류 · 배열 아님 · 형식이 어긋난 행 · 자료 메타/세트 챕터 조회 오류 — 이때 items 는 완전한 계획이 아니다.
 *   viewerId: 이 목록을 읽은 바로 그 서버 Auth(getUser)의 id — 화면은 이 값으로 계정 경계를 묶는다(비로그인 null).
 */
export interface StudyPlanSnapshot {
  items: PlanItem[]
  failed: boolean
  viewerId: string | null
}

/** 조회는 성공했지만 자료 행이 없을 때 — 실제 삭제를 증명하지 못하므로 /plan 은 보수적으로 말한다 */
const UNCONFIRMED_TITLE = '(자료를 확인할 수 없음)'
/** 기존 배열 wrapper 의 표기 — 다른 호출자(hub-lab · manage-overview) 화면은 그대로 둔다 */
const LEGACY_MISSING_TITLE = '(삭제된 자료)'

/** 화면의 viewer 와 서버 신원이 다를 때 — 쓰기 전에 거부한 결과 */
const OWNER_CHANGED = '로그인 계정이 바뀌어 저장하지 않았어요. 화면을 새로 열어 주세요.'

const MATERIAL_TYPES = new Set<string>(['book', 'article', 'script', 'word_set'])
function validRow(r: unknown): r is PlanRow {
  if (!r || typeof r !== 'object') return false
  const x = r as Record<string, unknown>
  // 배열 열은 명시적 null(미정) 이거나 정확한 원소 형식의 배열이어야 한다 — 열이 빠진(undefined) 행 · 다른 타입은 조회 실패(r7)
  const arrOf = (v: unknown, el: 'string' | 'number') => v === null || (Array.isArray(v) && v.every((e) => typeof e === el))
  return (
    typeof x.id === 'string' && x.id.length > 0 &&
    typeof x.material_type === 'string' && MATERIAL_TYPES.has(x.material_type) &&
    typeof x.material_id === 'string' && x.material_id.length > 0 &&
    arrOf(x.modules, 'string') && arrOf(x.chapters, 'number') && arrOf(x.weekdays, 'number')
  )
}

/** 현재 사용자의 학습 계획 — /plan 이 쓰는 읽기 facade. 조회는 한 번(기존 wrapper 와 같은 질의) */
export async function fetchStudyPlanSnapshot(): Promise<StudyPlanSnapshot> {
  return loadStudyPlan(UNCONFIRMED_TITLE)
}

/** 현재 사용자의 학습 계획 항목 — 자료 메타 join 포함(기존 배열 계약 · hub-lab · manage-overview 호환). */
export async function fetchStudyPlanItems(): Promise<PlanItem[]> {
  return (await loadStudyPlan(LEGACY_MISSING_TITLE)).items
}

async function loadStudyPlan(missingTitle: string): Promise<StudyPlanSnapshot> {
  const client = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser()
  // 인증 조회 오류는 「비로그인 · 빈 계획」이 아니다 — 세션이 없을 뿐인 경우(AuthSessionMissingError)만 비로그인
  if (authErr && authErr.name !== 'AuthSessionMissingError') return { items: [], failed: true, viewerId: null }
  if (!user) return { items: [], failed: false, viewerId: null }
  const viewerId = user.id
  const lc = loose(client)

  const { data: rowsRaw, error: rowsErr } = await lc
    .from('study_plan_items')
    .select('id, material_type, material_id, modules, chapters, weekdays')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  // 오류 · 배열 아님은 「빈 계획」이 아니다
  // 실제 배열일 때만 성공 — data:null(오류 없음)도 빈 계획으로 바꾸지 않는다
  if (rowsErr || !Array.isArray(rowsRaw)) return { items: [], failed: true, viewerId }
  const all = rowsRaw as unknown[]
  const rows = all.filter(validRow)
  // 형식이 어긋난 행이 있으면 남은 행만 「전체 계획」이라 부르지 않는다
  let failed = rows.length !== all.length
  if (rows.length === 0) return { items: [], failed, viewerId }

  const idsByType = (t: MaterialType) =>
    rows.filter((r) => r.material_type === t).map((r) => r.material_id)
  const bookIds = idsByType('book')
  const articleIds = idsByType('article')
  const scriptIds = idsByType('script')
  const setIds = idsByType('word_set')

  const [booksRes, articlesRes, scriptsRes, setsRes] = await Promise.all([
    bookIds.length
      ? lc
          .from('library_books')
          .select('id, title, author, book_v_level, cover_image_url, chapter_count')
          .in('id', bookIds)
      : Promise.resolve({ data: [] }),
    articleIds.length
      ? lc
          .from('library_articles')
          .select('id, title, author, source, article_v_level, word_count')
          .in('id', articleIds)
      : Promise.resolve({ data: [] }),
    scriptIds.length
      ? lc.from('texts').select('id, title, author').in('id', scriptIds)
      : Promise.resolve({ data: [] }),
    setIds.length
      ? lc
          .from('shared_word_sets')
          .select('id, title, slug, category, word_count, cover_emoji')
          .in('id', setIds)
      : Promise.resolve({ data: [] }),
  ])

  // 자료 메타 조회 오류를 기본값 · 「삭제된 자료」로 덮지 않는다
  for (const r of [booksRes, articlesRes, scriptsRes, setsRes] as { error?: unknown; data?: unknown }[]) {
    if (r.error) failed = true
    // 배열이 아닌 메타는 조인할 수 없다 — 터지기 전에 실패 결과로 돌려준다. 오류 없는 data:null 도 비배열과 같다(r9)
    else if (!Array.isArray(r.data)) return { items: [], failed: true, viewerId }
  }
  const bookMap = new Map(((booksRes.data ?? []) as BookRow[]).map((b) => [b.id, b]))
  const articleMap = new Map(((articlesRes.data ?? []) as ArticleRow[]).map((a) => [a.id, a]))
  const scriptMap = new Map(((scriptsRes.data ?? []) as ScriptRow[]).map((s) => [s.id, s]))
  const setMap = new Map(((setsRes.data ?? []) as SetRow[]).map((w) => [w.id, w]))

  // 공용단어장 내부 챕터 수(shared_words.chapter MAX) — 런처 챕터 선택 노출 여부.
  //   챕터 미부여 세트(chapter NULL)는 0 → 단일 세트로 취급(챕터 선택 숨김).
  const setChapterMax = new Map<string, number>()
  if (setIds.length) {
    const { data: chRows, error: chErr } = await lc
      .from('shared_words')
      .select('set_id, chapter')
      .in('set_id', setIds)
      .not('chapter', 'is', null)
    // 챕터 조회 오류를 「0챕터」로 만들지 않는다
    if (chErr) failed = true
    // 오류 없는 data:null 은 「0챕터」가 아니다(r9) — 비배열과 같이 실패
    else if (!Array.isArray(chRows)) return { items: [], failed: true, viewerId }
    for (const r of (chRows ?? []) as { set_id: string; chapter: number | null }[]) {
      if (r.chapter != null) {
        setChapterMax.set(r.set_id, Math.max(setChapterMax.get(r.set_id) ?? 0, r.chapter))
      }
    }
  }

  const items = rows.map((r) => {
    let title = missingTitle
    let subtitle: string | null = null
    const extras = { ...EMPTY_EXTRAS }
    let vLevel: number | null = null

    if (r.material_type === 'book') {
      const b = bookMap.get(r.material_id)
      if (b) {
        title = b.title ?? '(제목 없음)'
        subtitle = b.author ?? null
        vLevel = b.book_v_level ?? null
        extras.coverUrl = b.cover_image_url ?? null
        extras.chapterCount = b.chapter_count ?? 0
      }
    } else if (r.material_type === 'article') {
      const a = articleMap.get(r.material_id)
      if (a) {
        title = a.title ?? '(제목 없음)'
        subtitle = articleSourceLabel(a.source)
        vLevel = a.article_v_level ?? null
        extras.source = a.source ?? null
      }
    } else if (r.material_type === 'script') {
      const s = scriptMap.get(r.material_id)
      if (s) {
        title = s.title ?? '(제목 없음)'
        subtitle = s.author ?? null
      }
    } else {
      const w = setMap.get(r.material_id)
      if (w) {
        title = w.title ?? '(제목 없음)'
        subtitle = w.word_count ? `${w.word_count.toLocaleString()}단어` : w.category ?? null
        extras.slug = w.slug ?? null
        extras.coverEmoji = w.cover_emoji ?? null
        // 내부 챕터 수 — 런처에서 챕터 스코프 선택 노출용 (book 아닌 word_set 도 chapterCount 사용).
        extras.chapterCount = setChapterMax.get(r.material_id) ?? 0
      }
    }

    const allowed = new Set(activitiesForType(r.material_type))
    const modules = ((r.modules ?? []) as PlanActivity[]).filter((m) => allowed.has(m))
    const chapters = r.material_type === 'book' ? (r.chapters ?? []) : []

    return {
      id: r.id,
      materialType: r.material_type,
      materialId: r.material_id,
      modules,
      title,
      subtitle,
      href: materialHref({ type: r.material_type, id: r.material_id, slug: extras.slug }),
      slug: extras.slug,
      vLevel,
      chapters,
      weekdays: sanitizeWeekdays(r.weekdays),
      chapterCount: extras.chapterCount,
      coverUrl: extras.coverUrl,
      coverEmoji: extras.coverEmoji,
      source: extras.source,
    }
  })
  return { items, failed, viewerId }
}

function mkOption(over: Partial<MaterialOption> & { id: string; title: string }): MaterialOption {
  return {
    subtitle: null,
    slug: null,
    vLevel: null,
    coverUrl: null,
    coverEmoji: null,
    source: null,
    category: null,
    chapterCount: 0,
    bookId: null,
    chapterIdx: null,
    feedLabel: null,
    ...over,
  }
}

/** 공용단어장 V-Level 도출 — slug(auto-vlevel-vN) 우선, 없으면 cefr_level 폴백. */
function wordSetVLevel(slug: string | null, cefr: string | null): number | null {
  const m = slug?.match(/auto-vlevel-v(\d+)/)
  if (m) return parseInt(m[1], 10)
  return cefrToVLevel(cefr)
}

// (v06.124) 도서/글 챕터 종속 세트도 picker 에 노출 — '도서 챕터'/'스크립트 어휘' 카테고리
// 그룹으로 표시해 챕터 단위 단어장 계획을 지원한다 (기존: 부모 자료로만 학습한다고 숨김).

/** 계획에 추가 가능한 자료 — 도서 / 스크립트(article) / 공용단어장 / 내 스크립트. */
export async function fetchAvailableMaterials(): Promise<AvailableMaterials> {
  const empty: AvailableMaterials = { books: [], articles: [], wordSets: [], scripts: [] }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return empty
  const lc = loose(client)

  // 내가 등록한 도서 — 챕터 단어장을 여기에 한정하기 위해 먼저 받는다(아래 주석 참조).
  const { data: myTexts } = await lc
    .from('texts')
    .select('id, title, author, text_v_level, source, library_book_id, chapter_idx')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(300)
  const scriptRowsRaw = (myTexts ?? []) as ScriptRow[]
  const enrolledBookIds = [
    ...new Set(scriptRowsRaw.map((t) => t.library_book_id).filter((v): v is string => !!v)),
  ]

  const [books, articles, curatedSets, chapterSets] = await Promise.all([
    // 목록 규칙(상한·분리)은 plan-material-queries.ts 가 단일 출처 —
    //   인라인으로 두었더니 2026-08-30 에 두 번 조용히 잘렸다(그 파일 상단 참조).
    fetchPlanBooks<BookRow>(lc),
    lc
      .from('library_articles')
      .select('id, title, author, source, article_v_level, word_count, feed_label')
      .eq('status', 'published')
      .eq('copyright_safe_in_kr', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(300)
      .then((r: { data: unknown }) => r.data ?? []),
    fetchPlanCuratedSets<SetRow>(lc),
    fetchPlanChapterSets<SetRow>(lc, enrolledBookIds),
  ])
  const sets = [...curatedSets, ...chapterSets]
  const scripts = scriptRowsRaw

  // 소속 도서 제목으로 2차 분류(feedLabel) — 내 스크립트('도서에서') + 공용단어장(도서 챕터) 공통.
  const scriptRows = (scripts ?? []) as ScriptRow[]
  const setRows = (sets ?? []) as SetRow[]
  const bookIdSet = new Set<string>()
  for (const s of scriptRows) if (s.library_book_id) bookIdSet.add(s.library_book_id)
  for (const w of setRows) if (w.curation_query?.book_id) bookIdSet.add(w.curation_query.book_id)
  const bookTitle = new Map<string, string>()
  if (bookIdSet.size > 0) {
    const { data: bks } = await lc
      .from('library_books')
      .select('id, title')
      .in('id', Array.from(bookIdSet))
    for (const b of (bks ?? []) as { id: string; title: string | null }[]) {
      bookTitle.set(b.id, b.title ?? '도서')
    }
  }

  return {
    books: ((books ?? []) as BookRow[]).map((b) =>
      mkOption({
        id: b.id,
        title: b.title ?? '(제목 없음)',
        subtitle: b.author ?? null,
        vLevel: b.book_v_level ?? null,
        coverUrl: b.cover_image_url ?? null,
        chapterCount: b.chapter_count ?? 0,
      }),
    ),
    articles: ((articles ?? []) as ArticleRow[]).map((a) =>
      mkOption({
        id: a.id,
        title: a.title ?? '(제목 없음)',
        subtitle: articleSourceLabel(a.source),
        vLevel: a.article_v_level ?? null,
        source: a.source ?? null,
        feedLabel: a.feed_label ?? null,
      }),
    ),
    wordSets: setRows
      .map((w) =>
        mkOption({
          id: w.id,
          title: w.title ?? '(제목 없음)',
          subtitle: w.word_count ? `${w.word_count.toLocaleString()}단어` : null,
          slug: w.slug ?? null,
          coverEmoji: w.cover_emoji ?? null,
          category: w.category ?? null,
          // 소스탭 통일: 카테고리를 소스축(1단), 도서 챕터는 소속 책을 분류축(feedLabel, 2단)
          source: w.category ?? null,
          feedLabel:
            w.category === 'library_book' && w.curation_query?.book_id
              ? (bookTitle.get(w.curation_query.book_id) ?? null)
              : null,
          vLevel: wordSetVLevel(w.slug, w.cefr_level),
          bookId: w.curation_query?.book_id ?? null,
          chapterIdx: w.curation_query?.chapter_idx ?? null,
        }),
      )
      .sort((a, b) => {
        // 도서 챕터: 책 제목 → 챕터 순. 그 외 카테고리: 원래 순서 유지.
        const fa = a.feedLabel ?? ''
        const fb = b.feedLabel ?? ''
        if (fa !== fb) return fa.localeCompare(fb)
        return (Number(a.chapterIdx) || 0) - (Number(b.chapterIdx) || 0)
      }),
    scripts: scriptRows
      .map((s) =>
        mkOption({
          id: s.id,
          title: s.title ?? '(제목 없음)',
          subtitle: s.author ?? null,
          vLevel: s.text_v_level ?? null,
          source: s.source ?? null, // text_source — 내 스크립트 소스별 분류(1단)
          // '도서에서' texts 는 소속 도서 제목으로 2차 분류(feedLabel) → 소스 → 책 → 챕터
          feedLabel:
            s.source === 'library' && s.library_book_id
              ? (bookTitle.get(s.library_book_id) ?? null)
              : null,
          bookId: s.library_book_id ?? null,
          chapterIdx: s.chapter_idx ?? null,
        }),
      )
      .sort((a, b) => {
        const fa = a.feedLabel ?? ''
        const fb = b.feedLabel ?? ''
        if (fa !== fb) return fa.localeCompare(fb)
        return (a.chapterIdx ?? 0) - (b.chapterIdx ?? 0)
      }),
  }
}

export interface BookChapter {
  idx: number
  title: string | null
  /** 챕터별 어휘 V-level (distinct lemma p75, V11 제외). 단일 book_v_level 의 챕터 편차 노출. null=미산출 */
  vLevel: number | null
}

/**
 * 도서 챕터 목록(번호+제목+V-level) — /plan 챕터 리스트용.
 * RLS `read_via_published` 로 published+copyright_safe 도서만 읽힘 (picker 와 동일 범위).
 */
export async function fetchBookChapters(bookId: string): Promise<BookChapter[]> {
  if (!bookId) return []
  const client = await createClient()
  const { data } = await loose(client)
    .from('library_chapters_master')
    .select('chapter_idx, chapter_title, chapter_v_level')
    .eq('library_book_id', bookId)
    .order('chapter_idx', { ascending: true })
  return (
    (data ?? []) as { chapter_idx: number; chapter_title: string | null; chapter_v_level: number | null }[]
  ).map((c) => ({
    idx: c.chapter_idx,
    title: c.chapter_title,
    vLevel: c.chapter_v_level ?? null,
  }))
}

/**
 * 계획 항목 추가/수정. modules·chapters 정제.
 *   · 다중 엔트리(2026-07-06): 한 자료를 여러 배치(요일×챕터)로 담을 수 있게 UNIQUE 제거.
 *   · `id` 있으면 그 배치 UPDATE(본인) · 없으면 새 배치 INSERT 후 **id 반환**(낙관적 갱신이 실 id 추적).
 */
export async function savePlanItem(input: {
  /** 편집 시 대상 배치 id — 없으면 신규 배치 INSERT */
  id?: string
  materialType: MaterialType
  materialId: string
  modules: PlanActivity[]
  chapters?: number[]
  weekdays?: number[]
  /**
   * 이 저장을 시작한 화면의 viewer(T-0240 r3) — 서버 getUser 와 다르면 쓰기 전에 거부한다.
   * 거부용 결속일 뿐 권한 근거가 아니다(권한은 기존 Auth/RLS). 넘기지 않으면 기존과 같다.
   */
  expectedOwner?: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!input?.materialId) return { ok: false, error: '자료가 필요합니다.' }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }
  if (input.expectedOwner !== undefined && user.id !== input.expectedOwner) return { ok: false, error: OWNER_CHANGED }

  const allowed = new Set(activitiesForType(input.materialType))
  const modules = Array.from(new Set(input.modules)).filter((m) => allowed.has(m))
  const chapters =
    input.materialType === 'book'
      ? Array.from(new Set((input.chapters ?? []).filter((n) => Number.isInteger(n) && n > 0))).sort(
          (a, b) => a - b,
        )
      : []
  const weekdays = sanitizeWeekdays(input.weekdays)
  const lc = loose(client)

  if (input.id) {
    // 편집 — updated_at 은 BEFORE UPDATE 트리거(tg_study_plan_items_touch)가 갱신
    const { error } = await lc
      .from('study_plan_items')
      .update({ modules, chapters, weekdays })
      .eq('id', input.id)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, id: input.id }
  }

  const { data, error } = await lc
    .from('study_plan_items')
    .insert({
      user_id: user.id,
      material_type: input.materialType,
      material_id: input.materialId,
      modules,
      chapters,
      weekdays,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: (data as { id: string } | null)?.id }
}

/** 계획 항목 제거. expectedOwner(T-0240 r3) — 서버 getUser 와 다르면 지우기 전에 거부(넘기지 않으면 기존과 같다). */
export async function removePlanItem(itemId: string, expectedOwner?: string): Promise<{ ok: boolean; error?: string }> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }
  if (expectedOwner !== undefined && user.id !== expectedOwner) return { ok: false, error: OWNER_CHANGED }

  const { error } = await loose(client)
    .from('study_plan_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
