// apps/web/src/components/admin/curation/ChapterWordSetsAdminSection.tsx
//
// /admin/curation/preview/[bookId] 도서 검수 페이지의 챕터 단어장 검수 섹션.
// - 도서별 챕터 단어장(category='library_book') 일람 + 단어수 분포
// - 챕터당 단어 수 < 10 인 단어장 경고 highlight (Cognitive Load 적신호)
// - 행 클릭 → ChapterWordSetPreviewModal (단어 + 추출 메타)
// - 사용자 영역 BookCard 와 구분 — admin 전용 (구독 CTA 없음)

'use client'

import { useState } from 'react'
import { Layers, AlertTriangle, CheckCircle2 } from 'lucide-react'

import type { PublishedVocabSet } from '@/lib/library/vocab/queries'
import {
  ChapterWordSetPreviewModal,
  type AdminChapterSet,
} from './ChapterWordSetPreviewModal'

export interface AdminChapterSetRow extends PublishedVocabSet {
  chapterIdx: number
  curationQuery: Record<string, unknown>
}

interface Props {
  sets: AdminChapterSetRow[]
  bookId: string
  bookVLevel: number | null
}

const LOW_WORD_THRESHOLD = 10

export function ChapterWordSetsAdminSection({ sets, bookId, bookVLevel }: Props) {
  const [selectedSet, setSelectedSet] = useState<AdminChapterSet | null>(null)

  const totalWords = sets.reduce((sum, s) => sum + s.wordCount, 0)
  const lowChapters = sets.filter((s) => s.wordCount < LOW_WORD_THRESHOLD)
  const avg = sets.length > 0 ? Math.round(totalWords / sets.length) : 0

  function openModal(s: AdminChapterSetRow) {
    setSelectedSet({
      id: s.id,
      title: s.title,
      chapterIdx: s.chapterIdx,
      wordCount: s.wordCount,
      cefrLevel: s.cefrLevel,
      bookVLevel,
      curationQuery: s.curationQuery,
    })
  }

  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-[#8B5CF6]" aria-hidden />
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
            챕터 단어장 검수
          </h2>
          <span className="font-display text-[12px] font-[600] text-[var(--t3)]">
            {sets.length}
          </span>
        </div>
        {sets.length > 0 && (
          <div className="flex items-center gap-3 font-body text-[11px] text-[var(--t3)]">
            <span>총 {totalWords.toLocaleString()}단어</span>
            <span>·</span>
            <span>평균 {avg}/챕터</span>
            {bookVLevel != null && (
              <>
                <span>·</span>
                <span>필터 V{bookVLevel}+</span>
              </>
            )}
          </div>
        )}
      </header>

      {sets.length === 0 ? (
        <p className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-4 font-body text-[13px] text-[var(--t3)]">
          챕터 단어장이 아직 발행되지 않았어요. <code className="font-mono text-[11px]">status=&apos;published&apos;</code> 전환 시 trigger 자동 발행, 또는{' '}
          <code className="font-mono text-[11px]">SELECT publish_book_word_sets(&apos;{bookId}&apos;);</code> 수동 호출.
        </p>
      ) : (
        <>
          {lowChapters.length > 0 && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--warning)]/30 bg-[var(--warning-light)] p-3 font-body text-[12px] text-[#92400E]"
            >
              <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                <strong>{lowChapters.length}개 챕터</strong>가 단어 수 &lt; {LOW_WORD_THRESHOLD} —
                Cognitive Load 적신호. 클릭하여 단어 확인:{' '}
                {lowChapters.map((s) => `Ch.${s.chapterIdx}(${s.wordCount})`).join(', ')}
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full font-body text-[12px]">
              <thead>
                <tr className="border-b border-[var(--bd)] font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]">
                  <th className="py-2 pr-3 text-left">챕터</th>
                  <th className="py-2 pr-3 text-left">제목</th>
                  <th className="py-2 pr-3 text-right tabular-nums">단어수</th>
                  <th className="py-2 pr-3 text-left">CEFR</th>
                  <th className="py-2 pr-3 text-left">상태</th>
                </tr>
              </thead>
              <tbody>
                {sets.map((s) => {
                  const isLow = s.wordCount < LOW_WORD_THRESHOLD
                  return (
                    <tr
                      key={s.id}
                      onClick={() => openModal(s)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${s.title} 단어 미리보기`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openModal(s)
                        }
                      }}
                      className={`cursor-pointer border-b border-[var(--bd)]/40 transition-colors hover:bg-[var(--bg2)] focus-visible:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] ${
                        isLow ? 'bg-[var(--warning-light)]/50' : ''
                      }`}
                    >
                      <td className="py-2 pr-3 font-display font-[700] text-[var(--t1)]">
                        Ch.{s.chapterIdx}
                      </td>
                      <td className="py-2 pr-3 text-[var(--t2)]">{s.title}</td>
                      <td
                        className={`py-2 pr-3 text-right tabular-nums ${
                          isLow ? 'font-[700] text-[#92400E]' : 'text-[var(--t1)]'
                        }`}
                      >
                        {s.wordCount}
                      </td>
                      <td className="py-2 pr-3 text-[var(--t3)]">{s.cefrLevel ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1 text-[var(--success)]">
                          <CheckCircle2 size={11} aria-hidden />
                          published
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 font-body text-[10px] text-[var(--t3)]">
            ※ 행 클릭으로 단어 + 추출 메타 미리보기 · <code className="font-mono">category=&apos;library_book&apos;</code> · 공용 단어장 영역 노출 X
          </p>
        </>
      )}

      <ChapterWordSetPreviewModal set={selectedSet} onClose={() => setSelectedSet(null)} />
    </section>
  )
}
