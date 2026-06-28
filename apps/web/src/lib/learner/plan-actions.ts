// apps/web/src/lib/learner/plan-actions.ts
//
// 학습 계획(study_plan_items) server actions — fetch/save/remove + 추가용 자료 목록.
// P1 재설계: 자료(도서/스크립트/공용단어장) × 활동. learning_goals(수능) 폐기 대체.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

import {
  activitiesForType,
  materialHref,
  type MaterialType,
  type PlanActivity,
} from './plan-activities'

/** study_plan_items 는 생성 타입 미반영 — 느슨한 client 로 접근. */
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
  /** word_set 의 slug — 활동 launch 라우트 재구성용 (book/script 은 null) */
  slug: string | null
  vLevel: number | null
}

export interface MaterialOption {
  id: string
  title: string
  subtitle: string | null
  slug: string | null
  vLevel: number | null
}

export interface AvailableMaterials {
  books: MaterialOption[]
  scripts: MaterialOption[]
  wordSets: MaterialOption[]
}

interface PlanRow {
  id: string
  material_type: MaterialType
  material_id: string
  modules: string[] | null
}
interface BookRow {
  id: string
  title: string | null
  author: string | null
  book_v_level: number | null
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
}

/** 현재 사용자의 학습 계획 항목 — 자료 제목 join 포함. */
export async function fetchStudyPlanItems(): Promise<PlanItem[]> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return []
  const lc = loose(client)

  const { data: rowsRaw } = await lc
    .from('study_plan_items')
    .select('id, material_type, material_id, modules')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  const rows = (rowsRaw ?? []) as PlanRow[]
  if (rows.length === 0) return []

  const bookIds = rows.filter((r) => r.material_type === 'book').map((r) => r.material_id)
  const scriptIds = rows.filter((r) => r.material_type === 'script').map((r) => r.material_id)
  const setIds = rows.filter((r) => r.material_type === 'word_set').map((r) => r.material_id)

  const [booksRes, scriptsRes, setsRes] = await Promise.all([
    bookIds.length
      ? lc.from('library_books').select('id, title, author, book_v_level').in('id', bookIds)
      : Promise.resolve({ data: [] }),
    scriptIds.length
      ? lc.from('texts').select('id, title, author').in('id', scriptIds)
      : Promise.resolve({ data: [] }),
    setIds.length
      ? lc
          .from('shared_word_sets')
          .select('id, title, slug, category, word_count')
          .in('id', setIds)
      : Promise.resolve({ data: [] }),
  ])

  const bookMap = new Map(((booksRes.data ?? []) as BookRow[]).map((b) => [b.id, b]))
  const scriptMap = new Map(((scriptsRes.data ?? []) as ScriptRow[]).map((s) => [s.id, s]))
  const setMap = new Map(((setsRes.data ?? []) as SetRow[]).map((w) => [w.id, w]))

  return rows.map((r) => {
    let title = '(삭제된 자료)'
    let subtitle: string | null = null
    let slug: string | null = null
    let vLevel: number | null = null

    if (r.material_type === 'book') {
      const b = bookMap.get(r.material_id)
      if (b) {
        title = b.title ?? '(제목 없음)'
        subtitle = b.author ?? null
        vLevel = b.book_v_level ?? null
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
        slug = w.slug ?? null
      }
    }

    const allowed = new Set(activitiesForType(r.material_type))
    const modules = ((r.modules ?? []) as PlanActivity[]).filter((m) => allowed.has(m))

    return {
      id: r.id,
      materialType: r.material_type,
      materialId: r.material_id,
      modules,
      title,
      subtitle,
      href: materialHref({ type: r.material_type, id: r.material_id, slug }),
      slug,
      vLevel,
    }
  })
}

/** 계획에 추가할 수 있는 자료 — 내 스크립트 + 라이브러리 도서 + 발행 단어장. */
export async function fetchAvailableMaterials(): Promise<AvailableMaterials> {
  const empty: AvailableMaterials = { books: [], scripts: [], wordSets: [] }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return empty
  const lc = loose(client)

  const [{ data: books }, { data: scripts }, { data: sets }] = await Promise.all([
    lc.from('library_books').select('id, title, author, book_v_level').order('title').limit(200),
    lc
      .from('texts')
      .select('id, title, author')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    lc
      .from('shared_word_sets')
      .select('id, title, slug, category, word_count')
      .eq('is_published', true)
      .order('title')
      .limit(200),
  ])

  return {
    books: ((books ?? []) as BookRow[]).map((b) => ({
      id: b.id,
      title: b.title ?? '(제목 없음)',
      subtitle: b.author ?? null,
      slug: null,
      vLevel: b.book_v_level ?? null,
    })),
    scripts: ((scripts ?? []) as ScriptRow[]).map((s) => ({
      id: s.id,
      title: s.title ?? '(제목 없음)',
      subtitle: s.author ?? null,
      slug: null,
      vLevel: null,
    })),
    wordSets: ((sets ?? []) as SetRow[]).map((w) => ({
      id: w.id,
      title: w.title ?? '(제목 없음)',
      subtitle: w.word_count ? `${w.word_count.toLocaleString()}단어` : w.category ?? null,
      slug: w.slug ?? null,
      vLevel: null,
    })),
  }
}

/** 계획 항목 추가/수정(upsert by unique). modules 는 자료유형 가용 활동으로 정제. */
export async function savePlanItem(input: {
  materialType: MaterialType
  materialId: string
  modules: PlanActivity[]
}): Promise<{ ok: boolean; error?: string }> {
  if (!input?.materialId) return { ok: false, error: '자료가 필요합니다.' }
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const allowed = new Set(activitiesForType(input.materialType))
  const modules = Array.from(new Set(input.modules)).filter((m) => allowed.has(m))

  const { error } = await loose(client)
    .from('study_plan_items')
    .upsert(
      {
        user_id: user.id,
        material_type: input.materialType,
        material_id: input.materialId,
        modules,
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
