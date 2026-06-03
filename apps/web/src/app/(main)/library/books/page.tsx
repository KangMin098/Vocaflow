// apps/web/src/app/(main)/library/books/page.tsx
//
// v06.32 도서관 — 슬림 헤더 + 책장 그리드.
// Hero 영역 ~200px → ~40px (1 row meta). 인지 부하 최소화 + 컨텐츠 집중.

import { Library } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { LibraryGrid, type PublishedBook } from '@/components/library/LibraryGrid';

export const metadata = {
  title: '도서 — Vocaflow Library',
  description: '큐레이션된 영어 학습 자료',
};

export const revalidate = 60;

export default async function LibraryBooksPage() {
  const client = (await createClient()) as unknown as SupabaseClient;

  const { data, error } = await client
    .from('library_books')
    .select(
      'id, title, author, cefr_level, cefr_band, book_v_level, ' +
        'word_count, chapter_count, reading_minutes, cover_from, cover_to',
    )
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .order('published_at', { ascending: false });

  let books: PublishedBook[] = error
    ? []
    : ((data ?? []) as unknown as PublishedBook[]);

  if (books.length > 0) {
    const ids = books.map((b) => b.id);
    const { data: sets } = await client
      .from('shared_word_sets')
      .select('curation_query')
      .eq('is_published', true)
      .eq('category', 'library_book')
      .in('curation_query->>book_id', ids);

    const countsByBook = new Map<string, number>();
    for (const s of (sets ?? []) as { curation_query: Record<string, unknown> }[]) {
      const bookId = String(s.curation_query?.book_id ?? '');
      if (!bookId) continue;
      countsByBook.set(bookId, (countsByBook.get(bookId) ?? 0) + 1);
    }

    // v06.34 — library_seed_catalog 에서 curation_meta 가져와 도서별 매핑 (선택 모달용)
    const { data: seeds } = await client
      .from('library_seed_catalog')
      .select('imported_book_id, est_v_level, curation_meta, description')
      .in('imported_book_id', ids);

    const curationByBook = new Map<
      string,
      {
        est_v_level: number | null;
        curation_meta: Record<string, unknown> | null;
        description: string | null;
      }
    >();
    for (const s of (seeds ?? []) as Array<{
      imported_book_id: string | null;
      est_v_level: number | null;
      curation_meta: Record<string, unknown> | null;
      description: string | null;
    }>) {
      if (!s.imported_book_id) continue;
      curationByBook.set(s.imported_book_id, {
        est_v_level: s.est_v_level,
        curation_meta: s.curation_meta,
        description: s.description,
      });
    }

    books = books.map((b) => {
      const c = curationByBook.get(b.id);
      const cm = c?.curation_meta as
        | {
            synopsis_ko?: string;
            learning_value?: string;
            themes?: string[];
            est_basis?: string;
            est_cefr?: string;
            age_band?: string;
            genre_norm?: string;
          }
        | null
        | undefined;
      return {
        ...b,
        word_set_count: countsByBook.get(b.id) ?? 0,
        synopsis_ko: cm?.synopsis_ko ?? null,
        learning_value: cm?.learning_value ?? null,
        themes: cm?.themes ?? null,
        est_basis: cm?.est_basis ?? null,
        est_cefr: cm?.est_cefr ?? null,
        age_band: cm?.age_band ?? null,
        genre_norm: cm?.genre_norm ?? null,
        description_en: c?.description ?? null,
      };
    });
  }

  const totalBooks = books.length;
  const totalChapters = books.reduce((s, b) => s + (b.chapter_count ?? 0), 0);
  const totalWords = books.reduce((s, b) => s + (b.word_count ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Slim header — 1 row, 인지 부하 최소화 */}
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--bd)] pb-3">
        <div className="flex items-baseline gap-2.5">
          <Library size={16} className="self-center text-[#8B6A3F]" aria-hidden />
          <h1 className="font-display text-[18px] font-[700] text-[var(--t1)]">
            라이브러리
          </h1>
          <span className="font-body text-[12px] text-[var(--t3)]">
            큐레이션된 영어 원서
          </span>
        </div>
        {totalBooks > 0 && (
          <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--t3)]">
            <span>
              <strong className="font-display font-[700] text-[var(--t1)]">
                {totalBooks}
              </strong>
              권
            </span>
            <span aria-hidden>·</span>
            <span>
              <strong className="font-display font-[700] text-[var(--t1)]">
                {totalChapters}
              </strong>
              장
            </span>
            <span aria-hidden>·</span>
            <span>
              <strong className="font-display font-[700] text-[var(--t1)]">
                {(totalWords / 1000).toFixed(0)}k
              </strong>
              단어
            </span>
          </div>
        )}
      </header>

      {/* 책장 그리드 */}
      <LibraryGrid books={books} />
    </div>
  );
}
