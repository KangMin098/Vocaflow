// apps/web/src/components/game/GameIdentityNotice.tsx
'use client'

/**
 * 게임 판의 계정 경계 안내 — useGameSessionRecorder 의 status 가 'same' 이 아닐 때 게임 대신 그린다.
 * - checking: 판의 주인(단어를 읽은 사람)과 브라우저 신원이 아직 확인되지 않음 — 개인 단어 · 정답 · 입력을 그리지 않는다.
 * - changed: 다른 계정 로그인 · 로그아웃 — 게임을 내렸다(그 뒤의 입력 · 종료 점수는 기록하지 않는다 · 되살리지 않는다 · 이미 저장된 기록은 그대로).
 * 다시 열기는 전체 이동(<a>) — 서버 · 브라우저가 지금 계정으로 단어를 다시 읽는다. uid 는 DOM · URL 에 싣지 않는다.
 */
import { usePathname, useSearchParams } from 'next/navigation'

import type { StoryAuthStatus } from '@/components/library/story/use-story-auth-guard'
import { loginUrlWithReturn } from '@/lib/auth/redirect'

export function GameIdentityNotice({ status, reopenHref: given }: { status: Exclude<StoryAuthStatus, 'same'>; reopenHref?: string }) {
  const changed = status === 'changed'
  // 다시 열기 = 지금 이 판 주소. 서버 · 클라이언트가 같은 값을 그리도록 라우터 훅으로 만든다(window 를 읽으면 수화 불일치).
  const pathname = usePathname()
  const qs = useSearchParams()?.toString()
  const reopenHref = given ?? (qs ? `${pathname}?${qs}` : pathname)
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center" data-game-private={status} role="status" aria-live="polite">
      <h1 className="break-keep font-editorial text-[16px] font-[700] text-[var(--t1)]">
        {changed ? '로그인 상태가 바뀌었어요' : '로그인한 계정을 확인하고 있어요'}
      </h1>
      <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
        {changed ? '이 판을 멈췄어요. 계정이 바뀐 뒤의 입력과 종료 점수는 새 계정에 반영하지 않아요. 이전에 저장된 기록은 유지돼요. 지금 로그인한 계정으로 다시 열어 주세요.' : '확인이 끝나면 게임을 시작해요.'}
      </p>
      {changed && (
        <>
          <a
            href={reopenHref}
            data-game-reopen
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-5 py-3 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2"
          >
            다시 열기
          </a>
          <a
            href={loginUrlWithReturn(reopenHref)}
            data-game-login
            className="inline-flex min-h-[44px] items-center px-4 font-display text-[13px] font-[700] text-[var(--t2)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2"
          >
            로그인 화면으로
          </a>
        </>
      )}
    </div>
  )
}
