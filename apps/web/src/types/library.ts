// apps/web/src/types/library.ts

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type MemoryStatus = 'stable' | 'shaky' | 'risk' | 'new'

export type ModeKey =
  | 'read'
  | 'listen'
  | 'words'
  | 'flashcard'
  | 'spellforge'
  | 'wordblitz'
  | 'quiz'

export type ModeStatus = 'done' | 'active' | 'pending'

export interface LibraryText {
  id: string
  title: string
  author: string
  cefrLevel: CEFRLevel
  category: string
  preview: string
  wordCount: number
  progressPercent: number
  totalPages: number
  currentPage: number
  coverGradient: { from: string; to: string }
  addedAt: Date
  lastStudiedAt: Date | null
  isBookmarked: boolean
}

export interface CategoryItem {
  emoji: string
  label: string
  count: number
}

export interface CurationItem extends LibraryText {
  rating: number
  popularUsers: number
  estimatedHours: number
}

export interface Word {
  id: string
  text: string
  meaning: string
  pronunciation: string
  pos: string
  status: MemoryStatus
  exampleSentence: string
}

export interface Sentence {
  id: number
  text: string
  audioUrl?: string
  durationSec: number
}
