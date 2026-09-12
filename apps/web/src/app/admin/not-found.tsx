// apps/web/src/app/admin/not-found.tsx
//
// Admin 전용 404.
//
// 없을 때: 한 글자 틀린 주소(끝의 s 를 빠뜨린 「변경 이력」 경로 같은)나, 지워진 화면의 북마크가
// 루트 not-found 로 떨어져 **사이드바가 사라진다.** 관리자는 자기가 admin 밖으로
// 튕겼는지 주소를 잘못 쳤는지 구분하지 못한다.
//
// 여기서는 콘솔 안에 남고, 자주 틀리는 경로 몇 개를 바로 제시한다 —
// 404 는 "없다" 를 말하는 화면이 아니라 **다음 한 걸음**을 주는 화면이어야 한다.

import { Compass } from 'lucide-react'
import Link from 'next/link'

const SUGGESTIONS = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/curation', label: 'LCP — 도서 큐레이션' },
  { href: '/admin/articles', label: 'ACP — 짧은 글' },
  { href: '/admin/vocab', label: 'VCB — 어휘 파이프라인' },
  { href: '/admin/vrl', label: 'VRL — 어휘 레벨' },
  { href: '/admin/csat', label: '교재 공장' },
]

export default function AdminNotFound() {
  return (
    <div className="p-6 sm:p-8">
      <div className="mx-auto max-w-2xl rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)]">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[#8B5CF6]/12 text-[#8B5CF6]"
            aria-hidden
          >
            <Compass size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[#8B5CF6]">
              Admin Console · 404
            </p>
            <h1 className="font-display text-[20px] font-[800] tracking-tight text-[var(--t1)]">
              그 주소에는 화면이 없습니다
            </h1>
            <p className="mt-1 font-body text-[13px] leading-relaxed text-[var(--t2)]">
              주소가 한 글자 다르거나, 그 화면이 다른 파이프라인으로 옮겨졌을 수 있습니다.
            </p>
          </div>
        </div>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-display text-[13px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg)] hover:text-[var(--t1)] hover:shadow-[var(--sh-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
