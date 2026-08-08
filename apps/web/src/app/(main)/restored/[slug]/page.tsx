// apps/web/src/app/(main)/restored/[slug]/page.tsx — /restored/[slug]
//
// PD 복원 만화 리더 — 호 단위 독립 라우트. **CCP 의 `/text/[id]/comic` 과 별도.**
//
// 세로 스크롤 한 컷씩. 1940년대 지면을 그대로 띄우면 폰에서 레터링이 깨알이 되므로
// 파이프라인이 컷으로 쪼갠 결과를 한 컷씩 화면 폭 전체에 준다(웹툰·Guided View 관성).
//
// 출처 표기는 선택이 아니다 — PD 여도 아카이브 출처를 밝히는 것이 신뢰의 문제고,
// "1945년 원본을 복원했다"는 사실 자체가 이 콘텐츠의 매력이자 화질 기대치의 정직한 세팅이다.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft } from 'lucide-react'

import { selectPdComic, selectPdProvenance } from '@/lib/pd-comic/queries'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = { title: '복원 만화 · Vocaflow' }

const PD_BASIS_LABEL: Record<string, string> = {
  'pre-1929': '1929년 이전 발행 — 저작권 만료',
  'no-renewal': '저작권 갱신 기록 없음 — 퍼블릭 도메인',
  'explicit-license': '아카이브 명시 퍼블릭 도메인',
}

export default async function PdComicReaderPage({ params }: { params: { slug: string } }) {
  const client = (await createClient()) as unknown as SupabaseClient
  const [{ ready, data: panels }, prov] = await Promise.all([
    selectPdComic(client, params.slug),
    selectPdProvenance(client, params.slug),
  ])

  // 스키마 미적용은 404 가 아니다 — 아직 준비 안 된 상태로 안내한다.
  if (!ready) return <NotReady />
  if (panels.length === 0) notFound()

  return (
    <div className="mx-auto w-full max-w-[820px] px-3 pb-16 md:px-4">
      <header className="flex items-center gap-2 py-3">
        <Link
          href="/restored"
          className="inline-flex min-h-[44px] items-center gap-1.5 font-body text-[12px] font-[500] text-[var(--t3)] transition-colors hover:text-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden /> 서가
        </Link>
        {prov && (
          <span className="ml-auto truncate font-display text-[13px] font-[700] text-[var(--t1)]">
            {prov.title}
          </span>
        )}
      </header>

      {/* 컷 세로 스크롤 — 한 컷이 화면 폭 전체를 쓴다 */}
      <ol className="flex flex-col gap-3">
        {panels.map((p) => (
          <li key={p.panelOrder} className="overflow-hidden rounded-[var(--r-md)] bg-[var(--bg3)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl}
              alt={
                p.bubbles.length > 0
                  ? p.bubbles.map((b) => b.text).join(' ')
                  : `${p.panelOrder}번째 컷`
              }
              loading="lazy"
              className="block w-full"
            />
          </li>
        ))}
      </ol>

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
      <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-[var(--t3)]">
        출처 · 복원
      </p>
      <dl className="mt-2 grid gap-1.5 font-body text-[12.5px] text-[var(--t2)]">
        <div className="flex gap-2">
          <dt className="w-[70px] shrink-0 text-[var(--t3)]">원작</dt>
          <dd className="text-[var(--t1)]">
            {prov.seriesTitle ?? prov.title}
            {prov.issueNo != null && ` #${prov.issueNo}`}
            {prov.publishedYear && ` · ${prov.publishedYear}년`}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-[70px] shrink-0 text-[var(--t3)]">아카이브</dt>
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
            <dt className="w-[70px] shrink-0 text-[var(--t3)]">권리</dt>
            <dd>{PD_BASIS_LABEL[prov.pdBasis] ?? prov.pdBasis}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-[70px] shrink-0 text-[var(--t3)]">복원</dt>
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
        href="/restored"
        className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--r-full)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--ti)]"
      >
        서가로
      </Link>
    </div>
  )
}
