// apps/web/src/app/(marketing)/fit/s/[payload]/page.tsx
// 공유받은 지문 진단 결과 — `/fit/s/<payload>`.
//
// 왜 쿼리(`?r=`)가 아니라 경로 세그먼트인가:
//   Next 의 `opengraph-image.tsx` 는 **라우트 세그먼트(`params`)만 받고 `searchParams` 는
//   받지 못한다.** 쿼리로 두면 크롤러가 가져가는 og:image URL 에 페이로드가 실리지 않아
//   미리보기에 결과 곡선을 그릴 수 없다(2026-08-17 실측). 공유가 이 제품의 유일한 확산
//   경로라, 미리보기에 결과가 안 보이는 것은 사소한 문제가 아니다.
//
// 저장하지 않는다 — 페이로드가 곧 데이터다. 서버에 이 결과의 사본이 없다.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PublicFitClient } from '@/components/textfit/PublicFitClient'
import { absoluteUrl } from '@/lib/seo/site'
import { LEVEL_LABEL, profileHeadline } from '@/lib/textfit/profile'
import { decodeProfile } from '@/lib/textfit/share'

interface Params {
  params: { payload: string }
}

/**
 * 공유 링크는 **미리보기에서 결과가 보여야** 퍼진다.
 *
 * 메신저·SNS 에 붙였을 때 같은 제목만 뜨면 눌러야 내용을 알 수 있고,
 * 그 한 번의 마찰이 교사 채널의 확산 계수를 그대로 깎는다.
 */
export function generateMetadata({ params }: Params): Metadata {
  const shared = decodeProfile(params.payload)
  if (!shared) {
    return { title: '지문 난이도 진단 · Vocaflow', robots: { index: false, follow: true } }
  }

  const headline = profileHeadline(shared)
  const fitPart =
    shared.fitLevel !== null ? `${LEVEL_LABEL[shared.fitLevel]} 수준` : '고등 교육과정 이상'
  const title = `이 지문은 ${fitPart} · Vocaflow`
  const detail = shared.readings
    .filter((r) => [6, 7, 8].includes(r.level))
    .map((r) => `${LEVEL_LABEL[r.level]} ${(r.coverage * 100).toFixed(0)}%`)
    .join(' · ')
  const description = `${headline} ${detail}`

  return {
    title,
    description,
    // 공유 링크는 무한히 많은 파생 결과다 — 색인은 원본 도구 화면 하나로 모은다.
    alternates: { canonical: absoluteUrl('/fit') },
    openGraph: { type: 'website', title, description },
    robots: { index: false, follow: true },
  }
}

export default function SharedFitPage({ params }: Params) {
  const shared = decodeProfile(params.payload)
  // 망가진·위조된 페이로드는 404 로 끝낸다 — 빈 화면을 결과처럼 보여주지 않는다.
  if (!shared) notFound()

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <header className="mb-9 flex flex-col gap-3">
        <p className="m-0 font-mono text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
          공유받은 결과
        </p>
        <h1 className="m-0 text-balance font-display text-[28px] font-[800] leading-[1.2] tracking-[-0.03em] text-[var(--t1)] md:text-[34px]">
          {profileHeadline(shared)}
        </h1>
        <p className="m-0 max-w-[52ch] font-body text-[15px] leading-[1.75] text-[var(--t2)]">
          아래에 <b>직접 지문을 넣으면</b> 내 기준으로 다시 계산돼요. 가입도, 설치도 필요 없습니다.
        </p>
      </header>

      <PublicFitClient initialShared={shared} />
    </div>
  )
}
