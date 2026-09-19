// apps/web/src/app/(marketing)/video/[id]/page.tsx
//
// **편별 페이지 — 62편이 URL 하나를 나눠 쓰던 것을 끝낸다.**
//
// ── 왜 이게 PR 체계의 핵심인가 (실측 2026-09-13) ─────────────────────
// 영상 62편을 찍어 올렸는데 **색인 가능한 주소는 `/video` 하나**였다. 검색이 읽을 수 있는
// 것도 그 한 장에 있는 제목 62줄뿐이다. 영상 안의 말(자막)은 픽셀이라 기계가 못 읽는다.
//
// 시장의 PR 영상은 대개 YouTube 에만 있고 **자기 사이트에 색인 가능한 면이 없다.**
// 여기서는 편마다 주소를 주고, 그 안에 **자막 전문을 서버 렌더 HTML** 로 깐다(I6).
// 그러면 「빈칸 추론이 뭐죠」 같은 검색이 이 페이지에 닿을 수 있다.
//
// 자막은 버킷의 .vtt 를 가져오지 않고 **manifest 에 실어 둔 것**을 쓴다 — 크롤러는
// 그 왕복을 안 기다린다.
//
// `VideoObject` 구조화 데이터를 함께 낸다. 이것이 있어야 검색 결과에서 영상으로 취급된다.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ComponentVideo } from '@/components/video/ComponentVideo'
import {
  KIND_LABEL,
  VIDEO_PUBLISHED,
  allVideoIds,
  videoById,
  videosByKind,
} from '@/lib/video/catalog'

/** 발행된 편만 정적으로 준비한다 — 나머지는 404 다. */
export function generateStaticParams() {
  return allVideoIds().map((id) => ({ id }))
}

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const video = videoById(params.id)
  if (!video) return { title: '찾을 수 없는 영상' }
  return {
    // 레이아웃이 브랜드를 붙인다 — 여기서 또 붙이면 두 번 나온다.
    title: `${video.title} — 영상으로 보기`,
    description: video.subtitle,
    openGraph: {
      title: video.title,
      description: video.subtitle,
      images: [{ url: video.poster }],
      type: 'video.other',
    },
  }
}

export default function VideoDetailPage({ params }: { params: { id: string } }) {
  const video = videoById(params.id)
  if (!VIDEO_PUBLISHED || !video) notFound()

  // 같은 종류의 다른 편 — 막다른 화면을 만들지 않는다(D5).
  const siblings = videosByKind()
    [video.kind].filter((v) => v.id !== video.id)
    .slice(0, 6)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.subtitle,
    thumbnailUrl: [video.poster],
    contentUrl: video.src,
    duration: `PT${Math.round(video.seconds)}S`,
    inLanguage: 'ko',
    transcript: video.transcript.join(' '),
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      {/* 구조화 데이터 — 이게 있어야 검색이 영상으로 취급한다. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- 우리가 만든 객체만 직렬화한다(사용자 입력 0)
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-4 font-body text-[13px] text-[var(--t3)]">
        <Link href="/video" className="hover:text-[var(--t1)]">
          영상으로 보기
        </Link>
        <span className="mx-1.5" aria-hidden>
          ›
        </span>
        <span>{KIND_LABEL[video.kind]}</span>
      </nav>

      <h1 className="break-keep font-editorial text-[clamp(24px,4vw,36px)] font-[600] leading-tight text-[var(--t1)]">
        {video.title}
      </h1>
      <p className="mt-2 break-keep font-body text-[15px] leading-relaxed text-[var(--t2)]">
        {video.subtitle}
      </p>

      <div className="mt-6">
        <ComponentVideo video={video} />
      </div>

      {/* 자막 전문 — **이 페이지의 존재 이유**. 영상 안의 말은 픽셀이라 기계가 못 읽는다. */}
      {video.transcript.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-[16px] font-bold text-[var(--t1)]">
            영상에서 하는 말
          </h2>
          <ol className="flex flex-col gap-2 border-l-2 border-[var(--bd)] pl-4">
            {video.transcript.map((line, i) => (
              <li
                key={i}
                className="break-keep font-body text-[14px] leading-relaxed text-[var(--t2)]"
              >
                {line}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 근거 — 영상에 나온 수치가 어디서 왔는지. 없으면 절을 그리지 않는다. */}
      {video.evidence.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-[16px] font-bold text-[var(--t1)]">
            영상 속 수치의 출처
          </h2>
          <dl className="flex flex-col gap-2">
            {video.evidence.map((e) => (
              <div key={e.label} className="break-keep font-body text-[13px]">
                <dt className="inline font-semibold text-[var(--t1)]">{e.label}</dt>
                <dd className="ml-2 inline tabular-nums text-[var(--t1)]">{e.value}</dd>
                <dd className="mt-0.5 font-mono text-[11px] text-[var(--t3)]">{e.source}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* 다음 한 걸음 — 막다른 화면을 만들지 않는다. */}
      <section className="mt-12 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-6">
        <p className="break-keep font-body text-[15px] leading-relaxed text-[var(--t1)]">
          말로 듣는 것보다 직접 해 보는 편이 빠릅니다 — 지문 하나를 넣으면{' '}
          <strong>내가 아는 비율</strong>이 바로 나옵니다.
        </p>
        <Link
          href="/fit"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-body text-[15px] font-semibold text-[var(--ti)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        >
          내 지문으로 재 보기
        </Link>
      </section>

      {siblings.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-[16px] font-bold text-[var(--t1)]">
            같은 종류의 다른 영상
          </h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/video/${v.id}`}
                  className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-body text-[13px] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--t1)]"
                >
                  {v.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
