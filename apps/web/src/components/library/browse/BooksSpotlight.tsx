// apps/web/src/components/library/browse/BooksSpotlight.tsx
// PC 추천: Tines Blog의 이미지·본문 분할. 실제 추천 순서와 기존 상세 sheet를 사용한다.
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { bookCover } from '@/lib/library/book-cover'
import { GradientBookCover } from '@/components/library/shared/GradientBookCover'
import type { PublishedBook } from '@/lib/library/published-book'

export function BooksSpotlight({ books, onOpen }: { books: PublishedBook[]; onOpen: (book: PublishedBook) => void }) {
  const [index, setIndex] = useState(0)
  const activeIndex = Math.min(index, Math.max(0, books.length - 1))
  const book = books[activeIndex]
  if (!book) return null
  const cover = bookCover({ title: book.title, bookVLevel: book.book_v_level, coverFrom: book.cover_from, coverTo: book.cover_to })
  const step = (delta: number) => setIndex(Math.max(0, Math.min(books.length - 1, activeIndex + delta)))
  return (
    <div className="books-spotlight hidden md:block" onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        step(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }}>
      <Link className="books-feature" href={`/library/books/${book.id}`} onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
        event.preventDefault()
        onOpen(book)
      }} aria-label={`${book.title} 상세 보기`}>
        <div className="books-feature-media">
          <div className="books-feature-cover" style={{ background: `linear-gradient(155deg, ${cover.from}, ${cover.to})` }}>
            {book.cover_image_url
              ? <Image src={book.cover_image_url} alt={`${book.title} 표지`} fill sizes="(min-width: 1280px) 300px, 240px" className="object-contain" />
              : <GradientBookCover title={book.title} author={book.author} textTone={cover.textTone} />}
          </div>
        </div>
        <div className="books-feature-copy">
          <p className="books-feature-eyebrow">오늘의 추천 · BOOKS</p>
          <h2>{book.title}</h2>
          {book.author && <p className="books-feature-author">{book.author}</p>}
          {(book.synopsis_ko || book.learning_value) && <p className="books-feature-synopsis">{book.synopsis_ko || book.learning_value}</p>}
          <p className="books-feature-meta">
            {book.book_v_level != null && <span>V{book.book_v_level}</span>}
            {book.chapter_count != null && <span>{book.chapter_count}개 챕터</span>}
            {book.has_audio && <span>원어민 음성</span>}
          </p>
          <span className="books-feature-action">책 살펴보기 <ArrowRight size={16} aria-hidden /></span>
        </div>
      </Link>
      <div className="books-feature-nav">
        <p aria-live="polite" aria-atomic="true">{activeIndex + 1} / {books.length} · {book.title}</p>
        <button type="button" onClick={() => step(-1)} disabled={activeIndex === 0} aria-label="이전 추천 도서"><ArrowLeft size={18} aria-hidden /></button>
        <button type="button" onClick={() => step(1)} disabled={activeIndex === books.length - 1} aria-label="다음 추천 도서"><ArrowRight size={18} aria-hidden /></button>
      </div>
    </div>
  )
}
