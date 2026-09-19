// apps/web/src/app/(auth)/AuthProof.tsx
//
// **인증 화면 옆의 칠해진 지문** — `/login` · `/reset-password` · `/verify-email` 의 골격
// (2026-09-19 화면 재설계 DD-31 · docs/design/compare/auth.md — `/signup` 골든 6호(DD-26)의 결정을 따른다).
//
// 세 화면은 빈 바탕 한가운데 그림자 카드 한 장이었다(감사 평균 — 뷰포트 약 70% 가 빈 공간).
// 공개 화면이라 첫 화면에 **실제로 수행한 결과**가 있어야 한다(I1–I2). 가입 화면과 같은 지문이
// 같은 부품(`SignupProof` → `PaintedPassage`)으로 칠해진 채 폼 옆에 선다 — 화면마다 첫 문장만 다르다.
// 데모 지문은 랜딩과 같은 계산(`buildHeroDemo`, 계정 무관)이다. 계산이 실패하면 폼만 선다.

import type { ReactNode } from 'react'

import { buildHeroDemo } from '@/lib/marketing/hero-demo'
import type { ProfileLevel } from '@/lib/textfit/profile'

import { SignupProof } from './signup/SignupProof'

/** 두 단 판면 — 왼쪽(모바일은 위 두 줄) 칠해진 지문, 오른쪽 폼. `/signup/page.tsx` 와 같은 격자 */
export async function AuthSpread({ lead, children }: { lead: ReactNode; children: ReactNode }) {
  const demo = await buildHeroDemo()
  return (
    // `data-auth-wide` — 인증 레이아웃의 좁은 칼럼(max-w-md)을 넓힌다(layout 의 has-[] 규칙)
    <div data-auth-wide="" className="grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-14">
      {demo && (
        <section
          aria-label="칠해진 지문"
          className="flex flex-col gap-2 md:gap-4 md:border-r md:border-[var(--bd)] md:pr-14"
        >
          <p className="m-0 hidden break-keep font-ko-display text-[20px] font-[600] leading-[1.4] text-[var(--t1)] md:block">
            {lead}
          </p>
          <SignupProof
            tokens={demo.tokens}
            readings={demo.readings}
            fitLevel={demo.fitLevel as ProfileLevel | null}
          />
        </section>
      )}
      <div>{children}</div>
    </div>
  )
}
