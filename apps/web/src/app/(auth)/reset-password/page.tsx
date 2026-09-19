// apps/web/src/app/(auth)/reset-password/page.tsx
// @form: 채색 지문 — 재설정 폼 옆 지문이 학년 슬라이더로 칠해짐 · 200ms (/signup 과 같은 AuthSpread · SignupProof)
//
// 비밀번호 재설정 — 2026-09-19 화면 재설계(docs/design/compare/auth.md · DD-31 — `/signup` 골든 6호의 결정).
//   이전: 공개 화면 중 정적 신호 최다(11) — 그림자 카드 3벌 · 아이콘 원 · 좁은 카드에 두 줄 중앙 H1.
//   지금: 판면 위 두 단. 로직(요청·발송 완료·새 비밀번호 3상태)은 `ResetPasswordForm.tsx` 그대로.

import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthSpread } from '../AuthProof'
import { ResetPasswordForm, ResetSkeleton } from './ResetPasswordForm'

export const metadata: Metadata = {
  title: '비밀번호 재설정',
  description: '가입한 이메일로 재설정 링크를 보내드려요.',
}

export default function ResetPasswordPage() {
  return (
    <AuthSpread
      lead={
        <>
          다시 들어오면, 이 글은
          <br />
          내 수준으로 칠해져 있어요.
        </>
      }
    >
      {/* useSearchParams 는 Suspense 경계가 없으면 페이지 전체가 CSR 로 이탈한다 (Next 14). */}
      <Suspense fallback={<ResetSkeleton />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthSpread>
  )
}
