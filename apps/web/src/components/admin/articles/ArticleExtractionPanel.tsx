// apps/web/src/components/admin/articles/ArticleExtractionPanel.tsx
//
// 글 학습 단어 추출 패널 (책 BookExtractionPanel 미러).
// - 글은 단일 섹션 → analyzeArticle 이 이미 추출한 library_article_vocabularies 가 곧 발행 결과.
//   (책처럼 별도 RPC preview 불필요 — 분석 시점에 확정됨. 재추출은 상단 "재분석" 액션.)
// - meta cells + 학습가치(LV) 내림차순 랭킹 테이블 + register 배지 + 검수 팝업 트리거.

'use client'

import { useState } from 'react'
import { Layers, SearchCheck } from 'lucide-react'

import type { ReviewVocab } from '@/lib/articles/review-types'
import { RegisterBadge } from '@/components/library/RegisterBadge'
import { ArticleWordSetPreviewModal } from './ArticleWordSetPreviewModal'

interface Props {
  title: string
  cefrLevel: string | null
  /** v06.51 — V-Level baseline (compute_article_vrl P75). select_article_vocab 게이트 결과. */
  articleVLevel: number | null
  wordCount: number | null
  readingMinutes: number | null
  vocab: ReviewVocab[]
}

export function ArticleExtractionPanel({
  title,
  cefrLevel,
  articleVLevel,
  wordCount,
  readingMinutes,
  vocab,
}: Props) {
  const [limit, setLimit] = useState(50)
  const [modalOpen, setModalOpen] = useState(false)

  const visible = vocab.slice(0, limit)
  const missing = vocab.filter((v) => !v.meaningKo).length

  return (
    <section
      aria-labelledby="article-extract-title"
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-[#8B5CF6]" aria-hidden />
          <div>
            <h2
              id="article-extract-title"
              className="font-display text-[14px] font-[700] text-[var(--t1)]"
            >
              학습 단어 추출 — 분석 결과
            </h2>
            <p className="mt-0.5 font-body text-[12px] text-[var(--t2)]">
              article_v_level{articleVLevel != null ? ` V${articleVLevel}` : ''} 이상 · 📜 고어·🏛
              시대어 제외(본문 툴팁으로) · composite = freq_boost 0.70 + salience 0.10 + skill
              penalty · 발행 단어장과 동일 결과·순서 (LCP SSoT)
            </p>
          </div>
        </div>

        {vocab.length > 0 && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p-light)] px-3.5 font-display text-[12px] font-[600] text-[var(--on-p-tint)] transition-colors hover:bg-[var(--p)] hover:text-[var(--on-p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <SearchCheck size={13} aria-hidden />
            단어장 검수 팝업
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-[var(--r-sm)] bg-[var(--bg2)] p-3 sm:grid-cols-5">
        <MetaCell label="발행 기준" value={articleVLevel != null ? `≥ V${articleVLevel}` : '≥ V4'} />
        <MetaCell label="article_v_level" value={articleVLevel != null ? `V${articleVLevel}` : '—'} />
        <MetaCell label="CEFR" value={cefrLevel ?? '—'} />
        <MetaCell label="본문 단어수" value={wordCount?.toLocaleString() ?? '—'} />
        <MetaCell label="추출 단어" value={`${vocab.length}개`} />
      </div>
      {readingMinutes != null && (
        <p className="font-mono text-[10px] text-[var(--t2)]">읽기 시간: {readingMinutes}분</p>
      )}

      {missing > 0 && (
        <p className="rounded-[var(--r-sm)] border border-[var(--warning)]/30 bg-[var(--warning-light)] px-3 py-2 font-body text-[11px] text-[#92400E]">
          사전 미등재(뜻 없음) <strong>{missing}건</strong> — dict-fill 큐 후보 (학습 노출 시 뜻 누락)
        </p>
      )}

      {vocab.length === 0 ? (
        <p className="rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-4 font-body text-[12px] text-[var(--t2)]">
          추출된 단어가 없어요. 상단 “지금 처리/재분석”으로 파이프라인을 실행하세요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-sm)] border border-[var(--bd)]">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[var(--bg2)] text-[11px] font-[700] uppercase tracking-wider text-[var(--t2)]">
              <tr>
                <Th className="text-right">#</Th>
                <Th>단어</Th>
                <Th>뜻</Th>
                <Th className="text-right">V</Th>
                <Th className="text-center">CEFR</Th>
                <Th className="text-right">본문빈도</Th>
                <Th className="text-right">LV</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.word}
                  className="border-t border-[var(--bd)] font-body text-[12px] text-[var(--t1)] hover:bg-[var(--bg2)]"
                >
                  <Td className="text-right font-mono text-[var(--t2)]">{r.rank}</Td>
                  <Td className="font-display font-[600]">
                    <span className="inline-flex items-center gap-1.5">
                      {r.word}
                      <RegisterBadge register={r.wordRegister} />
                    </span>
                  </Td>
                  <Td className="text-[var(--t2)]">{r.meaningKo ?? '—'}</Td>
                  <Td className="text-right font-mono">
                    {r.vLevel != null ? `V${r.vLevel}` : '—'}
                  </Td>
                  <Td className="text-center font-mono text-[var(--t2)]">{r.cefrLevel ?? '—'}</Td>
                  <Td className="text-right font-mono text-[var(--t2)]">
                    {r.frequencyInArticle ?? '—'}
                  </Td>
                  <Td className="text-right font-mono">
                    {r.baseLearningValue != null ? r.baseLearningValue.toFixed(1) : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>

          {vocab.length > 50 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-[var(--bd)] bg-[var(--bg2)] p-2">
              {vocab.length > limit && (
                <>
                  <button
                    type="button"
                    onClick={() => setLimit((n) => n + 50)}
                    className="font-display text-[12px] font-[600] text-[var(--p)] hover:underline"
                  >
                    다음 50개 보기 ({vocab.length - limit}개 남음)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLimit(vocab.length)}
                    className="font-display text-[12px] font-[600] text-[var(--p)] hover:underline"
                  >
                    전체 보기 (총 {vocab.length}개)
                  </button>
                </>
              )}
              {limit > 50 && vocab.length <= limit && (
                <button
                  type="button"
                  onClick={() => setLimit(50)}
                  className="font-display text-[12px] font-[600] text-[var(--t2)] hover:underline"
                >
                  접기 (50개만 보기)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <ArticleWordSetPreviewModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={title}
        cefrLevel={cefrLevel}
        words={vocab}
      />
    </section>
  )
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
        {label}
      </span>
      <span className="font-display text-[14px] font-[700] tabular-nums text-[var(--t1)]">
        {value}
      </span>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>
}
