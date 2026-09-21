// apps/web/src/app/(marketing)/video/page.tsx
//
// **영상 서가** — 플랫폼 구성요소마다 한 편씩.
//
// 왜 공개(로그인 없이)인가: 이 목록의 첫 독자는 학습자가 아니라 **교사**다.
// 허용 CAC 가 가입당 ₩400 이라 광고 경로가 성립하지 않고 교사→학급 경로만 남는데
// (`docs/PLATFORM_AUDIT.md`), 교사는 3분 안에 "이게 뭐 하는 물건인지" 를 판단한다.
// 글로 읽히는 3분과 보이는 3분은 다르다.
//
// 발행 전에는 이 라우트가 **목록 대신 다음 걸음을 보여 준다**(D5) — 빈 화면을 두지 않는다.

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { ComponentVideo } from '@/components/video/ComponentVideo'
import { KIND_LABEL, KIND_ORDER, VIDEO_PUBLISHED, videosByKind } from '@/lib/video/catalog'
import { PILL } from '@/components/marketing/pill'
import { Frame, Hero2Col, SectionHead, WRAP } from '@/components/marketing/sections'

export const metadata: Metadata = {
  title: '영상으로 보기',
  description: '플랫폼 소개·학습 방법·권장안·커리큘럼·시리즈·문항 유형·학습 활동을 짧은 영상으로 봅니다.',
}

// 목록 순서는 `KIND_LABEL` 의 키 순서다 — 여기서 다시 적지 않는다.
// 손으로 적었더니 종류를 둘 더한 날 **11편이 조용히 사라졌다**(화면은 멀쩡히 떴다).
const ORDER = KIND_ORDER

// 모양(DD-68): 참조 블로그·팟캐스트 목록 — 2열 히어로(영사기 장면) → 종류마다 눈썹 머리 + 액자 속 영상 격자.
// ⚠️ 레이아웃이 이미 <main> 을 그린다 — 여기서 한 번 더 그리면 main 이 겹친다(예전 결함).
export default function VideoIndexPage() {
  const byKind = videosByKind()
  const total = ORDER.reduce((n, k) => n + byKind[k].length, 0)

  return (
    <div className="pb-8">
      <Hero2Col
        kicker="영상"
        title={<>읽는 대신<br />봅니다.</>}
        sub="모든 수치는 화면에 출처가 함께 나옵니다."
        media={<Image src="/illustrations/tines/scene-video.webp" alt="" width={1664} height={928} priority sizes="(min-width: 1024px) 50vw, 100vw" className="h-auto w-full" />}
      />

      {!VIDEO_PUBLISHED || total === 0 ? (
        // 빈 상태에 **다음 한 걸음**이 있어야 한다. "준비 중" 만 적고 끝내지 않는다.
        <section className={WRAP}>
          <div className="rounded-[var(--r-2xl)] bg-[var(--tint-lavender)] p-8 text-[var(--t1)] md:p-12">
            <p className="max-w-[48ch] break-keep font-serif text-[22px] leading-[1.45]">
              영상은 아직 올라가지 않았습니다. 그동안 제품이 하는 일을 직접 해 볼 수 있어요 —
              지문 하나를 넣으면 <strong>내가 아는 비율</strong>이 바로 나옵니다.
            </p>
            <Link href="/fit" className={`${PILL} mt-6 bg-[var(--ju)] text-[var(--on-ju)] hover:bg-[var(--p)]`}>
              내 지문으로 재 보기
            </Link>
          </div>
        </section>
      ) : (
        ORDER.filter((kind) => byKind[kind].length > 0).map((kind) => (
          <section key={kind} className={`${WRAP} pb-20`}>
            <SectionHead kicker={`${byKind[kind].length}편`} title={KIND_LABEL[kind]} />
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {byKind[kind].map((video) => (
                <article key={video.id}>
                  <Frame>
                    <ComponentVideo video={video} />
                  </Frame>
                  {/*
                    제목이 **편별 페이지로 가는 링크**다. 그 페이지에 자막 전문이 서버 렌더로
                    깔려 있어 검색이 읽을 것이 있다 — 목록만 있으면 62편이 URL 하나를 나눠 쓴다.
                  */}
                  <h3 className="mt-3 break-keep font-serif text-[20px] font-[700]">
                    <Link
                      href={`/video/${video.id}`}
                      className="text-[var(--t1)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
                    >
                      {video.title}
                    </Link>
                  </h3>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
