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

import { selectPdComic, selectPdProvenance } from '@/lib/pd-comic/queries'
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
  if (!prov) return { title: '복원 만화 · Vocaflow' }

  const issue = prov.issueNo ? ` #${prov.issueNo}` : ''
  const year = prov.publishedYear ? ` (${prov.publishedYear})` : ''
  const series = prov.seriesTitle ? `${prov.seriesTitle}${issue}` : `${prov.title}${issue}`

  return {
    title: `${series}${year} · 복원 만화 · Vocaflow`,
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
  const [{ ready, data: panels }, prov] = await Promise.all([
    selectPdComic(client, params.slug),
    provenanceOnce(params.slug),
  ])

  // 스키마 미적용은 404 가 아니다 — 아직 준비 안 된 상태로 안내한다.
  if (!ready) return <NotReady />
  if (panels.length === 0) notFound()

  return (
    <div className="mx-auto w-full max-w-[820px] px-3 pb-16 md:px-4">
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
