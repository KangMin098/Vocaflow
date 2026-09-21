// apps/web/src/components/marketing/LandingCta.tsx
//
// 랜딩 CTA 두 개 + 도착 계측. 모양은 참조 사이트의 알약 버튼(대문자 모노 라벨 · 990px 모서리 ·
// 채움 `--p` / 외곽선 `--ju`)을 따른다(DD-68). 계측 이벤트는 모양과 무관하게 그대로다.

'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { track } from '@/lib/analytics/client'

import { PILL } from './pill'

/**
 * @param trackView 도착(`landing_viewed`)을 이 자리가 센다 — 한 화면에 CTA 를 두 번 두면 두 번째는 `false`
 *   (두 번 세면 도착 수가 부풀어 퍼널이 거짓이 된다). 클릭은 어느 자리든 센다.
 */
export function LandingCta({ align = 'start', trackView = true }: { align?: 'start' | 'center'; trackView?: boolean }) {
  useEffect(() => {
    if (trackView) track({ name: 'landing_viewed', props: {} })
  }, [trackView])

  return (
    <div className={align === 'center' ? 'flex flex-col items-center' : 'flex flex-col items-start'}>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/fit"
          onClick={() => track({ name: 'landing_cta_clicked', props: { target: 'fit' } })}
          className={`${PILL} bg-[var(--ju)] text-[var(--on-ju)] hover:bg-[var(--p)]`}
        >
          지문 난이도 재 보기
        </Link>
        <Link
          href="/signup"
          onClick={() => track({ name: 'landing_cta_clicked', props: { target: 'signup' } })}
          className={`${PILL} border border-[var(--ju)] text-[var(--ju)] hover:bg-[var(--bg3)]`}
        >
          무료로 시작하기
        </Link>
      </div>
      <p className="mt-3 break-keep font-body text-[13px] text-[var(--t2)]">
        난이도 진단은 <strong>로그인 없이</strong> 바로 쓸 수 있어요
      </p>
    </div>
  )
}
