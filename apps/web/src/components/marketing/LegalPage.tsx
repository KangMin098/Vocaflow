// apps/web/src/components/marketing/LegalPage.tsx
// 약관·정책 공통 레이아웃 — 좌측 sticky TOC + 본문
// 차분한 타이포 · 가독성 우선

'use client'

import { Calendar, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'

export interface LegalSection {
  id: string
  title: string
  /** 단락 배열 — 줄바꿈은 별도 항목으로 */
  paragraphs: string[]
  /** 선택: 불릿 리스트 */
  bullets?: string[]
}

export interface LegalPageProps {
  title: string
  intro: string
  effectiveDate: string
  version: string
  sections: LegalSection[]
}

export function LegalPage({ title, intro, effectiveDate, version, sections }: LegalPageProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // ── Scroll spy: 가장 위에 보이는 섹션을 active 로 ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections])

  return (
    <div className="bg-[var(--bg)]">
      {/* ── Header ── */}
      <header className="border-b border-[var(--bd)] bg-[var(--bg2)]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--bd)] bg-[var(--bg)] px-3 py-1 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
            <FileText size={11} className="text-[var(--p)]" aria-hidden />
            법적 문서
          </span>
          <h1 className="mt-4 font-display text-[32px] font-[800] tracking-tight text-[var(--t1)] md:text-[40px]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl font-body text-[15px] leading-relaxed text-[var(--t2)]">
            {intro}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4 font-mono text-[11px] text-[var(--t2)]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} aria-hidden />
              시행일 {effectiveDate}
            </span>
            <span className="text-[var(--t2)]">·</span>
            <span>버전 {version}</span>
          </div>
        </div>
      </header>

      {/* ── Body: TOC + Content ── */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-[200px_1fr]">
          {/* TOC (sticky) */}
          <aside className="hidden md:block">
            <nav
              aria-label="목차"
              className="sticky top-20 space-y-1 border-l border-[var(--bd)] pl-4"
            >
              <p className="mb-3 font-display text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
                목차
              </p>
              {sections.map((s, i) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`block py-1 font-body text-[12px] leading-snug transition-colors duration-[var(--dur-normal)] ${
                    activeId === s.id
                      ? 'font-[600] text-[var(--p)]'
                      : 'text-[var(--t2)] hover:text-[var(--t1)]'
                  }`}
                >
                  <span className="font-mono text-[10px] tabular-nums text-[var(--t2)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>{' '}
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <article className="min-w-0 space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-20">
                <h2 className="flex items-baseline gap-3 font-display text-[20px] font-[700] tracking-tight text-[var(--t1)] md:text-[22px]">
                  <span className="font-mono text-[12px] font-[600] tabular-nums text-[var(--t2)]">
                    {String(i + 1).padStart(2, '0')}.
                  </span>
                  {s.title}
                </h2>
                <div className="mt-4 space-y-4">
                  {s.paragraphs.map((p, j) => (
                    <p
                      key={j}
                      className="font-body text-[14px] leading-[1.75] text-[var(--t2)]"
                    >
                      {p}
                    </p>
                  ))}
                  {s.bullets && (
                    <ul className="mt-3 space-y-2">
                      {s.bullets.map((b, j) => (
                        <li
                          key={j}
                          className="relative pl-5 font-body text-[14px] leading-[1.7] text-[var(--t2)]"
                        >
                          <span
                            className="absolute left-0 top-[10px] h-1 w-1 rounded-full bg-[var(--t3)]"
                            aria-hidden
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}

            {/* footer */}
            <footer className="border-t border-[var(--bd)] pt-6 font-body text-[12px] text-[var(--t2)]">
              본 문서에 대한 문의는{' '}
              <a
                href="mailto:legal@vocaflow.app"
                className="font-[600] text-[var(--p)] hover:underline"
              >
                legal@vocaflow.app
              </a>{' '}
              으로 연락 주세요.
            </footer>
          </article>
        </div>
      </div>
    </div>
  )
}
