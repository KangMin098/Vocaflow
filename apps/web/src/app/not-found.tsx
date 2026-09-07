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
        <p className="mt-3 break-keep font-body text-[14px] leading-relaxed text-[var(--t2)]">
          주소가 잘렸거나 바뀐 것 같아요. 아래에서 다시 시작할 수 있어요.
        </p>

        {/* ⚠️ 1차 출구는 반드시 **공개** 라우트다.
            예전엔 유일한 버튼이 `/hub`(PROTECTED_PREFIXES 첫 줄)라, 깨진 공유 링크로 온
            익명 방문자가 404 에서 곧장 로그인 폼으로 튕겼다 — 가입 의사가 없던 사람에게
            아무 설명 없이 로그인 벽을 세우는 길이었다. `/` 는 인증 여부와 무관하게 열리고,
            로그인 상태면 미들웨어가 `/hub` 로 보내 준다(한 줄로 두 경우를 다 만족). */}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] bg-[var(--p)] px-6 font-display text-[14px] font-[600] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:brightness-95 sm:w-auto"
          >
            처음 화면으로
          </Link>
          <Link
            href="/fit"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] px-6 font-display text-[14px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:brightness-95 sm:w-auto"
          >
            지문 진단 해보기
          </Link>
        </div>
      </div>
    </div>
  )
}
