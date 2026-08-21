// apps/web/src/components/library/textbooks/MyTextbooks.tsx
//
// **내 교재** — My Library 의 교재 면.
//
// 서가(`/library/textbooks`)가 고르는 곳이라면 여기는 **고른 것을 관리하는 곳**이다.
// 서점과 책장의 관계와 같다.
//
// ⚠️ 세 상태를 반드시 구별한다:
//   · 저장소를 못 읽음(`available: false`) → "확인 중". 고른 것이 없다고 말하면 거짓이다.
//   · 고른 것이 없음                        → 서가로 보낸다
//   · 고른 것이 있음                        → 권을 관리한다
// 앞의 둘을 한 문장으로 뭉개는 것이 이 저장소의 지배적 결함 유형이다(CONVENTIONS).

import { ArrowRight, BookOpen, Library } from 'lucide-react'
import Link from 'next/link'

import type { Shelf } from '@/lib/textbook/shelf'
import type { MySelection } from '@/lib/textbook/my-shelf-query'
import { TYPE_GUIDE } from '@/lib/textbook/type-guide'

export function MyTextbooks({ shelf, mine }: { shelf: Shelf; mine: MySelection }) {
  // ① 못 읽음 — 0 과 구별한다.
  if (!mine.available) {
    return (
      <Section>
        <p role="status" className="font-body text-[13px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
          담은 교재를 <strong className="font-display text-[var(--t1)]">확인하지 못했어요</strong> —
          없다는 뜻이 아닙니다. 잠시 뒤 다시 열어 보세요.
        </p>
      </Section>
    )
  }

  const picked = shelf.volumes.filter((v) => mine.steps.includes(v.step))

  // ② 고른 것이 없음 — 서가로 보낸다.
  if (picked.length === 0) {
    return (
      <Section>
        <p className="max-w-[46ch] font-editorial text-[19px] font-[500] leading-[1.35] text-[var(--t1)] [word-break:keep-all]">
          아직 담은 교재가 없어요.
        </p>
        <p className="mt-2 max-w-[52ch] font-body text-[12.5px] leading-[1.75] text-[var(--t2)] [word-break:keep-all]">
          학년을 잇는 일곱 권 중 지금 수준에 맞는 것을 고르면 여기에 쌓여요.
        </p>
        <Link
          href="/library/textbooks"
          className="group mt-4 inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--p-light)] px-4 font-display text-[12.5px] font-[700] text-[var(--on-p-tint)] no-underline transition-colors hover:bg-[var(--p)] hover:text-[var(--on-p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <Library size={14} aria-hidden />
          교재 서가 둘러보기
          <ArrowRight size={13} aria-hidden className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
        </Link>
      </Section>
    )
  }

  // ③ 관리 — 담은 권을 계단 순서로.
  return (
    <Section>
      <ol className="flex flex-col divide-y divide-[var(--bd)]">
        {picked.map((v) => (
          <li key={v.step} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3.5">
            <span
              aria-hidden
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p)] font-display text-[12px] font-[800] tabular-nums text-[var(--on-p)]"
            >
              {v.step}
            </span>
            <span className="min-w-0 flex-1">
              <Link
                href={`/library/textbooks/${v.step}`}
                className="font-editorial text-[17px] font-[500] text-[var(--t1)] no-underline hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
              >
                {v.title}
              </Link>
              <span className="mt-0.5 block font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
                {v.schoolBand} · 문항 {v.itemCount.toLocaleString()} · 최대 {v.maxUnits}단원
              </span>
            </span>
            <span className="flex flex-wrap gap-1">
              {v.types.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-display text-[10.5px] font-[700] text-[var(--t2)]"
                >
                  {TYPE_GUIDE[t]?.label ?? t}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>

      <Link
        href="/library/textbooks"
        className="group mt-4 inline-flex min-h-[44px] w-fit items-center gap-1 font-display text-[12px] font-[700] text-[var(--p)] no-underline transition-colors hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <BookOpen size={13} aria-hidden />
        교재 더 고르기
        <ArrowRight size={12} aria-hidden className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
      </Link>
    </Section>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="내 교재"
      className="rounded-ios-2xl bg-[var(--bg)] px-5 py-5 shadow-ios-2 md:px-8"
    >
      <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
        내 교재
      </p>
      <div className="mt-3">{children}</div>
    </section>
  )
}
