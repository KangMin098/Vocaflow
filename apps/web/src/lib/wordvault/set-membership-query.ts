// apps/web/src/lib/wordvault/set-membership-query.ts
// 선택한 기사 단어장(filter=set:<id>)의 정본 낱말 목록 — 본인 세션 클라이언트(RLS)로 읽는다.
// 발행된 기사 단어장(category library_article)이고 **부모 기사도 발행·한국 권리 안전**일 때만(관리자 세션이 RLS 로
// 더 읽을 수 있어도 공개 학습 관계로 내주지 않는다). 도서 장 세트·기타 필터는 null(기존 origin 판정 그대로).
// 조회 실패는 error 로 돌려준다 — 「단어 0」 이나 전체 목록으로 숨기지 않는다.
// T-0210 — 같은 조회에서 정본 shared_words.source_sentence 와 부모 기사 본문(content)을 함께 읽어, 그 문장이 **지금 기사 본문에 실제로 있는**
//   낱말만 contexts 에 싣는다(추가 왕복 · 쓰기 0). 빈 값 · 불일치 · 본문 없음은 싣지 않는다 — 만들거나 유추하지 않는다.
//   문맥이 하나도 없어도 words(목록 판정)는 그대로다.
import type { SupabaseClient } from '@supabase/supabase-js'

import { buildEvidenceSentenceMap, contentHash } from '@/lib/scriptquiz/reader-anchor'
import { buildParagraphsFromContent } from '@/app/(main)/text/[id]/text-content-helpers'

import { normalizeSourceFilter } from './source-filter'

/** contexts: 낱말(정본 word) → 이 기사 본문에서 확인된 원문 문장. 확인된 것만 있다. */
/** reader(T-0214): 본인이 연 같은 기사 글(texts · source_url article:<id>)의 본문이 지금 기사 본문과 같을 때만 —
 *  textId · 본문 해시(Reader 와 같은 contentHash) · 낱말 → 그 글 본문에서 **유일한 한 문장** 번호. 없거나 실패면 reader 자체가 없다. */
export type SetMembershipReader = { textId: string; hash: string; anchors: Record<string, number> }
export type SetMembershipPayload = { setId: string; words: string[]; contexts?: Record<string, string>; reader?: SetMembershipReader } | { setId: string; error: true }

/** Reader(layout)가 읽는 출처와 같은 열 — v_text_content 의 본문 · 단락 오프셋(T-0214 Codex P1: texts 에는 paragraph_offsets 가 없다). */
export const READER_TEXT_SOURCE = { table: 'v_text_content', columns: 'id, content, paragraph_offsets' } as const

/** Reader 문장(buildParagraphsFromContent — layout 과 같은 함수 · 같은 기본값)의 글자 목록 */
export function readerSentencesOf(content: string, offsets: unknown): Array<{ id: number; text: string }> {
  return buildParagraphsFromContent(content, Array.isArray(offsets) ? (offsets as number[]) : []).flatMap((p) => p.sentences.map((s) => ({ id: s.id, text: s.parts.map((pt) => pt.text).join('') })))
}

/** 겹치는 출현까지 센다(대소문자 무시 · 문장부호 보존 · 공백은 호출부가 정규화) */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) n += 1
  return n
}

/**
 * T-0214 — 「글에서 이 부분 보기」 번호. 경계 결정 T0214_BOUNDARY_DECISION_20261029.md(Rev 1.0, sha e20f3208…)의 공식 — **모두** 참일 때만, 아니면 null:
 *  (2) 공백만 정규화한 출처 S 가 비어 있지 않고 **Reader 표시 단위 하나 전체**와 정확히 같다(문장부호 · 대소문자 보존). 두 단위에 걸치거나
 *      병합된 단위의 일부만 맞으면 없음. 정본 경계는 Reader 단위(buildParagraphsFromContent)뿐 — 두 번째 영어 분리기 · 약어 목록 없음.
 *  (3) 공백 정규화한 원문 본문에서 S 가 **정확히 1회**(대소문자 무시 · 문장부호 보존 · 단락 경계 넘어 셈). 더 긴 표현 안에도 있으면 보수적으로 없음.
 *  (4) 기존 buildEvidenceSentenceMap 으로 바로 그 단위에 풀리는 기존 앵커 번호. 비슷한 · 처음 맞은 다른 단위는 고르지 않는다.
 * (1)·(5) 게이트 · 저장 형식은 호출부(loadOwnArticleReader · rememberEvidenceAnchor) 그대로. T-0209 의 evidenceSentenceIndex 는 바꾸지 않는다.
 */
export function readerAnchorIndex(content: string, readerSentences: ReadonlyArray<{ id: number; text: string }>, sentence: string): number | null {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  const target = norm(sentence)
  if (!target) return null
  const hits = readerSentences.filter((r) => norm(r.text) === target)
  if (hits.length !== 1) return null
  if (countOccurrences(norm(content).toLowerCase(), target.toLowerCase()) !== 1) return null
  const map = buildEvidenceSentenceMap(content, readerSentences)
  const at = map.indexOf(hits[0]!.id)
  return at >= 0 ? at : null
}

/**
 * T-0214 — 「글에서 이 부분 보기」 근거. 세트당 한 번: 본인 글 1행(texts id · article-practice-actions 와 같은 조건) +
 * Reader 와 같은 출처(v_text_content)의 본문 · 단락 오프셋 1행. 본문이 지금 기사 본문과 같을 때만.
 * 본인 글 없음 · 다른 판본 · 조회 실패 · 로그아웃이면 null — 목록 · 문장은 그대로 둔다.
 */
export async function loadOwnArticleReader(client: SupabaseClient, articleId: string, articleBody: string | null, contexts: Record<string, string>): Promise<SetMembershipReader | null> {
  if (!articleBody || Object.keys(contexts).length === 0) return null
  try {
    const uid = (await client.auth.getUser()).data.user?.id
    if (!uid) return null
    const { data: row, error } = await client.from('texts').select('id').eq('user_id', uid).eq('source_url', `article:${articleId}`).maybeSingle()
    if (error || !row) return null
    const textId = (row as { id?: unknown }).id
    if (typeof textId !== 'string') return null
    const { data: tc, error: tcErr } = await client.from(READER_TEXT_SOURCE.table).select(READER_TEXT_SOURCE.columns).eq('id', textId).maybeSingle()
    if (tcErr || !tc) return null
    const content = (tc as { content?: unknown }).content
    if (typeof content !== 'string' || content !== articleBody) return null
    const readerSentences = readerSentencesOf(content, (tc as { paragraph_offsets?: unknown }).paragraph_offsets ?? [])
    const anchors: Record<string, number> = {}
    for (const [word, sentence] of Object.entries(contexts)) {
      const at = readerAnchorIndex(content, readerSentences, sentence)
      if (at !== null) anchors[word] = at
    }
    return Object.keys(anchors).length > 0 ? { textId, hash: contentHash(content), anchors } : null
  } catch {
    return null
  }
}

/** 공백만 정규화해 본문에 그대로 들어 있는지 — 따옴표 · 대소문자 등은 바꾸지 않는다(다르면 싣지 않는다). */
export function verifiedSourceSentence(sentence: unknown, body: string | null): string | null {
  if (typeof sentence !== 'string' || !body) return null
  const s = sentence.replace(/\s+/g, ' ').trim()
  // 길이 하한을 두지 않는다 — 본문과 일치하는 짧은 문장(「Resist!」)도 유효하다(Codex P2). 빈 값만 거른다.
  if (s.length === 0) return null
  return body.replace(/\s+/g, ' ').includes(s) ? s : null
}

const PAGE = 1000

export async function loadArticleSetMembership(client: SupabaseClient, rawFilter: unknown): Promise<SetMembershipPayload | null> {
  const filter = normalizeSourceFilter(rawFilter)
  if (!filter.startsWith('set:')) return null
  const setId = filter.slice(4)
  try {
    const { data: set, error: setErr } = await client
      .from('shared_word_sets')
      .select('id, category, is_published, curation_query')
      .eq('id', setId)
      .maybeSingle()
    if (setErr) throw setErr
    const s = set as { category?: string; is_published?: boolean; curation_query?: { article_id?: unknown } | null } | null
    if (!s || s.category !== 'library_article' || s.is_published !== true) return null
    const articleId = s.curation_query?.article_id
    if (typeof articleId !== 'string') return null
    const { data: art, error: artErr } = await client
      .from('library_articles')
      .select('status, copyright_safe_in_kr, content')
      .eq('id', articleId)
      .maybeSingle()
    if (artErr) throw artErr
    const a = art as { status?: string; copyright_safe_in_kr?: boolean; content?: string | null } | null
    if (!a || a.status !== 'published' || a.copyright_safe_in_kr !== true) return null
    const words: string[] = []
    const contexts: Record<string, string> = {}
    const body = typeof a.content === 'string' ? a.content : null
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from('shared_words').select('id, word, source_sentence').eq('set_id', setId).order('id').range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as Array<{ word?: unknown; source_sentence?: unknown }>
      for (const r of rows) {
        if (typeof r.word !== 'string') continue
        words.push(r.word)
        const ctx = verifiedSourceSentence(r.source_sentence, body)
        if (ctx && !Object.prototype.hasOwnProperty.call(contexts, r.word)) contexts[r.word] = ctx
      }
      if (rows.length < PAGE) break
    }
    if (Object.keys(contexts).length === 0) return { setId, words }
    const reader = await loadOwnArticleReader(client, articleId, body, contexts)
    return reader ? { setId, words, contexts, reader } : { setId, words, contexts }
  } catch {
    return { setId, error: true }
  }
}
