// apps/web/src/components/library/browse/BookShelfRail.tsx
//
// 가로 스크롤 도서 셸프 (이어서 학습 · 지금 딱 맞아요 · 인기). BookGridCard 를 고정폭
// 컬럼으로 감싸 OTT 스타일 rail 구성. 비면 BooksExplorer 가 렌더 자체를 생략.

'use client'

import { BookGridCard } from './BookGridCard'
import type { PublishedBook } from '@/lib/library/published-book'

interface Props {
  title: string
  /** Lucide 아이콘 등 */
  icon?: React.ReactNode
  /** 라벨 옆 보조 설명 */
  hint?: string
  accent?: string
  books: PublishedBook[]
  userVLevel: number
  reasonsByBook?: Map<string, string[]>
  onOpen: (book: PublishedBook) => void
}

export function BookShelfRail({
  title,
  icon,
  hint,
  accent = 'var(--p)',
  books,
  userVLevel,
  reasonsByBook,
  onOpen,
}: Props) {
  if (books.length === 0) return null

  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-baseline gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
          {icon && (
            <span style={{ color: accent }} aria-hidden>
              {icon}
            </span>
          )}
          {title}
        </h2>
        {hint && <span className="font-body text-[11.5px] text-[var(--t2)]">{hint}</span>}
      </div>

      <div
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
        role="list"
      >
        {books.map((book) => (
          <div
            key={book.id}
            role="listitem"
            className="w-[136px] shrink-0 snap-start sm:w-[150px]"
          >
            <BookGridCard
              book={book}
              userVLevel={userVLevel}
              reasons={reasonsByBook?.get(book.id)}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
