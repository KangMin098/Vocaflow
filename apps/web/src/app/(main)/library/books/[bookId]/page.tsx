// apps/web/src/app/(main)/library/books/[bookId]/page.tsx
// LCP v2.0 Phase 11 — 사용자 책 미리보기

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { bookJsonLd } from '@/lib/seo/structured-data';
import { getChapterContent, listChapters } from '@/lib/library/reader-queries';
import { getResumeTarget } from '@/lib/library/resume-queries';
import { fetchBookChapterSets, fetchBookComposerSets } from '@/lib/library/books/queries';
import { fetchUserSubscriptions } from '@/lib/library/vocab/queries';
import type { ChapterSet } from '@/components/library/books/BookDetailClient';
import { UserPreviewClient } from './UserPreviewClient';

interface PageProps {
  params: { bookId: string };
  searchParams: { preview?: string };
}

/**
 * 책마다 다른 제목·설명을 준다.
 *
 * 그전까지 이 라우트에는 metadata 가 없어 루트 기본값이 그대로 나갔다 — 발행 도서 13권이
 * 검색 결과에서 전부 같은 제목으로 보였다는 뜻이다. 이 화면은 **비로그인 방문자가 보는
 * 미리보기**이므로(로그인+수강자만 /text 로 redirect) 검색 유입의 착지점이다.
 *
 * 조회는 본문과 따로 한다 — 필요한 필드가 2개뿐이라 본문 쿼리를 공유하려고
 * 캐시 계층을 만드는 것보다 가볍다.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const client = (await createClient()) as unknown as SupabaseClient;
  const { data } = await client
    .from('library_books')
    .select('title, author')
    .eq('id', params.bookId)
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .maybeSingle();

  const b = data as { title?: string; author?: string | null } | null;
  if (!b?.title) return {};

  const by = b.author ? ` — ${b.author}` : '';
  return {
    title: `${b.title}${by}`,
    description: `${b.title}${by}. 챕터별 어휘와 난이도를 미리 보고 영어 원문으로 읽습니다.`,
    alternates: { canonical: `/library/books/${params.bookId}` },
  };
}

export default async function LibraryBookPreviewPage({
  params,
  searchParams,
}: PageProps) {
  const client = (await createClient()) as unknown as SupabaseClient;

  const { data: book } = await client
    .from('library_books')
    .select(
      'id, title, author, cefr_level, cefr_band, book_v_level, ' +
        'v_level_centroid_precise, cefrj_level, cefrj_confidence, ' +
        'flesch_kincaid_grade, flesch_reading_ease, ' +
        'word_count, chapter_count, reading_minutes, vrl_components',
    )
    .eq('id', params.bookId)
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .maybeSingle();

  if (!book) notFound();

  // enroll한 사용자는 학습 재개 대상(/text)으로 직접 redirect (미리보기 우회).
  // getResumeTarget 이 null → 미enroll 과 동치이므로 별도 enrollment 쿼리 불필요.
  // (이전: /my/books/[bookId] 재개 라우트를 한 번 더 거쳐 이중 redirect + texts 중복 조회)
  // v06.34 — ?preview=1 escape hatch: workspace "단어" pill → 도서 단어장 페이지
  //   직접 진입 의도 명시 (학습 재개 우회 차단)
  const {
    data: { user },
  } = await client.auth.getUser();
  const skipEnrollRedirect = searchParams?.preview === '1';
  if (user && !skipEnrollRedirect) {
    const target = await getResumeTarget(client, user.id, params.bookId);
    if (target) {
      redirect(`/text/${target.textId}?mode=read`);
    }
  }

  const b = book as unknown as {
    id: string;
    title: string;
    author: string | null;
    cefr_level: string | null;
    cefr_band: string | null;
    book_v_level: number | null;
    v_level_centroid_precise: string | null;
    cefrj_level: string | null;
    cefrj_confidence: string | null;
    flesch_kincaid_grade: string | null;
    flesch_reading_ease: string | null;
    word_count: number | null;
    chapter_count: number | null;
    reading_minutes: number | null;
    vrl_components: Record<string, unknown> | null;
  };

  const [chapters, initialContent, chapterSets, composerSets, subscribedSet] = await Promise.all([
    listChapters(client, b.id),
    // ⚠️ 1장 본문을 **서버에서** 읽는다. 클라이언트 fetch 에만 맡기면 초기 HTML 에
    //    "본문 없음" 폴백만 들어가고, 크롤러는 JS 를 실행하지 않으므로 검색엔진이
    //    이 책의 본문을 한 글자도 보지 못한다(2026-08-26 실측 — 발행 13권 전부).
    //    미리보기에서 열리는 장이 1장뿐이라(`user-preview`) 한 장만 읽으면 된다.
    getChapterContent(client, b.id, 1),
    fetchBookChapterSets(
      client as unknown as Parameters<typeof fetchBookChapterSets>[0],
      b.id,
    ) as Promise<ChapterSet[]>,
    // 이 책으로 만든 컴포저 단어장 (해금·재등장 등) — Tier 2 "보조 단어장" 자리를 채운다.
    fetchBookComposerSets(
      client as unknown as Parameters<typeof fetchBookComposerSets>[0],
      b.id,
    ),
    fetchUserSubscriptions(
      client as unknown as Parameters<typeof fetchUserSubscriptions>[0],
      user?.id ?? null,
    ),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/*
        검색엔진에 **작품으로** 보이게 한다 — 제목 한 줄이 아니라 저자·무료·퍼블릭 도메인까지.
        이 화면은 비로그인 방문자가 보는 미리보기라 검색 유입의 착지점이다.
        내용은 코드가 만든 JSON 문자열이고 사용자 입력이 섞이지 않는다(/fit 과 같은 패턴).
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: bookJsonLd({
            id: b.id,
            title: b.title,
            author: b.author,
            wordCount: b.word_count,
            chapterCount: b.chapter_count,
          }),
        }}
      />
      <UserPreviewClient
        bookId={b.id}
        title={b.title}
        author={b.author}
        cefrLevel={b.cefr_level}
        cefrBand={b.cefr_band}
        bookVLevel={b.book_v_level}
        vLevelCentroid={b.v_level_centroid_precise}
        cefrjLevel={b.cefrj_level}
        cefrjConfidence={b.cefrj_confidence}
        fleschKincaidGrade={b.flesch_kincaid_grade}
        fleschReadingEase={b.flesch_reading_ease}
        lemmaCoveragePct={
          typeof b.vrl_components?.lemma_coverage_pct === 'number'
            ? b.vrl_components.lemma_coverage_pct
            : null
        }
        totalWordCount={b.word_count ?? 0}
        readingMinutes={b.reading_minutes ?? 0}
        initialContent={initialContent}
        chapters={chapters}
        chapterSets={chapterSets}
        composerSets={composerSets}
        subscribedIds={Array.from(subscribedSet)}
        isLoggedIn={!!user}
      />
    </div>
  );
}
