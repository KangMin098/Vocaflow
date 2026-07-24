// packages/library-pipeline/src/analyze/extract-lemmas.ts
// LCP v2.0 — book 전체 chapter의 lemma 통합 추출
// WLP processText를 chapter 단위 호출 + 결과 통합

import { processText } from '@vocaflow/wlp'
import type { ChapterSegment } from '../types'

export interface LemmaOccurrence {
  chapter_idx: number
  frequency_in_chapter: number
  first_sentence_in_chapter: string
  /** Phase 3 — 이 chapter 문맥의 지배 POS (winkNLP → dict 어휘). sense 매칭용. */
  context_pos: string | null
}

// winkNLP universal POS → shared_dictionary pos 어휘 (Phase 3 문맥 sense 매칭용).
const POS_MAP: Record<string, string> = {
  NOUN: 'noun', VERB: 'verb', ADJ: 'adjective', ADV: 'adverb', ADP: 'preposition',
  PRON: 'pronoun', CCONJ: 'conjunction', SCONJ: 'conjunction', AUX: 'verb',
  DET: 'determiner', INTJ: 'interjection', PART: 'particle', NUM: 'number',
}

export interface BookLemmaIndex {
  /** lemma → 등장 정보 (chapter별로 누적, chapter_idx 오름차순) */
  occurrences: Map<string, LemmaOccurrence[]>
  /** lemma → 책 전체 누적 빈도 */
  bookFrequency: Map<string, number>
}

// Phase 14.7.1 — LCP S4 토큰화 정규식 보정
// 학습 가치 0인 노이즈 토큰을 한 번 더 필터 (winkNLP isStopWord/isPunctuation 보완)
const TOKEN_BLOCKLIST = new Set<string>([
  // 호칭
  'mr', 'mrs', 'ms', 'dr', 'sir', 'madam', 'lord', 'lady',
  // contraction 단편 (apostrophe 시작 토큰은 본 검사 규칙에서도 별도 차단)
  "'s", "'t", "'ll", "'re", "'ve", "'d", "'m",
  // contraction 잔여 (winkNLP가 lemma만 떼어내는 경우)
  'll', 're', 've',
  // 약어 (학습 단어 아님 — 200권 평가 잔여, mr/mrs 와 동류)
  'acct', 'dept', 'depts', 'yrs', 'wks', 'wk', 'cts', 'rms', 'mgr', 'mdse', 'recd', 'shipt',
  'yd', 'yds', 'yr', 'hr', 'hrs', 'mos', 'pts', 'doz', 'rm',
])

/**
 * 학습 가치 있는 단어 lemma 인지 판정.
 *
 * 허용: 영문 소문자 + 하이픈/apostrophe 중간 (don't, co-operation OK)
 * 차단:
 *   — 길이 < 2 또는 > 30
 *   — 숫자 포함 (10th, 30,000, 6:30 등)
 *   — 점/콜론 포함 (mr., co., 6:30, u.s.a. 등 약어·시간)
 *   — apostrophe / 하이픈으로 시작 ('s, -ed 등)
 *   — 외래 기호 포함 (café, naïve 등) — Phase 14.8 별도
 *   — TOKEN_BLOCKLIST 적중
 */
function isValidLearningWord(raw: string): boolean {
  const lemma = raw.toLowerCase().trim()
  if (!lemma) return false
  if (lemma.length < 2 || lemma.length > 30) return false
  // 숫자 포함 거부
  if (/\d/.test(lemma)) return false
  // 점/콜론 포함 거부 (약어·시간)
  if (/[.:]/.test(lemma)) return false
  // 영문 + apostrophe + 하이픈만 (외래 기호 거부)
  if (!/^[a-z'-]+$/.test(lemma)) return false
  // 시작/끝이 apostrophe·하이픈이면 거부 ('s, -ed 등)
  if (/^['-]|['-]$/.test(lemma)) return false
  if (TOKEN_BLOCKLIST.has(lemma)) return false
  return true
}

/**
 * 책 전체 chapter의 lemma 추출 + 통합.
 *
 * WLP processText는 chapter 단위로 호출 (winkNLP는 paragraph 이상 단위가 효율적).
 * stopword와 punctuation은 자동 필터링됨 (WLP 기본 옵션).
 */
export function extractBookLemmas(chapters: ChapterSegment[]): BookLemmaIndex {
  const occurrences = new Map<string, LemmaOccurrence[]>()
  const bookFrequency = new Map<string, number>()

  for (const ch of chapters) {
    const result = processText(ch.content)

    // chapter 내 lemma별 빈도 + 첫 등장 sentence index 집계
    const chapterCounts = new Map<
      string,
      { count: number; firstSentenceIdx: number; posCounts: Map<string, number> }
    >()

    for (const sentence of result.sentences) {
      for (const token of sentence.tokens) {
        // stopword/punct는 통계에서 제외 (WLP 기본 옵션과 동일 정책)
        if (token.isStopWord || token.isPunctuation) continue
        // R3 (CLAUDE.md v06.29) — 고유명사 (PROPN) 차단
        //   캐릭터명·지명 (Elizabeth/Darcy/Jim/London/Hispaniola) 학습 vocab 에서 제외.
        //   winkNLP universal POS tag 기준 — 측정상 6권 noise 4~12% 모두 PROPN 패턴.
        if (token.pos === 'PROPN') continue
        // Phase 14.7.1 노이즈 필터 (숫자/약어/외래기호/호칭/contraction)
        if (!isValidLearningWord(token.lemma)) continue

        const mapped = POS_MAP[token.pos] ?? null
        const existing = chapterCounts.get(token.lemma)
        if (existing) {
          existing.count += 1
          if (mapped) existing.posCounts.set(mapped, (existing.posCounts.get(mapped) ?? 0) + 1)
        } else {
          const posCounts = new Map<string, number>()
          if (mapped) posCounts.set(mapped, 1)
          chapterCounts.set(token.lemma, {
            count: 1,
            firstSentenceIdx: token.sentenceIndex,
            posCounts,
          })
        }
      }
    }

    // chapter별 결과를 book index에 병합
    for (const [lemma, info] of chapterCounts) {
      // 책 전체 빈도 누적
      bookFrequency.set(lemma, (bookFrequency.get(lemma) ?? 0) + info.count)

      // chapter별 등장 기록
      const firstSentence =
        result.sentences[info.firstSentenceIdx]?.text.trim().slice(0, 300) ?? ''

      // Phase 3 — chapter 지배 POS (최다 등장 POS)
      let context_pos: string | null = null
      let maxPos = 0
      for (const [p, n] of info.posCounts) if (n > maxPos) { maxPos = n; context_pos = p }

      const list = occurrences.get(lemma) ?? []
      list.push({
        chapter_idx: ch.chapter_idx,
        frequency_in_chapter: info.count,
        first_sentence_in_chapter: firstSentence,
        context_pos,
      })
      occurrences.set(lemma, list)
    }
  }

  // chapter_idx 오름차순 정렬 (computeLearningValue가 첫 등장 chapter 사용)
  for (const list of occurrences.values()) {
    list.sort((a, b) => a.chapter_idx - b.chapter_idx)
  }

  return { occurrences, bookFrequency }
}
