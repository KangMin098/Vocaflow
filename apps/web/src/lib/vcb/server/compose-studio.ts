// apps/web/src/lib/vcb/server/compose-studio.ts
// Server Action — 단어장 Studio (blueprint 드라이런 · 채점 · 발행).
//
// 왜 미리보기와 발행이 같은 파일에 있나: 발행은 **드라이런과 같은 레시피로** 다시 조립해야 한다.
// 화면이 들고 있던 결과를 그대로 쓰면(직렬화 왕복) 사이에 사전이 바뀌었을 때 화면에서 본 것과
// 다른 것이 발행된다. 그래서 발행도 서버에서 다시 조립하고, 점수도 다시 낸다.

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { BLUEPRINTS, catalogSummary, type BlueprintParams } from '@/lib/vcb/compose/blueprints'
import { PASS_THRESHOLD, type Scorecard } from '@/lib/vcb/compose/evaluate'
import { publishComposedSet } from '@/lib/vcb/compose/publish'
import { fetchPublishedWords } from '@/lib/vcb/compose/resolve'
import { dryRun } from '@/lib/vcb/compose/run'
import type { Recipe } from '@/lib/vcb/compose/types'

const ADMIN_PATH = '/admin/vocab/studio'

// ── UI 가 필요한 카탈로그 (직렬화 가능한 형태) ──────────────────────

export interface BlueprintCardData {
  id: string
  family: string
  taxon: string
  title: string
  market_example: string
  organizing_principle: string
  status: string
  gap_note: string | null
  requires_params: string[]
  /** 기본 레시피의 요약 — 카드에서 "무엇으로 뽑나" 를 보여준다 */
  population_kind: string
  group_by: string
  facets: string[]
  default_count: number | null
}

export interface StudioCatalog {
  blueprints: BlueprintCardData[]
  summary: ReturnType<typeof catalogSummary>
  pass_threshold: number
}

export async function fetchStudioCatalog(): Promise<StudioCatalog> {
  await requireAdmin(ADMIN_PATH)

  return {
    blueprints: BLUEPRINTS.map((b): BlueprintCardData => {
      const r = b.build({})
      return {
        id: b.id,
        family: b.family,
        taxon: b.taxon,
        title: b.title,
        market_example: b.market_example,
        organizing_principle: b.organizing_principle,
        status: b.status,
        gap_note: b.gap_note ?? null,
        requires_params: b.requires_params as string[],
        population_kind: r.population.kind,
        group_by: r.organize.group_by,
        facets: r.present.facets,
        default_count: r.select.objective.kind === 'count' ? r.select.objective.n : null,
      }
    }),
    summary: catalogSummary(),
    pass_threshold: PASS_THRESHOLD,
  }
}

// ── 파라미터 선택지 (실 DB) ─────────────────────────────────────────

export interface StudioOptions {
  books: { id: string; title: string; chapters: number }[]
  list_tags: string[]
  themes: string[]
  article_sets: { id: string; title: string; word_count: number }[]
}

export async function fetchStudioOptions(): Promise<StudioOptions> {
  await requireAdmin(ADMIN_PATH)
  const client = createAdminClient()

  const [books, cats, articles] = await Promise.all([
    client
      .from('library_books')
      .select('id, title, chapter_count')
      .eq('status', 'published')
      .order('chapter_count', { ascending: false })
      .limit(40),
    client.from('dictionary_categories').select('name_ko').eq('level', 1).order('sort_order'),
    client
      .from('shared_word_sets')
      .select('id, title, word_count')
      .eq('category', 'library_article')
      .order('word_count', { ascending: false })
      .limit(30),
  ])

  // list_tags 는 사전에 실제로 존재하는 12종 — filters.ts 가 정본이므로 그걸 쓴다.
  const { ALL_LIST_TAGS } = await import('@/lib/vcb/filters')

  return {
    books: ((books.data ?? []) as unknown as { id: string; title: string; chapter_count: number | null }[]).map(
      (b) => ({ id: b.id, title: b.title, chapters: b.chapter_count ?? 0 }),
    ),
    list_tags: [...ALL_LIST_TAGS, 'kcurr2022_0', 'kcurr2022_1', 'kcurr2022_2'],
    themes: ((cats.data ?? []) as unknown as { name_ko: string }[]).map((c) => c.name_ko),
    article_sets: ((articles.data ?? []) as unknown as {
      id: string
      title: string
      word_count: number | null
    }[]).map((a) => ({ id: a.id, title: a.title, word_count: a.word_count ?? 0 })),
  }
}

// ── 드라이런 (미리보기 + 채점) ──────────────────────────────────────

export interface PreviewGroup {
  key: string
  label: string
  count: number
  sample: { word: string; meaning_ko: string; v_level: number | null }[]
}

export interface PreviewResult {
  ok: boolean
  error?: string
  blueprint?: string
  recipe?: Recipe
  scorecard?: Scorecard
  entry_count?: number
  group_count?: number
  groups?: PreviewGroup[]
  funnel?: Record<string, unknown>
  coverage?: Record<string, unknown> | null
  /** 고유 유형의 우위 증거 — 한국어 한 줄 */
  evidence_line?: string | null
  timing_ms?: Record<string, number>
}

const PREVIEW_GROUPS = 12
const PREVIEW_WORDS = 8

export async function previewBlueprint(
  blueprintId: string,
  params: BlueprintParams,
): Promise<PreviewResult> {
  await requireAdmin(ADMIN_PATH)
  const client = createAdminClient()

  try {
    const existingWords = await fetchPublishedWords(client, { limitSets: 120 })
    const r = await dryRun(client, blueprintId, params, {
      existingWords,
      maxPopulation: 8000,
      now: new Date().toISOString(),
    })

    const ev = r.set.evidence
    const evidenceLine = ev?.sentence_unlock
      ? `이 예산(${ev.sentence_unlock.budget}단어)으로 완전히 읽히는 문장 ${ev.sentence_unlock.ours}개 — 같은 개수를 빈도순으로 고르면 ${ev.sentence_unlock.baseline}개 (전체 ${ev.sentence_unlock.total}문장)`
      : ev?.future_encounters
        ? `선택한 단어의 평균 향후 재등장 ${ev.future_encounters.ours_mean.toFixed(1)}회 — 빈도순은 ${ev.future_encounters.baseline_mean.toFixed(1)}회 (모집단 평균 ${ev.future_encounters.population_mean.toFixed(1)}회)`
        : null

    return {
      ok: true,
      blueprint: r.blueprint,
      recipe: r.recipe,
      scorecard: r.scorecard,
      entry_count: r.set.entries.length,
      group_count: r.set.groups.length,
      groups: r.set.groups.slice(0, PREVIEW_GROUPS).map((g) => ({
        key: g.key,
        label: g.label,
        count: g.entries.length,
        sample: g.entries.slice(0, PREVIEW_WORDS).map((e) => ({
          word: e.candidate.word,
          meaning_ko: e.candidate.meaning_ko ?? '',
          v_level: e.candidate.v_level,
        })),
      })),
      funnel: r.set.funnel as unknown as Record<string, unknown>,
      coverage: (r.set.coverage as unknown as Record<string, unknown>) ?? null,
      evidence_line: evidenceLine,
      timing_ms: r.timing_ms as unknown as Record<string, number>,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── 발행 ────────────────────────────────────────────────────────────

export interface PublishActionResult {
  ok: boolean
  slug?: string
  set_id?: string
  published_count?: number
  total?: number
  error?: string
  blocked_by?: string[]
}

export async function publishBlueprint(
  blueprintId: string,
  params: BlueprintParams,
  force = false,
): Promise<PublishActionResult> {
  const admin = await requireAdmin(ADMIN_PATH)
  const client = createAdminClient()

  try {
    const existingWords = await fetchPublishedWords(client, { limitSets: 120 })
    const r = await dryRun(client, blueprintId, params, {
      existingWords,
      maxPopulation: 8000,
      now: new Date().toISOString(),
    })

    const outcome = await publishComposedSet(client, r.set, {
      force,
      published_by: admin?.id ?? null,
      scorecard: r.scorecard,
    })

    return {
      ok: outcome.ok,
      slug: outcome.slug,
      set_id: outcome.set_id,
      published_count: outcome.published_count,
      total: outcome.scorecard?.total,
      error: outcome.error,
      blocked_by: outcome.blocked_by,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
