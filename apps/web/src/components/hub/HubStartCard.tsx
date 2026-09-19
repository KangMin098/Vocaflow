// apps/web/src/components/hub/HubStartCard.tsx
// 모듈 시작 설정 + Primary CTA
// 자율성(Autonomy) 지원 — 단어장·모드·길이를 학습자가 직접 선택
//
// 2026-09-19 (DD-34 · docs/design/compare/module-hubs.md): 상자(bg2 · 그림자) · 아이콘 칩 · 그림자 세그먼트 ·
//   떠오르는 CTA(hover scale) · 모듈마다 다른 CTA 색(핑크 · 파랑)을 걷었다. 1차 행동은 주묵 하나 —
//   다른 골든과 같은 규칙이다(`cta.accent` · `accentText` 는 호출부 호환을 위해 받기만 한다).
//   선택지는 글자 탭(밑줄) — `/text/new` 의 한 편/책 탭과 같은 모양. 한국어 이탤릭(비활성 사유) 제거.

'use client'

import { Play } from 'lucide-react'
import type { ReactNode } from 'react'

export interface ChoiceField<T extends string> {
  label: string
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (v: T) => void
}

export interface HubStartCardProps {
  /** 카드 제목 (예: "오늘 학습 시작하기") */
  title: string
  /** 설명 */
  description?: string
  /** 단어장 선택 (선택 사항) */
  vocabulary?: ChoiceField<string>
  /** 라디오/세그먼트 형태 선택지들 */
  choices: Array<ChoiceField<string>>
  /** 슬롯 (커스텀 영역, 예: 영어 토글) */
  extras?: ReactNode
  /** Primary CTA */
  cta: {
    label: string
    href: string
    /** 받기만 한다 — 1차 행동은 주묵 하나(2026-09-19) */
    accent?: string
    /** 받기만 한다 */
    accentText?: string
    /** 비활성 시 사유 메시지 */
    disabled?: boolean
    disabledReason?: string
  }
}

export function HubStartCard({ title, description, vocabulary, choices, extras, cta }: HubStartCardProps) {
  return (
    <section aria-label={title} className="flex flex-col">
      <header className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">{title}</h2>
        {description && <p className="font-body text-[12px] text-[var(--t2)]">{description}</p>}
      </header>

      {/* 단어장 선택 (별도 — 가로 폭 풀) */}
      {vocabulary && (
        <div className="mb-4">
          <label
            htmlFor={`vocab-${vocabulary.label}`}
            className="mb-1.5 block font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]"
          >
            {vocabulary.label}
          </label>
          <select
            id={`vocab-${vocabulary.label}`}
            value={vocabulary.value}
            onChange={(e) => vocabulary.onChange(e.target.value)}
            className="min-h-[44px] w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-body text-[13px] text-[var(--t1)] focus:border-[var(--bdf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
          >
            {vocabulary.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.hint ? ` (${o.hint})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 선택지 — 글자 탭 */}
      <div className="space-y-3">
        {choices.map((c) => (
          <fieldset key={c.label} className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 border-0 p-0">
            <legend className="contents font-display text-[12px] font-[600] text-[var(--t2)]">{c.label}</legend>
            <div role="radiogroup" aria-label={c.label} className="flex flex-wrap items-center gap-x-4 border-b border-[var(--bd)]">
              {c.options.map((opt) => {
                const active = c.value === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => c.onChange(opt.value)}
                    className={`-mb-px inline-flex min-h-[44px] items-center border-b-2 px-1 font-display text-[13px] font-[600] transition-colors duration-[var(--dur-normal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] ${
                      active ? 'border-[var(--ju)] text-[var(--t1)]' : 'border-transparent text-[var(--t2)] hover:text-[var(--t1)]'
                    }`}
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}

        {extras}
      </div>

      {/* CTA — 화면의 1차 행동 하나 */}
      <div className="mt-5 flex flex-col items-start gap-2 sm:flex-row-reverse sm:items-center sm:justify-end sm:gap-4">
        {cta.disabled ? (
          <button
            type="button"
            disabled
            aria-disabled
            className="inline-flex min-h-[48px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-6 font-display text-[14px] font-[700] text-[var(--t2)] sm:w-auto"
          >
            <Play size={14} strokeWidth={2.5} aria-hidden />
            {cta.label}
          </button>
        ) : (
          <a
            href={cta.href}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-6 font-display text-[14px] font-[700] text-[var(--on-ju)] no-underline transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px sm:w-auto"
          >
            <Play size={14} strokeWidth={2.5} aria-hidden />
            {cta.label}
          </a>
        )}
        {cta.disabled && cta.disabledReason && (
          <p className="font-body text-[12px] text-[var(--t2)]">{cta.disabledReason}</p>
        )}
      </div>
    </section>
  )
}
