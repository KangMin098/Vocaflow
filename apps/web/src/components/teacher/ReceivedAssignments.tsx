// apps/web/src/components/teacher/ReceivedAssignments.tsx
//
// 받은 단어 과제 (학생) — 학급이 실제로 **배달하는** 첫 번째 것.
//
// 왜 `/teacher` 에 두는가: 학급은 교사·학생이 공유하는 하나의 표면이다. 학생용 라우트를
//   새로 만들면 학습자 표면이 22 → 23 이 된다(진단 F5 는 4개 이하를 목표로 한다).
//   같은 화면에서 역할에 따라 다른 것을 보여주는 편이 옳다.
//
// 규약: Memory Decay 4색 · 44px 타깃 · 4상태 · motion-reduce · 색 + 글자 병행.

'use client'

import { BookOpen, Check, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'

import type { ClassAssignment } from '@/lib/teacher/assignment-actions'
import { markAssignmentCollected } from '@/lib/teacher/assignment-actions'

interface Props {
  assignments: ClassAssignment[]
  /** 조회 실패 — 빈 목록이 "받은 게 없다" 로 읽히지 않게 한다. */
  failed?: boolean
  /** 이미 담은 과제 id — 서버가 알려준다. */
  collectedIds?: string[]
}

export function ReceivedAssignments({ assignments, failed = false, collectedIds = [] }: Props) {
  const [collected, setCollected] = useState<Set<string>>(new Set(collectedIds))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /**
   * 뜻이 비어 **게임에 안 나오는** 낱말 수.
   *
   * 담기는 성공했는데 그 낱말들만 조용히 안 풀리면, 학습자는 이유를 알 수 없다
   * (`fetchDueGameWords` 가 `.neq('meaning','')` 로 거른다). 드문 경우지만 말해 준다.
   */
  const [unplayable, setUnplayable] = useState(0)

  async function handleCollect(a: ClassAssignment) {
    setBusy(a.id)
    setError(null)
    try {
      const res = await markAssignmentCollected(a.id)
      if (!res.ok) {
        setError(res.error ?? '기록하지 못했어요.')
        return
      }
      setCollected((prev) => new Set(prev).add(a.id))
      setUnplayable(res.unplayable ?? 0)
    } finally {
      setBusy(null)
    }
  }

  if (failed) {
    return (
      <p
        role="status"
        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-body text-[13.5px] text-[var(--t2)]"
      >
        받은 과제를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.
      </p>
    )
  }

  if (assignments.length === 0) return null

  return (
    <section aria-label="받은 단어 과제" className="flex flex-col gap-3">
      <h2 className="m-0 font-display text-[15px] font-[700] text-[var(--t1)]">받은 단어</h2>

      {error && (
        <p
          role="alert"
          className="m-0 rounded-[var(--r-md)] border border-[var(--memory-risk)] bg-[var(--bg2)] px-4 py-3 font-body text-[13px] text-[var(--memory-risk-ink)]"
        >
          {error}
        </p>
      )}

      {/*
        담기는 됐는데 그중 몇 개가 **게임에 안 나오는** 경우 — 뜻이 비어 있으면 문제를
        만들 수 없어 `fetchDueGameWords` 가 거른다. 말해 주지 않으면 학습자는
        "왜 이 단어만 안 나오지" 를 영영 알 수 없다. 드문 경우라 조용한 한 줄로 둔다.
      */}
      {unplayable > 0 && (
        <p
          role="status"
          className="m-0 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-body text-[12.5px] leading-[1.6] text-[var(--t2)]"
        >
          <b className="tabular-nums text-[var(--t1)]">{unplayable}개</b>는 뜻이 비어 있어 단어장에는
          담겼지만 게임에는 나오지 않아요. 단어장에서 뜻을 채우면 바로 나옵니다.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {assignments.map((a) => {
          const done = collected.has(a.id)
          return (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <p className="m-0 flex items-center gap-2 font-display text-[14px] font-[700] text-[var(--t1)]">
                    <BookOpen size={14} aria-hidden className="text-[var(--t3)]" />
                    {a.title}
                  </p>
                  <p className="m-0 font-body text-[12px] text-[var(--t3)]">
                    {a.className} · 단어 {a.words.length}개
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCollect(a)}
                  disabled={done || busy === a.id}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 font-display text-[13px] font-[600] text-[var(--bg)] transition-all duration-[var(--dur-normal)] hover:brightness-110 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-default disabled:border-[var(--bd)] disabled:bg-[var(--bg3)] disabled:text-[var(--t2)] motion-reduce:transition-none"
                >
                  {busy === a.id ? (
                    <Loader2 size={14} aria-hidden className="animate-spin motion-reduce:animate-none" />
                  ) : done ? (
                    <Check size={14} aria-hidden style={{ color: 'var(--memory-stable)' }} />
                  ) : (
                    <Sparkles size={14} aria-hidden />
                  )}
                  {done ? '담았어요' : '단어장에 담기'}
                </button>
              </div>

              {/* 단어는 접지 않고 바로 보여준다 — 담기 전에 무엇인지 알아야 담는다. */}
              <ul className="flex flex-wrap gap-2">
                {a.words.slice(0, 24).map((w) => (
                  <li
                    key={w.w}
                    className="inline-flex items-baseline gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg2)] py-1 pl-3 pr-2 font-body text-[12.5px] text-[var(--t1)]"
                  >
                    {w.w}
                    {w.m && <span className="text-[11.5px] text-[var(--t3)]">{w.m}</span>}
                  </li>
                ))}
                {a.words.length > 24 && (
                  <li className="inline-flex items-center font-body text-[12px] text-[var(--t3)]">
                    외 {a.words.length - 24}개
                  </li>
                )}
              </ul>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
