// apps/web/src/app/admin/quality/gates/GateCheckClient.tsx
//
// 콘텐츠별 게시 전 게이트 — 도서/아티클 선택 → run_content_quality_gates(book|article, id)
// → 그 콘텐츠의 불변식 red/green. 게시 전 "이거 학습자에게 내보내도 되나?" 신뢰 확인.

'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export interface BookOpt {
  id: string
  title: string
  book_v_level: number | null
  status: string
}
export interface ArticleOpt {
  id: string
  title: string
  register: string | null
  status: string
}

/** 미발행 상태 뱃지 — 게시 전 검증 대상임을 표시 */
function statusTag(s: string): string {
  return s === 'published' ? '' : `[${s}] `
}

interface GateRow {
  pipeline: string
  invariant: string
  severity: 'critical' | 'warning'
  fail_count: number
  verdict: 'PASS' | 'FAIL' | 'WARN'
}

interface GateDetail {
  invariant: string
  word: string
  meaning_shown: string | null
  issue: string
  fix_hint: string | null
}

const V: Record<string, { bg: string; fg: string }> = {
  PASS: { bg: 'bg-[#2E7D5A]/10', fg: 'text-[#2E7D5A]' },
  FAIL: { bg: 'bg-[#9C3A30]/12', fg: 'text-[#9C3A30]' },
  WARN: { bg: 'bg-[#B5803A]/12', fg: 'text-[#B5803A]' },
}

export function GateCheckClient({ books, articles }: { books: BookOpt[]; articles: ArticleOpt[] }) {
  const [kind, setKind] = useState<'book' | 'article'>('book')
  const [bookId, setBookId] = useState(books[0]?.id ?? '')
  const [articleId, setArticleId] = useState(articles[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<GateRow[] | null>(null)
  const [details, setDetails] = useState<GateDetail[] | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  async function run() {
    setLoading(true)
    setError(null)
    setDetails(null)
    try {
      const client = createClient() as unknown as SupabaseClient
      const { data, error: e } = await client.rpc('run_content_quality_gates', {
        p_scope: kind,
        p_id: kind === 'book' ? bookId : articleId,
      })
      if (e) throw e
      setRows((data ?? []) as GateRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : '게이트 실행 실패')
      setRows(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadDetails() {
    setDetailsLoading(true)
    setError(null)
    try {
      const client = createClient() as unknown as SupabaseClient
      const { data, error: e } = await client.rpc('run_content_quality_gate_details', {
        p_scope: kind,
        p_id: kind === 'book' ? bookId : articleId,
      })
      if (e) throw e
      setDetails((data ?? []) as GateDetail[])
    } catch (err) {
      setError(err instanceof Error ? err.message : '상세 조회 실패')
    } finally {
      setDetailsLoading(false)
    }
  }

  const criticalFails = (rows ?? []).filter((r) => r.severity === 'critical' && r.verdict === 'FAIL')
  const safe = rows !== null && criticalFails.length === 0

  return (
    <section className="space-y-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6">
      <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">콘텐츠별 게시 전 체크</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(['book', 'article'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k)
                setRows(null)
              }}
              className={`rounded-[var(--r-md)] border px-3 py-2 font-display text-[13px] font-[600] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] ${
                kind === k
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#8B5CF6]'
                  : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:text-[var(--t1)]'
              }`}
            >
              {k === 'book' ? '도서' : '아티클'}
            </button>
          ))}
        </div>
        {kind === 'book' ? (
          <select
            value={bookId}
            onChange={(e) => {
              setBookId(e.target.value)
              setRows(null)
            }}
            className="min-w-[240px] flex-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[14px] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {statusTag(b.status)}
                {b.title} (V{b.book_v_level ?? '?'})
              </option>
            ))}
          </select>
        ) : (
          <select
            value={articleId}
            onChange={(e) => {
              setArticleId(e.target.value)
              setRows(null)
            }}
            className="min-w-[240px] flex-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-body text-[14px] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
          >
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {statusTag(a.status)}
                {a.title.slice(0, 70)}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={run}
          disabled={loading || (kind === 'book' ? !bookId : !articleId)}
          className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[#8B5CF6] px-4 py-2 font-display text-[13px] font-[600] text-white transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[#7c4ff0] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          게이트 실행
        </button>
      </div>

      {error && (
        <p role="alert" className="font-body text-[13px] text-[#9C3A30]">
          {error}
        </p>
      )}

      {rows !== null && (
        <div className="space-y-2">
          <p
            className={`rounded-[var(--r-md)] px-4 py-3 font-display text-[14px] font-[700] ${
              safe ? 'bg-[#2E7D5A]/10 text-[#2E7D5A]' : 'bg-[#9C3A30]/10 text-[#9C3A30]'
            }`}
          >
            {safe
              ? '✓ 게시 신뢰 가능 — critical 불변식 전부 통과'
              : `✕ 게시 차단 후보 — critical FAIL ${criticalFails.length}건`}
          </p>
          <ul className="space-y-1.5">
            {rows
              .sort((a, b) => (a.verdict === 'PASS' ? 1 : 0) - (b.verdict === 'PASS' ? 1 : 0))
              .map((r) => (
                <li
                  key={r.pipeline + r.invariant}
                  className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className={`rounded-[var(--r-sm)] px-2 py-1 font-mono text-[10px] font-[700] ${V[r.verdict].bg} ${V[r.verdict].fg}`}>
                      {r.verdict}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--t2)]">{r.pipeline}</span>
                    <span className="font-body text-[13px] text-[var(--t1)]">{r.invariant}</span>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--t2)]">
                    {r.verdict === 'PASS' ? '0' : `${r.fail_count}건`}
                  </span>
                </li>
              ))}
          </ul>

          {/* 원인 분석 드릴다운 — critical FAIL 시 문제 단어 + 이유 + 고칠 힌트 */}
          {criticalFails.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-[var(--bd)] pt-3">
              {details === null ? (
                <button
                  type="button"
                  onClick={loadDetails}
                  disabled={detailsLoading}
                  className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[#9C3A30]/40 bg-[#9C3A30]/8 px-3 py-2 font-display text-[12px] font-[600] text-[#9C3A30] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[#9C3A30]/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C3A30] disabled:opacity-50"
                >
                  {detailsLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                  상세 원인 보기 (문제 단어)
                </button>
              ) : details.length === 0 ? (
                <p className="font-body text-[12px] text-[var(--t2)]">
                  단어 레벨 상세 없음 — 파이프라인 레벨 FAIL(레벨·register·드리프트)은 상단 요약과
                  §5 대응표(런북) 참조.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {details.map((d, i) => (
                    <li key={`${d.invariant}-${d.word}-${i}`} className="rounded-[var(--r-sm)] bg-[#9C3A30]/6 px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="rounded-[var(--r-sm)] bg-[#9C3A30]/12 px-2 py-1 font-mono text-[10px] text-[#9C3A30]">
                          {d.invariant}
                        </span>
                        <span className="font-display text-[14px] font-[700] text-[var(--t1)]">{d.word}</span>
                        {d.meaning_shown && (
                          <span className="font-body text-[12px] text-[var(--t2)]">{d.meaning_shown}</span>
                        )}
                      </div>
                      <p className="mt-0.5 font-body text-[12px] text-[#9C3A30]">{d.issue}</p>
                      {d.fix_hint && (
                        <p className="font-mono text-[10px] text-[var(--t2)]">→ 고침: {d.fix_hint}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
