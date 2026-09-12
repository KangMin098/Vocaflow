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
import Link from 'next/link'

import { ComponentVideo } from '@/components/video/ComponentVideo'
import { KIND_LABEL, VIDEO_PUBLISHED, videosByKind, type VideoKind } from '@/lib/video/catalog'

export const metadata: Metadata = {
  title: '영상으로 보기',
  description: '플랫폼 소개·커리큘럼·시리즈·문항 유형·학습 활동을 짧은 영상으로 봅니다.',
}

/** 목록 순서 — 처음 온 사람이 읽는 순서다(무엇인가 → 왜 → 어떻게 → 무엇으로). */
const ORDER: VideoKind[] = ['intro', 'benefit', 'curriculum', 'series', 'type', 'module']

export default function VideoIndexPage() {
  const byKind = videosByKind()
  const total = ORDER.reduce((n, k) => n + byKind[k].length, 0)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <h1 className="break-keep font-display text-[clamp(28px,5vw,44px)] font-extrabold leading-tight text-[var(--t1)]">
          영상으로 보기
        </h1>
        <p className="mt-3 max-w-[52ch] break-keep text-[15px] leading-relaxed text-[var(--t2)]">
          읽는 대신 봅니다. 모든 수치는 화면에 출처가 함께 나옵니다.
        </p>
      </header>

      {!VIDEO_PUBLISHED || total === 0 ? (
        // 빈 상태에 **다음 한 걸음**이 있어야 한다(D5). "준비 중" 만 적고 끝내지 않는다.
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-6">
          <p className="break-keep text-[15px] leading-relaxed text-[var(--t2)]">
            영상은 아직 올라가지 않았습니다. 그동안 제품이 하는 일을 직접 해 볼 수 있어요 —
            지문 하나를 넣으면 <strong className="text-[var(--t1)]">내가 아는 비율</strong>이 바로 나옵니다.
          </p>
          <Link
            href="/fit"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--p)] px-5 text-[15px] font-semibold text-[var(--ti)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            내 지문으로 재 보기
          </Link>
        </section>
      ) : (
        ORDER.filter((kind) => byKind[kind].length > 0).map((kind) => (
          <section key={kind} className="mb-12">
            <h2 className="mb-1 break-keep font-display text-[20px] font-bold text-[var(--t1)]">
              {KIND_LABEL[kind]}
            </h2>
            <p className="mb-5 font-mono text-[13px] tabular-nums text-[var(--t3)]">
              {byKind[kind].length}편
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {byKind[kind].map((video) => (
                <article key={video.id}>
                  <ComponentVideo video={video} />
                  <h3 className="mt-2 break-keep text-[15px] font-semibold text-[var(--t1)]">
                    {video.title}
                  </h3>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  )
}
