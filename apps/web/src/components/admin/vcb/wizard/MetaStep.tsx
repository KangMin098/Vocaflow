// apps/web/src/components/admin/vcb/wizard/MetaStep.tsx
// Wizard Step 3 — slug/title/description/cover_emoji/target_segment/cefr + Distribution + Sample.

'use client'

import type { Segment, Cefr } from '@/lib/vcb/types'
import type { VocabFilters } from '@/lib/vcb/filters'
import { DistributionChart } from './DistributionChart'
import { SampleWords } from './SampleWords'

const SEGMENTS: Array<{ value: Segment; label: string }> = [
  { value: 'middle_school', label: '중학' },
  { value: 'high_school', label: '고교' },
  { value: 'toeic', label: 'TOEIC' },
  { value: 'business', label: '비즈니스' },
  { value: 'academic', label: '학술' },
  { value: 'civil_service', label: '공무원' },
  { value: 'general', label: '범용' },
]

const CEFR_LEVELS: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/

interface MetaState {
  collection_slug: string
  collection_title: string
  description: string
  cover_emoji: string
  target_segment: Segment
  target_cefr_range: Cefr[]
}

interface Props {
  filters: VocabFilters
  meta: MetaState
  onMetaChange: (next: MetaState) => void
}

export function MetaStep({ filters, meta, onMetaChange }: Props) {
  const slugValid = SLUG_PATTERN.test(meta.collection_slug)
  const titleValid =
    meta.collection_title.trim().length > 0 && meta.collection_title.length <= 200
  const cefrValid = meta.target_cefr_range.length > 0

  const setM = <K extends keyof MetaState>(key: K, value: MetaState[K]) => {
    onMetaChange({ ...meta, [key]: value })
  }

  const toggleCefr = (level: Cefr) => {
    const next = meta.target_cefr_range.includes(level)
      ? meta.target_cefr_range.filter((l) => l !== level)
      : [...meta.target_cefr_range, level]
    setM('target_cefr_range', next)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--t1)' }}>
          단어장 정보 + 최종 미리보기
        </h3>
        <p className="text-sm font-body" style={{ color: 'var(--t3)' }}>
          collection_slug / 제목 등 메타데이터를 입력하고, 분포·샘플을 확인 후 생성.
        </p>
      </div>

      {/* ── Distribution ─────────────────────── */}
      <section
        className="rounded-[var(--r-lg)] border p-5"
        style={{ borderColor: 'var(--bd)', background: 'var(--bg)' }}
      >
        <DistributionChart filters={filters} />
      </section>

      {/* ── Sample ───────────────────────────── */}
      <section
        className="rounded-[var(--r-lg)] border p-5"
        style={{ borderColor: 'var(--bd)', background: 'var(--bg)' }}
      >
        <SampleWords filters={filters} />
      </section>

      {/* ── Meta form ────────────────────────── */}
      <section
        className="rounded-[var(--r-lg)] border p-5 flex flex-col gap-4"
        style={{ borderColor: 'var(--bd)', background: 'var(--bg)' }}
      >
        <h4 className="font-display font-medium text-sm" style={{ color: 'var(--t1)' }}>
          메타데이터
        </h4>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-display" style={{ color: 'var(--t3)' }}>
            collection_slug <span style={{ color: 'var(--error)' }}>*</span>
          </span>
          <input
            type="text"
            value={meta.collection_slug}
            onChange={(e) => setM('collection_slug', e.target.value)}
            placeholder="csat-core-essential-2k"
            className="px-3 py-2 rounded-[var(--r-md)] border font-mono text-sm"
            style={{
              background: 'var(--bg)',
              borderColor:
                meta.collection_slug.length > 0 && !slugValid ? 'var(--error)' : 'var(--bd)',
              color: 'var(--t1)',
            }}
          />
          <span className="text-[11px] font-body" style={{ color: 'var(--t3)' }}>
            소문자·숫자·하이픈만 (3~80자). 영구 URL 식별자가 됩니다.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-display" style={{ color: 'var(--t3)' }}>
            제목 <span style={{ color: 'var(--error)' }}>*</span>
          </span>
          <input
            type="text"
            value={meta.collection_title}
            onChange={(e) => setM('collection_title', e.target.value)}
            placeholder="수능 필수 2,000"
            className="px-3 py-2 rounded-[var(--r-md)] border text-sm font-body"
            style={{
              background: 'var(--bg)',
              borderColor:
                meta.collection_title.length > 0 && !titleValid ? 'var(--error)' : 'var(--bd)',
              color: 'var(--t1)',
            }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-display" style={{ color: 'var(--t3)' }}>
            설명
          </span>
          <textarea
            value={meta.description}
            onChange={(e) => setM('description', e.target.value)}
            placeholder="수능 빈출 어휘 핵심 (CEFR B1-B2)"
            rows={2}
            className="px-3 py-2 rounded-[var(--r-md)] border text-sm font-body"
            style={{ background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--t1)' }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-display" style={{ color: 'var(--t3)' }}>
            커버 이모지
          </span>
          <input
            type="text"
            value={meta.cover_emoji}
            onChange={(e) => setM('cover_emoji', e.target.value)}
            placeholder="🎯"
            maxLength={8}
            className="px-3 py-2 rounded-[var(--r-md)] border text-sm font-body w-24"
            style={{ background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--t1)' }}
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-display" style={{ color: 'var(--t3)' }}>
            대상 사용자
          </span>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => {
              const active = meta.target_segment === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setM('target_segment', s.value)}
                  className="px-3 py-1.5 rounded-[var(--r-md)] text-sm font-display transition-all"
                  style={{
                    background: active ? 'var(--p-light)' : 'var(--bg)',
                    color: active ? 'var(--p-dark)' : 'var(--t1)',
                    border: `${active ? 1.5 : 1}px solid ${active ? 'var(--p)' : 'var(--bd)'}`,
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-display" style={{ color: 'var(--t3)' }}>
            CEFR 범위 <span style={{ color: 'var(--error)' }}>*</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {CEFR_LEVELS.map((c) => {
              const active = meta.target_cefr_range.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCefr(c)}
                  className="px-3 py-1.5 rounded-[var(--r-md)] text-sm font-display transition-all"
                  style={{
                    background: active ? 'var(--p-light)' : 'var(--bg)',
                    color: active ? 'var(--p-dark)' : 'var(--t1)',
                    border: `${active ? 1.5 : 1}px solid ${active ? 'var(--p)' : 'var(--bd)'}`,
                  }}
                >
                  {c}
                </button>
              )
            })}
          </div>
          {!cefrValid && (
            <span className="text-[11px] font-body" style={{ color: 'var(--error)' }}>
              최소 1개 이상 선택
            </span>
          )}
        </div>
      </section>
    </div>
  )
}

export type { MetaState }
