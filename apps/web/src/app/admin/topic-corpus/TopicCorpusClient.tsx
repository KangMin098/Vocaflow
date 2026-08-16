// apps/web/src/app/admin/topic-corpus/TopicCorpusClient.tsx
// TCP 콘솔 — 주제별 적재 → 드레인 → 승격.
//
// 드레인은 한 번 호출에 최대 10편만 처리하므로(외부 사이트 예의), 화면이 큐가 마를 때까지
// 반복 호출한다. 진행 상황을 화면에 남기는 이유: 로컬 로그로만 보이면 관리자는 무엇이
// 처리됐는지 알 수 없고, 멈춘 것과 느린 것을 구분하지 못한다.

'use client'

import { Database, Loader2, PlayCircle, Plus, Sparkles } from 'lucide-react'
import { useCallback, useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'

export interface TopicCorpusRow {
  source_id: string
  label_en: string
  label_ko: string
  category_id: string | null
  license: string
  is_active: boolean
  queued: number
  claimed: number
  done: number
  failed: number
  docs: number
  running_words: number
  distinct_words: number
  gap_words: number
  promoted: number
  last_harvest: string | null
}

interface LogLine {
  at: string
  text: string
  tone: 'info' | 'ok' | 'warn'
}

/** 승격 임계값 기본값 — RPC 기본값과 같은 수치를 화면에도 명시한다. */
const DEFAULT_MIN_DOC_FREQ = 3
const DEFAULT_MIN_SALIENCE = 1.0

export function TopicCorpusClient({
  rows,
  loadError,
}: {
  rows: TopicCorpusRow[]
  loadError: string | null
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [log, setLog] = useState<LogLine[]>([])
  const [minDocFreq, setMinDocFreq] = useState(DEFAULT_MIN_DOC_FREQ)
  const [minSalience, setMinSalience] = useState(DEFAULT_MIN_SALIENCE)

  const push = useCallback((text: string, tone: LogLine['tone'] = 'info') => {
    setLog((prev) =>
      [{ at: new Date().toLocaleTimeString('ko-KR'), text, tone }, ...prev].slice(0, 60),
    )
  }, [])

  const enqueue = useCallback(
    async (sourceId: string) => {
      setBusy(sourceId)
      try {
        const res = await fetch('/api/topic-corpus/enqueue', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceId, discover: true }),
        })
        const json = await res.json()
        if (!res.ok) {
          push(`${sourceId} 적재 실패 — ${json.message ?? res.status}`, 'warn')
          return
        }
        push(
          `${sourceId} 후보 ${json.candidates} · 신규 ${json.newly_queued} 적재` +
            (json.coverage_gap ? ` · 미수집 ${json.coverage_gap}편 남음` : ''),
          'ok',
        )
        if (json.coverage_gap) {
          push(
            `${sourceId} — TED 총 ${json.ted_total_count}편 중 주제 페이지가 노출한 ${json.candidates}편만 담겼다. 전량은 URL 목록 직접 제공이 필요하다.`,
            'warn',
          )
        }
      } catch (err) {
        push(`${sourceId} 적재 오류 — ${String(err)}`, 'warn')
      } finally {
        setBusy(null)
      }
    },
    [push],
  )

  const drain = useCallback(
    async (sourceId: string) => {
      setBusy(sourceId)
      try {
        // 큐가 마를 때까지 반복. 상한을 둬 무한 루프를 만들지 않는다.
        for (let round = 1; round <= 200; round += 1) {
          const res = await fetch('/api/topic-corpus/drain', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sourceId, max: 10 }),
          })
          const json = await res.json()
          if (!res.ok) {
            push(`${sourceId} 드레인 실패 — ${json.message ?? res.status}`, 'warn')
            return
          }
          if (json.claimed === 0) {
            push(`${sourceId} 큐가 비었습니다.`, 'ok')
            return
          }
          push(
            `${sourceId} #${round} — 수확 ${json.harvested} · 건너뜀 ${json.skipped} · 실패 ${json.failed}`,
            json.failed > 0 ? 'warn' : 'info',
          )
          if (json.drained) {
            push(`${sourceId} 드레인 완료.`, 'ok')
            return
          }
        }
        push(`${sourceId} 반복 상한 도달 — 남은 큐가 있으면 다시 실행하세요.`, 'warn')
      } catch (err) {
        push(`${sourceId} 드레인 오류 — ${String(err)}`, 'warn')
      } finally {
        setBusy(null)
      }
    },
    [push],
  )

  const promote = useCallback(
    async (sourceId: string, apply: boolean) => {
      setBusy(sourceId)
      try {
        const res = await fetch('/api/topic-corpus/promote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceId, minDocFreq, minSalience, apply }),
        })
        const json = await res.json()
        if (!res.ok) {
          push(`${sourceId} 승격 실패 — ${json.message ?? res.status}`, 'warn')
          return
        }
        if (json.note) {
          push(`${sourceId} — ${json.note}`, 'warn')
          return
        }
        push(
          apply
            ? `${sourceId} → ${json.category_id} 에 ${json.applied}개 승격 완료`
            : `${sourceId} → ${json.category_id} 승격 대상 ${json.eligible}개 (미적용)`,
          'ok',
        )
      } catch (err) {
        push(`${sourceId} 승격 오류 — ${String(err)}`, 'warn')
      } finally {
        setBusy(null)
      }
    },
    [push, minDocFreq, minSalience],
  )

  const totals = rows.reduce(
    (acc, r) => ({
      queued: acc.queued + r.queued,
      docs: acc.docs + r.docs,
      words: acc.words + r.distinct_words,
      gaps: acc.gaps + Number(r.gap_words ?? 0),
      promoted: acc.promoted + r.promoted,
    }),
    { queued: 0, docs: 0, words: 0, gaps: 0, promoted: 0 },
  )

  return (
    <div className="flex flex-col gap-s-5 p-s-5">
      <header className="flex flex-wrap items-center gap-s-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-t1">
            주제 코퍼스 (TCP)
          </h1>
          <p className="mt-s-1 font-body text-sm text-t2">
            주제별 어휘를 관측해 사전 주제 분류로 승격합니다. 원문은 저장하지 않습니다.
          </p>
        </div>
        <AdminScreenHelp screen="topic-corpus" />
      </header>

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-error bg-error-light px-s-4 py-s-3 font-body text-sm text-error"
        >
          현황을 불러오지 못했습니다 — {loadError}
          <br />
          <span className="text-t2">
            마이그레이션 <code>20260816160000_topic_corpus_ingest.sql</code> 적용 전이면 이 오류가
            정상입니다.
          </span>
        </div>
      )}

      {/* 합계 */}
      <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-5">
        {[
          { label: '대기', value: totals.queued, Icon: Database },
          { label: '수확 문서', value: totals.docs, Icon: PlayCircle },
          { label: '관측 단어', value: totals.words, Icon: Sparkles },
          { label: '사전 갭', value: totals.gaps, Icon: Plus },
          { label: '승격', value: totals.promoted, Icon: Sparkles },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border border-bd bg-bg2 px-s-4 py-s-3">
            <div className="flex items-center gap-s-2 font-mono text-[10px] uppercase tracking-wider text-t3">
              <Icon size={12} aria-hidden />
              {label}
            </div>
            <div className="mt-s-1 font-display text-2xl font-bold text-t1">
              {value.toLocaleString('ko-KR')}
            </div>
          </div>
        ))}
      </div>

      {/* 승격 임계값 */}
      <div className="flex flex-wrap items-end gap-s-4 rounded-xl border border-bd bg-bg2 px-s-4 py-s-3">
        <div className="flex flex-col gap-s-1">
          <label
            htmlFor="tcp-doc-freq"
            className="font-mono text-[10px] uppercase tracking-wider text-t3"
          >
            최소 등장 글 수
          </label>
          <input
            id="tcp-doc-freq"
            type="number"
            min={1}
            max={50}
            value={minDocFreq}
            onChange={(e) => setMinDocFreq(Math.max(1, Number(e.target.value) || 1))}
            className="h-11 w-28 rounded-lg border border-bd bg-bg px-s-3 font-mono text-sm text-t1 transition-colors duration-normal focus:border-bdf focus:outline-none focus:ring-2 focus:ring-p/20"
          />
        </div>
        <div className="flex flex-col gap-s-1">
          <label
            htmlFor="tcp-salience"
            className="font-mono text-[10px] uppercase tracking-wider text-t3"
          >
            두드러짐 하한
          </label>
          <input
            id="tcp-salience"
            type="number"
            step={0.1}
            min={0}
            max={10}
            value={minSalience}
            onChange={(e) => setMinSalience(Math.max(0, Number(e.target.value) || 0))}
            className="h-11 w-28 rounded-lg border border-bd bg-bg px-s-3 font-mono text-sm text-t1 transition-colors duration-normal focus:border-bdf focus:outline-none focus:ring-2 focus:ring-p/20"
          />
        </div>
        <p className="flex-1 font-body text-xs text-t3">
          하한 1.0 ≈ 배경 대비 2.7배 과대표집. 승격은 없는 링크를 추가할 뿐이며 기존 분류를
          덮어쓰지 않습니다.
        </p>
      </div>

      {/* 소스 표 */}
      <div className="overflow-x-auto rounded-xl border border-bd">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b border-bd bg-bg2 font-mono text-[10px] uppercase tracking-wider text-t3">
              <th className="px-s-3 py-s-2">주제</th>
              <th className="px-s-3 py-s-2">승격 대상 카테고리</th>
              <th className="px-s-3 py-s-2 text-right">대기</th>
              <th className="px-s-3 py-s-2 text-right">수확</th>
              <th className="px-s-3 py-s-2 text-right">단어</th>
              <th className="px-s-3 py-s-2 text-right">갭</th>
              <th className="px-s-3 py-s-2 text-right">실패</th>
              <th className="px-s-3 py-s-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-s-3 py-s-6 text-center font-body text-sm text-t3">
                  등록된 코퍼스 소스가 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.source_id} className="border-b border-bd last:border-0">
                <td className="px-s-3 py-s-3">
                  <div className="font-display text-sm font-semibold text-t1">{r.label_ko}</div>
                  <div className="font-mono text-[10px] text-t3">{r.source_id}</div>
                </td>
                <td className="px-s-3 py-s-3 font-mono text-[11px] text-t2">
                  {r.category_id ?? '— (통계만)'}
                </td>
                <td className="px-s-3 py-s-3 text-right font-mono text-sm text-t1">
                  {r.queued.toLocaleString('ko-KR')}
                  {r.claimed > 0 && <span className="text-t3"> +{r.claimed}</span>}
                </td>
                <td className="px-s-3 py-s-3 text-right font-mono text-sm text-t1">
                  {r.docs.toLocaleString('ko-KR')}
                </td>
                <td className="px-s-3 py-s-3 text-right font-mono text-sm text-t1">
                  {r.distinct_words.toLocaleString('ko-KR')}
                </td>
                <td className="px-s-3 py-s-3 text-right font-mono text-sm text-t2">
                  {Number(r.gap_words ?? 0).toLocaleString('ko-KR')}
                </td>
                <td
                  className={[
                    'px-s-3 py-s-3 text-right font-mono text-sm',
                    r.failed > 0 ? 'text-error' : 'text-t3',
                  ].join(' ')}
                >
                  {r.failed.toLocaleString('ko-KR')}
                </td>
                <td className="px-s-3 py-s-3">
                  <div className="flex flex-wrap gap-s-1">
                    <ActionButton
                      onClick={() => enqueue(r.source_id)}
                      disabled={busy !== null}
                      busy={busy === r.source_id}
                      label="적재"
                    />
                    <ActionButton
                      onClick={() => drain(r.source_id)}
                      disabled={busy !== null || r.queued === 0}
                      busy={busy === r.source_id}
                      label="드레인"
                    />
                    <ActionButton
                      onClick={() => promote(r.source_id, false)}
                      disabled={busy !== null || r.distinct_words === 0}
                      busy={busy === r.source_id}
                      label="미리보기"
                    />
                    <ActionButton
                      onClick={() => promote(r.source_id, true)}
                      disabled={busy !== null || r.distinct_words === 0}
                      busy={busy === r.source_id}
                      label="승격"
                      primary
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 진행 로그 */}
      <section className="rounded-xl border border-bd bg-bg2 p-s-4">
        <h2 className="mb-s-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-t3">
          진행 기록
        </h2>
        {log.length === 0 ? (
          <p className="font-body text-sm text-t3">아직 실행한 작업이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-s-1">
            {log.map((l, i) => (
              <li
                key={`${l.at}-${i}`}
                className={[
                  'font-mono text-[11px]',
                  l.tone === 'ok' ? 'text-success' : l.tone === 'warn' ? 'text-error' : 'text-t2',
                ].join(' ')}
              >
                <span className="text-t3">{l.at}</span> {l.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ActionButton({
  onClick,
  disabled,
  busy,
  label,
  primary,
}: {
  onClick: () => void
  disabled: boolean
  busy: boolean
  label: string
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex h-11 items-center gap-s-1 rounded-md border px-s-3 font-display text-[12px] font-semibold transition-all duration-normal',
        primary
          ? 'border-p bg-p text-ti hover:bg-p-hover'
          : 'border-bd bg-bg text-t2 hover:border-p hover:text-p',
        'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40',
      ].join(' ')}
    >
      {busy && <Loader2 size={12} className="animate-spin" aria-hidden />}
      {label}
    </button>
  )
}
