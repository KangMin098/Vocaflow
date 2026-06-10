// apps/web/src/components/admin/vcb/VcbRunCreateForm.tsx
// 3-step Wizard 오케스트레이터.
// Step 1 PresetGallery → Step 2 FilterPanel → Step 3 MetaStep → submit.

'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { createRun } from '@/lib/vcb/server/run-create'
import { CUSTOM_PRESET_ID } from '@/lib/vcb/presets'
import type { VcbPreset, PresetVariant } from '@/lib/vcb/presets'
import {
  DEFAULT_FILTERS,
  DEFAULT_LIMITS,
  type VocabFilters,
  type VocabLimits,
} from '@/lib/vcb/filters'
import type { Segment, Cefr } from '@/lib/vcb/types'
import { PresetGallery } from './wizard/PresetGallery'
import { FilterPanel } from './wizard/FilterPanel'
import { MetaStep, type MetaState } from './wizard/MetaStep'

type Step = 1 | 2 | 3

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/

const STEPS: Array<{ step: Step; title: string; subtitle: string }> = [
  { step: 1, title: '유형 선택', subtitle: '프리셋 또는 사용자 정의' },
  { step: 2, title: '필터 조정', subtitle: 'V-Level · 태그 · 빈도 · 품사' },
  { step: 3, title: '메타 + 미리보기', subtitle: 'slug · 제목 · 분포 · 샘플' },
]

const DEFAULT_META: MetaState = {
  collection_slug: '',
  collection_title: '',
  description: '',
  cover_emoji: '',
  target_segment: 'high_school',
  target_cefr_range: ['B1', 'B2'],
}

export function VcbRunCreateForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [step, setStep] = useState<Step>(1)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [filters, setFilters] = useState<VocabFilters>(DEFAULT_FILTERS)
  const [limits, setLimits] = useState<VocabLimits>(DEFAULT_LIMITS)
  const [meta, setMeta] = useState<MetaState>(DEFAULT_META)
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Step 1 → 2 진행 시 preset 의 변경사항 적용 ─────
  const handlePresetSelect = (preset: VcbPreset | null, variant: PresetVariant | null) => {
    if (preset === null) {
      // Custom 선택
      setSelectedPresetId(CUSTOM_PRESET_ID)
      setSelectedVariantId(null)
      setFilters(DEFAULT_FILTERS)
      setLimits(DEFAULT_LIMITS)
      setMeta(DEFAULT_META)
      return
    }

    setSelectedPresetId(preset.id)
    setSelectedVariantId(variant?.id ?? null)

    if (variant) {
      setFilters(variant.filters)
      setLimits(variant.limits)
      setMeta((prev) => ({
        ...prev,
        collection_slug: variant.slug_suggestion,
        collection_title: variant.title_suggestion,
        cover_emoji: preset.emoji,
        target_segment: variant.target_segment,
        target_cefr_range: variant.target_cefr_range,
      }))
    }
  }

  // ── Submit ─────────────────────────────────────
  const slugValid = SLUG_PATTERN.test(meta.collection_slug)
  const titleValid =
    meta.collection_title.trim().length > 0 && meta.collection_title.length <= 200
  const cefrValid = meta.target_cefr_range.length > 0
  const metaValid = slugValid && titleValid && cefrValid

  const canAdvance = useMemo(() => {
    if (step === 1) return selectedPresetId !== null
    if (step === 2) return matchCount !== null && matchCount > 0
    return false
  }, [step, selectedPresetId, matchCount])

  const handleSubmit = () => {
    setSubmitError(null)
    if (!metaValid) {
      setSubmitError('필수 메타데이터가 미입력 또는 유효하지 않습니다.')
      return
    }
    if (matchCount === null || matchCount === 0) {
      setSubmitError('매치 단어가 0건 입니다. 필터를 완화하세요.')
      return
    }

    startTransition(async () => {
      const result = await createRun({
        collection_slug: meta.collection_slug,
        collection_title: meta.collection_title.trim(),
        target_segment: meta.target_segment as Segment,
        target_cefr_range: meta.target_cefr_range as Cefr[],
        description: meta.description.trim() || null,
        cover_emoji: meta.cover_emoji.trim() || null,
        preset_id:
          selectedPresetId === CUSTOM_PRESET_ID ? null : selectedPresetId,
        filters: {
          ...filters,
          variant_id: selectedVariantId,
        },
        limits: { ...limits },
      })

      if (!result.ok || !result.data) {
        setSubmitError(result.error ?? 'Run 생성 실패')
        return
      }

      router.push(`/admin/vocab/runs/${result.data.run_id}`)
    })
  }

  return (
    <div className="max-w-5xl">
      {/* ── Stepper ────────────────────────────── */}
      <Stepper currentStep={step} />

      {/* ── Step body ──────────────────────────── */}
      <div className="mt-8 min-h-[400px]">
        {step === 1 && (
          <PresetGallery
            selectedPresetId={selectedPresetId}
            selectedVariantId={selectedVariantId}
            onSelect={handlePresetSelect}
          />
        )}

        {step === 2 && (
          <FilterPanel
            filters={filters}
            limits={limits}
            onFiltersChange={setFilters}
            onLimitsChange={setLimits}
            onCount={setMatchCount}
          />
        )}

        {step === 3 && (
          <MetaStep filters={filters} meta={meta} onMetaChange={setMeta} />
        )}
      </div>

      {/* ── Navigation ─────────────────────────── */}
      {submitError && (
        <div
          className="mt-6 flex items-center gap-2 px-4 py-3 rounded-[var(--r-md)] border"
          style={{
            background: 'var(--error-light)',
            borderColor: 'var(--error)',
            color: 'var(--error)',
          }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-body">{submitError}</span>
        </div>
      )}

      <div
        className="mt-8 pt-6 flex items-center justify-between gap-3 border-t"
        style={{ borderColor: 'var(--bd)' }}
      >
        <button
          type="button"
          onClick={() => {
            if (step === 1) return
            setStep((step - 1) as Step)
          }}
          disabled={step === 1 || isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] border font-display text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--bd)', color: 'var(--t2)', background: 'var(--bg)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          이전
        </button>

        <div className="text-xs font-body" style={{ color: 'var(--t3)' }}>
          Step {step} / 3
        </div>

        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((step + 1) as Step)}
            disabled={!canAdvance}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-[var(--r-md)] font-display text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{ background: 'var(--p)', color: '#FFFFFF', boxShadow: 'var(--sh-xs)' }}
          >
            다음
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !metaValid}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-[var(--r-md)] font-display text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{ background: 'var(--success)', color: '#FFFFFF', boxShadow: 'var(--sh-xs)' }}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Run 생성
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Stepper component ──────────────────────────
function Stepper({ currentStep }: { currentStep: Step }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const isActive = s.step === currentStep
        const isCompleted = s.step < currentStep
        return (
          <div key={s.step} className="flex items-center gap-2 flex-1">
            <div
              className="flex items-center gap-3 flex-1 px-3 py-2 rounded-[var(--r-md)]"
              style={{
                // active: 8% tint + accent border, completed: 6% success tint, idle: bg
                background: isActive ? 'var(--p-light)' : 'var(--bg)',
                border: `${isActive ? 1.5 : 1}px solid ${isActive ? 'var(--p)' : 'var(--bd)'}`,
              }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-display font-semibold flex-shrink-0"
                style={{
                  // 작은 영역 (28×28) 은 정보 hierarchy 위해 solid 유지하되 한 톤 dim
                  background: isCompleted
                    ? 'var(--success)'
                    : isActive
                      ? 'var(--p)'
                      : 'var(--bg2)',
                  color: isCompleted || isActive ? '#FFFFFF' : 'var(--t3)',
                  border: `1px solid ${
                    isCompleted ? 'var(--success)' : isActive ? 'var(--p)' : 'var(--bd)'
                  }`,
                }}
              >
                {isCompleted ? '✓' : s.step}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-display text-[13px] font-medium truncate"
                  style={{ color: isActive ? 'var(--p-dark)' : 'var(--t1)' }}
                >
                  {s.title}
                </div>
                <div className="text-[11px] font-body truncate" style={{ color: 'var(--t3)' }}>
                  {s.subtitle}
                </div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--t4)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
