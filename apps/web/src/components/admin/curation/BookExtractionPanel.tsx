// apps/web/src/components/admin/curation/BookExtractionPanel.tsx
// 큐레이션 — 도서 단어 재추출 preview 패널.
// /text/new ExtractionPanel 과 동일 composite, baseline = 책 자체 V-Level (P70/75/80).

'use client'

import { useState } from 'react'
import { Loader2, Zap, AlertCircle, BookPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  extractBookVocabularyAdmin,
  findUnboundBookLemmas,
  stageBookDictCandidates,
  type ExtractedBookWord,
  type StageDictResult,
  type UnboundLemma,
  type UnboundReason,
} from '@/lib/library/admin-queries'
import { RegisterBadge } from '@/components/library/RegisterBadge'

const REASON_LABEL: Record<UnboundReason, string> = {
  spelling_variant: '철자 변형',
  genuine_miss: '실단어 미등재',
  noise: '노이즈',
  no_v_level: 'V-Level 없음',
  not_classified: '분류 미완료',
  no_meaning: '뜻 누락',
}

const REASON_HINT: Record<UnboundReason, string> = {
  spelling_variant: 'US/UK 철자 차이 — canonical 철자가 사전에 있어 재추출 시 자동 회수됨',
  genuine_miss: '영단어로 보이나 사전 미등재 — seed/dict-fill 큐 후보',
  noise: '고유명사·로마숫자·단편 — 학습 대상 아님 (무시)',
  no_v_level: 'dict row 있으나 v_level NULL — VRL 분류 큐 등록',
  not_classified: 'classified_by NULL — VRL 자동 분류 미수행',
  no_meaning: 'meaning_ko 비어있음 — dict-fill 큐 등록',
}

interface BookExtractionPanelProps {
  bookId: string
  bookVLevel: number | null
}

export function BookExtractionPanel({
  bookId,
  bookVLevel,
}: BookExtractionPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ExtractedBookWord[] | null>(null)
  const [limit, setLimit] = useState<number>(50)
  const [unbound, setUnbound] = useState<UnboundLemma[] | null>(null)
  const [unboundLimit, setUnboundLimit] = useState<number>(100)
  const [staging, setStaging] = useState(false)
  const [stageResult, setStageResult] = useState<StageDictResult | null>(null)

  const meta = rows && rows.length > 0 ? rows[0] : null
  const chapterCount = rows ? new Set(rows.map((r) => r.chapter_idx)).size : 0

  // 미등재 실단어를 "사전 등재 큐"(addable_modern)로 올림 — 뜻 생성·등재는 Claude Code 배치.
  async function handleStage() {
    setStaging(true)
    try {
      const client = createClient()
      const res = await stageBookDictCandidates(client, bookId)
      setStageResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : '등재 큐잉 실패')
    } finally {
      setStaging(false)
    }
  }

  // v06.35 — preview == publish. threshold 는 항상 book_v_level (percentile 미사용).
  async function run() {
    setLoading(true)
    setError(null)
    setRows(null)
    setLimit(50)
    setUnbound(null)
    setUnboundLimit(100)
    try {
      const client = createClient()
      const [data, unboundData] = await Promise.all([
        extractBookVocabularyAdmin(client, bookId),
        findUnboundBookLemmas(client, bookId, 5000),
      ])
      setRows(data)
      setUnbound(unboundData)
    } catch (e) {
      setError(e instanceof Error ? e.message : '추출 실패')
    } finally {
      setLoading(false)
    }
  }

  function handleRun() {
    void run()
  }

  const unboundByReason = (() => {
    if (!unbound) return null
    const map = new Map<UnboundReason, number>()
    for (const r of unbound) {
      map.set(r.reason, (map.get(r.reason) ?? 0) + 1)
    }
    return map
  })()

  // 추출기 freq_external_a 클러스터로 base 에 회수되는 lemma — reason 과 무관.
  // 진단상 genuine_miss/noise 로 보여도 추출 시 base 단어로 surface 되므로 seed 우선순위 낮음.
  const clusterRecoverable = unbound?.filter((r) => r.cluster_base) ?? []
  const clusterRecoverableMiss = clusterRecoverable.filter(
    (r) => r.reason === 'genuine_miss',
  ).length

  const visible = rows ? rows.slice(0, limit) : []
  const visibleUnbound = unbound ? unbound.slice(0, unboundLimit) : []

  return (
    <section
      aria-labelledby="extract-panel-title"
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="extract-panel-title"
            className="font-display text-[14px] font-[700] text-[var(--t1)]"
          >
            학습 단어 추출 — 미리보기 = 실제 발행
          </h2>
          <p className="mt-0.5 font-body text-[12px] text-[var(--t3)]">
            book_v_level{bookVLevel != null ? ` V${bookVLevel}` : ''} 이상 · 📜 고어·🏛 시대어
            제외(본문 툴팁으로) · composite = freq_boost 0.70 + 챕터 salience 0.10 + skill
            penalty · 발행 단어장과 동일 결과·순서
          </p>
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--ti)] hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" aria-hidden />
          ) : (
            <Zap size={12} aria-hidden />
          )}
          {loading ? '추출 중…' : '추출'}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[var(--r-sm)] border border-[var(--learn-error)] bg-[var(--learn-error-light)] p-3 font-body text-[12px] text-[var(--learn-error)]"
        >
          <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {meta && (
        <div className="grid grid-cols-2 gap-2 rounded-[var(--r-sm)] bg-[var(--bg2)] p-3 sm:grid-cols-4">
          <MetaCell label="발행 기준" value={`≥ V${meta.v_threshold}`} />
          <MetaCell label="book_v_level" value={`V${meta.book_v_level}`} />
          <MetaCell label="챕터" value={`${chapterCount}개`} />
          <MetaCell label="단어 (챕터×단어)" value={`${meta.total_candidates}개`} />
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--r-sm)] border border-[var(--bd)]">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[var(--bg2)] text-[11px] font-[700] uppercase tracking-wider text-[var(--t3)]">
              <tr>
                <Th>#</Th>
                <Th className="text-right">Ch</Th>
                <Th>단어</Th>
                <Th>뜻</Th>
                <Th className="text-right">V</Th>
                <Th className="text-right">freq</Th>
                <Th className="text-right">score</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={`${r.chapter_idx}-${r.word}`}
                  className="border-t border-[var(--bd)] font-body text-[12px] text-[var(--t1)] hover:bg-[var(--bg2)]"
                >
                  <Td className="font-mono text-[var(--t3)]">{r.rank}</Td>
                  <Td className="text-right font-mono text-[var(--t3)]">{r.chapter_idx}</Td>
                  <Td className="font-display font-[600]">
                    <span className="inline-flex items-center gap-1.5">
                      {r.word}
                      <RegisterBadge register={r.word_register} />
                      {r.match_via === 'spelling_variant' && (
                        <span
                          title={`철자 변형 회수: ${r.matched_from} → ${r.word}`}
                          className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--active-light)] px-1.5 font-mono text-[9px] font-[700] text-[var(--active)]"
                        >
                          {r.matched_from}→
                        </span>
                      )}
                    </span>
                  </Td>
                  <Td className="text-[var(--t2)]">{r.meaning_ko ?? '—'}</Td>
                  <Td className="text-right font-mono">V{r.v_level}</Td>
                  <Td className="text-right font-mono text-[var(--t3)]">
                    {r.frequency_rank ?? '—'}
                  </Td>
                  <Td className="text-right font-mono">{r.composite_score}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length > 50 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-[var(--bd)] bg-[var(--bg2)] p-2">
              {rows.length > limit && (
                <>
                  <button
                    type="button"
                    onClick={() => setLimit((n) => n + 50)}
                    className="font-display text-[12px] font-[600] text-[var(--p)] hover:underline"
                  >
                    다음 50개 보기 ({rows.length - limit}개 남음)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLimit(rows.length)}
                    className="font-display text-[12px] font-[600] text-[var(--p)] hover:underline"
                  >
                    전체 보기 (총 {rows.length}개)
                  </button>
                </>
              )}
              {limit > 50 && rows.length <= limit && (
                <button
                  type="button"
                  onClick={() => setLimit(50)}
                  className="font-display text-[12px] font-[600] text-[var(--t3)] hover:underline"
                >
                  접기 (50개만 보기)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="font-body text-[12px] text-[var(--t3)]">
          이 percentile 에서는 추출할 단어가 없어요.
        </p>
      )}

      {unbound && unbound.length > 0 && (
        <section
          aria-labelledby="unbound-title"
          className="mt-2 flex flex-col gap-2 rounded-[var(--r-sm)] border border-[var(--learn-error)]/30 bg-[var(--learn-error-light)]/40 p-3"
        >
          <header className="flex items-baseline justify-between gap-2">
            <h3
              id="unbound-title"
              className="font-display text-[12px] font-[700] text-[var(--learn-error)]"
            >
              사전 미바인딩 단어 ({unbound.length}건)
            </h3>
            <span className="font-body text-[11px] text-[var(--t3)]">
              추출에서 제외된 lemma — 원인 진단용
            </span>
          </header>

          {unboundByReason && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(unboundByReason.entries()).map(([reason, count]) => (
                <span
                  key={reason}
                  title={REASON_HINT[reason]}
                  className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[10px] text-[var(--t2)]"
                >
                  {REASON_LABEL[reason]}
                  <strong className="text-[var(--t1)]">{count}</strong>
                </span>
              ))}
              {clusterRecoverable.length > 0 && (
                <span
                  title={
                    'freq_external_a 굴절 클러스터상 base(예: ax→axe·twas→be)가 있는 lemma. ' +
                    '추출기는 클러스터 경로를 쓰지 않으므로 현재 추출(매핑)에서 제외됨. ' +
                    'base 가 대부분 V1 기능어(be·hello·have·they)라 학습 후보 아님 → seed 불필요(genuine miss 아님). ' +
                    `(이 중 genuine_miss ${clusterRecoverableMiss}건)`
                  }
                  className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--info)]/40 bg-[var(--info-light)] px-2 py-0.5 font-mono text-[10px] text-[var(--info)]"
                >
                  ↻ 클러스터 회수
                  <strong>{clusterRecoverable.length}</strong>
                </span>
              )}
            </div>
          )}

          {/* 사전 등재 프로세스 — 미등재 실단어를 등재 큐(addable_modern)로 올림.
              뜻 생성·등재는 Claude Code 배치가 처리 (런타임 LLM 키 불요). */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--bd)] pt-2">
            <button
              type="button"
              onClick={handleStage}
              disabled={staging}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p-light)] px-3 font-display text-[12px] font-[600] text-[var(--p)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p)] hover:text-[var(--ti)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {staging ? (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              ) : (
                <BookPlus size={13} aria-hidden />
              )}
              미등재 실단어 사전 등재 큐에 추가
            </button>
            {stageResult ? (
              <span className="font-body text-[11px] text-[var(--t2)]">
                <strong className="text-[var(--t1)]">{stageResult.already_addable}건</strong> 등재
                대기 (이번 +{stageResult.staged}) · Claude Code 배치가 뜻 생성·등재 후 재추출 시 반영
              </span>
            ) : (
              <span className="font-body text-[11px] text-[var(--t3)]">
                실단어를 등재 큐로 올립니다 — 뜻 생성·사전 등재는 Claude Code 배치가 처리
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[var(--bg2)] text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]">
                <tr>
                  <Th className="text-right">#</Th>
                  <Th>lemma</Th>
                  <Th>사유</Th>
                  <Th>사전 표제어</Th>
                  <Th>클러스터 base</Th>
                  <Th>굴절 base</Th>
                  <Th>파생 base</Th>
                  <Th className="text-right">빈도</Th>
                  <Th>dict V</Th>
                  <Th>dict 뜻</Th>
                  <Th>분류자</Th>
                  <Th>분류</Th>
                </tr>
              </thead>
              <tbody>
                {visibleUnbound.map((r, i) => (
                  <tr
                    key={r.lemma}
                    className="border-t border-[var(--bd)] font-body text-[11px] text-[var(--t1)]"
                  >
                    <Td className="text-right font-mono text-[10px] tabular-nums text-[var(--t3)]">
                      {i + 1}
                    </Td>
                    <Td className="font-display font-[600]">{r.lemma}</Td>
                    <Td title={REASON_HINT[r.reason]}>
                      <span
                        className={
                          'font-mono text-[10px] ' +
                          (r.reason === 'spelling_variant'
                            ? 'text-[var(--active)]'
                            : r.reason === 'genuine_miss'
                              ? 'text-[var(--learn-error)]'
                              : 'text-[var(--t3)]')
                        }
                      >
                        {REASON_LABEL[r.reason]}
                      </span>
                    </Td>
                    <Td className="font-mono text-[10px] text-[var(--active)]">
                      {r.variant_hit ?? '—'}
                    </Td>
                    <Td className="font-mono text-[10px]">
                      {r.cluster_base ? (
                        <span
                          title={`클러스터상 base='${r.cluster_base}'. 추출기는 클러스터 미사용 → 현재 추출 제외. base 가 사전에 있어 genuine miss 아님 (seed 불필요)`}
                          className="inline-flex items-center gap-0.5 text-[var(--info)]"
                        >
                          ↻ {r.cluster_base}
                        </span>
                      ) : (
                        <span className="text-[var(--t4)]">—</span>
                      )}
                    </Td>
                    <Td className="font-mono text-[10px]">
                      {r.inflection_base ? (
                        <span
                          title={`굴절 규칙(en_inflection_bases)상 base='${r.inflection_base}' 이 사전에 존재하나 미완성 — 우측 dict V/뜻 확인`}
                          className="inline-flex items-center gap-0.5 text-[var(--warning)]"
                        >
                          굴 {r.inflection_base}
                        </span>
                      ) : (
                        <span className="text-[var(--t4)]">—</span>
                      )}
                    </Td>
                    <Td className="font-mono text-[10px]">
                      {r.deriv_base ? (
                        <span
                          title={`파생 규칙(en_derivational_bases)상 '${r.deriv_base}' 의 파생형 — seed 후보`}
                          className="inline-flex items-center gap-0.5 text-[var(--p)]"
                        >
                          파 {r.deriv_base}
                        </span>
                      ) : (
                        <span className="text-[var(--t4)]">—</span>
                      )}
                    </Td>
                    <Td className="text-right font-mono text-[var(--t3)]">
                      {r.book_occurrences}
                    </Td>
                    <Td className="font-mono text-[var(--t3)]">
                      {r.dict_v_level != null ? `V${r.dict_v_level}` : '—'}
                    </Td>
                    <Td className="max-w-[200px] truncate text-[var(--t2)]">
                      {r.dict_meaning_ko ?? '—'}
                    </Td>
                    <Td className="font-mono text-[10px] text-[var(--t3)]">
                      {r.dict_classified_by ?? '—'}
                    </Td>
                    <Td className="font-mono text-[10px]">
                      {r.archaic_class ? (
                        <span
                          title="archaic_candidates classify 파이프라인 분류 상태"
                          className={
                            r.archaic_class === 'addable_modern'
                              ? 'text-[var(--info)]'
                              : r.archaic_class === 'processed'
                                ? 'text-[var(--success)]'
                                : r.archaic_class.endsWith('_noise')
                                  ? 'text-[var(--t3)]'
                                  : 'text-[var(--t2)]'
                          }
                        >
                          {r.archaic_class}
                        </span>
                      ) : (
                        <span className="text-[var(--t4)]">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>

            {unbound.length > 100 && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-[var(--bd)] bg-[var(--bg2)] p-2">
                {unbound.length > unboundLimit && (
                  <>
                    <button
                      type="button"
                      onClick={() => setUnboundLimit((n) => n + 100)}
                      className="font-display text-[12px] font-[600] text-[var(--p)] hover:underline"
                    >
                      다음 100개 보기 ({unbound.length - unboundLimit}개 남음)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnboundLimit(unbound.length)}
                      className="font-display text-[12px] font-[600] text-[var(--p)] hover:underline"
                    >
                      전체 보기 (총 {unbound.length}개)
                    </button>
                  </>
                )}
                {unboundLimit > 100 && unbound.length <= unboundLimit && (
                  <button
                    type="button"
                    onClick={() => setUnboundLimit(100)}
                    className="font-display text-[12px] font-[600] text-[var(--t3)] hover:underline"
                  >
                    접기 (100개만 보기)
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </section>
  )
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">
        {label}
      </span>
      <span className="font-display text-[14px] font-[700] tabular-nums text-[var(--t1)]">
        {value}
      </span>
    </div>
  )
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <th className={`px-3 py-2 ${className}`}>{children}</th>
}

function Td({
  children,
  className = '',
  title,
}: {
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <td className={`px-3 py-2 ${className}`} title={title}>
      {children}
    </td>
  )
}
