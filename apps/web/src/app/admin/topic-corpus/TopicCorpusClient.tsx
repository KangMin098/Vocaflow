// apps/web/src/app/admin/topic-corpus/TopicCorpusClient.tsx
// TCP 콘솔 — 주제별 적재 → 드레인 → 승격.
//
// 드레인은 한 번 호출에 최대 10편만 처리하므로(외부 사이트 예의), 화면이 큐가 마를 때까지
// 반복 호출한다. 진행 상황을 화면에 남기는 이유: 로컬 로그로만 보이면 관리자는 무엇이
// 처리됐는지 알 수 없고, 멈춘 것과 느린 것을 구분하지 못한다.
//
// ── 두 가지를 고쳤다 (실측 결함) ──
// ① 액션 뒤 `router.refresh()` 가 없어 표가 그대로였다. 다음 단계 버튼의 disabled 가 바로
//    그 표를 보므로(대기 0 → 드레인 잠김, 단어 0 → 승격 잠김), **성공 로그를 보면서도 다음
//    버튼을 못 눌렀다.** 이제 성공한 액션마다 서버 상태를 다시 읽는다.
// ② 승격(apply)은 최대 500단어를 사전 분류에 붙이는 쓰기인데 확인 절차가 없었다. 되돌리기는
//    수동 SQL 뿐이다. 이제 **미리보기(dry-run)를 본 임계값에서만** 승격이 열리고, 실행 전에
//    대상 건수를 보여 주는 확인 단계를 한 번 더 거친다.

'use client'

import { AlertTriangle, Database, Loader2, PlayCircle, Plus, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'

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

/** 미리보기(dry-run) 결과 — 이 값이 있어야 승격이 열린다. */
interface PreviewState {
  eligible: number
  categoryId: string | null
  /** 미리보기를 뽑은 임계값. 지금 입력값과 다르면 그 미리보기는 무효다. */
  minDocFreq: number
  minSalience: number
}

interface EnqueueResponse {
  candidates?: number
  newly_queued?: number
  ted_total_count?: number | null
  coverage_gap?: number | null
  discover_error?: string | null
  message?: string
}

interface DrainResponse {
  claimed?: number
  harvested?: number
  skipped?: number
  failed?: number
  drained?: boolean
  message?: string
}

interface PromoteResponse {
  category_id?: string | null
  eligible?: number
  applied?: number
  note?: string
  message?: string
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
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [log, setLog] = useState<LogLine[]>([])
  const [minDocFreq, setMinDocFreq] = useState(DEFAULT_MIN_DOC_FREQ)
  const [minSalience, setMinSalience] = useState(DEFAULT_MIN_SALIENCE)
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({})
  const [confirming, setConfirming] = useState<string | null>(null)

  const push = useCallback((text: string, tone: LogLine['tone'] = 'info') => {
    setLog((prev) =>
      [{ at: new Date().toLocaleTimeString('ko-KR'), text, tone }, ...prev].slice(0, 60),
    )
  }, [])

  /**
   * 서버 상태를 다시 읽는다. 이게 없으면 표의 수치가 액션 전 값에 머물고,
   * 그 수치를 보는 다음 단계 버튼이 계속 잠긴 채로 남는다.
   */
  const refresh = useCallback(() => {
    startRefresh(() => {
      router.refresh()
    })
  }, [router])

  const enqueue = useCallback(
    async (sourceId: string) => {
      setBusy(sourceId)
      try {
        const res = await fetch('/api/topic-corpus/enqueue', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceId, discover: true }),
        })
        const json = (await res.json()) as EnqueueResponse
        if (!res.ok) {
          push(`${sourceId} 적재 실패 — ${json.message ?? res.status}`, 'warn')
          return
        }
        push(
          `${sourceId} 후보 ${json.candidates ?? 0} · 신규 ${json.newly_queued ?? 0} 적재` +
            (json.coverage_gap ? ` · 미수집 ${json.coverage_gap}편 남음` : ''),
          'ok',
        )
        if (json.coverage_gap) {
          // 총 편수는 provider 가 밝혔을 때만 있다 — 없으면 그 문장을 그리지 않는다.
          // (예전엔 소스를 가리지 않고 "TED 총 undefined편" 이 찍혔다.)
          const total = typeof json.ted_total_count === 'number' ? json.ted_total_count : null
          push(
            total !== null
              ? `${sourceId} — 소스가 밝힌 총 ${total}편 중 목록 페이지가 노출한 ${json.candidates ?? 0}편만 담겼다. 전량은 URL 목록 직접 제공이 필요하다.`
              : `${sourceId} — 목록 페이지가 노출한 ${json.candidates ?? 0}편만 담겼고 ${json.coverage_gap}편이 미수집으로 남았다. 전량은 URL 목록 직접 제공이 필요하다.`,
            'warn',
          )
        }
        refresh()
      } catch (err) {
        push(`${sourceId} 적재 오류 — ${String(err)}`, 'warn')
      } finally {
        setBusy(null)
      }
    },
    [push, refresh],
  )

  const drain = useCallback(
    async (sourceId: string) => {
      setBusy(sourceId)
      let progressed = false
      try {
        // 큐가 마를 때까지 반복. 상한을 둬 무한 루프를 만들지 않는다.
        for (let round = 1; round <= 200; round += 1) {
          const res = await fetch('/api/topic-corpus/drain', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sourceId, max: 10 }),
          })
          const json = (await res.json()) as DrainResponse
          if (!res.ok) {
            push(`${sourceId} 드레인 실패 — ${json.message ?? res.status}`, 'warn')
            return
          }
          if (json.claimed === 0) {
            push(`${sourceId} 큐가 비었습니다.`, 'ok')
            return
          }
          progressed = true
          push(
            `${sourceId} #${round} — 수확 ${json.harvested ?? 0} · 건너뜀 ${json.skipped ?? 0} · 실패 ${json.failed ?? 0}`,
            (json.failed ?? 0) > 0 ? 'warn' : 'info',
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
        // 한 편이라도 처리했으면 단어·대기 수치가 바뀌었다 — 승격 버튼의 잠금이 여기에 달려 있다.
        if (progressed) refresh()
      }
    },
    [push, refresh],
  )

  /** 미리보기 — 아무것도 쓰지 않는다. 결과를 기억해 두어야 승격이 열린다. */
  const preview = useCallback(
    async (sourceId: string) => {
      setBusy(sourceId)
      try {
        const res = await fetch('/api/topic-corpus/promote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceId, minDocFreq, minSalience, apply: false }),
        })
        const json = (await res.json()) as PromoteResponse
        if (!res.ok) {
          push(`${sourceId} 미리보기 실패 — ${json.message ?? res.status}`, 'warn')
          return
        }
        if (json.note) {
          push(`${sourceId} — ${json.note}`, 'warn')
          return
        }
        const eligible = json.eligible ?? 0
        setPreviews((prev) => ({
          ...prev,
          [sourceId]: {
            eligible,
            categoryId: json.category_id ?? null,
            minDocFreq,
            minSalience,
          },
        }))
        push(
          `${sourceId} → ${json.category_id ?? '(카테고리 없음)'} 승격 대상 ${eligible}개 (미적용)`,
          'ok',
        )
      } catch (err) {
        push(`${sourceId} 미리보기 오류 — ${String(err)}`, 'warn')
      } finally {
        setBusy(null)
      }
    },
    [push, minDocFreq, minSalience],
  )

  /** 실제 승격 — 확인 단계를 통과한 뒤에만 불린다. */
  const applyPromotion = useCallback(
    async (sourceId: string) => {
      setBusy(sourceId)
      try {
        const res = await fetch('/api/topic-corpus/promote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceId, minDocFreq, minSalience, apply: true }),
        })
        const json = (await res.json()) as PromoteResponse
        if (!res.ok) {
          push(`${sourceId} 승격 실패 — ${json.message ?? res.status}`, 'warn')
          return
        }
        if (json.note) {
          push(`${sourceId} — ${json.note}`, 'warn')
          return
        }
        push(
          `${sourceId} → ${json.category_id ?? '(카테고리 없음)'} 에 ${json.applied ?? 0}개 승격 완료`,
          'ok',
        )
        // 쓴 뒤의 미리보기는 낡았다 — 다시 승격하려면 다시 봐야 한다.
        setPreviews((prev) => {
          const next = { ...prev }
          delete next[sourceId]
          return next
        })
        setConfirming(null)
        refresh()
      } catch (err) {
        push(`${sourceId} 승격 오류 — ${String(err)}`, 'warn')
      } finally {
        setBusy(null)
      }
    },
    [push, minDocFreq, minSalience, refresh],
  )

  /** 지금 임계값에서 유효한 미리보기만 승격을 연다. 임계값을 바꾸면 자동으로 무효가 된다. */
  const validPreview = (sourceId: string): PreviewState | null => {
    const p = previews[sourceId]
    if (!p) return null
    if (p.minDocFreq !== minDocFreq || p.minSalience !== minSalience) return null
    return p
  }

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
        {refreshing && (
          <span
            role="status"
            className="inline-flex items-center gap-s-1 font-mono text-[10px] uppercase tracking-wider text-t3"
          >
            <Loader2 size={12} className="animate-spin" aria-hidden />
            현황 갱신 중
          </span>
        )}
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
            정상입니다. 아래 수치는 <strong>0 이 아니라 &quot;모름&quot;</strong> 입니다.
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
              {loadError ? '—' : value.toLocaleString('ko-KR')}
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
            onChange={(e) => {
              setMinDocFreq(Math.max(1, Number(e.target.value) || 1))
              setConfirming(null)
            }}
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
            onChange={(e) => {
              setMinSalience(Math.max(0, Number(e.target.value) || 0))
              setConfirming(null)
            }}
            className="h-11 w-28 rounded-lg border border-bd bg-bg px-s-3 font-mono text-sm text-t1 transition-colors duration-normal focus:border-bdf focus:outline-none focus:ring-2 focus:ring-p/20"
          />
        </div>
        <p className="flex-1 font-body text-xs text-t3">
          하한 1.0 ≈ 배경 대비 2.7배 과대표집. 승격은 없는 링크를 추가할 뿐이며 기존 분류를
          덮어쓰지 않습니다. <strong>임계값을 바꾸면 미리보기가 무효가 되고 승격이 다시 잠깁니다.</strong>
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
                <td colSpan={8} className="px-s-4 py-s-5 font-body text-sm text-t2">
                  {loadError ? (
                    <>
                      소스 목록을 읽지 못했다 — 등록된 소스가 <strong>없는 것이 아니라</strong>{' '}
                      확인할 수 없는 상태다. 위 오류를 먼저 해소한다.
                    </>
                  ) : (
                    <>
                      등록된 코퍼스 소스가 없다 — 큐가 빈 게 아니라{' '}
                      <strong>소스 레지스트리가 비어 있다</strong>. 다음 한 걸음:
                      <ul className="mt-s-2 flex list-disc flex-col gap-s-1 pl-5 text-t3">
                        <li>
                          <code className="font-mono text-[11px] text-t2">
                            supabase/migrations/20260816170000_topic_corpus_local_sources.sql
                          </code>{' '}
                          을 적용하면 local:nasa · local:voa · local:plos · local:elife 등이
                          등록된다.
                        </li>
                        <li>
                          직접 추가하려면{' '}
                          <code className="font-mono text-[11px] text-t2">
                            topic_corpus_sources
                          </code>{' '}
                          에 행을 넣는다 (id · provider · topic_key · label_en/ko · category_id ·
                          license).
                        </li>
                        <li>
                          큰 큐는 화면 대신{' '}
                          <code className="font-mono text-[11px] text-t2">pnpm tcp:drain</code> 으로
                          비운다 — 탭을 닫아도 계속 돈다.
                        </li>
                      </ul>
                    </>
                  )}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const ready = validPreview(r.source_id)
              const isConfirming = confirming === r.source_id
              return (
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
                    {isConfirming && ready ? (
                      <div className="flex flex-col gap-s-2 rounded-lg border border-warning bg-warning-light px-s-3 py-s-2">
                        <p className="flex items-start gap-s-2 font-body text-xs text-t1">
                          <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
                          <span>
                            <strong>{ready.eligible.toLocaleString('ko-KR')}개</strong> 단어를{' '}
                            <code className="font-mono">
                              {ready.categoryId ?? '(카테고리 없음)'}
                            </code>{' '}
                            에 붙입니다 (글 {ready.minDocFreq}편 이상 · 두드러짐{' '}
                            {ready.minSalience} 이상). 되돌리려면{' '}
                            <code className="font-mono">source=&apos;corpus-derived&apos;</code>{' '}
                            링크를 SQL 로 지워야 합니다 — 화면에는 취소 버튼이 없습니다.
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-s-1">
                          <ActionButton
                            onClick={() => applyPromotion(r.source_id)}
                            disabled={busy !== null || ready.eligible === 0}
                            busy={busy === r.source_id}
                            label="확인 · 승격 실행"
                            primary
                          />
                          <ActionButton
                            onClick={() => setConfirming(null)}
                            disabled={busy !== null}
                            busy={false}
                            label="취소"
                          />
                        </div>
                      </div>
                    ) : (
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
                          title={r.queued === 0 ? '대기 0 — 먼저 적재한다' : undefined}
                        />
                        <ActionButton
                          onClick={() => preview(r.source_id)}
                          disabled={busy !== null || r.distinct_words === 0}
                          busy={busy === r.source_id}
                          label="미리보기"
                          title={
                            r.distinct_words === 0
                              ? '관측 단어 0 — 먼저 드레인한다'
                              : '쓰기 없음 — 지금 임계값의 승격 대상 수만 센다'
                          }
                        />
                        <ActionButton
                          onClick={() => setConfirming(r.source_id)}
                          disabled={busy !== null || !ready}
                          busy={false}
                          label="승격"
                          primary
                          title={
                            ready
                              ? `미리보기 대상 ${ready.eligible}개 — 누르면 확인 단계로`
                              : '미리보기를 먼저 본다 (임계값을 바꾸면 다시 봐야 한다)'
                          }
                        />
                      </div>
                    )}
                    {!isConfirming && ready && (
                      <p className="mt-s-1 font-mono text-[10px] text-t3">
                        미리보기 {ready.eligible.toLocaleString('ko-KR')}개 대기 중
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
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
  title,
}: {
  onClick: () => void
  disabled: boolean
  busy: boolean
  label: string
  primary?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
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
