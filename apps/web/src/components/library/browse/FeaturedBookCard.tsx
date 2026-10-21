// apps/web/src/components/library/browse/FeaturedBookCard.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, BookOpen } from 'lucide-react'

import type { PublishedBook } from '@/lib/library/published-book'

/** Library의 넓은 추천 카드. 실제 표지·제목을 사용하고 기존 상세 시트로 연결한다. */
export function FeaturedBookCard({ book, onOpen }: { book: PublishedBook; onOpen: (book: PublishedBook) => void }) {
  return (
    <Link href={`/library/books/${book.id}`} onClick={(event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
      event.preventDefault()
      onOpen(book)
    }} className="book-feature-card" data-learning-material="book" aria-label={`${book.title} 상세 보기`}>
      <div className="book-feature-card__top">
        {book.cover_image_url ? (
          <Image src={book.cover_image_url} alt="" width={90} height={120} sizes="90px" className="h-[120px] w-[90px] rounded object-contain" />
        ) : <span aria-hidden className="book-feature-card__cover flex-col justify-center gap-3"><BookOpen size={28} strokeWidth={1.3} /><span className="line-clamp-3">{book.title}</span></span>}
        <ArrowUpRight size={22} strokeWidth={1.5} aria-hidden />
      </div>
      <h3 className="mt-6 break-keep font-display text-[22px] font-[600] leading-[1.2] tracking-[-0.02em]">{book.title}</h3>
      {book.author && <p className="mt-2 font-display text-[14px]">{book.author}</p>}
      {book.synopsis_ko && <p className="mt-4 line-clamp-2 break-keep font-body text-[14px] leading-relaxed">{book.synopsis_ko}</p>}
      <span className="mt-5 block font-display text-[13px] font-[600]">{book.chapter_count != null ? `${book.chapter_count}개 챕터` : '상세 보기'}{book.book_v_level != null ? ` · V${book.book_v_level}` : ''}</span>
    </Link>
  )
}
