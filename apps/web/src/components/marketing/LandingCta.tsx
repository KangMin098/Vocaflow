// apps/web/src/components/marketing/LandingCta.tsx
//
// 랜딩 히어로의 두 버튼 — **랜딩에서 유일하게 클라이언트인 부분.**
//
// 왜 이것만 떼어 냈나: 랜딩(`app/page.tsx`)은 서버 컴포넌트이고 `revalidate` 하루로
// 캐시된다. 거기서 `onClick` 이나 `useEffect` 를 쓰려면 화면 전체가 클라이언트가 되고,
// 그러면 초기 HTML 에 크롤러가 읽을 내용이 사라진다 — 이 자리에 있던 개발용 화면 인덱스가
// 정확히 그 상태였다. 그래서 **재는 부분만** 클라이언트로 둔다.
//
// 무엇을 재는가:
//   · `landing_viewed` — sitemap 132개 URL 이 여기로 온다. 못 세면 검색이 사람을 데려오는지 모른다
//   · `landing_cta_clicked` — `fit` 은 `fit_viewed` 와 대조해 랜딩→진단 이탈을 본다
//
// ⚠️ 계측이 실패해도 이동은 막지 않는다. `track` 은 이미 조용히 실패하도록 만들어져 있고,
//    여기서도 클릭 핸들러가 링크의 기본 동작을 가로채지 않는다.

'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

import { track } from '@/lib/analytics/client'

export function LandingCta() {
  useEffect(() => {
    track({ name: 'landing_viewed', props: {} })
  }, [])

  return (
    <>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/fit"
          onClick={() => track({ name: 'landing_cta_clicked', props: { target: 'fit' } })}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-6 font-body text-[14px] font-[700] text-[var(--on-p)] transition-opacity duration-[var(--dur-normal)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
        >
          지문 난이도 재 보기
          <ArrowRight size={16} aria-hidden />
        </Link>
        <Link
          href="/signup"
          onClick={() => track({ name: 'landing_cta_clicked', props: { target: 'signup' } })}
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-6 font-body text-[14px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
        >
          무료로 시작하기
        </Link>
      </div>
      <p className="mt-3 font-body text-[12px] text-[var(--t3)]">
        난이도 진단은 <strong>로그인 없이</strong> 바로 쓸 수 있어요
      </p>
    </>
  )
}
