// apps/web/src/app/(main)/comics/restored/[slug]/page.tsx — /comics/restored/[slug]
//
// PD 복원 만화 리더 — 호 단위 독립 라우트. **CCP 의 `/text/[id]/comic` 과 별도.**
//
// 세로 스크롤 한 컷씩. 1940년대 지면을 그대로 띄우면 폰에서 레터링이 깨알이 되므로
// 파이프라인이 컷으로 쪼갠 결과를 한 컷씩 화면 폭 전체에 준다(웹툰·Guided View 관성).
//
// 출처 표기는 선택이 아니다 — PD 여도 아카이브 출처를 밝히는 것이 신뢰의 문제고,
// "1945년 원본을 복원했다"는 사실 자체가 이 콘텐츠의 매력이자 화질 기대치의 정직한 세팅이다.

import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft } from 'lucide-react'

import { listPdComics, selectPdComic, selectPdComicInfo, selectPdProvenance } from '@/lib/pd-comic/queries'
import { comicIssueJsonLd } from '@/lib/seo/structured-data'
import { createClient } from '@/lib/supabase/server'
import PdModernReader from '@/components/comic/PdModernReader'

export const dynamic = 'force-dynamic'
/**
 * 출처 조회를 한 번만 한다 — `generateMetadata` 와 본문이 같은 요청에서 각각 부르면 왕복이 두 배다.
 * (supabase rpc 는 Next 의 fetch 중복 제거 대상이 아니다.)
 */
const provenanceOnce = cache(async (slug: string) => {
  const client = (await createClient()) as unknown as SupabaseClient
  return selectPdProvenance(client, slug)
})

/**
 * **같은 시리즈의 이웃 호** — 만화는 연재물이라 다음 호로 이어 읽는 것이 자연스럽다.
 *
 * 그전에는 이 화면의 출구가 "복원 만화 목록" 하나였다. 목록은 시리즈 단위라,
 * 한 호를 다 읽은 사람이 다음 호로 가려면 두 번 거슬러 올라가야 했다.
 * 크롤러도 같다 — 110호가 sitemap 으로만 이어져 있고 서로를 가리키지 않으면
 * 검색엔진이 시리즈를 하나의 연재로 읽지 않는다.
 *
 * ⚠️ 호수(`issue_no`)를 믿고 정렬하지 않는다. 발행 중 가장 큰 시리즈
 *    (`super-mystery-comics`, 33호)는 **호수가 전부 `null`** 이고,
 *    `Atomic War!` 는 9호가 번호 4개를 나눠 쓴다(2026-08-26 실측).
 *    그래서 호수가 있으면 호수로, 없으면 slug 로 — 어느 쪽이든 **순서가 흔들리지 않게** 한다.
 */
const siblingsOnce = cache(async (slug: string, seriesKey: string | null) => {
  if (!seriesKey) return { prev: null, next: null, total: 0 }

  const client = (await createClient()) as unknown as SupabaseClient
  const { data } = await listPdComics(client, seriesKey)

  const ordered = [...data].sort((a, b) => {
    const an = a.issueNo,
      bn = b.issueNo
    if (an != null && bn != null && an !== bn) return an - bn
    if (an != null && bn == null) return -1
    if (an == null && bn != null) return 1
    return a.slug.localeCompare(b.slug)
  })

  const i = ordered.findIndex((x) => x.slug === slug)
  if (i < 0) return { prev: null, next: null, total: ordered.length }

  return {
    prev: ordered[i - 1] ?? null,
    next: ordered[i + 1] ?? null,
    total: ordered.length,
  }
})

/**
 * 호마다 다른 제목을 준다.
 *
 * 그전까지 113호가 전부 `복원 만화 · Vocaflow` 하나였다 — 검색엔진에는 **같은 제목의 페이지 113개**로
 * 보이고, 그건 중복 취급이라 대개 하나만 남고 나머지는 색인에서 빠진다.
 * "1945년 원본" 이라는 사실 자체가 이 콘텐츠의 검색 가치라 연도와 시리즈를 제목에 넣는다.
 */
export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const prov = await provenanceOnce(params.slug)
  if (!prov) return { title: '복원 만화' }

  const issue = prov.issueNo ? ` #${prov.issueNo}` : ''
  const year = prov.publishedYear ? ` (${prov.publishedYear})` : ''
  const series = prov.seriesTitle ? `${prov.seriesTitle}${issue}` : `${prov.title}${issue}`

  return {
    title: `${series}${year} · 복원 만화`,
    description: `${prov.title}${year} — 퍼블릭 도메인 만화를 컷 단위로 복원해 영어 원문 그대로 읽습니다.`,
    alternates: { canonical: `/comics/restored/${params.slug}` },
  }
}

const PD_BASIS_LABEL: Record<string, string> = {
  'pre-1929': '1929년 이전 발행 — 저작권 만료',
  'no-renewal': '저작권 갱신 기록 없음 — 퍼블릭 도메인',
  'explicit-license': '아카이브 명시 퍼블릭 도메인',
}

export default async function PdComicReaderPage({ params }: { params: { slug: string } }) {
  const client = (await createClient()) as unknown as SupabaseClient
  const [{ ready, data: panels }, prov, info] = await Promise.all([
    selectPdComic(client, params.slug),
    provenanceOnce(params.slug),
    selectPdComicInfo(client, params.slug),
  ])

  // 스키마 미적용은 404 가 아니다 — 아직 준비 안 된 상태로 안내한다.
  if (!ready) return <NotReady />
  if (panels.length === 0) notFound()

  return (
    <div className="mx-auto w-full max-w-[820px] px-3 pb-16 md:px-4">
      {/*
        검색엔진에 **호(issue)로** 보이게 한다 — 시리즈·호수·발행연도·출처까지.
        "1945년 원본" 이라는 사실이 이 콘텐츠의 검색 가치이고, 같은 시리즈의 다른 호가
        함께 발견되는 것이 카탈로그의 값이다.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: comicIssueJsonLd({
            slug: params.slug,
            title: prov?.title ?? params.slug,
            seriesTitle: prov?.seriesTitle ?? null,
            issueNo: prov?.issueNo ?? null,
            publishedYear: prov?.publishedYear ?? null,
            sourceArchive: prov?.sourceArchive ?? null,
            sourceUrl: prov?.sourceUrl ?? null,
          }),
        }}
      />
      <header className="flex items-center gap-2 py-3">
        <Link
          href="/comics/restored"
          className="inline-flex min-h-[44px] items-center gap-2 font-body text-[12px] font-[500] text-[var(--t2)] transition-colors hover:text-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden /> 서가
        </Link>
        {prov && (
          <span className="ml-auto truncate font-display text-[13px] font-[700] text-[var(--t1)]">
            {prov.title}
          </span>
        )}
      </header>

      {/* 발행된 현대화 페이지 — 공개 URL + 모던 말풍선 오버레이 + 학습(TTS·단어뜻) */}
      <PdModernReader
        title={prov?.title ?? '복원 만화'}
        pages={panels.map((p) => ({
          index: p.panelOrder,
          page: String(p.panelOrder),
          imageUrl: p.imageUrl,
          balloons: (p.bubbles as Array<{ text: string; kind?: string; box?: { x: number; y: number; w: number; h: number } }>)
            .filter((b) => b.box)
            .map((b) => ({ type: b.kind === 'caption' ? 'caption' as const : 'balloon' as const, x: b.box!.x, y: b.box!.y, w: b.box!.w, h: b.box!.h, text: b.text })),
        }))}
      />

      <SeriesNav slug={params.slug} seriesKey={info?.seriesKey ?? null} seriesTitle={info?.seriesTitle ?? null} />

      {prov && <Provenance prov={prov} panels={panels.length} />}
    </div>
  )
}

function Provenance({
  prov,
  panels,
}: {
  prov: NonNullable<Awaited<ReturnType<typeof selectPdProvenance>>>
  panels: number
}) {
  return (
    <footer className="mt-6 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-4">
      <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
        출처 · 복원
      </p>
      <dl className="mt-2 grid gap-2 font-body text-[12.5px] text-[var(--t2)]">
        <div className="flex gap-2">
          <dt className="w-[70px] shrink-0 text-[var(--t2)]">원작</dt>
          <dd className="text-[var(--t1)]">
            {prov.seriesTitle ?? prov.title}
            {prov.issueNo != null && ` #${prov.issueNo}`}
            {prov.publishedYear && ` · ${prov.publishedYear}년`}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-[70px] shrink-0 text-[var(--t2)]">아카이브</dt>
          <dd>
            {prov.sourceUrl ? (
              <a
                href={prov.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--p)] underline underline-offset-2"
              >
                {prov.sourceArchive ?? '원본 보기'}
              </a>
            ) : (
              (prov.sourceArchive ?? '—')
            )}
          </dd>
        </div>
        {prov.pdBasis && (
          <div className="flex gap-2">
            <dt className="w-[70px] shrink-0 text-[var(--t2)]">권리</dt>
            <dd>{PD_BASIS_LABEL[prov.pdBasis] ?? prov.pdBasis}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-[70px] shrink-0 text-[var(--t2)]">복원</dt>
          <dd>
            종이 변색·인쇄 망점 제거 후 {panels}컷으로 재구성 — 원본의 그림·대사는 바꾸지 않았습니다
          </dd>
        </div>
      </dl>
    </footer>
  )
}

/**
 * 이전 호 · 다음 호 — 이 화면의 **두 번째 출구**.
 *
 * 목록(`/comics/restored`)은 시리즈 단위라, 한 호를 다 읽은 사람이 다음 호로 가려면
 * 두 번 거슬러 올라가야 했다. 연재물에서 그건 사실상 막다른 길이다.
 */
async function SeriesNav({
  slug,
  seriesKey,
  seriesTitle,
}: {
  slug: string
  seriesKey: string | null
  seriesTitle: string | null
}) {
  const { prev, next, total } = await siblingsOnce(slug, seriesKey)
  if (!prev && !next) return null

  return (
    <nav
      aria-label="같은 시리즈"
      className="mt-6 flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-4"
    >
      <p className="m-0 font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
        {seriesTitle ?? '같은 시리즈'}
        {total > 0 && <span className="ml-2 font-mono text-[10px] text-[var(--t3)]">{total}권</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {prev && <IssueLink issue={prev} label="이전 호" />}
        {next && <IssueLink issue={next} label="다음 호" />}
      </div>
    </nav>
  )
}

function IssueLink({
  issue,
  label,
}: {
  issue: { slug: string; title: string; issueNo: number | null }
  label: string
}) {
  return (
    <Link
      href={`/comics/restored/${issue.slug}`}
      className="inline-flex min-h-11 flex-1 items-center gap-2 rounded-[var(--r-sm)] border border-[var(--bd)] px-3 font-body text-[12.5px] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-[var(--t3)]">
        {label}
      </span>
      <span className="line-clamp-1">
        {issue.issueNo != null ? `#${issue.issueNo} ` : ''}
        {issue.title}
      </span>
    </Link>
  )
}

function NotReady() {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-16 text-center">
      <p className="font-display text-[16px] font-[800] text-[var(--t1)]">아직 준비 중이에요</p>
      <p className="mt-1.5 font-body text-[13px] text-[var(--t2)]">
        복원 만화 서가를 만들고 있습니다.
      </p>
      <Link
        href="/comics/restored"
        className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--r-full)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--on-p)]"
      >
        서가로
      </Link>
    </div>
  )
}
