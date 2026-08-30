// apps/web/src/lib/vcb/compose/publish.ts
//
// 발행 — 조립된 세트를 shared_word_sets / shared_words 에 쓴다. **마이그레이션 없음**
// (기존 `curation_query jsonb` · `auto_curated boolean` 컬럼에 레시피와 점수를 저장한다).
//
// 평가가 발행의 전제다: 통과선 미달이면 `force` 없이는 쓰지 않는다. 지금까지 5 생성기가
// 곧바로 발행했고, 잘못 뽑혔다는 사실은 발행 뒤에야(또는 영원히) 드러났다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveLadderStep, vocabBrandFingerprint } from '@vocaflow/library-pipeline/vocab-brand'

import { rungForSet } from '@/lib/library/vocab/rung'
import { PASS_THRESHOLD, evaluateSet, type Scorecard } from './evaluate'
import { evaluateMarket } from './market'
import type { ComposedSet } from './types'

export interface PublishOptions {
  /** 통과선 미달이어도 발행한다 — 어드민이 의도적으로 넘길 때만 */
  force?: boolean
  /** 발행자 (감사 기록) */
  published_by?: string | null
  /** 기존 점수를 재계산하지 않고 그대로 쓴다 (드라이런 결과 재사용) */
  scorecard?: Scorecard
  existingWords?: Set<string>
}

export interface PublishOutcome {
  ok: boolean
  set_id?: string
  slug: string
  published_count?: number
  scorecard?: Scorecard
  error?: string
  /** 통과선 미달로 막혔을 때 그 이유 */
  blocked_by?: string[]
}

const WORD_CHUNK = 500

interface SharedWordRow {
  set_id: string
  word: string
  meaning_ko: string
  example_en: string | null
  pronunciation: string | null
  part_of_speech: string | null
  cefr_level: string | null
  sort_order: number
  ipa: string | null
  synonyms: string[] | null
  antonyms: string[] | null
  collocations: string[] | null
  korean_learner_note: string | null
  v_level: number | null
  source_sentence: string | null
  chapter: number | null
}

/**
 * 조립 결과 → shared_words 행.
 *
 * ⚠️ 챕터 라벨 규약: 학습자 UI(`VocabSetPreviewModal`)는 **챕터 내 `korean_learner_note` 가
 * 균일할 때 그것을 챕터 제목으로** 쓴다 (어원 세트가 어근 라벨을 그렇게 넣었다).
 * 그래서 목차가 있는 세트는 사전의 학습자 노트 대신 그룹 라벨을 넣는다 — 두 값을 동시에
 * 담을 컬럼이 없으므로, 목차가 있으면 목차가 이긴다. 목차가 없으면 사전 노트를 그대로 쓴다.
 */
export function toSharedWords(set: ComposedSet, setId: string): SharedWordRow[] {
  const grouped = set.recipe.organize.group_by !== 'none'
  const chapterOf = new Map<string, number>()
  set.groups.forEach((g, i) => chapterOf.set(g.key, i + 1))

  return set.entries.map((e) => {
    const c = e.candidate
    const sentence = c.corpus_sentence ?? null
    return {
      set_id: setId,
      word: c.word,
      meaning_ko: c.meaning_ko ?? '',
      // 코퍼스 문장이 있으면 그것이 더 좋은 예문이다 — 학습자가 그 책에서 만날 문장이다.
      example_en: sentence ?? c.example_en ?? null,
      pronunciation: c.ipa,
      part_of_speech: c.primary_pos ?? c.pos ?? null,
      cefr_level: c.cefr_level,
      sort_order: e.sort_order,
      ipa: c.ipa,
      synonyms: c.synonyms.length > 0 ? c.synonyms : null,
      antonyms: c.antonyms.length > 0 ? c.antonyms : null,
      collocations: c.collocations.length > 0 ? c.collocations : null,
      korean_learner_note: grouped ? e.group_label : c.korean_learner_note,
      v_level: c.v_level,
      source_sentence: sentence,
      chapter: grouped ? (chapterOf.get(e.group_key) ?? null) : null,
    }
  })
}

/**
 * 코퍼스 출처를 top-level 로 남긴다 — 단, 키 이름이 `book_id` 여서는 안 된다.
 *
 * `curation_query->>book_id` 는 **도서 챕터 세트 1,129개가 쓰는 키**이고, 학습자 화면
 * (`fetchBookChapterSets` · `subscribeToWordSet`)이 그 키로 "이건 챕터 세트다" 를 판정한다.
 * 컴포저 세트가 같은 키를 쓰면 챕터 세트 목록에 chapter_idx=0 으로 끼어들어 구독 경로가
 * 엉킨다. 그래서 provenance 는 `source_book_id` 로 남긴다.
 */
function sourceRefs(set: ComposedSet): Record<string, unknown> {
  const pop = set.recipe.population
  if (pop.kind !== 'corpus') return {}
  return {
    source_scope: pop.scope,
    source_book_id: pop.scope === 'book' || pop.scope === 'chapter_range' ? (pop.ids[0] ?? null) : null,
    source_text_ids: pop.scope === 'text' || pop.scope === 'article' ? pop.ids : null,
    source_chapter_from: pop.chapter_from ?? null,
    source_chapter_to: pop.chapter_to ?? null,
  }
}

/** `curation_query` 에 저장할 것 — 레시피와 점수를 함께 둔다. 재현과 재평가가 같은 자리에서 된다. */
export function buildCurationQuery(
  set: ComposedSet,
  scorecard: Scorecard,
): Record<string, unknown> {
  return {
    version: set.recipe.version,
    blueprint: set.recipe.blueprint,
    ...sourceRefs(set),
    recipe: {
      population: set.recipe.population,
      select: set.recipe.select,
      organize: set.recipe.organize,
      present: set.recipe.present,
    },
    funnel: set.funnel,
    coverage: set.coverage ?? null,
    evidence: set.evidence ?? null,
    // 시중 베스트 대비 요소별 비교 — 발행된 세트가 "왜 이게 더 나은가" 를 스스로 들고 있게 한다.
    market: (() => {
      const m = evaluateMarket(set)
      return {
        competitor: m.competitor,
        competitor_title: m.competitor_title,
        all_at_or_above: m.all_at_or_above,
        all_above: m.all_above,
        losing: m.losing,
        beatable_ties: m.beatable_ties,
        mean_delta: m.mean_delta,
        elements: m.elements.map((e) => ({ id: e.id, ours: e.ours, baseline: e.baseline })),
      }
    })(),
    scorecard: {
      total: scorecard.total,
      passed: scorecard.passed,
      metrics: scorecard.metrics.map((m) => ({ id: m.id, score: m.score, weight: m.weight })),
      facets: scorecard.facets.map((f) => ({
        facet: f.facet,
        code: f.code,
        full_ratio: f.full_ratio,
        ready_ratio: f.ready_ratio,
        missing_count: f.missing_count,
      })),
      blockers: scorecard.blockers,
      warnings: scorecard.warnings,
      evaluated_at: scorecard.evaluated_at,
    },
    generated_by: 'lib/vcb/compose/publish.ts',
  }
}

/**
 * 발행 — 멱등. 같은 slug 로 다시 부르면 그 세트의 단어를 교체한다.
 *
 * 원자성: 새 단어를 넣는 동안 세트를 `is_published=false` 로 내려 둔다. RPC 없이 트랜잭션을
 * 쓸 수 없으므로, **반쯤 채워진 세트가 학습자에게 보이는 것**만은 이 순서로 막는다.
 * (기존 4 생성기는 이 보호가 없어 재실행 중 세트가 비어 보일 수 있었다.)
 */
export async function publishComposedSet(
  client: SupabaseClient,
  set: ComposedSet,
  opts: PublishOptions = {},
): Promise<PublishOutcome> {
  const slug = set.recipe.meta.slug
  const scorecard =
    opts.scorecard ?? evaluateSet(set, { existingWords: opts.existingWords, now: new Date().toISOString() })

  if (!opts.force && (!scorecard.passed || scorecard.total < PASS_THRESHOLD)) {
    return {
      ok: false,
      slug,
      scorecard,
      blocked_by:
        scorecard.blockers.length > 0
          ? scorecard.blockers
          : [`총점 ${scorecard.total.toFixed(2)} < 통과선 ${PASS_THRESHOLD}`],
      error: '평가 통과선 미달 — force 없이 발행하지 않는다',
    }
  }

  if (set.entries.length === 0) {
    return { ok: false, slug, scorecard, error: '빈 세트는 발행하지 않는다' }
  }

  const meta = set.recipe.meta

  try {
    // 1) 세트 행 — 내려 둔 상태로 upsert
    const { data: existing, error: findErr } = await client
      .from('shared_word_sets')
      .select('id, version')
      .eq('slug', slug)
      .maybeSingle()
    if (findErr) throw new Error(`slug 조회 실패: ${findErr.message}`)

    const prev = existing as { id: string; version: number | null } | null
    const nextVersion = (prev?.version ?? 0) + 1

    const setRow = {
      slug,
      title: meta.title,
      description: meta.description,
      category: meta.category,
      subcategory: meta.subcategory,
      cefr_level: meta.target_cefr_range[0] ?? null,
      cover_emoji: meta.cover_emoji,
      auto_curated: true,
      is_published: false,
      word_count: 0,
      curation_query: buildCurationQuery(set, scorecard),
      version: nextVersion,
      // 출판 정보 — 교재의 `textbook_volume_renders` 와 같은 자리(마이그레이션 20260830160000).
      //
      //   · 지문: 지금 규격의 해시. **색을 복사하지 않는다** — 토큰이 정본이다.
      //     나중에 토큰이 바뀌면 이 값이 현재 지문과 달라지므로, 화면이 "옛 규격으로
      //     만들어진 권" 을 가려낼 수 있다.
      //   · 계단: 청사진이 열리는 바닥과 표제어 난이도 중 **높은 쪽**. 둘 다 모르면 null 로
      //     두고 화면이 추정으로 내려간다 — 짐작한 값을 굳혀 두지 않는다.
      brand_fingerprint: vocabBrandFingerprint(),
      ladder_step: resolveLadderStep({
        blueprint: set.recipe.blueprint,
        suggested: rungForSet({
          category: meta.category,
          cefrLevel: meta.target_cefr_range[0] ?? null,
        }).rung?.step ?? null,
      }),
    }

    let setId: string
    if (prev) {
      const { error } = await client.from('shared_word_sets').update(setRow).eq('id', prev.id)
      if (error) throw new Error(`세트 갱신 실패: ${error.message}`)
      setId = prev.id
    } else {
      const { data, error } = await client
        .from('shared_word_sets')
        .insert(setRow)
        .select('id')
        .single()
      if (error || !data) throw new Error(`세트 생성 실패: ${error?.message ?? 'unknown'}`)
      setId = (data as { id: string }).id
    }

    // 2) 기존 단어 제거 (멱등)
    const { error: delErr } = await client.from('shared_words').delete().eq('set_id', setId)
    if (delErr) throw new Error(`기존 단어 삭제 실패: ${delErr.message}`)

    // 3) 새 단어 삽입
    const rows = toSharedWords(set, setId)
    for (let i = 0; i < rows.length; i += WORD_CHUNK) {
      const { error } = await client.from('shared_words').insert(rows.slice(i, i + WORD_CHUNK))
      if (error) throw new Error(`단어 삽입 실패(${i}): ${error.message}`)
    }

    // 4) 공개
    const { error: pubErr } = await client
      .from('shared_word_sets')
      .update({
        is_published: true,
        word_count: rows.length,
        regenerated_at: new Date().toISOString(),
      })
      .eq('id', setId)
    if (pubErr) throw new Error(`공개 전환 실패: ${pubErr.message}`)

    void opts.published_by

    return { ok: true, set_id: setId, slug, published_count: rows.length, scorecard }
  } catch (err) {
    return {
      ok: false,
      slug,
      scorecard,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
