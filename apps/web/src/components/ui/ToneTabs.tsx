// apps/web/src/components/ui/ToneTabs.tsx
//
// 색 탭(DD-68 · tines-mapping §14) — 참조 홈 `HomeUseCasesSection`: 탭 하나하나가 **다른 원색 카드**(초록 · 보라 · 청록 ·
// 주황 · 파랑, 모서리 14, 크림 글자)이고, 고른 탭의 색이 아래 패널로 이어진다. 실측 ui-kit-summary 「탭」.
//
// 접근성: role=tablist/tab/tabpanel · aria-selected · aria-controls · 방향키(←→ · Home · End)로 옮기고
// 옮긴 탭이 곧 선택된다(자동 활성). 선택되지 않은 탭은 tabIndex=-1 — Tab 키는 목록에서 패널로 바로 간다.
// 색만으로 선택을 알리지 않는다 — 선택된 탭은 아래 모서리가 패널과 이어지고 제목 밑줄이 생긴다.

'use client'

import Image from 'next/image'
import { useId, useRef, useState } from 'react'

import { DEEP_CLASS, type Deep } from '@/lib/design/tone'

export type ToneTab = {
  id: string
  label: string
  /** 탭 카드 안 한 줄 */
  summary: string
  tone: Deep
  /** 탭 카드 구석 소품(`public/illustrations/tines/<spot>.webp`) */
  spot?: string
  /** 패널 — 서버에서 만든 노드를 그대로 받는다 */
  panel: React.ReactNode
}

export function ToneTabs({ items, label }: { items: ToneTab[]; label: string }) {
  const [active, setActive] = useState(0)
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const move = (to: number) => {
    const n = (to + items.length) % items.length
    setActive(n)
    refs.current[n]?.focus()
  }
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); move(i + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); move(0) }
    else if (e.key === 'End') { e.preventDefault(); move(items.length - 1) }
  }
  const cur = items[active]

  return (
    <div>
      <div role="tablist" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((t, i) => {
          const on = i === active
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el }}
              role="tab"
              type="button"
              id={`${base}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${base}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKey(e, i)}
              data-shape="keep"
              className={`${DEEP_CLASS[t.tone]} relative flex min-h-[150px] flex-col overflow-hidden p-5 text-left text-[var(--t1)] transition-[filter] duration-[var(--dur-quick)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] lg:min-h-[167px] ${
                on ? 'rounded-t-[14px] rounded-b-none lg:-mb-2 lg:pb-7' : 'rounded-[14px]'
              }`}
            >
              <span className={`font-serif text-[22px] leading-[1.15] ${on ? 'underline decoration-2 underline-offset-[6px]' : ''}`}>{t.label}</span>
              <span className="mt-2 max-w-[22ch] break-keep font-body text-[14px] leading-[1.45]">{t.summary}</span>
              {t.spot && (
                <Image src={`/illustrations/tines/${t.spot}.webp`} alt="" width={1328} height={1328} className="pointer-events-none mt-auto w-[72px] self-end select-none" />
              )}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${cur.id}`}
        tabIndex={0}
        className={`${DEEP_CLASS[cur.tone]} mt-2 rounded-[14px] p-6 text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] md:p-10 lg:mt-0 ${
          active === 0 ? 'lg:rounded-tl-none' : active === items.length - 1 ? 'lg:rounded-tr-none' : ''
        }`}
      >
        {cur.panel}
      </div>
    </div>
  )
}
