// apps/web/src/app/admin/db/InfoTip.tsx
//
// 풍선말 — 설명을 화면에서 **꺼내되 버리지는 않는** 장치.
//
// 모니터링 화면에서 설명 문장은 두 번 해롭다. 자리를 먹어 신호를 접힌 아래로 밀어내고,
// 급할 때 읽히지도 않는다. 그렇다고 지우면 "이 숫자가 왜 위험한가" 를 아무도 못 말한다.
// 그래서 라벨 옆 작은 표식에 접어 둔다 — 평소엔 1문자, 필요할 때 전문.
//
// 공용 `components/ui/Tooltip` 을 쓰지 않는 이유: 그쪽은 `whitespace-nowrap` 이라
// 두 줄 이상 설명이 화면 밖으로 흘러나간다. 여기 것은 폭을 잠그고 줄을 바꾼다.
//
// 접근성: hover 만으로는 키보드·터치에서 못 연다. 트리거가 실제 `button` 이고
// focus/blur 와 click 토글을 함께 받는다(터치는 hover 가 없다). Esc 로 닫힌다.

'use client'

import { HelpCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const wrap = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <span ref={wrap} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`${label} 설명`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="relative inline-flex h-[18px] w-[18px] items-center justify-center rounded-[var(--r-full)] after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] text-[var(--t2)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:bg-[var(--bg3)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
      >
        <HelpCircle size={13} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-[280px] -translate-x-1/2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 text-left font-body text-[12px] leading-[1.65] text-[var(--t1)] shadow-[var(--sh-md)]"
        >
          {children}
        </span>
      )}
    </span>
  )
}
