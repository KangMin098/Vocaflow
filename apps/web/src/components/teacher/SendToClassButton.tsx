// apps/web/src/components/teacher/SendToClassButton.tsx
//
// 추출한 단어를 **우리 반에 보내기** — 교사 채널 루프의 시작점.
//
// 어디에 붙는가: `/text/new` 의 단어 추출 결과. 교사의 실제 작업 순서가
//   "지문 붙여넣기 → 어려운 단어 → 반에 보내기" 라 그 자리가 맞다.
//   새 화면을 만들지 않는다(진단 F5 — 학습자 표면 22개를 더 늘리지 않는다).
//
// 학급이 없으면 **버튼 자체를 그리지 않는다.** 눌러 봐야 "학급이 없어요" 가 뜨는 버튼은
//   기능이 아니라 광고다. 대신 학급을 만들러 갈 링크 한 줄만 둔다.

'use client'

import { Check, Loader2, Send } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import type { AssignmentWord } from '@/lib/teacher/assignment-actions'
import { createAssignment } from '@/lib/teacher/assignment-actions'
import type { TeacherClass } from '@/lib/teacher/class-actions'

interface Props {
  /** 내가 가르치는 학급들. 비어 있으면 안내만 보여준다. */
  classes: TeacherClass[]
  /** 보낼 낱말 — 지문이 아니라 낱말만 넘긴다(저작권 · DB CHECK 와 같은 선). */
  words: AssignmentWord[]
  /** 과제 이름 기본값 (예: 글 제목). 교사가 고칠 수 있다. */
  defaultTitle?: string
}

export function SendToClassButton({ classes, words, defaultTitle = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [title, setTitle] = useState(defaultTitle)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (words.length === 0) return null

  if (classes.length === 0) {
    return (
      <p className="m-0 font-body text-[12.5px] leading-[1.6] text-[var(--t3)]">
        학급을 만들면 이 단어를 학생들에게 바로 보낼 수 있어요.{' '}
        <Link
          href="/teacher"
          className="border-b border-[var(--p)] text-[var(--p)] transition-opacity duration-[var(--dur-normal)] hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
        >
          클래스 만들기
        </Link>
      </p>
    )
  }

  async function handleSend() {
    setBusy(true)
    setError(null)
    try {
      const res = await createAssignment(classId, title.trim() || '단어 과제', words)
      if (!res.ok) {
        setError(res.error ?? '보내지 못했어요.')
        return
      }
      setSent(true)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <p className="m-0 flex items-center gap-2 font-body text-[13px] text-[var(--t2)]">
        <Check size={15} aria-hidden style={{ color: 'var(--memory-stable)' }} />
        학급에 보냈어요 — 학생 화면 <b>클래스</b>에서 받아 볼 수 있어요.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 font-display text-[13px] font-[600] text-[var(--bg)] transition-all duration-[var(--dur-normal)] hover:brightness-110 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
        >
          <Send size={14} aria-hidden />
          우리 반에 보내기 ({words.length}개)
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
          <label className="flex flex-col gap-2">
            <span className="font-display text-[12px] font-[700] text-[var(--t1)]">학급</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-body text-[13.5px] text-[var(--t1)] focus:border-[var(--p)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.member_count}명)
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-display text-[12px] font-[700] text-[var(--t1)]">
              과제 이름
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="예: 3과 본문 · 9월 모의 21번"
              className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-body text-[13.5px] text-[var(--t1)] placeholder:text-[var(--t3)] focus:border-[var(--p)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            />
          </label>

          <p className="m-0 font-body text-[12px] leading-[1.6] text-[var(--t3)]">
            지문은 보내지 않고 <b>낱말과 뜻만</b> 전달돼요.
          </p>

          {error && (
            <p
              role="alert"
              className="m-0 font-body text-[12.5px] text-[var(--memory-risk-ink)]"
            >
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={busy || !classId}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p)] px-4 font-display text-[13px] font-[600] text-[var(--bg)] transition-all duration-[var(--dur-normal)] hover:brightness-110 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {busy ? (
                <Loader2 size={14} aria-hidden className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Send size={14} aria-hidden />
              )}
              보내기
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
