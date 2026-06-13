// apps/web/src/lib/text-extract/source-sentence.ts
//
// 스크립트(붙여넣기 글) 단어장 예문 = 그 글의 실제 문장 (context-dependent 학습원칙 #5).
// extract_vocabulary_for_user_v2 는 dict 일반 예문(example_en)만 주므로, 클라이언트에서
// 보유한 원문(text)에서 단어 출현 문장을 직접 뽑아 example_sentence 로 저장한다.

import { splitIntoSentences } from '@/lib/echo/sentence-splitter'

const MAX_LEN = 300

/** 원문을 문장 리스트로 1회 분리 (단어마다 재분리 방지 — 호출부에서 캐시). */
export function buildSentenceIndex(text: string): string[] {
  return splitIntoSentences(text)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cap(s: string): string {
  const t = s.trim()
  return t.length > MAX_LEN ? `${t.slice(0, MAX_LEN).trimEnd()}…` : t
}

/**
 * 원문 문장들 중 단어가 처음 등장하는 문장.
 *   1) surface(추출이 실제 매칭한 표면형) → 2) lemma(word) 를 whole-word(ci) 로 탐색
 *   3) 실패 시 lemma stem 으로 시작하는 굴절형(run→running) 탐색 (word 길이 ≥4 — 과매칭 회피)
 * 못 찾으면 null (호출부가 dict 예문으로 폴백).
 */
export function firstSentenceContaining(
  sentences: string[],
  surface: string | null | undefined,
  word: string,
): string | null {
  const targets = [surface, word].filter(
    (t): t is string => typeof t === 'string' && t.length >= 2,
  )
  for (const t of targets) {
    const whole = new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i')
    for (const s of sentences) {
      if (whole.test(s)) return cap(s)
    }
  }
  if (word.length >= 4) {
    const stem = new RegExp(`\\b${escapeRegExp(word)}[a-z]*\\b`, 'i')
    for (const s of sentences) {
      if (stem.test(s)) return cap(s)
    }
  }
  return null
}
