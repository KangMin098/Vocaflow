// apps/web/src/components/hub/portal/TitleMarquee.tsx
//
// 흐르는 서명 줄 — 참조 홈 히어로 아래 **고객 로고 줄**(양 끝이 잘린 채 흐른다) 자리.
// 로고 대신 **실제로 발행된 고전의 제목**을 세리프 서명처럼 흘린다(지어낸 이름 0 — `hub-portal-query`).
//
// · 5초 넘게 움직이므로 멈춤 단추를 둔다(WCAG 2.2.2). 포인터가 올라오거나 포커스가 안에 있어도 멈춘다.
// · `prefers-reduced-motion` — 이동을 없애고 가로로 넘겨 보는 목록으로 둔다(낮추기, 끄기 아님).
// · 줄을 두 번 이어 붙여 -50% 까지 옮기면 이음매 없이 돈다. 두 번째 사본은 읽기 도구에서 숨긴다.

'use client'

import { Pause, Play } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { track } from '@/lib/analytics/client'
import type { PortalBook } from '@/lib/learner/hub-portal-query'

// 인라인 `animation` 을 쓰면 멈춤 규칙(:hover · :focus-within)이 인라인 우선순위에 진다 — 규칙은 한곳에 둔다.
const MARQUEE_CSS = `
@keyframes hub-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
.hub-mq { animation: hub-marquee var(--mq-dur, 40s) linear infinite; }
.hub-mq-wrap:hover .hub-mq, .hub-mq-wrap:focus-within .hub-mq, .hub-mq[data-held] { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .hub-mq { animation: none; } }
`

export function TitleMarquee({ books }: { books: PortalBook[] }) {
  const [held, setHeld] = useState(false)
  if (books.length === 0) return null

  const row = (copy: number) => (
    <ul aria-hidden={copy > 0 || undefined} className="flex shrink-0 items-center gap-14 pr-14">
      {books.map((b, i) => (
        <li key={`${copy}-${b.id}`} className="shrink-0">
          <Link
            href={`/library/books/${b.id}`}
            tabIndex={copy > 0 ? -1 : undefined}
            onClick={() => track({ name: 'hub_promo_clicked', props: { slot: 'shelf', index: 40 + i } })}
            className="whitespace-nowrap font-serif text-[24px] font-[600] tracking-[-0.01em] text-[var(--ju)] no-underline transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] md:text-[28px]"
          >
            {b.title}
          </Link>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="hub-mq-wrap relative flex items-center gap-3">
      <style>{MARQUEE_CSS}</style>
      <div
        aria-label="새로 들어온 고전 제목"
        role="region"
        className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:overflow-x-auto"
      >
        <div
          className="hub-mq flex w-max py-2"
          data-held={held || undefined}
          style={{ ['--mq-dur' as string]: `${Math.max(30, books.length * 5)}s` }}
        >
          {row(0)}
          {row(1)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setHeld((h) => !h)}
        aria-label={held ? '제목 흐름 다시 켜기' : '제목 흐름 멈추기'}
        aria-pressed={held}
        className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--bd)] text-[var(--ju)] transition-colors hover:bg-[var(--tint-lavender)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-safe:inline-flex"
      >
        {held ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}
      </button>
    </div>
  )
}
