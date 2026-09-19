// apps/web/src/app/(auth)/verify-email/page.tsx
// @form: 채색 지문 — 인증 안내 옆 지문이 학년 슬라이더로 칠해짐 · 200ms (/signup 과 같은 AuthSpread · SignupProof)
//
// 이메일 인증 대기 — 2026-09-19 화면 재설계(docs/design/compare/auth.md · DD-31 — `/signup` 골든 6호의 결정).
//   메일을 기다리는 동안에도 방금 가입한 이유(칠해진 지문)가 옆에 남는다. 로직은 `VerifyEmailClient.tsx` 그대로.

import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AuthSpread } from '../AuthProof'
import { VerifyEmailClient, VerifyEmailSkeleton } from './VerifyEmailClient'

export const metadata: Metadata = {
  title: '이메일 확인',
  description: '메일의 링크를 누르면 진단부터 시작해요.',
}

export default function VerifyEmailPage() {
  return (
    <AuthSpread
      lead={
        <>
          메일의 링크를 누르면 진단부터 —
          <br />
          이 글이 내 수준으로 칠해져요.
        </>
      }
    >
      <Suspense fallback={<VerifyEmailSkeleton />}>
        <VerifyEmailClient />
      </Suspense>
    </AuthSpread>
  )
}
