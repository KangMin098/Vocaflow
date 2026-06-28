// apps/web/src/lib/learner/plan-actions.ts
//
// 학습 계획(study_plan_items) + 주당 리듬(study_plan_schedule) server actions.
// P1 리치 구성: 자료 4종(도서/스크립트=article/공용단어장/내 스크립트) × 활동 + 도서 챕터 + 일정.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import {
  activitiesForType,
  articleSourceLabel,
  materialHref,
  type MaterialType,
  type PlanActivity,
  type PlanSchedule,
} from './plan-activities'

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
  chapterCount: number
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
}
interface ScriptRow {
  id: string
  title: string | null
  author: string | null
}
interface SetRow {
  id: string
  title: string | null
  slug: string | null
  category: string | null
  word_count: number | null
  cover_emoji: string | null
}

const EMPTY_EXTRAS = {
  slug: null as string | null,
  chapters: [] as number[],
  chapterCount: 0,
  coverUrl: null as string | null,
  coverEmoji: null as string | null,
  source: null as string | null,
}

/** 현재 사용자의 학습 계획 항목 — 자료 메타 join 포함. */
export async function fetchStudyPlanItems(): Promise<PlanItem[]> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return []
  const lc = loose(client)

  const { data: rowsRaw } = await lc
    .from('study_plan_items')
    .select('id, material_type, material_id, modules, chapters')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  const rows = (rowsRaw ?? []) as PlanRow[]
  if (rows.length === 0) return []

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

  const bookMap = new Map(((booksRes.data ?? []) as BookRow[]).map((b) => [b.id, b]))
  const articleMap = new Map(((articlesRes.data ?? []) as ArticleRow[]).map((a) => [a.id, a]))
  const scriptMap = new Map(((scriptsRes.data ?? []) as ScriptRow[]).map((s) => [s.id, s]))
  const setMap = new Map(((setsRes.data ?? []) as SetRow[]).map((w) => [w.id, w]))

  return rows.map((r) => {
    let title = '(삭제된 자료)'
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
      chapterCount: extras.chapterCount,
      coverUrl: extras.coverUrl,
      coverEmoji: extras.coverEmoji,
      source: extras.source,
    }
  })
}

function mkOption(over: Partial<MaterialOption> & { id: string; title: string }): MaterialOption {
  return {
    subtitle: null,
    slug: null,
    vLevel: null,
    coverUrl: null,
    coverEmoji: null,
    source: null,
    chapterCount: 0,
    ...over,
  }
}

/** 계획에 추가 가능한 자료 — 도서 / 스크립트(article) / 공용단어장 / 내 스크립트. */
export async function fetchAvailableMaterials(): Promise<AvailableMaterials> {
  const empty: AvailableMaterials = { books: [], articles: [], wordSets: [], scripts: [] }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return empty
  const lc = loose(client)

  const [{ data: books }, { data: articles }, { data: sets }, { data: scripts }] = await Promise.all([
    lc
      .from('library_books')
      .select('id, title, author, book_v_level, cover_image_url, chapter_count')
      .eq('status', 'published')
      .order('title')
      .limit(300),
    lc
      .from('library_articles')
      .select('id, title, author, source, article_v_level, word_count')
      .eq('status', 'published')
      .eq('copyright_safe_in_kr', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(300),
    lc
      .from('shared_word_sets')
      .select('id, title, slug, category, word_count, cover_emoji')
      .eq('is_published', true)
      .order('title')
      .limit(300),
    lc
      .from('texts')
      .select('id, title, author')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(300),
  ])

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
      }),
    ),
    wordSets: ((sets ?? []) as SetRow[]).map((w) =>
      mkOption({
        id: w.id,
        title: w.title ?? '(제목 없음)',
        subtitle: w.word_count ? `${w.word_count.toLocaleString()}단어` : w.category ?? null,
        slug: w.slug ?? null,
        coverEmoji: w.cover_emoji ?? null,
      }),
    ),
    scripts: ((scripts ?? []) as ScriptRow[]).map((s) =>
      mkOption({
        id: s.id,
        title: s.title ?? '(제목 없음)',
        subtitle: s.author ?? null,
      }),
    ),
  }
}

/** 계획 항목 추가/수정(upsert). modules·chapters 정제. */
export async function savePlanItem(input: {
  materialType: MaterialType
  materialId: string
  modules: PlanActivity[]
  chapters?: number[]
}): Promise<{ ok: boolean; error?: string }> {
  if (!input?.materialId) return { ok: false, error: '자료가 필요합니다.' }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const allowed = new Set(activitiesForType(input.materialType))
  const modules = Array.from(new Set(input.modules)).filter((m) => allowed.has(m))
  const chapters =
    input.materialType === 'book'
      ? Array.from(new Set((input.chapters ?? []).filter((n) => Number.isInteger(n) && n > 0))).sort(
          (a, b) => a - b,
        )
      : []

  const { error } = await loose(client)
    .from('study_plan_items')
    .upsert(
      {
        user_id: user.id,
        material_type: input.materialType,
        material_id: input.materialId,
        modules,
        chapters,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,material_type,material_id' },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** 계획 항목 제거. */
export async function removePlanItem(itemId: string): Promise<{ ok: boolean; error?: string }> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const { error } = await loose(client)
    .from('study_plan_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** 주당 학습 리듬 조회 (없으면 기본값). */
export async function fetchSchedule(): Promise<PlanSchedule> {
  const fallback: PlanSchedule = { weeklyDays: [], dailyMinutes: 20 }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return fallback
  const { data } = await loose(client)
    .from('study_plan_schedule')
    .select('weekly_days, daily_minutes')
    .eq('user_id', user.id)
    .maybeSingle()
  const row = data as { weekly_days: number[] | null; daily_minutes: number | null } | null
  if (!row) return fallback
  return {
    weeklyDays: (row.weekly_days ?? []).filter((d) => d >= 1 && d <= 7),
    dailyMinutes: row.daily_minutes ?? 20,
  }
}

/** 주당 학습 리듬 저장(upsert). */
export async function saveSchedule(
  input: PlanSchedule,
): Promise<{ ok: boolean; error?: string }> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const weekly = Array.from(new Set((input.weeklyDays ?? []).filter((d) => d >= 1 && d <= 7))).sort()
  const minutes = Math.max(5, Math.min(240, Math.round(input.dailyMinutes || 20)))

  const { error } = await loose(client)
    .from('study_plan_schedule')
    .upsert(
      { user_id: user.id, weekly_days: weekly, daily_minutes: minutes, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
