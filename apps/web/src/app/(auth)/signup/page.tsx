// apps/web/src/app/(auth)/signup/page.tsx
// @form: 채색 지문 — 가입 폼 옆 지문이 학년 슬라이더로 칠해짐 · 200ms (/fit 과 같은 PaintedPassage · SignupProof)
//
// 가입 — 2026-09-19 화면 재설계(발산 A 「칠해진 지문 옆의 가입」 · docs/design/compare/signup.md · DD-26).
//   이전: 빈 바탕 한가운데 그림자 카드 폼 + 중앙 H1 2줄 · 1차 행동이 1280·390 모두 첫 화면 밖(감사 평균).
//   지금: 판면 위 두 단 — 왼쪽(모바일은 위 두 줄) = 랜딩·`/fit` 과 같은 지문이 칠해진 채, 오른쪽 = 폼.
//   데모 지문은 랜딩과 같은 계산(`buildHeroDemo`, 사전 조회 — 계정 무관)이다. 계산이 실패하면 폼만 선다.
//
// 폼 로직은 그대로 `SignupForm.tsx`(클라이언트) — 복귀 경로 보존·세션 분기·약관 동의.

import type { Metadata } from 'next'
import { Suspense } from 'react'

import { buildHeroDemo } from '@/lib/marketing/hero-demo'
import type { ProfileLevel } from '@/lib/textfit/profile'

import { SignupForm, SignupSkeleton } from './SignupForm'
import { SignupProof } from './SignupProof'

export const metadata: Metadata = {
  title: '가입',
  description: '가입하고 진단하면 글이 내 수준으로 칠해져요.',
}

export default async function SignupPage() {
  const demo = await buildHeroDemo()

  return (
    // `data-auth-wide` — 인증 레이아웃의 좁은 칼럼(max-w-md)을 이 화면만 넓힌다(layout 의 has-[] 규칙)
    <div data-auth-wide="" className="grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-14">
      {demo && (
        <section aria-label="가입하면 저장되는 것" className="flex flex-col gap-2 md:gap-4 md:border-r md:border-[var(--bd)] md:pr-14">
          <p className="m-0 hidden break-keep font-ko-display text-[20px] font-[600] leading-[1.4] text-[var(--t1)] md:block">
            지금은 학년 기준으로 칠했어요.
            <br />
            가입하고 진단하면 내 수준으로 칠해요.
          </p>
          <SignupProof
            tokens={demo.tokens}
            readings={demo.readings}
            fitLevel={demo.fitLevel as ProfileLevel | null}
          />
        </section>
      )}

      <div>
        {/* useSearchParams 는 Suspense 경계가 없으면 페이지 전체가 CSR 로 이탈한다 (Next 14). */}
        <Suspense fallback={<SignupSkeleton />}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  )
}
