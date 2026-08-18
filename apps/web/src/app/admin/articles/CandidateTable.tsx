// apps/web/src/app/admin/articles/CandidateTable.tsx
// ACP §18 P3 — 소스 GET 후보 테이블 (② 뷰).
//
// 수집된 후보(library_article_seed_catalog)를 score 순으로 보여주고, 다중 선택 → 큐 import.
// 정렬·뱃지는 SourcePolicy 분기:
//   · supply='static'(VOA frozen) → "recency 미적용 · 정렬 source·length"
//   · supply='live'               → "recency 반영"
//   · media='audio'               → audio 컬럼(🔊/🔇) / 'text' → "—"
// register·CEFR·V 는 ingest+analyze 후 산출 — 후보 단계엔 없음(추측 금지 → "—" 표시).

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Volume2, VolumeX } from 'lucide-react'

import type { SeedListRow } from '@/lib/acp/seed-upsert'
import { useSourcePolicy, SUPPLY_LABEL } from '@/lib/articles/use-source-policy'

interface Props {
  source: string
  onImported: () => void
}

const GRID = 'grid grid-cols-[38px_1fr_110px_96px_130px_64px] items-center gap-2'

export function CandidateTable({ source, onImported }: Props) {
  const policy = useSourcePolicy(source)
  const [items, setItems] = useState<SeedListRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelected(new Set())
    try {
      const res = await fetch(
        `/api/admin/articles/seed-list?source=${encodeURIComponent(source)}&includeImported=false&limit=200`,
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? '후보를 불러오지 못했습니다.')
        return
      }
      setItems((data.items ?? []) as SeedListRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류')
    } finally {
      setLoading(false)
    }
  }, [source])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (id: string): void =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  async function importSelected(): Promise<void> {
    const picks = items.filter((it) => selected.has(it.source_id))
    if (picks.length === 0) return
    setImporting(true)
    try {
      let ok = 0
      for (const it of picks) {
        try {
          const res = await fetch('/api/acp/enqueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feed_id: it.feed_id, item_url: it.source_url }),
          })
          const d = (await res.json().catch(() => ({}))) as { ok?: boolean }
          if (res.ok && d.ok) ok += 1
        } catch {
          /* 개별 실패는 건너뜀 — 아래 재로드로 실제 반영분 확인 */
        }
      }
      await load()
      if (ok > 0) onImported()
    } finally {
      setImporting(false)
    }
  }

  const selectedCount = selected.size

  return (
    <section aria-label="수집 후보" className="flex flex-col gap-2">
      {/* cbar — 후보 수 + supply 뱃지 (정렬 규칙 분기) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-[var(--t2)]">
          후보 {items.length}건 · score 순
        </span>
        <span
          className="rounded-[var(--r-full)] border border-[var(--bd)] px-2.5 py-1 font-mono text-[10px] font-[600]"
          style={
            policy.supply === 'static'
              ? { backgroundColor: 'var(--learn-fresh-light)', color: 'var(--learn-fresh)' }
              : { backgroundColor: 'var(--bg2)', color: 'var(--t3)' }
          }
        >
          {policy.supply === 'static'
            ? `${SUPPLY_LABEL.static} · 정렬 source·length`
            : SUPPLY_LABEL.live}
        </span>
      </div>

      {loading ? (
        <CandidateSkeleton />
      ) : error ? (
        <div
          role="alert"
          className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--learn-error-light)] px-3 py-2 font-body text-[12px] text-[var(--learn-error)]"
        >
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-3 py-8 text-center font-body text-[12px] text-[var(--t2)]">
          이 소스의 미import 후보가 없어요. 아래 라이브 RSS 또는 대량 GET 으로 수집하세요.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)]">
          {/* 헤더행 */}
          <div
            className={`${GRID} border-b border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]`}
          >
            <span aria-hidden />
            <span>제목 · feed</span>
            <span>register</span>
            <span>CEFR · V</span>
            <span>score</span>
            <span className="text-center">audio</span>
          </div>

          <ul role="list">
            {items.map((it) => {
              const isSel = selected.has(it.source_id)
              return (
                <li key={it.source_id}>
                  <button
                    type="button"
                    onClick={() => toggle(it.source_id)}
                    aria-pressed={isSel}
                    className={`${GRID} w-full border-t border-[var(--bd)] px-3 py-2 text-left transition-colors first:border-t-0 hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p)]`}
                    style={isSel ? { backgroundColor: 'var(--learn-known-light)' } : undefined}
                  >
                    {/* 체크박스 */}
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-[4px] border"
                      style={{
                        borderColor: isSel ? 'var(--learn-known)' : 'var(--bd)',
                        backgroundColor: isSel ? 'var(--learn-known)' : 'transparent',
                      }}
                      aria-hidden
                    >
                      {isSel && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="var(--ti)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {/* 제목 · feed */}
                    <span className="min-w-0">
                      <span className="line-clamp-1 font-display text-[13px] font-[600] text-[var(--t1)]">
                        {it.title}
                      </span>
                      <span className="line-clamp-1 font-mono text-[10px] text-[var(--t2)]">
                        {it.feed_label ?? it.feed_id ?? '—'}
                      </span>
                    </span>
                    {/* register — 분석 전 */}
                    <span className="font-mono text-[10px] text-[var(--t2)]">분석 전</span>
                    {/* CEFR · V — 분석 전 */}
                    <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">—</span>
                    {/* score 막대 */}
                    <ScoreBar value={it.score_total ?? 0} />
                    {/* audio (policy.media) */}
                    <span className="flex items-center justify-center">
                      <AudioCell hasAudio={it.has_audio} media={policy.media} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 하단 import 카운터 */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={importSelected}
          disabled={selectedCount === 0 || importing}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Plus size={13} aria-hidden />}
          큐에 추가 ({selectedCount})
        </button>
      </div>
    </section>
  )
}

function AudioCell({ hasAudio, media }: { hasAudio: boolean; media: 'audio' | 'text' }) {
  if (media !== 'audio') {
    return <span className="font-mono text-[11px] text-[var(--t2)]" aria-label="audio 비대상">—</span>
  }
  return hasAudio ? (
    <Volume2 size={15} className="text-[var(--learn-known)]" aria-label="audio 있음" />
  ) : (
    <VolumeX size={15} className="text-[var(--learn-error)]" aria-label="audio 없음(보류)" />
  )
}

function ScoreBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value))
  const pct = Math.round(v * 100)
  const color = v >= 0.7 ? 'var(--learn-known)' : v >= 0.4 ? 'var(--learn-review)' : 'var(--learn-error)'
  return (
    <span className="flex items-center gap-1.5">
      <span className="block h-1.5 flex-1 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg2)]">
        <span className="block h-full rounded-[var(--r-full)]" style={{ width: `${pct}%`, backgroundColor: color }} />
      </span>
      <span className="w-[30px] text-right font-mono text-[10px] tabular-nums text-[var(--t2)]">
        {v.toFixed(2)}
      </span>
    </span>
  )
}

function CandidateSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]"
        />
      ))}
    </div>
  )
}
