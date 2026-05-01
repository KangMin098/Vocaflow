// apps/web/src/components/text-viewer/AnalysisResult.tsx
// AI 분석 결과 통합 화면 (좌: 원문 / 우: 단어 리스트)

'use client'

import { ArrowLeft, ArrowRight, Save, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { AnalysisResult as AnalysisResultData } from './analysis-types'
import { ScriptDisplay } from './ScriptDisplay'
import { WordList } from './WordList'

export interface AnalysisResultProps {
  result: AnalysisResultData
  onBack: () => void
  onSave: (selectedIds: string[]) => void
  onPlayAudio?: (word: string) => void
}

export function AnalysisResult({ result, onBack, onSave, onPlayAudio }: AnalysisResultProps) {
  // 기본: 모든 단어 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(result.words.map((w) => w.id))
  )
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedIds(new Set(result.words.map((w) => w.id)))
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  const selectedCount = selectedIds.size
  const canSave = selectedCount > 0

  return (
    <div className="flex flex-col gap-s-4">
      {/* ── 분석 완료 배너 ── */}
      <div
        className="relative overflow-hidden rounded-xl p-s-4 lg:p-s-5"
        style={{
          background: 'linear-gradient(135deg, var(--success-light) 0%, var(--bg2) 70%)',
          border: '1px solid var(--success-light)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, var(--success), transparent)',
          }}
        />

        <div className="relative flex flex-col gap-s-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-s-3">
            <div className="bg-success flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm">
              <Sparkles size={18} className="text-ti" />
            </div>
            <div>
              <div className="text-success mb-[2px] font-mono text-[10px] font-bold uppercase tracking-[0.15em]">
                ✓ AI 분석 완료
              </div>
              <h2 className="font-display text-lg font-bold tracking-tight text-t1">
                {result.words.length}개 학습 단어 추출됨x
                <span className="ml-s-2 text-sm font-normal text-t2">
                  ({(result.duration / 1000).toFixed(1)}초)
                </span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex shrink-0 items-center gap-s-2 rounded-md border border-bd bg-bg px-s-3 py-s-2 font-display text-sm font-medium text-t1 transition-all duration-normal hover:border-t2 hover:bg-bg2"
          >
            <ArrowLeft size={14} />
            <span>다시 입력</span>
          </button>
        </div>
      </div>

      {/* ── 좌우 분할: 원문 + 단어 리스트 ── */}
      <div className="grid min-h-[600px] grid-cols-1 gap-s-4 lg:grid-cols-2">
        <ScriptDisplay
          text={result.text}
          totalWords={result.totalWords}
          totalChars={result.totalChars}
          words={result.words}
          selectedIds={selectedIds}
          hoveredWordId={hoveredId}
          onWordClick={handleToggle}
        />

        <WordList
          words={result.words}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onHover={setHoveredId}
          onPlayAudio={onPlayAudio}
        />
      </div>

      {/* ── 저장 CTA ── */}
      <div className="mt-s-2 flex flex-col gap-s-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-s-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
            선택된 단어
          </div>
          <div className="font-display text-2xl font-extrabold tabular-nums leading-none text-t1">
            {selectedCount}
            <span className="text-base font-medium text-t2"> / {result.words.length}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSave(Array.from(selectedIds))}
          disabled={!canSave}
          className="text-ti group relative flex h-12 items-center justify-center gap-s-2 overflow-hidden rounded-xl bg-p px-s-6 font-display text-sm font-bold shadow-sm transition-all duration-normal hover:bg-p-hover hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-p sm:h-14 sm:text-base lg:px-s-8"
        >
          {!canSave ? (
            <>
              <Save size={16} />
              <span>단어를 선택하세요</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>WordVault에 저장하기</span>
              <ArrowRight
                size={16}
                className="transition-transform duration-normal group-hover:translate-x-1"
              />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
