// apps/web/src/components/practice/TextbookPracticeScope.tsx
// 교재 연습 — 문항을 **실제로 고른 경로**를 학습 전에 알린다(volume · legacy_v_level).
//   legacy_v_level(V레벨 공통 풀): 안내를 먼저 보이고 「공통 문항으로 연습하기」를 명시 선택한 뒤에만 문항을 그린다.
//   volume(권 단위 함수): 「교재의 수준 · 유형 기준」 한 줄 — 인쇄본 수록 문제와 같다고 약속하지 않는다.
//   경로를 모르면(null) 공통 풀처럼 다룬다 — 권 전용으로 낙관하지 않는다.
// 선택 · 접기는 상태만 바꾼다 — 채점 · 시도 기록 · 이벤트를 만들지 않는다. DcpPlayer 는 그대로 쓴다(revisit 끔).

'use client'

import Link from 'next/link'
import { useState } from 'react'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import type { DcpItem } from '@/lib/learner/dcp'
import type { VolumePracticePath } from '@/lib/textbook/practice-rpc'

export const COMMON_POOL_NOTICE = '선택한 교재의 기준 수준으로 고른 공통 문항이에요.'
export const COMMON_POOL_LIMIT = '교재에 실린 문제나 어휘 · 구문 영역 구성과 같다는 뜻은 아니에요.'
export const COMMON_POOL_CTA = '공통 문항으로 연습하기'
export const VOLUME_SCOPE_NOTE = '이 교재의 수준 · 유형 기준으로 고른 연습 문항이에요. 인쇄본에 실린 문제와 같지 않을 수 있어요.'

export function TextbookPracticeScope({
  items,
  scope,
  backHref,
  backCta,
  grade,
}: {
  items: DcpItem[]
  scope: VolumePracticePath | null
  backHref: string
  backCta: string
  /** 격리 dev 화면만 합성 채점을 넣는다(기본 = 서버 채점) */
  grade?: Parameters<typeof DcpPlayer>[0]['grade']
}) {
  const [chosen, setChosen] = useState(false)
  const player = <DcpPlayer items={items} backHref={backHref} backCta={backCta} grade={grade} />

  if (scope === 'volume') {
    return (
      <div className="flex flex-col gap-3" data-testid="textbook-scope-volume">
        <p className="m-0 break-keep font-body text-[12.5px] text-[var(--t2)]">{VOLUME_SCOPE_NOTE}</p>
        {player}
      </div>
    )
  }

  if (!chosen) {
    return (
      <section
        aria-label="공통 문항 안내"
        className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5"
        data-testid="textbook-scope-common"
      >
        <p className="m-0 break-keep font-display text-[14px] font-[700] text-[var(--t1)]">{COMMON_POOL_NOTICE}</p>
        <p className="m-0 break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">{COMMON_POOL_LIMIT}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setChosen(true)}
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)]"
            data-testid="textbook-scope-choose"
          >
            {COMMON_POOL_CTA}
          </button>
          <Link
            href={backHref}
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-5 font-display text-[14px] font-[700] text-[var(--t1)] no-underline transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            {backCta}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-3" data-testid="textbook-scope-common-chosen">
      <p className="m-0 break-keep font-body text-[12.5px] text-[var(--t2)]">
        {COMMON_POOL_NOTICE} {COMMON_POOL_LIMIT}
      </p>
      {player}
    </div>
  )
}
