// apps/web/src/app/not-found.tsx

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg2)] p-6">
      <div className="w-full max-w-md rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-8 text-center shadow-[var(--sh-md)]">
        <p className="font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
          404
        </p>
        <h1 className="mt-2 font-display text-[28px] font-[800] tracking-tight text-[var(--t1)]">
          페이지를 찾을 수 없어요
        </h1>
        <p className="mt-3 font-body text-[14px] leading-relaxed text-[var(--t2)]">
          주소를 확인해 주시거나 홈으로 돌아가 다시 시도해 주세요.
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href="/hub"
            className="rounded-[var(--r-md)] bg-[var(--p)] px-6 py-3 font-display text-[14px] font-[600] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p-hover)]"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
