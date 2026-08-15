// apps/web/src/lib/vcb/compose/resolve.ts
//
// 모집단 해석 — PopulationSpec → CandidateWord[]. DB 클라이언트를 인자로 받는다
// ('use server' 를 붙이지 않는 이유: 서버 액션과 통합 테스트가 같은 코드를 써야 한다).
//
// 여기가 기존 5 생성기의 SQL 이 모이는 곳이다. 같은 조회가 다섯 벌 있으면 한 벌만 고쳐지는 날이
// 오고, 그날 세트들이 조용히 갈라진다 (실측: NOISE register 6개가 두 스크립트에 복붙돼 있었다).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CandidateWord, PopulationSpec } from './types'

/** shared_dictionary 에서 후보 조립에 쓰는 컬럼 — 한 곳에서만 정의한다. */
const DICT_COLUMNS = [
  'word',
  'meaning_ko',
  'pos',
  'primary_pos',
  'cefr_level',
  'v_level',
  'frequency_rank',
  'frequency_band',
  'word_register',
  'ipa',
  'audio_url',
  'audio_url_us',
  'image_url',
  'example_en',
  'collocations',
  'synonyms',
  'antonyms',
  'homophones',
  'rhyme_key',
  'senses',
  'mnemonic_ko',
  'korean_learner_note',
  'base_word',
  'derivation_suffix',
  'derived_forms',
  'inflected_forms',
  'verified',
].join(', ')

interface DictRow {
  word: string
  meaning_ko: string | null
  pos: string | null
  primary_pos: string | null
  cefr_level: string | null
  v_level: number | null
  frequency_rank: number | null
  frequency_band: string | null
  word_register: string | null
  ipa: string | null
  audio_url: string | null
  audio_url_us: string | null
  image_url: string | null
  example_en: string | null
  collocations: string[] | null
  synonyms: string[] | null
  antonyms: string[] | null
  homophones: string[] | null
  rhyme_key: string | null
  senses: unknown
  mnemonic_ko: string | null
  korean_learner_note: string | null
  base_word: string | null
  derivation_suffix: string | null
  derived_forms: string[] | null
  inflected_forms: string[] | null
  verified: boolean | null
}

function senseCount(senses: unknown): number {
  if (Array.isArray(senses)) return senses.length
  return senses ? 1 : 0
}

export function toCandidate(row: DictRow): CandidateWord {
  return {
    word: row.word,
    lemma: null,
    meaning_ko: row.meaning_ko,
    pos: row.pos,
    primary_pos: row.primary_pos,
    cefr_level: row.cefr_level,
    v_level: row.v_level,
    frequency_rank: row.frequency_rank,
    frequency_band: row.frequency_band,
    word_register: row.word_register,
    ipa: row.ipa,
    audio_url: row.audio_url ?? row.audio_url_us ?? null,
    image_url: row.image_url,
    example_en: row.example_en,
    collocations: row.collocations ?? [],
    synonyms: row.synonyms ?? [],
    antonyms: row.antonyms ?? [],
    homophones: row.homophones ?? [],
    rhyme_key: row.rhyme_key,
    sense_count: senseCount(row.senses),
    mnemonic_ko: row.mnemonic_ko,
    korean_learner_note: row.korean_learner_note,
    base_word: row.base_word,
    derivation_suffix: row.derivation_suffix,
    derived_forms: row.derived_forms ?? [],
    inflected_forms: row.inflected_forms ?? [],
    verified: row.verified ?? false,
  }
}

const CHUNK = 300

/**
 * 구(phrase) 후보에 **머리 동사의 굴절형**을 붙인다.
 *
 * `bring about` 행에는 굴절형이 없지만 예문은 "brought about" 이다. 머리 동사 `bring` 은
 * 자기 행에 `brought·bringing·brings` 를 들고 있으므로 그것을 구 후보로 옮겨 오면
 * "예문이 이 표제어를 담고 있나" 를 추측이 아니라 데이터로 판정할 수 있다
 * (Round 13 실측: 구동사 예문 실패 19건이 전부 불규칙 과거였다).
 */
async function attachPhraseHeadInflections(
  client: SupabaseClient,
  candidates: CandidateWord[],
): Promise<void> {
  const heads = new Set<string>()
  for (const c of candidates) {
    const w = c.word.trim()
    if (!/\s/.test(w)) continue
    const head = w.split(/\s+/)[0]!.toLowerCase()
    if (head.length >= 2) heads.add(head)
  }
  if (heads.size === 0) return

  const list = [...heads]
  const byHead = new Map<string, string[]>()
  for (let i = 0; i < list.length; i += CHUNK) {
    const { data, error } = await client
      .from('shared_dictionary')
      .select('word, inflected_forms')
      .in('word', list.slice(i, i + CHUNK))
    if (error) return // 보조 정보다 — 실패해도 조립을 막지 않는다
    for (const r of (data ?? []) as unknown as { word: string; inflected_forms: string[] | null }[]) {
      if (r.inflected_forms && r.inflected_forms.length > 0) {
        byHead.set(r.word.toLowerCase(), r.inflected_forms)
      }
    }
  }

  for (const c of candidates) {
    const w = c.word.trim()
    if (!/\s/.test(w)) continue
    const forms = byHead.get(w.split(/\s+/)[0]!.toLowerCase())
    if (forms) c.inflected_forms = [...new Set([...c.inflected_forms, ...forms])]
  }
}

/** 단어 목록 → 사전 행. 관계 기반 모집단(roots/topics/corpus)이 전부 이걸 거친다. */
export async function hydrate(
  client: SupabaseClient,
  words: string[],
): Promise<Map<string, CandidateWord>> {
  const out = new Map<string, CandidateWord>()
  const uniq = [...new Set(words.map((w) => w.toLowerCase()))]

  for (let i = 0; i < uniq.length; i += CHUNK) {
    const slice = uniq.slice(i, i + CHUNK)
    const { data, error } = await client.from('shared_dictionary').select(DICT_COLUMNS).in('word', slice)
    if (error) throw new Error(`hydrate failed: ${error.message}`)
    for (const row of (data ?? []) as unknown as DictRow[]) {
      out.set(row.word.toLowerCase(), toCandidate(row))
    }
  }
  return out
}

export interface ResolveOptions {
  /** 모집단 상한 — 사전 전체(45,688)를 매번 끌어오지 않기 위한 안전핀 */
  maxPopulation?: number
  /** 사전 모집단에 미리 밀어 넣을 필터 (select 가 다시 검사하지만 전송량을 줄인다) */
  pushdown?: {
    v_level_min?: number | null
    v_level_max?: number | null
    freq_bands?: string[]
    primary_pos?: string[]
    verified_only?: boolean
    require_example?: boolean
    require_ipa?: boolean
  }
}

const DEFAULT_MAX = 12000

// ── dictionary ──────────────────────────────────────────────────────

async function resolveDictionary(
  client: SupabaseClient,
  opts: ResolveOptions,
): Promise<CandidateWord[]> {
  const max = opts.maxPopulation ?? DEFAULT_MAX
  const p = opts.pushdown ?? {}
  const out: CandidateWord[] = []
  const PAGE = 1000

  for (let from = 0; from < max; from += PAGE) {
    let q = client
      .from('shared_dictionary')
      .select(DICT_COLUMNS)
      .not('meaning_ko', 'is', null)
      // 분류되지 않은 행은 v_level 신뢰도가 없다 — 기존 스크립트 3종이 모두 이 조건을 썼다.
      .not('classified_by', 'is', null)
      .order('frequency_rank', { ascending: true, nullsFirst: false })
      .range(from, Math.min(from + PAGE, max) - 1)

    if (p.v_level_min != null) q = q.gte('v_level', p.v_level_min)
    if (p.v_level_max != null) q = q.lte('v_level', p.v_level_max)
    if (p.freq_bands && p.freq_bands.length > 0) q = q.in('frequency_band', p.freq_bands)
    if (p.primary_pos && p.primary_pos.length > 0) q = q.in('primary_pos', p.primary_pos)
    if (p.verified_only) q = q.eq('verified', true)
    if (p.require_example) q = q.not('example_en', 'is', null)
    if (p.require_ipa) q = q.not('ipa', 'is', null)

    const { data, error } = await q
    if (error) throw new Error(`dictionary population failed: ${error.message}`)
    const rows = (data ?? []) as unknown as DictRow[]
    for (const r of rows) out.push(toCandidate(r))
    if (rows.length < PAGE) break
  }

  await attachPhraseHeadInflections(client, out)
  return out
}

// ── list ────────────────────────────────────────────────────────────

async function resolveList(
  client: SupabaseClient,
  tags: string[],
  mode: 'any' | 'all',
  opts: ResolveOptions,
): Promise<CandidateWord[]> {
  const max = opts.maxPopulation ?? DEFAULT_MAX
  const out: CandidateWord[] = []
  const PAGE = 1000

  for (let from = 0; from < max; from += PAGE) {
    let q = client
      .from('shared_dictionary')
      .select(DICT_COLUMNS)
      .not('meaning_ko', 'is', null)
      .order('frequency_rank', { ascending: true, nullsFirst: false })
      .range(from, Math.min(from + PAGE, max) - 1)

    q = mode === 'all' ? q.contains('list_tags', tags) : q.overlaps('list_tags', tags)

    const { data, error } = await q
    if (error) throw new Error(`list population failed: ${error.message}`)
    const rows = (data ?? []) as unknown as DictRow[]
    for (const r of rows) out.push(toCandidate(r))
    if (rows.length < PAGE) break
  }
  await attachPhraseHeadInflections(client, out)
  return out
}

// ── roots ───────────────────────────────────────────────────────────

async function resolveRoots(
  client: SupabaseClient,
  spec: Extract<PopulationSpec, { kind: 'roots' }>,
): Promise<CandidateWord[]> {
  const { data: roots, error: rErr } = await client
    .from('word_roots')
    .select('id, root, gloss_ko, origin, notes')
  if (rErr) throw new Error(`word_roots failed: ${rErr.message}`)

  const rootById = new Map<number, { root: string; gloss_ko: string | null }>()
  for (const r of (roots ?? []) as unknown as {
    id: number
    root: string
    gloss_ko: string | null
  }[]) {
    rootById.set(r.id, { root: r.root, gloss_ko: r.gloss_ko })
  }

  const links: { word: string; root_id: number; affix_type: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    let q = client.from('word_root_links').select('word, root_id, affix_type').range(from, from + 999)
    if (spec.root_ids && spec.root_ids.length > 0) q = q.in('root_id', spec.root_ids)
    if (spec.affix_types && spec.affix_types.length > 0) q = q.in('affix_type', spec.affix_types)
    const { data, error } = await q
    if (error) throw new Error(`word_root_links failed: ${error.message}`)
    const rows = (data ?? []) as unknown as typeof links
    links.push(...rows)
    if (rows.length < 1000) break
  }

  // 어근 생산성 — 링크가 많은 어근이 챕터로 더 값나간다 (기존 roots-publish-set 과 같은 규칙).
  const productivity = new Map<number, number>()
  for (const l of links) productivity.set(l.root_id, (productivity.get(l.root_id) ?? 0) + 1)

  const dict = await hydrate(
    client,
    links.map((l) => l.word),
  )

  // 단어 하나가 여러 어근에 걸리면 대표 어근을 하나 고른다:
  // affix_type='root' 우선, 동률이면 생산성 높은 쪽.
  const best = new Map<string, { root_id: number; score: number }>()
  for (const l of links) {
    const key = l.word.toLowerCase()
    const isRoot = (l.affix_type ?? 'root') === 'root'
    const score = (isRoot ? 1_000_000 : 0) + (productivity.get(l.root_id) ?? 0)
    const cur = best.get(key)
    if (!cur || score > cur.score) best.set(key, { root_id: l.root_id, score })
  }

  const out: CandidateWord[] = []
  for (const [word, pick] of best) {
    const c = dict.get(word)
    if (!c) continue
    const root = rootById.get(pick.root_id)
    out.push({
      ...c,
      group_keys: [
        {
          key: `root:${pick.root_id}`,
          label: root ? `${root.root} — ${root.gloss_ko ?? ''}`.trim() : `어근 #${pick.root_id}`,
          rank: -(productivity.get(pick.root_id) ?? 0),
        },
      ],
    })
  }
  return out
}

// ── topics ──────────────────────────────────────────────────────────

async function resolveTopics(
  client: SupabaseClient,
  spec: Extract<PopulationSpec, { kind: 'topics' }>,
): Promise<CandidateWord[]> {
  const { data: cats, error } = await client
    .from('dictionary_categories')
    .select('id, level, parent_id, name_ko, name_en, sort_order')
  if (error) throw new Error(`dictionary_categories failed: ${error.message}`)

  type Cat = {
    id: string
    level: number
    parent_id: string | null
    name_ko: string
    sort_order: number | null
  }
  const all = (cats ?? []) as unknown as Cat[]
  const byId = new Map(all.map((c) => [c.id, c]))
  const childrenOf = (id: string): Cat[] => all.filter((c) => c.parent_id === id)

  const l1 = all.filter((c) => c.level === 1)
  const targets =
    spec.themes && spec.themes.length > 0 ? l1.filter((c) => spec.themes!.includes(c.name_ko)) : l1

  // 롤업 레벨 = 챕터가 될 층. 기본 2 (L1 테마 = 세트, L2 = 챕터, L3 매핑을 L2 로 올린다).
  const rollup = spec.rollup_level ?? 2

  // 챕터(L2) → 그 아래 모든 카테고리 id
  const chapterOf = new Map<string, { key: string; label: string; rank: number }>()
  for (const t of targets) {
    const l2s = childrenOf(t.id)
    const chapters = rollup === 1 ? [t] : l2s
    for (const ch of chapters) {
      const stack = [ch.id]
      const seen = new Set<string>()
      while (stack.length > 0) {
        const id = stack.pop()!
        if (seen.has(id)) continue
        seen.add(id)
        chapterOf.set(id, {
          key: `topic:${ch.id}`,
          label: ch.name_ko,
          rank: ch.sort_order ?? 0,
        })
        for (const c of childrenOf(id)) stack.push(c.id)
      }
    }
  }

  const catIds = [...chapterOf.keys()]
  if (catIds.length === 0) return []

  const links: { word: string; category_id: string; rank_in_category: number | null }[] = []
  for (let i = 0; i < catIds.length; i += 100) {
    const slice = catIds.slice(i, i + 100)
    for (let from = 0; ; from += 1000) {
      const { data, error: lErr } = await client
        .from('dictionary_word_categories')
        .select('word, category_id, rank_in_category')
        .in('category_id', slice)
        .range(from, from + 999)
      if (lErr) throw new Error(`dictionary_word_categories failed: ${lErr.message}`)
      const rows = (data ?? []) as unknown as typeof links
      links.push(...rows)
      if (rows.length < 1000) break
    }
  }

  const dict = await hydrate(
    client,
    links.map((l) => l.word),
  )

  // 한 단어가 여러 카테고리에 걸리면 rank_in_category 가 낮은(대표적인) 쪽을 챕터로 삼는다.
  const best = new Map<string, { chapter: { key: string; label: string; rank: number }; rank: number }>()
  for (const l of links) {
    const ch = chapterOf.get(l.category_id)
    if (!ch) continue
    const key = l.word.toLowerCase()
    const rank = l.rank_in_category ?? 9999
    const cur = best.get(key)
    if (!cur || rank < cur.rank) best.set(key, { chapter: ch, rank })
  }

  const out: CandidateWord[] = []
  for (const [word, pick] of best) {
    const c = dict.get(word)
    if (!c) continue
    out.push({ ...c, group_keys: [pick.chapter] })
  }
  void byId
  return out
}

// ── corpus ──────────────────────────────────────────────────────────

interface LbvRow {
  word: string
  lemma: string | null
  chapter_idx: number | null
  frequency_in_book: number | null
  frequency_in_chapter: number | null
  first_sentence: string | null
  noise_kind: string | null
}

async function resolveCorpusBook(
  client: SupabaseClient,
  spec: Extract<PopulationSpec, { kind: 'corpus' }>,
): Promise<CandidateWord[]> {
  const bookId = spec.ids[0]
  if (!bookId) return []

  const rows: LbvRow[] = []
  for (let from = 0; ; from += 1000) {
    let q = client
      .from('library_book_vocabularies')
      .select('word, lemma, chapter_idx, frequency_in_book, frequency_in_chapter, first_sentence, noise_kind')
      .eq('library_book_id', bookId)
      .is('noise_kind', null)
      .range(from, from + 999)

    if (spec.scope === 'chapter_range') {
      if (spec.chapter_from != null) q = q.gte('chapter_idx', spec.chapter_from)
      if (spec.chapter_to != null) q = q.lte('chapter_idx', spec.chapter_to)
    }

    const { data, error } = await q
    if (error) throw new Error(`library_book_vocabularies failed: ${error.message}`)
    const batch = (data ?? []) as unknown as LbvRow[]
    rows.push(...batch)
    if (batch.length < 1000) break
  }

  // ⚠️ 이 테이블의 실제 구조 (2026-08-14 실측):
  //   UNIQUE(library_book_id, word) — **책당 단어 한 행**이다. `chapter_idx` 는 첫 등장 챕터,
  //   `frequency_in_chapter` 는 그 첫 챕터에서의 횟수, `frequency_in_book` 은 책 전체 횟수.
  //   (표본 Pride and Prejudice: 4,516행 = 4,516단어 · 토큰 45,411 · 62% 가 첫 챕터 밖에서 재등장)
  //
  // 그래서 "앞으로 몇 번 더 만나나"(U2) = frequency_in_book − frequency_in_chapter 다.
  // 챕터별 행을 훑어 세려던 첫 구현은 구조상 항상 0 을 냈다 (Round 1 실측: 0.00 vs 0.00).

  // 같은 단어가 여러 챕터에 있다 → 합산하고 첫 등장 챕터·문장을 대표로 삼는다.
  interface Agg {
    freq: number
    bookFreq: number
    chapter: number | null
    sentence: string | null
  }
  const agg = new Map<string, Agg>()
  for (const r of rows) {
    const key = r.word.toLowerCase()
    const cur = agg.get(key)
    const chFreq = Math.max(1, r.frequency_in_chapter ?? 1)
    if (!cur) {
      agg.set(key, {
        freq: chFreq,
        bookFreq: Math.max(r.frequency_in_book ?? chFreq, chFreq),
        chapter: r.chapter_idx,
        sentence: r.first_sentence,
      })
      continue
    }
    // UNIQUE 제약이 있으므로 여기 오는 일은 없지만, 제약이 바뀌어도 합이 깨지지 않게 둔다.
    cur.freq += chFreq
    cur.bookFreq = Math.max(cur.bookFreq, r.frequency_in_book ?? 0)
    if (r.chapter_idx != null && (cur.chapter == null || r.chapter_idx < cur.chapter)) {
      cur.chapter = r.chapter_idx
      if (r.first_sentence) cur.sentence = r.first_sentence
    }
    if (!cur.sentence && r.first_sentence) cur.sentence = r.first_sentence
  }

  const dict = await hydrate(client, [...agg.keys()])

  const out: CandidateWord[] = []
  for (const [word, a] of agg) {
    const c = dict.get(word)
    if (!c) continue
    out.push({
      ...c,
      // 책 전체 세트는 책 빈도가 커버리지 무게이고, 챕터 범위 세트는 그 챕터에서의 빈도다.
      corpus_freq: spec.scope === 'book' ? a.bookFreq : a.freq,
      corpus_sentence: a.sentence,
      corpus_chapter: a.chapter,
      future_encounters: Math.max(0, a.bookFreq - a.freq),
    })
  }
  return out
}

/** texts / articles — 본문에서 추출된 단어 세트. 현재 경로는 shared_words 의 글 단어장. */
async function resolveCorpusText(
  client: SupabaseClient,
  spec: Extract<PopulationSpec, { kind: 'corpus' }>,
): Promise<CandidateWord[]> {
  if (spec.ids.length === 0) return []

  const { data, error } = await client
    .from('shared_words')
    .select('word, source_sentence, chapter')
    .in('set_id', spec.ids)
  if (error) throw new Error(`shared_words(text) failed: ${error.message}`)

  const rows = (data ?? []) as unknown as {
    word: string
    source_sentence: string | null
    chapter: number | null
  }[]
  const dict = await hydrate(
    client,
    rows.map((r) => r.word),
  )

  const out: CandidateWord[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const key = r.word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const c = dict.get(key)
    if (!c) continue
    out.push({
      ...c,
      corpus_freq: 1,
      corpus_sentence: r.source_sentence,
      corpus_chapter: r.chapter,
    })
  }
  return out
}

// ── exam_items ──────────────────────────────────────────────────────

async function resolveExamItems(
  client: SupabaseClient,
  spec: Extract<PopulationSpec, { kind: 'exam_items' }>,
): Promise<CandidateWord[]> {
  const { data: src, error: sErr } = await client
    .from('frequency_data_sources')
    .select('id, source_key')
    .eq('source_key', spec.source_key)
    .maybeSingle()
  if (sErr) throw new Error(`frequency_data_sources failed: ${sErr.message}`)
  if (!src) return []

  const sourceId = (src as { id: number }).id
  interface FreqRow {
    lemma: string
    raw_count: number | null
    frequency_tier: number | null
    metadata: { years_appeared?: unknown[]; question_history?: Record<string, number[]> } | null
  }
  const rows: FreqRow[] = []
  for (let from = 0; ; from += 1000) {
    let q = client
      .from('lexicon_frequencies')
      .select('lemma, raw_count, frequency_tier, metadata')
      .eq('source_id', sourceId)
      .order('rank_in_source', { ascending: true })
      .range(from, from + 999)
    // raw_count = 출제된 연도 수 (kice 시드가 그렇게 넣는다) → min_years 와 같은 축이다.
    if (spec.min_years != null) q = q.gte('raw_count', spec.min_years)
    if (spec.raw_count_min != null) q = q.gte('raw_count', spec.raw_count_min)
    if (spec.frequency_tier_min != null) q = q.gte('frequency_tier', spec.frequency_tier_min)
    const { data, error } = await q
    if (error) throw new Error(`lexicon_frequencies failed: ${error.message}`)
    const batch = (data ?? []) as unknown as FreqRow[]
    rows.push(...batch)
    if (batch.length < 1000) break
  }

  // 문항유형 필터 — {연도: [문항번호]} 안에 요청 번호가 하나라도 있으면 통과.
  const wanted = spec.question_nos
  const filtered =
    wanted && wanted.length > 0
      ? rows.filter((r) => {
          const qh = r.metadata?.question_history
          if (!qh) return false
          for (const nos of Object.values(qh)) {
            for (const n of nos ?? []) if (wanted.includes(Number(n))) return true
          }
          return false
        })
      : rows

  const dict = await hydrate(
    client,
    filtered.map((r) => r.lemma),
  )
  const out: CandidateWord[] = []
  for (const r of filtered) {
    const c = dict.get(r.lemma.toLowerCase())
    if (c) out.push(c)
  }
  return out
}

// ── learner ─────────────────────────────────────────────────────────

async function resolveLearner(
  client: SupabaseClient,
  spec: Extract<PopulationSpec, { kind: 'learner' }>,
): Promise<CandidateWord[]> {
  if (!spec.user_id) return []

  if (spec.state === 'unknown' || spec.state === 'known') {
    const verdict = spec.state === 'known' ? 'known' : 'unknown'
    const { data, error } = await client
      .from('word_familiarity')
      .select('lemma')
      .eq('user_id', spec.user_id)
      .eq('verdict', verdict)
    if (error) throw new Error(`word_familiarity failed: ${error.message}`)
    const words = ((data ?? []) as unknown as { lemma: string }[]).map((r) => r.lemma)
    const dict = await hydrate(client, words)
    return [...dict.values()]
  }

  // risk / shaky / due — FSRS 상태. memory_state 는 저장 금지이므로 여기서 계산하지 않고
  // next_review_at 기준으로만 뽑는다 (상태 분류는 lib/srs/state.ts 가 유일한 SSoT).
  const { data, error } = await client
    .from('vocabularies')
    .select('word, next_review_at, review_count')
    .eq('user_id', spec.user_id)
    .gt('review_count', 0)
    .order('next_review_at', { ascending: true })
    .limit(2000)
  if (error) throw new Error(`vocabularies failed: ${error.message}`)

  const words = ((data ?? []) as unknown as { word: string }[]).map((r) => r.word)
  const dict = await hydrate(client, words)
  return [...dict.values()]
}

// ── 기지 어휘 ───────────────────────────────────────────────────────

/**
 * 이 학습자가 이미 아는 단어 — `unlock` 의 차감 입력.
 *
 * 두 출처를 합친다: `word_familiarity.verdict='known'`(추출 화면에서 "알아요") +
 * FSRS 로 충분히 익은 것. 후자는 `memory_state` 컬럼이 없으므로(저장 금지) 여기서
 * review_count 와 stability 로 근사한다.
 */
export async function fetchKnownWords(
  client: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const known = new Set<string>()

  const { data: fam, error: fErr } = await client
    .from('word_familiarity')
    .select('lemma')
    .eq('user_id', userId)
    .eq('verdict', 'known')
  if (fErr) throw new Error(`word_familiarity failed: ${fErr.message}`)
  for (const r of (fam ?? []) as unknown as { lemma: string }[]) known.add(r.lemma.toLowerCase())

  const { data: vocab, error: vErr } = await client
    .from('vocabularies')
    .select('word, review_count, stability')
    .eq('user_id', userId)
    .gte('review_count', 3)
  if (vErr) throw new Error(`vocabularies failed: ${vErr.message}`)
  for (const r of (vocab ?? []) as unknown as {
    word: string
    stability: number | null
  }[]) {
    // stability 21일 ≈ 3주 유지 — 세트에서 빼도 잊히지 않을 선. 하드 게이트가 아니라 차감 기준이다.
    if ((r.stability ?? 0) >= 21) known.add(r.word.toLowerCase())
  }

  return known
}

/** 이미 발행된 세트의 단어 — 평가기의 novelty 입력. */
export async function fetchPublishedWords(
  client: SupabaseClient,
  opts: { categories?: string[]; limitSets?: number } = {},
): Promise<Set<string>> {
  let setQuery = client.from('shared_word_sets').select('id').eq('is_published', true)
  if (opts.categories && opts.categories.length > 0) {
    setQuery = setQuery.in('category', opts.categories)
  }
  setQuery = setQuery.limit(opts.limitSets ?? 200)

  const { data: sets, error } = await setQuery
  if (error) throw new Error(`shared_word_sets failed: ${error.message}`)
  const ids = ((sets ?? []) as unknown as { id: string }[]).map((s) => s.id)
  if (ids.length === 0) return new Set()

  const out = new Set<string>()
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50)
    for (let from = 0; ; from += 1000) {
      const { data, error: wErr } = await client
        .from('shared_words')
        .select('word')
        .in('set_id', slice)
        .range(from, from + 999)
      if (wErr) throw new Error(`shared_words failed: ${wErr.message}`)
      const rows = (data ?? []) as unknown as { word: string }[]
      for (const r of rows) out.add(r.word.toLowerCase())
      if (rows.length < 1000) break
    }
  }
  return out
}

// ── 진입점 ──────────────────────────────────────────────────────────

export async function resolvePopulation(
  client: SupabaseClient,
  spec: PopulationSpec,
  opts: ResolveOptions = {},
): Promise<CandidateWord[]> {
  switch (spec.kind) {
    case 'dictionary':
      return resolveDictionary(client, opts)
    case 'list':
      return resolveList(client, spec.tags as string[], spec.mode, opts)
    case 'roots':
      return resolveRoots(client, spec)
    case 'topics':
      return resolveTopics(client, spec)
    case 'corpus':
      return spec.scope === 'book' || spec.scope === 'chapter_range'
        ? resolveCorpusBook(client, spec)
        : resolveCorpusText(client, spec)
    case 'exam_items':
      return resolveExamItems(client, spec)
    case 'learner':
      return resolveLearner(client, spec)
    case 'published': {
      // except 의 오른쪽에서는 단어 목록만 쓰이므로 사전 hydrate 없이 껍데기로 넘긴다
      // (1,300 세트 6만 단어를 hydrate 하면 그 자체가 몇 분이다).
      const words = await fetchPublishedWords(client, { categories: spec.categories, limitSets: 400 })
      return [...words].map(
        (w): CandidateWord => ({
          word: w,
          lemma: null,
          meaning_ko: null,
          pos: null,
          primary_pos: null,
          cefr_level: null,
          v_level: null,
          frequency_rank: null,
          frequency_band: null,
          word_register: null,
          ipa: null,
          audio_url: null,
          image_url: null,
          example_en: null,
          collocations: [],
          synonyms: [],
          antonyms: [],
          homophones: [],
          rhyme_key: null,
          sense_count: 0,
          mnemonic_ko: null,
          korean_learner_note: null,
          base_word: null,
          derivation_suffix: null,
          derived_forms: [],
          inflected_forms: [],
          verified: false,
        }),
      )
    }
    case 'union': {
      const parts = await Promise.all(spec.of.map((s) => resolvePopulation(client, s, opts)))
      const merged = new Map<string, CandidateWord>()
      for (const part of parts) for (const c of part) merged.set(c.word.toLowerCase(), c)
      return [...merged.values()]
    }
    case 'intersect': {
      const parts = await Promise.all(spec.of.map((s) => resolvePopulation(client, s, opts)))
      if (parts.length === 0) return []
      const [first, ...rest] = parts
      const sets = rest.map((p) => new Set(p.map((c) => c.word.toLowerCase())))
      return first!.filter((c) => sets.every((s) => s.has(c.word.toLowerCase())))
    }
    case 'except': {
      const [a, b] = await Promise.all(spec.of.map((s) => resolvePopulation(client, s, opts)))
      const minus = new Set((b ?? []).map((c) => c.word.toLowerCase()))
      return (a ?? []).filter((c) => !minus.has(c.word.toLowerCase()))
    }
    default:
      return []
  }
}

/** 레시피의 필터에서 pushdown 을 도출한다 — 전송량을 줄이되 결과는 바꾸지 않는다. */
export function pushdownFrom(recipeFilters: {
  v_level_min: number | null
  v_level_max: number | null
  freq_bands: string[]
  primary_pos: string[]
  verified_only: boolean
  require_fields: string[]
}): ResolveOptions['pushdown'] {
  return {
    v_level_min: recipeFilters.v_level_min,
    v_level_max: recipeFilters.v_level_max,
    freq_bands: recipeFilters.freq_bands,
    primary_pos: recipeFilters.primary_pos,
    verified_only: recipeFilters.verified_only,
    require_example: recipeFilters.require_fields.includes('example_en'),
    require_ipa: recipeFilters.require_fields.includes('ipa'),
  }
}
