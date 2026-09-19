// apps/web/src/app/(auth)/login/page.tsx
// @form: 채색 지문 — 로그인 폼 옆 지문이 학년 슬라이더로 칠해짐 · 200ms (/signup 과 같은 AuthSpread · SignupProof)
//
// 로그인 — 2026-09-19 화면 재설계(docs/design/compare/auth.md · DD-31 — `/signup` 골든 6호의 결정을 따른다).
//   이전: 빈 바탕 한가운데 그림자 카드 한 장 + 중앙 H1(감사 평균 — 뷰포트 약 70% 가 빈 공간).
//   지금: 판면 위 두 단 — 왼쪽(모바일은 위 두 줄) 칠해진 지문, 오른쪽 폼. 폼 로직은 `LoginForm.tsx` 그대로.

import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthSpread } from '../AuthProof'
import { LoginForm, LoginSkeleton } from './LoginForm'

export const metadata: Metadata = {
  title: '로그인',
  description: '로그인하면 글이 내 수준으로 칠해져요.',
}

export default function LoginPage() {
  return (
    <AuthSpread
      lead={
        <>
          지금은 학년 기준으로 칠했어요.
          <br />
          로그인하면 내 수준으로 칠해요.
        </>
      }
    >
      {/* useSearchParams 는 Suspense 경계가 없으면 페이지 전체가 CSR 로 이탈한다 (Next 14). */}
      <Suspense fallback={<LoginSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthSpread>
  )
}
