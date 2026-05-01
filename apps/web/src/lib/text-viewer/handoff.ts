// apps/web/src/lib/text-viewer/handoff.ts
// TextViewer → WordVault 단어 추출 결과 인계 (mock Phase 2)

import type { ExtractedWord } from '@/components/text-viewer/analysis-types'
import type { WordItem } from '@/components/wordvault/types'

const STORAGE_KEY = 'vocaflow.pending.extracted-words'

export function saveExtractedWords(words: ExtractedWord[]): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(words))
  } catch {
    // 사일런트 — 최악엔 단어 인계가 누락될 뿐, 흐름 중단은 피함
  }
}

export function consumePendingWords(): ExtractedWord[] | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  sessionStorage.removeItem(STORAGE_KEY)
  try {
    return JSON.parse(raw) as ExtractedWord[]
  } catch {
    return null
  }
}

export function toWordItem(w: ExtractedWord, id: number): WordItem {
  const levelClass: WordItem['levelClass'] = w.level.startsWith('A')
    ? 'a'
    : w.level.startsWith('B')
      ? 'b'
      : 'c'

  return {
    id,
    word: w.word,
    pos: w.partOfSpeech,
    meaning: w.meaning,
    exampleEn: '',
    level: w.level,
    levelClass,
    mastery: 1,
    lastDays: 0,
    nextDays: 1,
  }
}
