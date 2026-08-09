// apps/web/src/components/practice/DcpItems.tsx
//
// DCP 문항 인터랙션 — order(문장 순서 배열)·insert(삽입 위치 선택).
// 접근성 우선: 드래그 대신 이동 버튼/슬롯 탭(키보드·터치 44px·색+아이콘). Calm UI 토큰.
// 제출 포맷은 grade_dcp_item 계약: order={order:[presented 인덱스]} · insert={position:슬롯}.

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import type { DcpInsertPayload, DcpOrderPayload } from '@/lib/learner/dcp'

// ────────────────────────────────────────────────────────────
// order — presented 문장을 원래 순서로 배열 (이동 버튼)
// ────────────────────────────────────────────────────────────
export function DcpOrderItem({
  payload,
  submitting,
  onSubmit,
}: {
  payload: DcpOrderPayload
  submitting: boolean
  onSubmit: (answer: { order: number[] }) => void
}) {
  const { presented } = payload
  const [order, setOrder] = useState<number[]>(() => presented.map((_, i) => i))

  function move(pos: number, dir: -1 | 1) {
    const target = pos + dir
    if (target < 0 || target >= order.length) return
    setOrder((prev) => {
      const next = [...prev]
      const a = next[pos]!
      next[pos] = next[target]!
      next[target] = a
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-[13px] text-[var(--t2)]">문장을 올바른 순서로 배열하세요.</p>
      <ol className="flex flex-col gap-2">
        {order.map((pIdx, pos) => (
          <li
            key={pIdx}
            className="flex items-center gap-2.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-2.5"
          >
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--p-light)] font-mono text-[12px] font-[700] text-[var(--on-p-tint)]"
              aria-hidden
            >
              {pos + 1}
            </span>
            <p className="min-w-0 flex-1 font-body text-[13px] leading-relaxed text-[var(--t1)]">
              {presented[pIdx]}
            </p>
            <span className="flex shrink-0 gap-1">
              <MoveButton dir="up" disabled={submitting || pos === 0} onClick={() => move(pos, -1)} />
              <MoveButton dir="down" disabled={submitting || pos === order.length - 1} onClick={() => move(pos, 1)} />
            </span>
          </li>
        ))}
      </ol>
      <SubmitButton disabled={submitting} onClick={() => onSubmit({ order })} />
    </div>
  )
}

function MoveButton({ dir, disabled, onClick }: { dir: 'up' | 'down'; disabled: boolean; onClick: () => void }) {
  const Icon = dir === 'up' ? ChevronUp : ChevronDown
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'up' ? '위로 이동' : '아래로 이동'}
      className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-35"
    >
      <Icon size={18} strokeWidth={2.25} aria-hidden />
    </button>
  )
}

// ────────────────────────────────────────────────────────────
// insert — remaining 사이 슬롯에 insert_sentence 삽입 위치 선택
// ────────────────────────────────────────────────────────────
export function DcpInsertItem({
  payload,
  submitting,
  onSubmit,
}: {
  payload: DcpInsertPayload
  submitting: boolean
  onSubmit: (answer: { position: number }) => void
}) {
  const { remaining, insert_sentence } = payload
  const [pos, setPos] = useState<number | null>(null)
  // 슬롯 0..remaining.length (각 문장 앞 + 마지막 뒤)
  const slots = Array.from({ length: remaining.length + 1 }, (_, i) => i)

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-[13px] text-[var(--t2)]">아래 문장이 들어갈 위치를 고르세요.</p>
      <div
        className="rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p-light)] p-3 font-body text-[13px] font-[600] leading-relaxed text-[var(--t1)]"
      >
        {insert_sentence}
      </div>

      <div className="flex flex-col gap-1">
        {slots.map((slot) => (
          <div key={slot} className="flex flex-col gap-1">
            <SlotButton
              selected={pos === slot}
              disabled={submitting}
              onClick={() => setPos(slot)}
              index={slot}
            />
            {slot < remaining.length && (
              <p className="rounded-[var(--r-sm)] bg-[var(--bg)] px-3 py-2 font-body text-[13px] leading-relaxed text-[var(--t1)]">
                {remaining[slot]}
              </p>
            )}
          </div>
        ))}
      </div>

      <SubmitButton disabled={submitting || pos === null} onClick={() => pos !== null && onSubmit({ position: pos })} />
    </div>
  )
}

function SlotButton({
  selected,
  disabled,
  onClick,
  index,
}: {
  selected: boolean
  disabled: boolean
  onClick: () => void
  index: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${index + 1}번째 위치에 삽입`}
      aria-pressed={selected}
      className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[var(--r-sm)] border border-dashed px-3 font-display text-[12px] font-[700] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:opacity-50"
      style={
        selected
          ? { borderColor: 'var(--p)', background: 'var(--p-light)', color: 'var(--p)', borderStyle: 'solid' }
          : { borderColor: 'var(--bd)', background: 'transparent', color: 'var(--t3)' }
      }
    >
      {selected ? '여기에 삽입 ✓' : '↳ 여기'}
    </button>
  )
}

// ── 공용 제출 버튼 ──
function SubmitButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
    >
      제출
    </button>
  )
}
