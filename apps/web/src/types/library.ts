// apps/web/src/types/library.ts

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type MemoryStatus = 'stable' | 'shaky' | 'risk' | 'new'

export type ModeKey =
  | 'listen'
  | 'read'
  | 'shadow'
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
  /** 도서 단위 카드 (library_book_id 가 있는 enrolled 도서를 chapter 그룹화한 결과).
   * - null: 직접 입력/파일/스크립트 — 카드 클릭 → /text/[id]
   * - string: 라이브러리 도서 — 카드 클릭 → /text/[nextTextId]?mode=read (v06.32 직진) */
  bookId: string | null
  /** v06.32 — 도서 단위 카드 resume target. /my/books/[bookId] 중간 redirect 우회.
   *  in_progress > not_started > 첫 chapter 순서로 결정. */
  nextTextId?: string | null
  /** v06.34 — 사용자 직접 입력 책 그룹 식별자 (texts.user_book_group_id).
   *  bookId=null + userBookGroupId=string 이면 사용자 책 (챕터 그룹).
   *  카드 클릭 → /text/[nextTextId]?mode=read 직진. */
  userBookGroupId?: string | null
  /** 도서 단위 카드일 때 — enrolled chapter 총수 (= library_books.chapter_count) */
  chapterCount?: number
  /** 도서 단위 카드일 때 — 완료(progress=100) chapter 수 */
  completedChapters?: number
  /** 도서 단위 카드일 때 — book_v_level (i+1 레벨 권장 표시용) */
  bookVLevel?: number | null
  /** 도서 단위 카드일 때 — V레벨별 기지어 커버리지 (i+1 적합도 판정) */
  lexicalCoverage?: Record<string, number> | null
  /** 도서 단위 카드일 때 — 원천 표지 이미지 URL (상세 sheet hero) */
  coverImageUrl?: string | null
  /** 도서 단위 카드일 때 — 그림책 여부 (i+1 임계 삽화 보정) */
  isPictureBook?: boolean
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
