// apps/web/src/app/(main)/text/[id]/reader-viewer-gate.tsx
'use client'

/**
 * 읽기 화면의 계정 경계 — 레이아웃이 서버 쿠키 세션으로 **실제로 읽은** 글의 주인(`ownerId` = v_text_content.user_id ·
 * security_invoker 뷰 + texts 본인 행 RLS 라 읽힌 행은 지금 사용자의 사본)과 브라우저 신원이 긍정 확인(same)으로 같을 때만
 * 본문 · 제목 · 단어 · 모든 모드(읽기 · 단어 · 듣기 · 철자 · echo · comic)를 그린다.
 * - checking(확인 전 · BFCache 복원 뒤 재확인 중) · changed(다른 계정 · 로그아웃): 그리지 않는다. 바뀌면 되살리지 않는다.
 * - 읽기 음성(tts-controller)은 모듈 싱글턴이라 화면이 내려가도 계속 읽는다 — same 이 아니게 되면 그 자리에서 멈춘다.
 * 다시 열기는 전체 이동 — 서버가 지금 쿠키로 글을 다시 읽는다(남의 글이면 레이아웃이 404). uid 는 DOM · URL 에 싣지 않는다.
 * 권한 증명이 아니다 — 쓰기 권한은 서버 getUser · RLS 그대로.
 */
import { useEffect, useRef, type ReactNode } from 'react'

import { useStoryAuthGuard, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { useTTS } from '@/lib/workspace/tts-controller'

export function ReaderViewerGate({
  ownerId,
  textId,
  authSource,
  children,
}: {
  ownerId: string
  textId: string
  /** 시험 · 하네스 주입(없으면 StoryAuthSourceContext → 실제 브라우저 세션) */
  authSource?: StoryAuthSource
  children: ReactNode
}) {
  const { status } = useStoryAuthGuard(ownerId, authSource)
  const tts = useTTS()
  const stopRef = useRef(tts.stop)
  stopRef.current = tts.stop
  const shownRef = useRef(false)
  useEffect(() => {
    if (status === 'same') shownRef.current = true
    // 보였던 화면이 내려가면(바뀜 · 재확인 중) 이 글을 읽던 음성을 멈춘다
    else if (shownRef.current) stopRef.current()
  }, [status])

  if (status === 'same') return <>{children}</>
  const changed = status === 'changed'
  const reopenHref = `/text/${textId}`
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center" data-reader-private={status} role="status" aria-live="polite">
      <h1 className="break-keep font-editorial text-[16px] font-[700] text-[var(--t1)]">
        {changed ? '로그인 상태가 바뀌었어요' : '로그인한 계정을 확인하고 있어요'}
      </h1>
      <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
        {changed ? '이 글 화면과 읽어 주기를 멈췄어요. 지금 로그인한 계정으로 다시 열어 주세요.' : '확인이 끝나면 글을 보여 드려요.'}
      </p>
      {changed && (
        <>
          <a
            href={reopenHref}
            data-reader-reopen
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-5 py-3 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2"
          >
            다시 열기
          </a>
          <a
            href={loginUrlWithReturn(reopenHref)}
            data-reader-login
            className="inline-flex min-h-[44px] items-center px-4 font-display text-[13px] font-[700] text-[var(--t2)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2"
          >
            로그인 화면으로
          </a>
        </>
      )}
    </div>
  )
}
