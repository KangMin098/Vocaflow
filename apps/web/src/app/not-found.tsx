// apps/web/src/app/not-found.tsx
//
// 404 — 참조 사이트 404 골격(DD-68 · tines-mapping §2): 공통 헤더 · 큰 제목 · 폭 전체 장면 삽화(갈림길 팻말) · 출구 알약.
// 루트 not-found 라 레이아웃 그룹 밖이다 — 공통 헤더·푸터를 직접 얹는다.

import Image from 'next/image'
import Link from 'next/link'

import { PILL } from '@/components/marketing/pill'
import { SiteFooter } from '@/components/marketing/site/SiteFooter'
import { SiteHeader } from '@/components/marketing/site/SiteHeader'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[1360px] px-4 pb-6 pt-10 text-center lg:px-10 lg:pt-16">
          <p className="font-mono text-[14px] font-[700] uppercase tracking-[0.06em] text-[var(--ju)]">404</p>
          <h1 className="mt-4 break-keep font-display text-[40px] font-[400] leading-[1.06] tracking-[-0.03em] text-[var(--t1)] md:text-[64px]">
            페이지를 찾을 수 없어요.
          </h1>
          <p className="mx-auto mt-5 max-w-[40ch] break-keep font-serif text-[20px] leading-[1.45] text-[var(--t2)] md:text-[24px]">
            주소가 잘렸거나 바뀐 것 같아요. 아래에서 다시 시작할 수 있어요.
          </p>

          {/* ⚠️ 1차 출구는 반드시 **공개** 라우트다.
              예전엔 유일한 버튼이 `/hub`(PROTECTED_PREFIXES 첫 줄)라, 깨진 공유 링크로 온
              익명 방문자가 404 에서 곧장 로그인 폼으로 튕겼다 — 가입 의사가 없던 사람에게
              아무 설명 없이 로그인 벽을 세우는 길이었다. `/` 는 인증 여부와 무관하게 열리고,
              로그인 상태면 미들웨어가 `/hub` 로 보내 준다(한 줄로 두 경우를 다 만족). */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className={`${PILL} bg-[var(--ju)] text-[var(--on-ju)] hover:bg-[var(--p)]`}>
              처음 화면으로
            </Link>
            <Link href="/fit" className={`${PILL} border border-[var(--ju)] text-[var(--ju)] hover:bg-[var(--bg3)]`}>
              지문 진단 해보기
            </Link>
          </div>
        </section>
        <Image
          src="/illustrations/tines/scene-404.webp"
          alt=""
          width={1664}
          height={928}
          sizes="100vw"
          className="h-auto w-full select-none [mask-image:linear-gradient(to_bottom,transparent,black_18%)]"
        />
      </main>
      <SiteFooter />
    </div>
  )
}
