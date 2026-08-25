// apps/web/src/components/admin/curation/AdvancedFetchPanel.tsx
//
// BulkFetchTab 의 advanced 파라미터 panel — 소스별 동적 표시.
// SOURCE_OPTS[source].advanced 배열에 포함된 필드만 노출.
//
// v06.34 — 사용자 명시 요청: "Gutendex 가 제공하는 advanced 조건 전체"
// Gutendex 6종 + Standard Ebooks 2종 + Wikibooks 2종 + LibriVox 4종.

'use client'

import { ChevronDown, ChevronUp, Sliders } from 'lucide-react'
import { useState } from 'react'
import type { AdvancedFieldKey } from '@/lib/library/seed-fetchers/types'

export interface AdvancedState {
  search: string
  languages: string[]
  authorYearStart: string
  authorYearEnd: string
  copyright: '' | 'public_domain' | 'in_copyright'
  ids: string // comma-separated
  mimeType: string
  subjectSlug: string
  featuredOnly: boolean
  genreId: string
  publishedSince: string
  author: string
  // v06.43 — Lit2Go
  lit2goGradeBand: '' | 'all' | 'k-2' | '3-5' | '6-8' | '9-12'
  lit2goAudioOnly: boolean
}

export const DEFAULT_ADVANCED: AdvancedState = {
  search: '',
  languages: [],
  authorYearStart: '',
  authorYearEnd: '',
  copyright: '',
  ids: '',
  mimeType: '',
  subjectSlug: '',
  featuredOnly: false,
  genreId: '',
  publishedSince: '',
  author: '',
  lit2goGradeBand: '',
  lit2goAudioOnly: false,
}

interface Props {
  enabled: AdvancedFieldKey[]
  popularLanguages?: Array<{ value: string; label: string }>
  state: AdvancedState
  onChange: (next: AdvancedState) => void
  disabled?: boolean
}

export function AdvancedFetchPanel({
  enabled,
  popularLanguages = [],
  state,
  onChange,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)

  if (enabled.length === 0) return null

  const hasActive = countActive(state, enabled) > 0
  const set = <K extends keyof AdvancedState>(k: K, v: AdvancedState[K]) =>
    onChange({ ...state, [k]: v })

  return (
    <section
      className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]"
      aria-label="advanced 필터"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 font-display text-[12px] font-[600] text-[var(--t1)] hover:bg-[var(--bg2)]"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Sliders size={12} className="text-[var(--t2)]" />
          소스별 고급 조건
          {hasActive && (
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--p)] px-1 font-mono text-[9px] font-[700] text-[var(--on-p)]">
              {countActive(state, enabled)}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="border-t border-[var(--bd)] p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {enabled.includes('search') && (
              <Field label="키워드 검색" hint="제목·저자 일치">
                <input
                  type="text"
                  value={state.search}
                  onChange={(e) => set('search', e.target.value)}
                  placeholder="alice wonderland"
                  className={inputCls}
                  disabled={disabled}
                />
              </Field>
            )}

            {enabled.includes('languages') && popularLanguages.length > 0 && (
              <Field label="언어 (multi)" hint="여러 언어 동시 검색">
                <MultiLangSelect
                  options={popularLanguages}
                  value={state.languages}
                  onChange={(v) => set('languages', v)}
                  disabled={disabled}
                />
              </Field>
            )}

            {enabled.includes('authorYearRange') && (
              <Field label="저자 연도 범위" hint="출생/사망 연도">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={state.authorYearStart}
                    onChange={(e) => set('authorYearStart', e.target.value)}
                    placeholder="1800"
                    className={`${inputCls} w-full`}
                    disabled={disabled}
                  />
                  <span className="text-[var(--t2)]">~</span>
                  <input
                    type="number"
                    value={state.authorYearEnd}
                    onChange={(e) => set('authorYearEnd', e.target.value)}
                    placeholder="1900"
                    className={`${inputCls} w-full`}
                    disabled={disabled}
                  />
                </div>
              </Field>
            )}

            {enabled.includes('copyright') && (
              <Field label="저작권" hint="public_domain | in_copyright">
                <select
                  value={state.copyright}
                  onChange={(e) =>
                    set('copyright', e.target.value as AdvancedState['copyright'])
                  }
                  className={inputCls}
                  disabled={disabled}
                >
                  <option value="">무관 (전체)</option>
                  <option value="public_domain">Public Domain 만</option>
                  <option value="in_copyright">저작권 보호 만</option>
                </select>
              </Field>
            )}

            {enabled.includes('ids') && (
              <Field label="특정 ID 일괄" hint="comma 구분 — 다른 필터 무시">
                <input
                  type="text"
                  value={state.ids}
                  onChange={(e) => set('ids', e.target.value)}
                  placeholder="11, 84, 1342"
                  className={inputCls}
                  disabled={disabled}
                />
              </Field>
            )}

            {enabled.includes('mimeType') && (
              <Field label="MIME 타입" hint="text/plain · application/epub+zip">
                <input
                  type="text"
                  value={state.mimeType}
                  onChange={(e) => set('mimeType', e.target.value)}
                  placeholder="text/plain"
                  className={inputCls}
                  disabled={disabled}
                />
              </Field>
            )}

            {enabled.includes('subjectSlug') && (
              <Field label="Subject Slug" hint="collection 직접 지정">
                <input
                  type="text"
                  value={state.subjectSlug}
                  onChange={(e) => set('subjectSlug', e.target.value)}
                  placeholder="best-of-2024"
                  className={inputCls}
                  disabled={disabled}
                />
              </Field>
            )}

            {enabled.includes('featuredOnly') && (
              <Field label="Featured Only" hint="Wikibooks featured 만">
                <label className="inline-flex items-center gap-2 text-[12px] text-[var(--t2)]">
                  <input
                    type="checkbox"
                    checked={state.featuredOnly}
                    onChange={(e) => set('featuredOnly', e.target.checked)}
                    disabled={disabled}
                  />
                  Featured Books 강제
                </label>
              </Field>
            )}

            {enabled.includes('genreId') && (
              <Field label="Genre ID" hint="LibriVox 정확 ID 지정">
                <input
                  type="number"
                  value={state.genreId}
                  onChange={(e) => set('genreId', e.target.value)}
                  placeholder="3"
                  className={inputCls}
                  disabled={disabled}
                />
              </Field>
            )}

            {enabled.includes('publishedSince') && (
              <Field label="게시일 since" hint="YYYY-MM-DD">
                <input
                  type="date"
                  value={state.publishedSince}
                  onChange={(e) => set('publishedSince', e.target.value)}
                  className={inputCls}
                  disabled={disabled}
                />
              </Field>
            )}

            {enabled.includes('author') && (
              <Field label="저자 (접두 매칭)" hint="LibriVox author 검색">
                <input
                  type="text"
                  value={state.author}
                  onChange={(e) => set('author', e.target.value)}
                  placeholder="Dickens"
                  className={inputCls}
                  disabled={disabled}
                />
              </Field>
            )}

            {enabled.includes('lit2goGradeBand') && (
              <Field
                label="Lit2Go US 학년 밴드"
                hint="⚠ 미국 원어민 학년 (Flesch-Kincaid). EFL ≠. coverage 가 V-Level SSoT"
              >
                <select
                  value={state.lit2goGradeBand}
                  onChange={(e) =>
                    set(
                      'lit2goGradeBand',
                      e.target.value as AdvancedState['lit2goGradeBand'],
                    )
                  }
                  className={inputCls}
                  disabled={disabled}
                >
                  <option value="">전체</option>
                  <option value="k-2">K-2 (≈ EFL B1-B2 어휘)</option>
                  <option value="3-5">3-5 학년 (≈ B1)</option>
                  <option value="6-8">6-8 학년 (≈ B1-B2)</option>
                  <option value="9-12">9-12 학년 (≈ B2)</option>
                </select>
              </Field>
            )}

            {enabled.includes('lit2goAudioOnly') && (
              <Field label="Lit2Go 오디오 보유 만" hint="USF audiobooks 만">
                <label className="inline-flex items-center gap-2 text-[var(--t2)]">
                  <input
                    type="checkbox"
                    checked={state.lit2goAudioOnly}
                    onChange={(e) => set('lit2goAudioOnly', e.target.checked)}
                    className="h-3 w-3"
                    disabled={disabled}
                  />
                  <span className="font-mono text-[11px]">오디오 있음만</span>
                </label>
              </Field>
            )}
          </div>

          {hasActive && (
            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={() => onChange(DEFAULT_ADVANCED)}
                className="font-mono text-[10px] text-[var(--t2)] underline-offset-2 hover:underline"
              >
                전체 초기화
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ── 상태 → API body 변환 ─────────────────────
export function buildAdvancedBody(
  state: AdvancedState,
  enabled: AdvancedFieldKey[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (enabled.includes('search') && state.search.trim()) out.search = state.search.trim()
  // v06.34 — languages multi 비활성 (영어 강제 정책)
  if (enabled.includes('authorYearRange')) {
    if (state.authorYearStart) out.authorYearStart = Number(state.authorYearStart)
    if (state.authorYearEnd) out.authorYearEnd = Number(state.authorYearEnd)
  }
  if (enabled.includes('copyright')) {
    if (state.copyright === 'public_domain') out.copyright = false
    else if (state.copyright === 'in_copyright') out.copyright = true
  }
  if (enabled.includes('ids') && state.ids.trim()) {
    const ids = state.ids
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (ids.length > 0) out.ids = ids
  }
  if (enabled.includes('mimeType') && state.mimeType.trim()) out.mimeType = state.mimeType.trim()
  if (enabled.includes('subjectSlug') && state.subjectSlug.trim())
    out.subjectSlug = state.subjectSlug.trim()
  if (enabled.includes('featuredOnly') && state.featuredOnly) out.featuredOnly = true
  if (enabled.includes('genreId') && state.genreId) out.genreId = Number(state.genreId)
  if (enabled.includes('publishedSince') && state.publishedSince)
    out.publishedSince = state.publishedSince
  if (enabled.includes('author') && state.author.trim()) out.author = state.author.trim()
  // v06.43 — Lit2Go
  if (enabled.includes('lit2goGradeBand') && state.lit2goGradeBand)
    out.lit2goGradeBand = state.lit2goGradeBand
  if (enabled.includes('lit2goAudioOnly') && state.lit2goAudioOnly) out.lit2goAudioOnly = true
  return out
}

function countActive(state: AdvancedState, enabled: AdvancedFieldKey[]): number {
  let n = 0
  if (enabled.includes('search') && state.search.trim()) n++
  // v06.34 — languages 카운트 제외 (영어 강제 정책)
  if (enabled.includes('authorYearRange') && (state.authorYearStart || state.authorYearEnd)) n++
  if (enabled.includes('copyright') && state.copyright) n++
  if (enabled.includes('ids') && state.ids.trim()) n++
  if (enabled.includes('mimeType') && state.mimeType.trim()) n++
  if (enabled.includes('subjectSlug') && state.subjectSlug.trim()) n++
  if (enabled.includes('featuredOnly') && state.featuredOnly) n++
  if (enabled.includes('genreId') && state.genreId) n++
  if (enabled.includes('publishedSince') && state.publishedSince) n++
  if (enabled.includes('author') && state.author.trim()) n++
  if (enabled.includes('lit2goGradeBand') && state.lit2goGradeBand) n++
  if (enabled.includes('lit2goAudioOnly') && state.lit2goAudioOnly) n++
  return n
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="font-body text-[10px] text-[var(--t2)]">{hint}</span>
      )}
    </label>
  )
}

function MultiLangSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ value: string; label: string }>
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
}) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }
  return (
    <div className="flex flex-wrap gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] p-2">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            disabled={disabled}
            className="inline-flex items-center rounded-[var(--r-full)] border px-2 py-1 font-mono text-[10px] transition-colors"
            style={{
              background: on ? 'var(--p-light)' : 'var(--bg)',
              borderColor: on ? 'var(--p)' : 'var(--bd)',
              color: on ? 'var(--p-dark)' : 'var(--t2)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const inputCls =
  'h-8 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[12px] text-[var(--t1)]'
