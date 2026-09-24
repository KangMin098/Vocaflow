// apps/web/src/app/admin/video/VideoActions.tsx
//
// 발행된 편 하나에 대한 조치 — **교체 요청 · 내리기 · 되살리기.**
// 구성요소 탭의 행과 요청 상세(발행된 요청 편)가 같은 컴포넌트를 쓴다 — 둘이 다르게 말하면
// 한쪽에선 되살릴 수 있다는데 다른 쪽에선 못 한다는 일이 생긴다.
//
// 내리기는 **DB 에 적는 것까지**다. 학습자 화면에서 사라지는 것은 `retire:sync --commit` 으로
// manifest 를 고쳐 커밋·배포한 뒤 — 그래서 내린 뒤 그 명령을 바로 보여 준다.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { Retirement } from '@/lib/admin/video-requests'
import { restoreVideoAction, retireVideoAction } from './actions'

const btn =
  'inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] px-2 font-body text-[12px] transition-colors duration-[var(--dur-normal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] disabled:opacity-40'

export function VideoActions({
  videoId,
  published,
  retired,
  compact = false,
}: {
  videoId: string
  /** manifest 에 있는가 — 없으면 교체할 자리가 없다(새 요청으로 만든다) */
  published: boolean
  retired: Retirement | null
  /** 표 안에서는 한 줄로 */
  compact?: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  if (retired) {
    return (
      <div className={compact ? 'flex flex-wrap items-center gap-1' : 'space-y-1'}>
        <span className="font-body text-[12px] font-[700] text-[var(--warning)]" title={retired.reason}>
          ⊘ 내림{retired.purged ? ' · 파일 삭제됨' : ''}
        </span>
        {!compact && <p className="break-keep font-body text-[12px] text-[var(--t2)]">이유 · {retired.reason}</p>}
        <button
          type="button"
          disabled={pending || retired.purged}
          title={retired.purged ? '파일을 지웠습니다 — 되살리려면 다시 찍어야 합니다' : undefined}
          onClick={() =>
            start(async () => {
              setError(null)
              const r = await restoreVideoAction(videoId)
              if (!r.ok) setError(r.error ?? '되살리지 못했습니다')
              else {
                setDone('되살림 — package 를 다시 돌리면 manifest 에 돌아갑니다')
                router.refresh()
              }
            })
          }
          className={`${btn} text-[var(--t2)] underline hover:text-[var(--t1)]`}
        >
          되살리기
        </button>
        {error && <p role="alert" className="font-body text-[12px] text-[var(--error-ink)]">✗ {error}</p>}
        {done && <p className="font-body text-[12px] text-[var(--t2)]">{done}</p>}
      </div>
    )
  }

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-1' : 'space-y-2'}>
      <div className="flex flex-wrap items-center gap-1">
        {published && (
          <Link href={`/admin/video?replace=${encodeURIComponent(videoId)}`} className={`${btn} text-[var(--t1)] underline`}>
            교체 요청
          </Link>
        )}
        {published && !open && (
          <button type="button" onClick={() => setOpen(true)} className={`${btn} text-[var(--t2)] underline hover:text-[var(--t1)]`}>
            내리기
          </button>
        )}
      </div>
      {open && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              setError(null)
              const r = await retireVideoAction(videoId, reason)
              if (!r.ok) setError(r.error ?? '내리지 못했습니다')
              else {
                setOpen(false)
                setReason('')
                setDone('내림 기록 — 화면에서 빼려면: pnpm video retire:sync --commit → manifest 커밋·배포')
                router.refresh()
              }
            })
          }}
        >
          <label className="sr-only" htmlFor={`retire-${videoId}`}>내리는 이유</label>
          <input
            id={`retire-${videoId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="이유 — 예: 수치가 낡음"
            aria-describedby={`retire-${videoId}-hint`}
            className="min-h-[44px] min-w-[12rem] flex-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
          />
          <button
            type="submit"
            disabled={pending || !reason.trim()}
            className={`${btn} border border-[var(--bde)] text-[var(--error-ink)]`}
          >
            내리기 확정
          </button>
          <button type="button" onClick={() => setOpen(false)} className={`${btn} text-[var(--t3)]`}>
            취소
          </button>
          <p id={`retire-${videoId}-hint`} className="w-full break-keep font-body text-[11px] text-[var(--t3)]">
            파일은 버킷에 남습니다(되살리기 가능). 영구 삭제는 터미널의 --purge 로만 합니다.
          </p>
        </form>
      )}
      {error && <p role="alert" className="font-body text-[12px] text-[var(--error-ink)]">✗ {error}</p>}
      {done && <p className="break-keep font-body text-[12px] text-[var(--t2)]">{done}</p>}
    </div>
  )
}
