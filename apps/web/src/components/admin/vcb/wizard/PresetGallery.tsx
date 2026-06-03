// apps/web/src/components/admin/vcb/wizard/PresetGallery.tsx
// Wizard Step 1 — 9 프리셋 카드 + Custom.

'use client'

import { ChevronRight, Sparkles, Wrench } from 'lucide-react'
import { VCB_PRESETS, CUSTOM_PRESET_ID } from '@/lib/vcb/presets'
import type { VcbPreset, PresetVariant } from '@/lib/vcb/presets'

interface Props {
  selectedPresetId: string | null
  selectedVariantId: string | null
  onSelect: (preset: VcbPreset | null, variant: PresetVariant | null) => void
}

export function PresetGallery({ selectedPresetId, selectedVariantId, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3
          className="font-display font-semibold text-base mb-1"
          style={{ color: 'var(--t1)' }}
        >
          유형 선택
        </h3>
        <p className="text-sm font-body" style={{ color: 'var(--t3)' }}>
          사용자 페르소나에 맞는 프리셋을 선택하면 다음 단계 필터가 자동으로 채워집니다. 직접 만들고 싶으면 우측 하단 <b>사용자 정의</b>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {VCB_PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id
          return (
            <PresetCard
              key={preset.id}
              preset={preset}
              isSelected={isSelected}
              selectedVariantId={isSelected ? selectedVariantId : null}
              onVariantSelect={(variant) => onSelect(preset, variant)}
            />
          )
        })}

        {/* Custom 카드 */}
        <button
          type="button"
          onClick={() => onSelect(null, null)}
          className="group relative flex flex-col gap-3 rounded-[var(--r-lg)] border-2 p-5 text-left transition-all"
          style={{
            borderColor: selectedPresetId === CUSTOM_PRESET_ID ? '#64748B' : 'var(--bd)',
            background: selectedPresetId === CUSTOM_PRESET_ID ? 'var(--bg2)' : 'var(--bg)',
            borderStyle: 'dashed',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center text-xl"
              style={{ background: 'var(--bg3)' }}
            >
              <Wrench className="w-5 h-5" style={{ color: 'var(--t2)' }} />
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-[15px]" style={{ color: 'var(--t1)' }}>
                사용자 정의
              </div>
              <div className="text-xs font-body" style={{ color: 'var(--t3)' }}>
                필터 직접 설정
              </div>
            </div>
          </div>
          <p className="text-xs font-body leading-relaxed" style={{ color: 'var(--t2)' }}>
            V-Level · list_tags · 빈도 · 품사 · CEFR 등 모든 차원을 처음부터 조합.
          </p>
        </button>
      </div>
    </div>
  )
}

// ── PresetCard ────────────────────────────────────
function PresetCard({
  preset,
  isSelected,
  selectedVariantId,
  onVariantSelect,
}: {
  preset: VcbPreset
  isSelected: boolean
  selectedVariantId: string | null
  onVariantSelect: (variant: PresetVariant) => void
}) {
  return (
    <div
      className="rounded-[var(--r-lg)] border-2 p-5 transition-all"
      style={{
        // Selected: 6% tint + soft 8% ring (눈 피로 저감)
        borderColor: isSelected ? preset.accent : 'var(--bd)',
        background: isSelected ? `${preset.accent}0F` : 'var(--bg)',
        boxShadow: isSelected ? `0 0 0 3px ${preset.accent}14` : 'none',
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-[var(--r-md)] flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: `${preset.accent}18` }}
          aria-hidden
        >
          {preset.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-[15px]" style={{ color: 'var(--t1)' }}>
            {preset.title}
          </div>
          <div className="text-xs font-body flex items-center gap-1.5 mt-0.5">
            <Sparkles className="w-3 h-3" style={{ color: preset.accent }} />
            <span style={{ color: preset.accent }}>{preset.persona}</span>
          </div>
        </div>
      </div>

      <p className="text-xs font-body leading-relaxed mb-4" style={{ color: 'var(--t2)' }}>
        {preset.description}
      </p>

      {/* Variants */}
      <div className="flex flex-col gap-1.5">
        {preset.variants.map((variant) => {
          const isVariantSelected = selectedVariantId === variant.id
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onVariantSelect(variant)}
              className="group flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--r-md)] text-left transition-all"
              style={{
                // Calm UI — solid accent 대신 12% tint + left accent bar (Material 3 토널)
                background: isVariantSelected ? `${preset.accent}14` : 'var(--bg2)',
                color: isVariantSelected ? preset.accent : 'var(--t1)',
                borderLeft: `3px solid ${isVariantSelected ? preset.accent : 'transparent'}`,
              }}
            >
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-display text-[13px] font-medium truncate">
                  {variant.label}
                </span>
                <span
                  className="text-[11px] font-body truncate"
                  style={{ color: isVariantSelected ? `${preset.accent}CC` : 'var(--t3)' }}
                >
                  {variant.hint}
                </span>
              </div>
              <ChevronRight
                className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color: isVariantSelected ? preset.accent : 'var(--t3)' }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
