// apps/web/src/components/hub/HubStartCard.tsx
// 모듈 시작 설정 + Primary CTA
// 자율성(Autonomy) 지원 — 단어장·모드·길이를 학습자가 직접 선택

'use client'

import { Play, Settings as SettingsIcon } from 'lucide-react'
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
    accent?: string
    /** 비활성 시 사유 메시지 */
    disabled?: boolean
    disabledReason?: string
  }
}

export function HubStartCard({
  title,
  description,
  vocabulary,
  choices,
  extras,
  cta,
}: HubStartCardProps) {
  const accent = cta.accent ?? 'var(--p)'
  return (
    <section
      aria-label={title}
      // Tertiary tone (배경 톤 변경) + spacing 통일 (p-5 → p-5 일관)
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-5 shadow-[var(--sh-xs)] md:p-6"
    >
      <header className="mb-5 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)]"
          style={{ backgroundColor: `${accent}15`, color: accent }}
          aria-hidden
        >
          <SettingsIcon size={13} strokeWidth={2} />
        </span>
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">{title}</h2>
        {description && (
          <>
            <span className="font-body text-[12px] text-[var(--t2)]">·</span>
            <p className="font-body text-[12px] text-[var(--t2)]">{description}</p>
          </>
        )}
      </header>

      {/* 단어장 선택 (별도 — 가로 폭 풀) */}
      {vocabulary && (
        <div className="mb-4">
          <label
            htmlFor={`vocab-${vocabulary.label}`}
            className="mb-1.5 block font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]"
          >
            {vocabulary.label}
          </label>
          <select
            id={`vocab-${vocabulary.label}`}
            value={vocabulary.value}
            onChange={(e) => vocabulary.onChange(e.target.value)}
            className="w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[13px] text-[var(--t1)] focus:border-[var(--bdf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
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

      {/* 세그먼트 선택지들 */}
      <div className="space-y-4">
        {choices.map((c) => (
          <fieldset key={c.label} className="flex flex-wrap items-center gap-3">
            <legend className="contents font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
              {c.label}
            </legend>
            <div className="flex flex-wrap items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-1">
              {c.options.map((opt) => {
                const active = c.value === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => c.onChange(opt.value)}
                    className={`rounded-[var(--r-sm)] px-3 py-1.5 font-display text-[12px] font-[600] transition-all duration-[var(--dur-normal)] ${
                      active
                        ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-xs)]'
                        : 'text-[var(--t2)] hover:text-[var(--t1)]'
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

      {/* CTA */}
      <div className="mt-6 flex flex-col items-start gap-2 border-t border-[var(--bd)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        {cta.disabled && cta.disabledReason ? (
          <p className="font-body text-[12px] italic text-[var(--t2)]">{cta.disabledReason}</p>
        ) : (
          <p className="font-body text-[12px] text-[var(--t2)]">
            준비됐어요. 시작 버튼을 눌러주세요.
          </p>
        )}

        {cta.disabled ? (
          <button
            type="button"
            disabled
            aria-disabled
            className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--bg3)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--t2)] sm:w-auto"
          >
            <Play size={14} strokeWidth={2.5} aria-hidden />
            {cta.label}
          </button>
        ) : (
          <a
            href={cta.href}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:scale-[1.02] hover:shadow-[var(--sh-md)] active:scale-[0.97] sm:w-auto"
            style={{ backgroundColor: accent }}
          >
            <Play size={14} strokeWidth={2.5} aria-hidden />
            {cta.label}
          </a>
        )}
      </div>
    </section>
  )
}
