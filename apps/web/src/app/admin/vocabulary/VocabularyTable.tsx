// apps/web/src/app/admin/vocabulary/VocabularyTable.tsx

'use client'

import { ChevronLeft, ChevronRight, Database } from 'lucide-react'
import type { DictSearchRow } from '@/lib/admin/dict/word-search'
import { inlineSanityIssues } from './_sanity'

interface VocabularyTableProps {
  rows: DictSearchRow[]
  currentPage: number
  hasNext: boolean
  selectedWord: string
  onSelect: (word: string) => void
  onPageChange: (page: number) => void
}

const CEFR_COLOR: Record<string, string> = {
  A1: '#86EFAC',
  A2: '#22C55E',
  B1: '#3B82F6',
  B2: '#1D4ED8',
  C1: '#7C3AED',
  C2: '#581C87',
}

const SEV_DOT: Record<'critical' | 'warning' | 'info', string> = {
  critical: 'var(--error)',
  warning: 'var(--active)',
  info: 'var(--info)',
}

export function VocabularyTable({
  rows,
  currentPage,
  hasNext,
  selectedWord,
  onSelect,
  onPageChange,
}: VocabularyTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--r-xl)] border border-dashed border-[var(--bd)] bg-[var(--bg)] py-12 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg3)] text-[var(--t2)]">
          <Database size={18} aria-hidden />
        </span>
        <p className="font-body text-[13px] text-[var(--t2)]">조건에 맞는 단어 없음</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--bd)] bg-[var(--bg2)]">
              <th className="px-3 py-2 text-left font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                word
              </th>
              <th className="px-3 py-2 text-left font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                POS
              </th>
              <th className="px-3 py-2 text-left font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                meaning
              </th>
              <th className="px-3 py-2 text-center font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                CEFR
              </th>
              <th className="px-3 py-2 text-center font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                V
              </th>
              <th className="px-3 py-2 text-right font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                freq
              </th>
              <th className="px-3 py-2 text-center font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                src
              </th>
              <th className="px-3 py-2 text-center font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                ✓
              </th>
              <th className="px-3 py-2 text-left font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                sanity
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.word === selectedWord
              const issues = inlineSanityIssues(row)
              const cefr = row.cefr_level
              const cefrColor = cefr ? CEFR_COLOR[cefr] : undefined
              const reclassified =
                row.v_level != null &&
                row.v_level_rule_v1 != null &&
                row.v_level !== row.v_level_rule_v1
              return (
                <tr
                  key={row.word}
                  onClick={() => onSelect(row.word)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(row.word)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  className={`cursor-pointer border-b border-[var(--bd)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 ${
                    isSelected ? 'bg-[#8B5CF61A]' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <p className="font-english text-[13px] font-[700] text-[var(--t1)]">
                      {row.word}
                    </p>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-[var(--t2)]">
                    {row.primary_pos ?? row.pos ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <p className="line-clamp-1 font-body text-[12px] text-[var(--t2)]">
                      {row.meaning_ko ?? (
                        <span className="italic text-[var(--error-ink)]">empty</span>
                      )}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {cefr ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] font-[700]"
                        style={{
                          backgroundColor: `${cefrColor}1A`,
                          color: cefrColor,
                        }}
                      >
                        {cefr}
                        {row.cefr_confidence != null && (
                          <span className="font-body opacity-70">
                            {Number(row.cefr_confidence).toFixed(2)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-[var(--t2)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.v_level != null ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] font-[700] ${
                          reclassified
                            ? 'bg-[#8B5CF61A] text-[#8B5CF6]'
                            : 'bg-[var(--bg3)] text-[var(--t2)]'
                        }`}
                        title={
                          reclassified
                            ? `rule_v1: V${row.v_level_rule_v1} → current: V${row.v_level}`
                            : `V${row.v_level}`
                        }
                      >
                        V{row.v_level}
                        {reclassified && (
                          <span className="font-body text-[8px] opacity-70">
                            ←{row.v_level_rule_v1}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-[var(--t2)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[10px] tabular-nums text-[var(--t2)]">
                    {row.frequency_rank?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-[9px] text-[var(--t2)]">
                    {row.source}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.verified ? (
                      <span className="text-[12px] text-[var(--success)]" aria-label="verified">
                        ✓
                      </span>
                    ) : (
                      <span className="text-[12px] text-[var(--t2)]" aria-label="unverified">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {issues.length > 0 ? (
                      <div
                        className="flex flex-wrap items-center gap-1"
                        aria-label={`${issues.length} sanity issues`}
                      >
                        {issues.slice(0, 3).map((iss) => (
                          <span
                            key={iss.id}
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--bg2)] px-2 py-1 font-mono text-[9px] text-[var(--t2)]"
                            title={iss.detail}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: SEV_DOT[iss.severity] }}
                              aria-hidden
                            />
                            {iss.label}
                          </span>
                        ))}
                        {issues.length > 3 && (
                          <span className="font-mono text-[9px] text-[var(--t2)]">
                            +{issues.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-[9px] text-[var(--success)]">clean</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-[var(--t2)]">
          page {currentPage} {hasNext ? '/ ...' : '(last)'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="min-h-[44px] inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[11px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={12} aria-hidden /> prev
          </button>
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNext}
            className="min-h-[44px] inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[11px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            next <ChevronRight size={12} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
