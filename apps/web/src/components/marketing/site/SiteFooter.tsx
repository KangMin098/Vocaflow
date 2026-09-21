// apps/web/src/components/marketing/site/SiteFooter.tsx
//
// 공개 화면 공통 푸터(DD-68 · tines-mapping C7) — 참조 `SiteFooter26` 의 다단 링크 묶음 골격.
// 링크는 nav-data 한 곳에서 온다(헤더 · 서랍 · 푸터가 같은 목록을 본다).

import Link from 'next/link'

import { LogoMark } from './LogoMark'
import { FOOTER_COLUMNS } from './nav-data'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--bd)] bg-[var(--bg)]">
      <div className="mx-auto max-w-[1360px] px-4 py-14 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_3fr]">
          <div>
            <Link href="/" className={`inline-flex min-h-[44px] items-center gap-2 rounded-full ${FOCUS}`} aria-label="Vocaflow 홈">
              <LogoMark />
              <span className="font-display text-[22px] font-[500] tracking-[-0.02em] text-[var(--ju)]">vocaflow</span>
            </Link>
            <p className="mt-3 max-w-[28ch] break-keep font-serif text-[18px] leading-[1.4] text-[var(--ju)]">
              내가 아는 비율로 읽기를 설계합니다.
            </p>
          </div>
          <nav aria-label="바닥글" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="font-display text-[13px] font-[700] tracking-[0.04em] text-[var(--ju)]">{col.title}</p>
                <ul className="mt-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className={`inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] font-body text-[14px] text-[var(--ju)] underline-offset-4 hover:underline ${FOCUS}`}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <p className="mt-10 border-t border-[var(--bd)] pt-6 font-body text-[13px] text-[var(--ju)]">
          © {new Date().getFullYear()} Vocaflow — 영어 스크립트 기반 어휘 학습
        </p>
      </div>
    </footer>
  )
}
