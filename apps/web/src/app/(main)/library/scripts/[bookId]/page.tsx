// apps/web/src/app/(main)/library/scripts/[bookId]/page.tsx
//
// 짧은 글 — **공개 상세 + 학습 리졸버**.
//
// ── 왜 공개 상세가 생겼나 (2026-08-26 실측) ─────────────────────────
// 발행 글이 **160개** 있고, `library_articles` 의 RLS 는 published+`copyright_safe_in_kr` 를
// **익명에게 연다**(`anyone_read_published_safe_articles`). 본문도 같은 표에 있다.
// 즉 데이터도 정책도 라이선스도 공개 준비가 끝나 있었는데 **그것을 보여주는 주소가 없었다.**
//
// 이 라우트는 리졸버뿐이어서, 비로그인이 글 주소로 오면 `startArticleLearning` 이 실패하고
// **목록으로 튕겼다**. 검색에서 특정 글로 온 사람이 갈 곳을 잃는다는 뜻이다.
// 같은 날 sitemap 에 도서 13 · 만화 110 을 올렸는데 글 160 은 올릴 수조차 없었다 —
// 가리킬 주소가 없었으니까.
//
// ── 동작 (도서 상세와 같은 갈래) ────────────────────────────────────
//   로그인  → `startArticleLearning`(멱등) → `/text/[textId]?mode=read` 로 학습 시작
//   비로그인 → **공개 미리보기**(제목·난이도·본문·출처) + 로그인 CTA
//   글이 아님 → 도서 라우트로 (레거시 북마크 보존)
//
// ── 라이선스 ────────────────────────────────────────────────────────
// 발행 160개는 PD 76 · CC-BY-SA 43 · CC-BY 16 · CC-BY-ND 25 다. CC 는 **출처 표시가 조건**이라
// 화면과 구조화 데이터 양쪽에 원문 링크와 라이선스를 남긴다. `display_only`(ND 25)는
// 개작이 금지된 것이지 표시가 금지된 것이 아니다 — 원문 그대로만 보여준다.

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { RETURN_PARAM } from '@/lib/auth/redirect'
import { startArticleLearning } from '@/lib/articles/start-learning'
import { formatReadingTime } from '@/lib/library/reading-time'
import { articleJsonLd } from '@/lib/seo/structured-data'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: { bookId: string }
}

interface ArticleRow {
  id: string
  title: string
  author: string | null
  content: string | null
  source: string | null
  source_url: string | null
  feed_label: string | null
  published_at: string | null
  word_count: number | null
  reading_minutes: number | null
  cefr_level: string | null
  article_v_level: number | null
  license_class: string | null
}

/** 라이선스 코드 → 화면 표기. 모르는 값은 그대로 보여준다(숨기면 출처 표시가 깨진다). */
const LICENSE_LABEL: Record<string, string> = {
  public_domain: '퍼블릭 도메인',
  cc_by: 'CC BY 4.0',
  cc_by_sa: 'CC BY-SA 4.0',
  cc_by_nd: 'CC BY-ND 4.0',
}

/**
 * 글 하나를 한 번만 읽는다 — `generateMetadata` 와 본문이 같은 요청에서 각각 부르면 왕복이 두 배다.
 *
 * 조건을 RLS 와 **같게** 맞춘다(`published` + `copyright_safe_in_kr`). 갈라지면
 * 익명에게는 404 인 주소를 sitemap 이 광고하게 된다.
 */
const articleOnce = cache(async (id: string): Promise<ArticleRow | null> => {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data } = await supabase
    .from('library_articles')
    .select(
      'id, title, author, content, source, source_url, feed_label, published_at, ' +
        'word_count, reading_minutes, cefr_level, article_v_level, license_class',
    )
    .eq('id', id)
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .maybeSingle()

  return (data as ArticleRow | null) ?? null
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const a = await articleOnce(params.bookId)
  if (!a) return {}

  const by = a.author ? ` — ${a.author}` : ''
  const lead = (a.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 150)

  return {
    title: a.title,
    description: lead || `${a.title}${by}. 영어 원문을 어휘와 함께 읽습니다.`,
    alternates: { canonical: `/library/scripts/${a.id}` },
  }
}

export default async function LibraryScriptsResolve({ params }: PageProps) {
  const id = params.bookId
  const article = await articleOnce(id)

  // 글이 아니면 도서 라우트로 — 레거시 북마크를 보존한다.
  if (!article) redirect(`/library/books/${id}`)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 로그인 사용자는 곧장 학습으로. (실패하면 아래 미리보기로 떨어진다 — 목록으로 튕기지 않는다.)
  if (user) {
    const res = await startArticleLearning(id)
    if (res.ok) redirect(`/text/${res.textId}?mode=read`)
  }

  return <ArticlePreview a={article} isLoggedIn={!!user} />
}

function ArticlePreview({ a, isLoggedIn }: { a: ArticleRow; isLoggedIn: boolean }) {
  const paragraphs = (a.content ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const readingTime = formatReadingTime(a.reading_minutes)
  const licenseLabel = a.license_class
    ? (LICENSE_LABEL[a.license_class] ?? a.license_class)
    : null

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 py-6 md:px-6">
      {/* 검색엔진에 **글로** 보이게 한다 — 제목만이 아니라 저자·출처·라이선스까지. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: articleJsonLd({
            id: a.id,
            title: a.title,
            author: a.author,
            sourceUrl: a.source_url,
            sourceLabel: a.feed_label ?? a.source,
            publishedAt: a.published_at,
            wordCount: a.word_count,
            licenseClass: a.license_class,
          }),
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/library/scripts"
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--r-sm)] px-3 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden />
          Dispatches
        </Link>
        {readingTime && (
          <span className="font-mono text-[11px] text-[var(--t2)]">읽는 시간 {readingTime}</span>
        )}
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-balance font-display text-[24px] font-[800] leading-[1.25] tracking-[-0.02em] text-[var(--t1)] md:text-[30px]">
          {a.title}
        </h1>
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-[12px] text-[var(--t2)]">
          {a.author && <span>{a.author}</span>}
          {a.cefr_level && (
            <span className="font-mono text-[11px]">{a.cefr_level}</span>
          )}
          {a.article_v_level != null && (
            <span className="font-mono text-[11px]">V{a.article_v_level}</span>
          )}
          {a.word_count != null && a.word_count > 0 && (
            <span className="font-mono text-[11px] tabular-nums">
              {a.word_count.toLocaleString()} 단어
            </span>
          )}
        </p>
      </header>

      <article className="flex flex-col gap-4">
        {paragraphs.length > 0 ? (
          paragraphs.map((p, i) => (
            <p
              key={i}
              className="m-0 font-body text-[15px] leading-[1.85] text-[var(--t1)] md:text-[16px]"
            >
              {p}
            </p>
          ))
        ) : (
          <p className="m-0 font-body text-[13px] text-[var(--t2)]">
            본문을 준비하고 있어요.
          </p>
        )}
      </article>

      {/* 출처·라이선스 — CC 는 표시가 **조건**이다. 장식이 아니라 준수 사항. */}
      {(a.source_url || licenseLabel) && (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--bd)] pt-4 font-body text-[11.5px] text-[var(--t3)]">
          {a.source_url && (
            <a
              href={a.source_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 underline decoration-[var(--bd)] underline-offset-2 transition-colors hover:text-[var(--t1)]"
            >
              출처 {a.feed_label ?? a.source ?? '원문'}
              <ExternalLink size={11} aria-hidden />
            </a>
          )}
          {licenseLabel && <span>{licenseLabel}</span>}
        </footer>
      )}

      {!isLoggedIn && (
        <section className="flex flex-col items-start gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
          <p className="m-0 font-body text-[13px] leading-relaxed text-[var(--t2)]">
            로그인하면 이 글의 <strong>모르는 단어만 골라</strong> 단어장으로 만들고, 읽은 곳부터
            이어서 볼 수 있어요.
          </p>
          <Link
            href={`/login?${RETURN_PARAM}=${encodeURIComponent(`/library/scripts/${a.id}`)}`}
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          >
            이 글로 학습 시작
          </Link>
        </section>
      )}
    </div>
  )
}
