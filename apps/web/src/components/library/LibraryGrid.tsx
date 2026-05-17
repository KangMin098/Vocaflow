// apps/web/src/components/library/LibraryGrid.tsx
// LCP v2.0 Phase 11 — 사용자 라이브러리 책 그리드

import Link from 'next/link'

export interface PublishedBook {
  id: string
  title: string
  author: string | null
  cefr_level: string | null
  word_count: number | null
  chapter_count: number | null
  reading_minutes: number | null
}

interface LibraryGridProps {
  books: PublishedBook[]
}

export function LibraryGrid({ books }: LibraryGridProps) {
  if (books.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-20 text-center"
      >
        <div className="select-none text-3xl" aria-hidden>
          📚
        </div>
        <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">
          아직 게시된 책이 없습니다
        </h3>
        <p className="font-body text-[12px] text-[var(--t3)]">
          관리자가 책을 큐레이션하면 여기에 표시됩니다.
        </p>
      </div>
    )
  }

  return (
    <div
      role="list"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {books.map((book) => (
        <div role="listitem" key={book.id}>
          <BookCard book={book} />
        </div>
      ))}
    </div>
  )
}

function BookCard({ book }: { book: PublishedBook }) {
  return (
    <Link
      href={`/library/books/${book.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-display text-[15px] font-[700] text-[var(--t1)]">
            {book.title}
          </h3>
          {book.cefr_level && (
            <span
              className="inline-flex shrink-0 items-center rounded-[var(--r-sm)] px-2 py-0.5 font-mono text-[10px] font-[700]"
              style={{
                backgroundColor: `var(--cefr-${book.cefr_level}-bg)`,
                color: `var(--cefr-${book.cefr_level}-text)`,
              }}
            >
              {book.cefr_level}
            </span>
          )}
        </div>
        {book.author && (
          <p className="line-clamp-1 font-body text-[12px] text-[var(--t3)]">{book.author}</p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-2.5 font-mono text-[10px] text-[var(--t3)]">
        {book.chapter_count != null && <span>{book.chapter_count}장</span>}
        {book.word_count != null && <span>{(book.word_count / 1000).toFixed(0)}k 단어</span>}
        {book.reading_minutes != null && <span>{Math.round(book.reading_minutes / 60)}h</span>}
      </div>
    </Link>
  )
}
