// apps/web/src/components/admin/factory/ExampleToggle.tsx
//
// **「예시 보기」 — 누르면 전/후 비교가 펼쳐진다.**
// 설명을 더 쓰는 것보다 실제 모습 한 쌍이 빨리 읽힌다. 기본은 접혀 있다(한 줄 설명이 먼저다).

'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

import type { PlainExample } from '@/lib/csat/factory-plain'

export function ExampleToggle({ example }: { example: PlainExample }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-[var(--r-sm)] px-1 font-display text-[12.5px] font-[700] text-[var(--admin)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]"
      >
        <ChevronDown
          size={14}
          strokeWidth={2}
          aria-hidden
          className={`transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] ${open ? 'rotate-180' : ''} motion-reduce:transition-none`}
        />
        예시 보기 <span className="font-body font-[400] text-[var(--t2)]">— {example.caption}</span>
      </button>
      {open ? (
        <div id={panelId} className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <figure className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
            <figcaption className="font-display text-[11.5px] font-[700] text-[var(--t2)]">
              전 · {example.before.label}
            </figcaption>
            <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t1)]">
              {example.before.text}
            </p>
          </figure>
          <span aria-hidden className="self-center justify-self-center font-display text-[18px] text-[var(--t3)]">
            <span className="hidden sm:inline">→</span>
            <span className="sm:hidden">↓</span>
          </span>
          <figure className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--admin)_40%,transparent)] bg-[var(--bg)] p-3">
            <figcaption className="font-display text-[11.5px] font-[700] text-[var(--admin)]">
              후 · {example.after.label}
            </figcaption>
            <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t1)]">
              {example.after.text}
            </p>
          </figure>
        </div>
      ) : null}
    </div>
  )
}
