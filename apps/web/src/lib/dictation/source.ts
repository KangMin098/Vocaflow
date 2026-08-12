// apps/web/src/lib/dictation/source.ts
//
// 받아쓰기 자료 해석기 — "무엇을 받아쓸 것인가"의 단일 출처.
//
// 왜 이 파일이 생겼나:
//   v06 까지 받아쓰기는 localStorage 하드코딩 시드 3개만 알았다. 도서 12권·챕터 텍스트
//   269·공용 단어장 1,169세트가 DB 에 있는데 그 중 하나도 못 받아썼다. `?text=` 하나만
//   반쪽으로 붙어 있었고 그마저 임시 리소스로 복사해 localStorage 에 넣는 방식이었다.
//
// 스코프 규칙은 프로젝트 공통(`?set=` / `?text=` / `?chapter=`)을 그대로 따른다 —
//   lib/workspace/scoped-words.ts · lib/game/use-word-scope.ts 와 같은 어휘.
//   도서 챕터는 별도 파라미터를 만들지 않는다: enroll 하면 챕터가 곧 texts 행이고,
//   `texts.library_book_id` 유무로 'book' / 'text' 를 판별한다.
//
// ── 타깃 단어 (이 모듈의 핵심) ─────────────────────────────────────
//   문장마다 "이 문장에서 반드시 받아써야 하는 내 단어"를 심는다. 받아쓰기가 단순
//   전사 연습으로 끝나지 않고 **문맥 속 단어 인출**(Context-Dependent Retrieval)이 되며,
//   적중 여부가 그대로 FSRS 등급이 된다 → 받아쓴 단어가 복습 큐에 남는다.
//   굴절형 인식은 matchSurface(사전 inflected_forms + 규칙형)에 위임.

import type { SupabaseClient } from '@supabase/supabase-js'

import { matchSurface } from '@/lib/text/surface-match'
import { loadInflectedForms } from '@/lib/workspace/scoped-words'

import { splitSentences } from './text-splitter'
import type { CEFRCode } from './types'

const CEFR_SET = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

/** DB `dictation_sessions.source_kind` 와 1:1. */
export type DictationSourceKind = 'book' | 'text' | 'set' | 'daily' | 'custom'

/** 오늘의 받아쓰기에서 이 문장이 뽑힌 이유 — 학습자에게 그대로 보여준다. */
export type DailyReason = 'due' | 'retry' | 'fresh'

export interface DictationSentence {
  text: string
  /** 이 문장에서 훈련할 내 단어(원형). 없을 수 있다(순수 전사 문장). */
  targetWords: string[]
  /** 타깃 단어별 굴절형 — 채점 시 표면형 대조에 쓴다. */
  targetForms: Record<string, string[]>
  /** "Chapter 3" · "내 스크립트" 등 출처 라벨 */
  contextLabel?: string
  /** 오늘의 받아쓰기 전용 — 왜 이 문장인가 */
  reason?: DailyReason
  translation?: string
}

export interface DictationSource {
  kind: DictationSourceKind
  title: string
  subtitle: string
  sentences: DictationSentence[]
  cefr?: CEFRCode
  /** DB 적재용 출처 좌표 */
  textId?: string
  libraryBookId?: string
  chapterIdx?: number
  sharedSetId?: string
}

export interface DictationScope {
  set?: string
  text?: string
  chapter?: number | null
  userId: string | null
}

// ── 문장 품질 필터 ────────────────────────────────────────────────
//
// 받아쓰기는 문장 길이가 곧 난이도다. 3단어 문장("He left.")은 훈련이 안 되고,
// 45단어 만연체는 작업기억(§학습원칙6 Cognitive Load ~4항목)을 넘겨 좌절만 남긴다.
// 실측 기준: 고전 도서 원문은 평균 20~25단어라 상한을 넉넉히 둔다.

const MIN_WORDS = 4
const MAX_WORDS = 34

export function countWords(s: string): number {
  return s.split(/\s+/).filter((w) => w.length > 0).length
}

/** 받아쓰기에 쓸 만한 문장인가 — 길이 + 알파벳 비중(챕터 머리글·로마숫자 배제). */
export function isUsableSentence(s: string): boolean {
  const trimmed = s.trim()
  if (trimmed.length < 12) return false
  const words = countWords(trimmed)
  if (words < MIN_WORDS || words > MAX_WORDS) return false
  // "CHAPTER IV." · "* * *" · 각주 번호 등 — 알파벳이 절반 미만이면 본문이 아니다
  const letters = (trimmed.match(/[A-Za-z]/g) ?? []).length
  if (letters / trimmed.length < 0.5) return false
  // 전부 대문자(장 제목·표제)는 제외
  if (trimmed === trimmed.toUpperCase()) return false
  return true
}

// ── 타깃 단어 매칭 ────────────────────────────────────────────────

export interface TargetLemma {
  word: string
  forms: string[]
}

/** 문장에 실제로 등장하는 타깃 단어만 남긴다 (굴절형 인식). */
export function attachTargets(
  sentence: string,
  lemmas: TargetLemma[],
  limit = 3,
): { targetWords: string[]; targetForms: Record<string, string[]> } {
  const hit: string[] = []
  const forms: Record<string, string[]> = {}
  for (const l of lemmas) {
    if (hit.length >= limit) break
    const m = matchSurface(sentence, l.word, l.forms)
    if (m) {
      hit.push(l.word)
      forms[l.word] = l.forms
    }
  }
  return { targetWords: hit, targetForms: forms }
}

/** vocabularies/shared_words 행 → 굴절형까지 채운 TargetLemma[] */
async function toTargetLemmas(
  client: SupabaseClient,
  rows: Array<{ word: string; lemma: string | null }>,
): Promise<TargetLemma[]> {
  const lemmas = rows.map((r) => (r.lemma ?? r.word).toLowerCase()).filter(Boolean)
  const formsMap = await loadInflectedForms(client, [...new Set(lemmas)])
  const seen = new Set<string>()
  const out: TargetLemma[] = []
  for (const r of rows) {
    const key = (r.lemma ?? r.word).toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ word: key, forms: formsMap.get(key) ?? [] })
  }
  return out
}

function normalizeCefr(raw: string | null | undefined): CEFRCode | undefined {
  const code = (raw ?? '').toUpperCase()
  return CEFR_SET.has(code) ? (code as CEFRCode) : undefined
}

// ── ① 스크립트 / 도서 챕터 (texts) ────────────────────────────────

interface TextRow {
  id: string
  title: string | null
  content: string | null
  translation: string | null
  cefr_level: string | null
  library_book_id: string | null
  chapter_idx: number | null
  chapter_title: string | null
}

/**
 * 도서 챕터 본문은 `texts.content` 에 없다.
 *
 * enroll 은 챕터 texts 행만 만들고 본문은 `content_chunks`(해시 중복 제거)에 두므로
 * 도서에서 온 texts 는 content 가 항상 NULL 이다. `v_text_content` 가 두 곳을 합치고,
 * `get_chapter_content` RPC 가 소유자 검사와 함께 그 뷰를 읽는다.
 * (이 사실을 놓쳐 도서 챕터 받아쓰기가 전부 빈손이 되던 것을 e2e 가 잡았다.)
 */
async function loadTextContent(
  client: SupabaseClient,
  row: TextRow,
): Promise<string | null> {
  if (row.content && row.content.trim().length > 0) return row.content
  const { data, error } = await client.rpc('get_chapter_content', { p_text_id: row.id })
  if (error || typeof data !== 'string' || data.trim().length === 0) return null
  return data
}

/**
 * texts.id 한 건 → 문장 목록.
 * library_book_id 가 있으면 kind='book'(도서 챕터), 없으면 kind='text'(내 스크립트).
 * 타깃 단어는 그 텍스트에 묶인 내 vocabularies (도서 enroll 시 챕터 단어장이 여기 들어온다).
 */
export async function resolveTextSource(
  client: SupabaseClient,
  textId: string,
  userId: string | null,
): Promise<DictationSource | null> {
  const { data } = await client
    .from('texts')
    .select(
      'id, title, content, translation, cefr_level, library_book_id, chapter_idx, chapter_title',
    )
    .eq('id', textId)
    .maybeSingle()
  const row = data as TextRow | null
  if (!row) return null

  const content = await loadTextContent(client, row)
  if (!content) return null

  const isBook = !!row.library_book_id
  const chapterLabel = isBook
    ? row.chapter_title || `Chapter ${row.chapter_idx ?? 1}`
    : '내 스크립트'

  let lemmas: TargetLemma[] = []
  if (userId) {
    const { data: vocabData } = await client
      .from('vocabularies')
      .select('word, lemma')
      .eq('user_id', userId)
      .eq('text_id', textId)
      .limit(300)
    lemmas = await toTargetLemmas(
      client,
      (vocabData ?? []) as Array<{ word: string; lemma: string | null }>,
    )
  }

  const raw = splitSentences(content).filter(isUsableSentence)
  const sentences: DictationSentence[] = raw.map((text) => ({
    text,
    ...attachTargets(text, lemmas),
    contextLabel: chapterLabel,
  }))

  // 첫 문장에만 번역을 붙이던 기존 동작 유지 (texts.translation 은 전체 번역이라 문장 대응 불가)
  if (sentences.length > 0 && row.translation) {
    sentences[0] = { ...sentences[0], translation: row.translation }
  }

  const withTargets = sentences.filter((s) => s.targetWords.length > 0).length

  return {
    kind: isBook ? 'book' : 'text',
    title: row.title ?? (isBook ? '도서 챕터' : '내 스크립트'),
    subtitle: isBook
      ? `${chapterLabel} · 문장 ${sentences.length}개${withTargets > 0 ? ` · 내 단어가 든 문장 ${withTargets}개` : ''}`
      : `문장 ${sentences.length}개${withTargets > 0 ? ` · 내 단어가 든 문장 ${withTargets}개` : ''}`,
    sentences,
    cefr: normalizeCefr(row.cefr_level),
    textId: row.id,
    libraryBookId: row.library_book_id ?? undefined,
    chapterIdx: row.chapter_idx ?? undefined,
  }
}

// ── ② 공용 단어장 (shared_word_sets) ──────────────────────────────

interface SharedWordRow {
  word: string
  lemma: string | null
  meaning_ko: string | null
  source_sentence: string | null
  example_en: string | null
  chapter: number | null
}

/**
 * 단어장 → "그 단어가 사는 문장" 받아쓰기.
 *
 * 단어장에는 문장이 없다고들 하는데 사실이 아니다 — `shared_words.source_sentence` 는
 * 그 단어를 뽑아온 **도서 원문 문장**이다(v06.35 이후). 이 문장을 받아쓰면
 * 단어를 문맥째 인출하게 되고, 그게 단어장 단독 암기보다 강하다(§학습원칙5).
 * source_sentence 가 없는 단어(auto-V·specialty 세트)는 example_en 으로 폴백한다.
 *
 * 같은 문장에 여러 단어가 걸리면 문장을 합치고 타깃만 늘린다 — 같은 문장을 두 번
 * 받아쓰게 하지 않는다.
 */
export async function resolveSetSource(
  client: SupabaseClient,
  setId: string,
  chapter: number | null,
): Promise<DictationSource | null> {
  const { data: setData } = await client
    .from('shared_word_sets')
    .select('id, title, cefr_level, curation_query')
    .eq('id', setId)
    .maybeSingle()
  const set = setData as {
    id: string
    title: string
    cefr_level: string | null
    curation_query: Record<string, unknown> | null
  } | null
  if (!set) return null

  let q = client
    .from('shared_words')
    .select('word, lemma, meaning_ko, source_sentence, example_en, chapter')
    .eq('set_id', setId)
  if (chapter != null) q = q.eq('chapter', chapter)
  const { data } = await q.order('sort_order', { ascending: true }).limit(400)
  const rows = (data ?? []) as SharedWordRow[]
  if (rows.length === 0) return null

  const lemmas = await toTargetLemmas(client, rows)
  const formsOf = new Map(lemmas.map((l) => [l.word, l.forms]))

  // 문장 → 타깃 단어 누적 (원문 문장 우선, 없으면 사전 예문)
  const byText = new Map<string, { targets: Set<string>; meaning: string | null }>()
  for (const r of rows) {
    const text = (r.source_sentence ?? r.example_en ?? '').trim()
    if (!text || !isUsableSentence(text)) continue
    const key = (r.lemma ?? r.word).toLowerCase()
    const bucket = byText.get(text) ?? { targets: new Set<string>(), meaning: r.meaning_ko }
    bucket.targets.add(key)
    byText.set(text, bucket)
  }

  const sentences: DictationSentence[] = [...byText.entries()].map(([text, bucket]) => {
    const targetWords = [...bucket.targets].slice(0, 3)
    const targetForms: Record<string, string[]> = {}
    for (const w of targetWords) targetForms[w] = formsOf.get(w) ?? []
    return {
      text,
      targetWords,
      targetForms,
      contextLabel: chapter != null ? `Chapter ${chapter}` : set.title,
    }
  })

  const bookId =
    typeof set.curation_query?.['book_id'] === 'string'
      ? (set.curation_query['book_id'] as string)
      : undefined

  return {
    kind: 'set',
    title: set.title,
    subtitle: `단어 ${rows.length}개가 사는 문장 ${sentences.length}개`,
    sentences,
    cefr: normalizeCefr(set.cefr_level),
    sharedSetId: set.id,
    libraryBookId: bookId,
    chapterIdx: chapter ?? undefined,
  }
}

// ── ③ 직접 붙여넣기 (custom) ──────────────────────────────────────

/** 붙여넣은 글은 sessionStorage 로만 전달한다 — 저장하지 않는 자료라 URL 에 실을 수 없다. */
export const CUSTOM_SCRIPT_KEY = 'vocaflow:dictation:custom'

export interface CustomScript {
  title: string
  script: string
}

export function stashCustomScript(payload: CustomScript): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(CUSTOM_SCRIPT_KEY, JSON.stringify(payload))
  } catch {
    /* quota 초과 등 — 호출부가 null 로 degrade */
  }
}

export function readCustomScript(): CustomScript | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(CUSTOM_SCRIPT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CustomScript
    return parsed?.script ? parsed : null
  } catch {
    return null
  }
}

/**
 * 붙여넣은 글 → 문장 목록.
 *
 * 이 글은 `texts` 에 저장하지 않는다. 저장하려면 추출·레벨 산출 파이프라인을 함께
 * 돌려야 하고(그건 /text/new 의 일이다), 받아쓰기 한 번 하려고 자료 목록을 어지럽힐
 * 이유가 없다. 대신 **받아쓴 기록은 그대로 남는다**(dictation_sessions.source_kind='custom').
 *
 * 저장하지 않아도 내 단어와는 연결한다 — 붙여넣은 글에 내 복습 단어가 있으면 타깃이 된다.
 */
export async function resolveCustomSource(
  client: SupabaseClient,
  payload: CustomScript,
  userId: string | null,
): Promise<DictationSource | null> {
  const sentences0 = splitSentences(payload.script).filter(isUsableSentence)
  if (sentences0.length === 0) return null

  let lemmas: TargetLemma[] = []
  if (userId) {
    const { data } = await client
      .from('vocabularies')
      .select('word, lemma')
      .eq('user_id', userId)
      .order('next_review_at', { ascending: true, nullsFirst: false })
      .limit(300)
    lemmas = await toTargetLemmas(
      client,
      (data ?? []) as Array<{ word: string; lemma: string | null }>,
    )
  }

  const sentences: DictationSentence[] = sentences0.map((text) => ({
    text,
    ...attachTargets(text, lemmas),
    contextLabel: payload.title,
  }))
  const withTargets = sentences.filter((s) => s.targetWords.length > 0).length

  return {
    kind: 'custom',
    title: payload.title,
    subtitle: `문장 ${sentences.length}개${withTargets > 0 ? ` · 내 단어가 든 문장 ${withTargets}개` : ''} · 저장되지 않음`,
    sentences,
  }
}

// ── 진입점 ────────────────────────────────────────────────────────

/**
 * 스코프 → 자료. daily 는 조립 규칙이 달라 lib/dictation/daily.ts 가 담당한다.
 * 여기서는 명시 스코프(`?set=` / `?text=`)만 해석한다.
 */
export async function resolveDictationSource(
  client: SupabaseClient,
  scope: DictationScope & { custom?: boolean },
): Promise<DictationSource | null> {
  if (scope.set) return resolveSetSource(client, scope.set, scope.chapter ?? null)
  if (scope.text) return resolveTextSource(client, scope.text, scope.userId)
  if (scope.custom) {
    const payload = readCustomScript()
    if (!payload) return null
    return resolveCustomSource(client, payload, scope.userId)
  }
  return null
}
