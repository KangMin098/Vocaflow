// apps/web/src/components/home/GatewayLead.tsx
//
// 관문 첫 줄 — **돌아온 사람을 알아보는 자리**.
//
// 이 줄이 생기기 전 `/hub` 은 처음 온 사람·오늘 이미 한 사람·사흘 만에 온 사람에게
// 전부 같은 화면을 보여줬다. 모바일이 없어 푸시·위젯이 없는 제품에서(PLATFORM_AUDIT F2)
// 웹 홈은 유일한 리텐션 장치인데, 그 자리가 복귀를 다루지 않고 있었다.
//
// 설계 규칙:
//   ① **경쟁 CTA 를 만들지 않는다.** 이어하기는 버튼이 아니라 링크 한 줄이다.
//      화면의 1차 행동은 여전히 무대의 "지금 시작" 하나다(단일 CTA 규칙).
//   ② **할 말이 없으면 그리지 않는다.** 처음 온 사람·오늘 이미 한 사람에게는 null 을
//      받아 아무것도 렌더하지 않는다. 자리를 채우려고 인사말을 만들지 않는다 —
//      히어로 140px 를 매일 같은 인사말에 쓰던 것이 이전 허브의 결함이었다.
//   ③ **공백을 비난으로 만들지 않는다.** 7일 넘게 비면 일수를 아예 지운다(gateway-state 주석).

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { activityLabel } from '@/lib/framework/registry'
import { gatewayLine, type GatewayState } from '@/lib/learner/gateway-state'

export function GatewayLead({ state }: { state: GatewayState }) {
  // 활동 이름은 레지스트리가 소유한다 — 화면에서 짓지 않는다(apps/web/CLAUDE.md).
  const name = state.last ? activityLabel(state.last.module) : null
  const line = gatewayLine(state, name)
  if (!line) return null

  const href = state.last?.href ?? null

  return (
    <section
      aria-label="이어하기"
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-ios-xl bg-[var(--bg)] px-5 py-3.5 shadow-ios-1 md:px-6"
    >
      <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
        {line.lead}
      </p>

      {line.detail && (
        <p className="min-w-0 font-body text-[13px] leading-snug text-[var(--t2)] [word-break:keep-all]">
          {line.detail}
        </p>
      )}

      {/* 2차 행동 — 무대의 단일 CTA 와 무게가 겹치지 않도록 버튼이 아니라 링크로 둔다. */}
      {href && (
        <Link
          href={href}
          className="group ml-auto inline-flex min-h-[44px] shrink-0 items-center gap-1 font-display text-[13px] font-[700] text-[var(--p)] no-underline transition-colors duration-[var(--dur-normal)] hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          거기서 이어하기
          <ArrowRight
            size={13}
            aria-hidden
            className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
          />
        </Link>
      )}
    </section>
  )
}
