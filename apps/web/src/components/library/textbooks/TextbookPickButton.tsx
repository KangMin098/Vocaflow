// apps/web/src/components/library/textbooks/TextbookPickButton.tsx
//
// 교재 **담기 / 빼기** — 서가와 권 상세가 공유하는 하나의 버튼.
//
// ⚠️ 실패를 삼키지 않는다. 눌렀는데 아무 일도 안 일어나는 것이 이 저장소의 지배적 결함이라
//    서버 액션이 실패하면 그 문장을 **화면에 띄운다**(role="status" 로 스크린리더에도).
// ⚠️ 낙관적 갱신을 하지 않는다 — 담김 여부는 다음 학습 동선을 좌우하므로,
//    서버가 확인해 준 상태만 보여준다.

'use client'

import { BookmarkCheck, BookmarkPlus, Loader2, LogIn } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'

import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { addTextbook, removeTextbook } from '@/lib/textbook/my-shelf-actions'

export function TextbookPickButton({
  step,
  title,
  picked,
  signedIn = true,
  size = 'md',
}: {
  step: number
  /** 스크린리더 문장에 쓴다 — 서가에 버튼이 일곱 개라 "담기" 만으로는 어느 권인지 모른다. */
  title: string
  picked: boolean
  /** 비로그인이면 담기가 아니라 **로그인으로 가는 길**을 낸다. */
  signedIn?: boolean
  size?: 'sm' | 'md'
}) {
  const [isPicked, setIsPicked] = useState(picked)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const pathname = usePathname()

  function toggle() {
    setError(null)
    startTransition(async () => {
      const r = isPicked ? await removeTextbook(step) : await addTextbook(step)
      if (r.ok) setIsPicked(!isPicked)
      else setError(r.error ?? '지금은 처리할 수 없어요.')
    })
  }

  const pad = size === 'sm' ? 'px-3 text-[11.5px]' : 'px-4 text-[12.5px]'

  // ⚠️ 비로그인에게 **눌러도 안 되는 버튼**을 팔지 않는다. 자리를 비우지도 않는다 —
  //    비우면 "이 서가에서 할 수 있는 일이 없다" 로 읽힌다. 로그인으로 가는 길을 내되
  //    **돌아올 곳을 들려 보낸다**(안 그러면 로그인 후 /hub 로 떨어진다 —
  //    이 저장소가 `?next=` / `?returnTo=` 로 이미 한 번 겪은 실패다).
  if (!signedIn) {
    return (
      <Link
        href={loginUrlWithReturn(pathname)}
        aria-label={`${title} 담으려면 로그인`}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-ios-pill border border-[var(--bd)] bg-[var(--bg)] font-display font-[700] text-[var(--t1)] no-underline transition-colors hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 ${pad}`}
      >
        <LogIn size={14} aria-hidden />
        담으려면 로그인
      </Link>
    )
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={isPicked}
        aria-label={`${title} ${isPicked ? '내 교재에서 빼기' : '내 교재에 담기'}`}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-ios-pill border font-display font-[700] no-underline motion-safe:transition-all motion-safe:active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 ${pad} ${
          isPicked
            ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)] hover:bg-[var(--bg2)]'
            : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--p)] hover:text-[var(--p)]'
        }`}
      >
        {pending ? (
          <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" />
        ) : isPicked ? (
          <BookmarkCheck size={14} aria-hidden />
        ) : (
          <BookmarkPlus size={14} aria-hidden />
        )}
        {/* 상태를 아이콘만으로 가르지 않는다 — 색맹 대응 + 아이콘 의미는 학습된 지식이다 */}
        {isPicked ? '담음' : '담기'}
      </button>

      {error && (
        <span
          role="status"
          className="max-w-[30ch] font-body text-[11px] leading-[1.6] text-[var(--error)] [word-break:keep-all]"
        >
          {error}
        </span>
      )}
    </span>
  )
}
