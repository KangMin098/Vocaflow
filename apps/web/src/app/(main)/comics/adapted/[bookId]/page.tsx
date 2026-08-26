// apps/web/src/app/(main)/comics/[bookId]/page.tsx
//
// 만화 상세 — 미등록·비로그인도 볼 수 있는 프리뷰 + 포맷 선택 (설계서 D4·D5).
// 왜 필요한가: 리더 라우트(/text/[id]/comic)는 texts.id 를 요구해 등록 전에는 만화를 아예 볼 수 없었다(G3).
//   가장 강한 유입 자산을 유입 전에 못 쓰던 구조 → 여기서 3컷을 먼저 보여주고, 시작 시 멱등 등록으로 잇는다.
//
// 프리뷰는 아트만 보여준다 — 정본 대사/target_vocab 은 리더의 학습 자산이라 프리뷰에 싣지 않는다(§7.2).

import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BookImage, Layers } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { Screen } from '@/components/ui/ios'
import { createClient } from '@/lib/supabase/server'
import { fetchComicCatalog, fetchComicPreview } from '@/lib/comic/catalog'
import { prescribeFormat } from '@/lib/comic/prescribe'
import { ComicFormatChoice } from '@/components/comic/ComicFormatChoice'
import { judgeIPlusOne } from '@/lib/library/i-plus-one'
import { applyBookReadGate } from '@/lib/library/publish-gate'

interface PageProps {
  params: { bookId: string }
}

/**
 * **책마다 다른 제목** — 고정 메타였다(`만화 미리보기` 하나).
 *
 * 2026-08-26 실측: 이 라우트만 canonical 도 og:image 도 없었고 description 이 20자였다.
 * 지금은 발행 만화가 1권뿐이라 눈에 띄지 않지만, 제목이 같은 페이지가 여럿이면
 * 검색엔진은 중복으로 보고 대개 하나만 남긴다 — 복원 만화 113호가 `복원 만화 · Vocaflow`
 * 하나였을 때 겪은 것과 같은 구조다. 늘어난 뒤에 고치면 이미 색인에서 빠진 뒤다.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const book = await bookOnce(params.bookId)
  if (!book) return { title: '만화 미리보기' }

  return {
    title: `${book.title} 만화판`,
    description: `${book.title}${book.author ? ` · ${book.author}` : ''} — 같은 책을 그림으로 먼저 만나고, 이어서 원문으로 읽습니다.`,
    alternates: { canonical: `/comics/adapted/${params.bookId}` },
  }
}

/** 메타와 본문이 같은 요청에서 각각 부르면 왕복이 두 배다. */
const bookOnce = cache(async (bookId: string) => {
  const client = (await createClient()) as unknown as SupabaseClient
  // 조건은 화면과 같은 열람 게이트 — 갈리면 없는 책의 제목을 메타에 싣게 된다.
  const { data } = await applyBookReadGate(
    client.from('library_books').select('title, author').eq('id', bookId),
  ).maybeSingle()
  return (data as { title: string; author: string | null } | null) ?? null
})

export const dynamic = 'force-dynamic'

const PREVIEW_PANELS = 3

export default async function ComicDetailPage({ params }: PageProps) {
  const client = (await createClient()) as unknown as SupabaseClient
  const bookId = params.bookId

  // 발행 만화 여부는 카탈로그(이중 published 게이트)로 판정 — 없으면 404
  const catalog = await fetchComicCatalog(client, { coverLimit: 0 })
  const item = catalog.find((c) => c.bookId === bookId)
  if (!item) notFound()

  const [panels, bookRes, userRes] = await Promise.all([
    fetchComicPreview(client, bookId, PREVIEW_PANELS),
    // 열람 게이트(status만) — 만화 RPC 와 동일 기준. 카탈로그 게이트보다 느슨한 이유는 publish-gate.ts 주석 참조.
    applyBookReadGate(
      client
        .from('library_books')
        .select(
          'title, author, chapter_count, reading_minutes, lexical_coverage, is_picture_book, librivox_audio',
        )
        .eq('id', bookId),
    ).maybeSingle(),
    client.auth.getUser(),
  ])

  // 카탈로그가 폴백 경로(구 RPC)면 메타가 비어 있으므로 도서 행으로 보강
  const book = bookRes.data as {
    title: string
    author: string | null
    chapter_count: number | null
    reading_minutes: number | null
    lexical_coverage: Record<string, number> | null
    is_picture_book: boolean | null
    librivox_audio: unknown
  } | null

  const title = book?.title ?? item.title
  const author = book?.author ?? item.author
  const chapterCount = book?.chapter_count ?? item.bookChapterCount
  const readingMinutes = book?.reading_minutes ?? item.readingMinutes
  const lexicalCoverage = book?.lexical_coverage ?? item.lexicalCoverage
  const isPictureBook = book?.is_picture_book ?? item.isPictureBook
  const hasAudio = book ? book.librivox_audio != null : item.hasAudio

  const user = userRes.data.user

  let userVLevel = 0
  let enrolled = false
  let firstTextId: string | null = null
  let resumeTextId: string | null = null
  let readAnyChapter = false
  let comicProgressPct = 0
  let comicCompleted = false

  if (user) {
    const [profileRes, textsRes, progRes] = await Promise.all([
      client.from('user_profiles').select('current_v_level').eq('user_id', user.id).maybeSingle(),
      client
        .from('texts')
        .select('id, chapter_idx, status')
        .eq('user_id', user.id)
        .eq('library_book_id', bookId)
        .order('chapter_idx', { ascending: true }),
      client
        .from('comic_read_progress')
        .select('last_index, panels_total, completed_at')
        .eq('library_book_id', bookId)
        .maybeSingle(),
    ])

    userVLevel = (profileRes.data as { current_v_level: number | null } | null)?.current_v_level ?? 0

    const rows = (textsRes.data ?? []) as Array<{ id: string; status: string }>
    if (rows.length > 0) {
      enrolled = true
      firstTextId = rows[0].id
      resumeTextId = rows.find((r) => r.status !== 'completed')?.id ?? rows[0].id
      readAnyChapter = rows.some((r) => r.status === 'completed')
    }

    const prog = progRes.data as {
      last_index: number | null
      panels_total: number | null
      completed_at: string | null
    } | null
    if (prog) {
      comicCompleted = prog.completed_at != null
      const total = item.panelsTotal > 0 ? item.panelsTotal : (prog.panels_total ?? 0)
      comicProgressPct = comicCompleted
        ? 100
        : total > 0
          ? Math.min(100, Math.round(((prog.last_index ?? 0) / total) * 100))
          : 0
    }
  }

  const fit = judgeIPlusOne(lexicalCoverage, userVLevel, isPictureBook === true)
  const prescription = prescribeFormat({
    diagnosed: userVLevel >= 1,
    fit: fit?.tier ?? null,
    comicProgressPct,
    comicCompleted,
    readAnyChapter,
    hasAudio,
  })

  const readerTarget = resumeTextId ?? firstTextId

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-6 py-5 md:py-7">
        <div>
          <Link
            href="/comics/adapted"
            className="inline-flex min-h-11 items-center gap-2 font-body text-[12.5px] font-[500] text-[var(--t2)] transition-colors hover:text-[var(--p)]"
          >
            <ArrowLeft size={14} aria-hidden /> 만화 목록
          </Link>
        </div>

        {/* 헤더 */}
        <header className="flex flex-col gap-2 px-1">
          <span
            className="font-display text-[10px] font-[800] uppercase tracking-[0.16em]"
            style={{ color: 'var(--active-ink)' }}
          >
            만화 · Comic
          </span>
          <h1 className="font-editorial text-[34px] font-[500] leading-[1.06] tracking-[-0.012em] text-[var(--t1)] md:text-[44px]">
            {title}
          </h1>
          {author && <p className="font-body text-[13px] text-[var(--t2)]">{author}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {item.panelsTotal > 0 && <Meta>{item.panelsTotal}컷</Meta>}
            {item.vLevel != null && <Meta>V{item.vLevel}</Meta>}
            {fit && <Meta>{fit.label}</Meta>}
            {comicProgressPct > 0 && !comicCompleted && <Meta>{comicProgressPct}% 봄</Meta>}
          </div>
        </header>

        {/* 프리뷰 — 아트만 (정본 대사는 리더에서) */}
        {panels.length > 0 && (
          <section aria-label="만화 미리보기" className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {panels.map((p) => (
                <div
                  key={`${p.chapterIdx}-${p.pageOrder}`}
                  className="relative aspect-[4/3] overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="px-1 font-body text-[12px] text-[var(--t2)]">
              {panels.length}컷 미리보기 — 대사와 단어는 시작하면 만날 수 있어요.
            </p>
          </section>
        )}

        {panels.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center">
            <BookImage size={24} className="text-[var(--t2)]" aria-hidden />
            <p className="font-body text-[13px] text-[var(--t2)]">
              미리보기를 준비 중이에요. 바로 시작해도 좋아요.
            </p>
          </div>
        )}

        {/* 포맷 선택 */}
        <ComicFormatChoice
          bookId={bookId}
          comicHref={readerTarget ? `/text/${readerTarget}/comic` : null}
          textHref={readerTarget ? `/text/${readerTarget}?mode=read` : null}
          audioHref={hasAudio && readerTarget ? `/text/${readerTarget}?mode=listen` : null}
          hasAudio={hasAudio}
          isLoggedIn={!!user}
          enrolled={enrolled}
          panelsTotal={item.panelsTotal}
          chapterCount={chapterCount}
          readingMinutes={readingMinutes}
          prescription={prescription}
        />

        {/* 3종 체계 연결 — 만화에서 만난 단어는 이 책의 챕터 단어장으로 이어진다 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
          <Link
            href={`/library/books/${bookId}?preview=1`}
            className="inline-flex min-h-11 items-center gap-2 font-display text-[13px] font-[700] text-[var(--p)] transition-colors hover:text-[var(--p-dark)]"
          >
            <Layers size={14} aria-hidden /> 이 책의 단어장 보기
          </Link>
          <p className="font-body text-[12px] text-[var(--t2)]">
            만화는 본문을 대신하지 않아요 — 이야기를 먼저 잡아두면 원문이 훨씬 잘 읽혀요.
          </p>
        </div>
      </div>
    </Screen>
  )
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[var(--r-full)] bg-[var(--bg)] px-2 py-1 font-mono text-[11px] tabular-nums text-[var(--t2)]">
      {children}
    </span>
  )
}
