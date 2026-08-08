// apps/web/src/app/(main)/library/books/page.tsx
//
// v06.32 도서관 — 슬림 헤더 + 책장 그리드.
// Hero 영역 ~200px → ~40px (1 row meta). 인지 부하 최소화 + 컨텐츠 집중.

import { Library } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { Capsule, Screen } from '@/components/ui/ios';
import { createClient } from '@/lib/supabase/server';
import { BooksExplorer } from '@/components/library/browse/BooksExplorer';
import { ComicHeroCard, type ComicHeroItem } from '@/components/comic/ComicHeroCard';
import { comicBookIdsOf, fetchComicCatalog } from '@/lib/comic/catalog';
import { applyBookCatalogGate } from '@/lib/library/publish-gate';
import type { PublishedBook } from '@/lib/library/published-book';

/** 만화 히어로에 노출할 최대 도서 수 (커버 조회 상한과 동일) */
const HERO_N = 4;

export const metadata = {
  title: '도서 — Vocaflow Library',
  description: '큐레이션된 영어 학습 자료',
};

export const revalidate = 60;

export default async function LibraryBooksPage() {
  const client = (await createClient()) as unknown as SupabaseClient;

  // 학습자 V레벨 — i+1 적합도 판정용 (미진단 시 0 → 배지 미표시)
  let userVLevel = 0;
  // 학습자 단계 — 추천 길이/cold-start 가중 (user_stats 미존재 시 cold)
  let userMastery: 'cold' | 'warm' | 'hot' = 'cold';
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user) {
    const { data: profile } = await client
      .from('user_profiles')
      .select('current_v_level')
      .eq('user_id', user.id)
      .maybeSingle();
    userVLevel = (profile as { current_v_level: number | null } | null)?.current_v_level ?? 0;

    const { data: stats } = await client
      .from('user_stats')
      .select('mastery_level')
      .eq('user_id', user.id)
      .maybeSingle();
    const m = (stats as { mastery_level: string | null } | null)?.mastery_level;
    if (m === 'warm' || m === 'hot') userMastery = m;
  }

  // v06.34 — 사용자별 enrollment + 진행도 fetch (texts 1 쿼리).
  //   bookId → { totalChapters, completedChapters, resumeTextId(첫 미완료 chapter) }
  // resumeTextId 가 없으면 첫 chapter 또는 마지막 chapter 의 textId 사용 (재학습 CTA).
  const enrollmentByBook = new Map<
    string,
    { completed: number; total: number; resumeTextId: string | null; firstTextId: string }
  >();

  // 공개 출시 판정은 published_at (정식 publish RPC 가 찍음) 으로 한다.
  // status='published' 단독은 부족 — 그 값은 챕터 단어장 발행 트리거를 쏘는
  // 메커니즘으로도 쓰여(ready→published) published_at 없이 올라간 도서가 섞임.
  // 조건 자체는 lib/library/publish-gate.ts 가 단일 출처(스크립트/만화와 함께 관리).
  const { data, error } = await applyBookCatalogGate(
    client
      .from('library_books')
      .select(
        'id, title, author, cefr_level, cefr_band, book_v_level, ' +
          'word_count, chapter_count, reading_minutes, cover_from, cover_to, cover_image_url, lexical_coverage, ' +
          'is_picture_book, librivox_audio, published_at, curation_metadata',
      ),
  ).order('published_at', { ascending: false });

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
      .select('imported_book_id, est_v_level, curation_meta, description, popularity_rank')
      .in('imported_book_id', ids);

    const curationByBook = new Map<
      string,
      {
        est_v_level: number | null;
        curation_meta: Record<string, unknown> | null;
        description: string | null;
        popularity_rank: number | null;
      }
    >();
    for (const s of (seeds ?? []) as Array<{
      imported_book_id: string | null;
      est_v_level: number | null;
      curation_meta: Record<string, unknown> | null;
      description: string | null;
      popularity_rank: number | null;
    }>) {
      if (!s.imported_book_id) continue;
      curationByBook.set(s.imported_book_id, {
        est_v_level: s.est_v_level,
        curation_meta: s.curation_meta,
        description: s.description,
        popularity_rank: s.popularity_rank,
      });
    }

    // 사용자 enrolled 도서들의 texts row 한 번에 fetch (chapter_idx ASC).
    if (user) {
      const { data: texts } = await client
        .from('texts')
        .select('id, library_book_id, chapter_idx, status')
        .eq('user_id', user.id)
        .in('library_book_id', ids)
        .order('chapter_idx', { ascending: true });
      const rows = (texts ?? []) as Array<{
        id: string;
        library_book_id: string;
        chapter_idx: number;
        status: string;
      }>;
      for (const r of rows) {
        const cur = enrollmentByBook.get(r.library_book_id) ?? {
          completed: 0,
          total: 0,
          resumeTextId: null as string | null,
          firstTextId: r.id,
        };
        cur.total += 1;
        if (r.status === 'completed') cur.completed += 1;
        // 첫 미완료 chapter = resume target (chapter_idx ASC 정렬됨)
        else if (cur.resumeTextId == null) cur.resumeTextId = r.id;
        enrollmentByBook.set(r.library_book_id, cur);
      }
    }

    books = books.map((b) => {
      // librivox_audio(jsonb) 는 has_audio 로 축약, curation_metadata 는 추출 후 제외.
      const { librivox_audio, curation_metadata, ...rest } = b as PublishedBook & {
        librivox_audio?: unknown;
        curation_metadata?: Record<string, unknown> | null;
      };
      const c = curationByBook.get(b.id);
      // 큐레이션 메타: library_books.curation_metadata(공개 RLS) 우선,
      // 없으면 library_seed_catalog(admin/curator 전용 RLS) fallback.
      const lbMeta = curation_metadata ?? null;
      const cm = (lbMeta ?? c?.curation_meta) as
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
      const popularityRank =
        (typeof lbMeta?.popularity_rank === 'number'
          ? (lbMeta.popularity_rank as number)
          : null) ??
        c?.popularity_rank ??
        null;
      const descriptionEn =
        (typeof lbMeta?.description === 'string' ? (lbMeta.description as string) : null) ??
        c?.description ??
        null;
      // v06.34 — enrollment 상태 + CTA 결정
      const e = enrollmentByBook.get(b.id) ?? null;
      let enrollState: 'not_enrolled' | 'enrolled' | 'in_progress' | 'completed' = 'not_enrolled';
      let ctaHref = `/library/books/${b.id}`;
      let ctaLabel = '미리보기';
      let progressPct = 0;
      if (e && e.total > 0) {
        progressPct = Math.round((e.completed / e.total) * 100);
        if (e.completed >= e.total) {
          enrollState = 'completed';
          ctaLabel = '다시 학습';
          ctaHref = `/text/${e.firstTextId}?mode=read`;
        } else if (e.completed > 0 || e.resumeTextId !== e.firstTextId) {
          enrollState = 'in_progress';
          ctaLabel = '이어서 학습';
          ctaHref = `/text/${e.resumeTextId ?? e.firstTextId}?mode=read`;
        } else {
          enrollState = 'enrolled';
          ctaLabel = '학습 시작';
          ctaHref = `/text/${e.firstTextId}?mode=read`;
        }
      }
      return {
        ...rest,
        word_set_count: countsByBook.get(b.id) ?? 0,
        has_audio: librivox_audio != null,
        popularity_rank: popularityRank,
        synopsis_ko: cm?.synopsis_ko ?? null,
        learning_value: cm?.learning_value ?? null,
        themes: cm?.themes ?? null,
        est_basis: cm?.est_basis ?? null,
        est_cefr: cm?.est_cefr ?? null,
        age_band: cm?.age_band ?? null,
        genre_norm: cm?.genre_norm ?? null,
        description_en: descriptionEn,
        enrollment_state: enrollState,
        progress_pct: progressPct,
        cta_href: ctaHref,
        cta_label: ctaLabel,
      };
    });
  }

  // ── 만화 (CCP) — 카탈로그 1회로 히어로 + 도서 카드 포맷 배지를 함께 처리 ──
  //   조회는 lib/comic/catalog.ts 단일 출처(만화 탭 /comics 와 공유).
  //   히어로 route 분기: 등록 → /text/[textId]/comic · 미등록 → 도서 상세(등록 흐름)
  //   커버는 실제로 그려지는 히어로 N개만 (커버 1장 = 전권 payload — lib/comic/catalog.ts 주석 참조)
  const comicCatalog = await fetchComicCatalog(client, { coverLimit: HERO_N });
  const comicHeroes: ComicHeroItem[] = comicCatalog.slice(0, HERO_N).map((c) => {
    const e = enrollmentByBook.get(c.bookId);
    return {
      bookId: c.bookId,
      title: c.title,
      author: c.author,
      vLevel: c.vLevel,
      panelsTotal: c.panelsTotal,
      coverArt: c.coverArt,
      href: e ? `/text/${e.resumeTextId ?? e.firstTextId}/comic` : `/comics/book/${c.bookId}`,
      enrolled: !!e,
    };
  });

  // 포맷 배지/필터/상세 시트 CTA — 히어로 상한과 무관하게 전량 필요.
  //   같은 카탈로그를 재사용하므로 추가 쿼리 없음.
  const comicBookIds = comicBookIdsOf(comicCatalog);
  if (comicBookIds.size > 0) {
    // 만화 진도 — 본문 진도(texts.status)와 분리 회계라 별도 조회(설계서 R1·R2).
    const comicProgress = new Map<string, { pct: number; completed: boolean }>();
    if (user) {
      const panelsByBook = new Map(comicCatalog.map((c) => [c.bookId, c.panelsTotal]));
      const { data: prog } = await client
        .from('comic_read_progress')
        .select('library_book_id, last_index, panels_total, completed_at')
        .in('library_book_id', Array.from(comicBookIds));
      for (const r of (prog ?? []) as Array<{
        library_book_id: string;
        last_index: number | null;
        panels_total: number | null;
        completed_at: string | null;
      }>) {
        const completed = r.completed_at != null;
        const total = panelsByBook.get(r.library_book_id) || (r.panels_total ?? 0);
        const pct = completed
          ? 100
          : total > 0
            ? Math.min(100, Math.round(((r.last_index ?? 0) / total) * 100))
            : 0;
        comicProgress.set(r.library_book_id, { pct, completed });
      }
    }

    books = books.map((b) => {
      if (!comicBookIds.has(b.id)) return b;
      const e = enrollmentByBook.get(b.id);
      const cp = comicProgress.get(b.id);
      return {
        ...b,
        has_comic: true,
        comic_href: e
          ? `/text/${e.resumeTextId ?? e.firstTextId}/comic`
          : `/comics/book/${b.id}`,
        comic_progress_pct: cp?.pct ?? 0,
        comic_completed: cp?.completed ?? false,
      };
    });
  }

  const totalBooks = books.length;
  const totalChapters = books.reduce((s, b) => s + (b.chapter_count ?? 0), 0);
  const totalWords = books.reduce((s, b) => s + (b.word_count ?? 0), 0);
  const myCount = books.filter(
    (b) =>
      b.enrollment_state === 'enrolled' ||
      b.enrollment_state === 'in_progress' ||
      b.enrollment_state === 'completed',
  ).length;
  const inProgressCount = books.filter((b) => b.enrollment_state === 'in_progress').length;

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-5 py-6 md:py-8">
        <header className="flex flex-col gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-ios-sm bg-ios-orange text-white"
            >
              <Library size={16} />
            </span>
            <h1 className="font-editorial text-[44px] font-[500] tracking-[-0.012em] leading-[1.02] text-[var(--t1)] md:text-[56px]">
              라이브러리
            </h1>
          </div>
          <p className="font-body text-[15px] text-[var(--t2)]">
            큐레이션된 영어 원서 — i+1 수준에 맞춘 도서를 추천해드려요.
          </p>
          {totalBooks > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Capsule label="도서" value={`${totalBooks}권`} />
              <Capsule label="챕터" value={`${totalChapters}`} />
              <Capsule label="단어" value={`${(totalWords / 1000).toFixed(0)}k`} />
              {myCount > 0 && (
                <Capsule
                  tone="green"
                  label="내 학습"
                  value={inProgressCount > 0 ? `${myCount}권 · 진행 ${inProgressCount}` : `${myCount}권`}
                />
              )}
            </div>
          )}
        </header>

        {comicHeroes.length > 0 && <ComicHeroCard items={comicHeroes} />}

        <BooksExplorer books={books} userVLevel={userVLevel} userMastery={userMastery} />
      </div>
    </Screen>
  );
}
