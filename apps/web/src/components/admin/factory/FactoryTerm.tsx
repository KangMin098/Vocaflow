// apps/web/src/components/admin/factory/FactoryTerm.tsx
//
// **점선 밑줄 용어 — 올리거나 누르면 한두 문장 설명이 뜬다.**
//
// 설명은 `factory-glossary.ts` 한 곳에서만 읽는다(화면에서 새로 적지 않는다).
// 마우스를 올려도(hover) · 키보드로 초점을 줘도(focus) · 휴대폰에서 눌러도(tap) 열린다 —
// hover 만으로 열면 키보드와 터치 사용자는 설명을 영영 못 본다. Esc 로 닫힌다.

'use client'

import Link from 'next/link'
import { useId, useRef, useState, type ReactNode } from 'react'

import { GLOSSARY, type TermId } from '@/lib/csat/factory-glossary'

export function FactoryTerm({ id, children }: { id: TermId; children?: ReactNode }) {
  const term = GLOSSARY[id]
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const tipId = useId()
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }
  // 풍선으로 마우스를 옮기는 사이에 닫히지 않게 조금 기다린다.
  const hide = () => {
    if (pinned) return
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <span className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onFocus={show}
        onBlur={() => {
          setPinned(false)
          hide()
        }}
        onClick={() => {
          setPinned((p) => !p)
          setOpen((o) => !pinned || !o)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setPinned(false)
            setOpen(false)
          }
        }}
        // 문장 속 낱말이라 글자 높이를 44px 로 키우면 줄이 벌어진다 — 누르는 넓이만 가상 요소로 44px 을 준다.
        className="relative cursor-help rounded-[2px] border-b border-dotted border-current bg-transparent p-0 font-[inherit] text-inherit underline-offset-2 after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]"
      >
        {children ?? term.word}
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1.5 flex w-[min(300px,80vw)] flex-col gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 text-left shadow-[var(--sh-md)]"
        >
          <span className="font-display text-[12.5px] font-[700] text-[var(--t1)]">{term.word}</span>
          <span className="break-keep font-body text-[12.5px] font-[400] leading-relaxed text-[var(--t1)]">
            {term.plain}
          </span>
          {'example' in term && term.example ? (
            <span className="break-keep font-body text-[12px] font-[400] leading-relaxed text-[var(--t2)]">
              예) {term.example}
            </span>
          ) : null}
          <Link
            href={`/admin/csat/help#${id}`}
            className="inline-flex min-h-[44px] w-fit items-center font-display text-[11.5px] font-[700] text-[var(--admin)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--admin)]"
          >
            용어집에서 보기 →
          </Link>
        </span>
      ) : null}
    </span>
  )
}
