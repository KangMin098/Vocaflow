// apps/web/src/app/admin/compose/ComposeConsoleClient.tsx
// ACP §20 재저작 콘솔 — 7면(소스·피드·발견·원장·작성·가공·발행).
//
// 탭 라벨은 도움말 레지스트리(lib/admin/help/compose.ts)의 tabs 키와 **문자열이 같아야 한다**.
// AdminScreenHelp 가 라벨로 조회하므로 라벨만 바꾸면 도움말이 조용히 사라진다.

'use client'

import { useState, useTransition } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { COMPOSE_TABS, COMPOSE_TAB_BACKING, type ComposeTab } from '@/lib/admin/compose-tabs'

import {
  addFeed,
  createBatch,
  createComposeJob,
  deleteComposeJob,
  deleteFeed,
  releaseComposeJob,
  setFeedEnabled,
  type ActionResult,
} from './actions'

export interface ComposeCounts {
  feeds: number | null
  feedsEnabled: number | null
  batches: number | null
  facts: number | null
  jobsPending: number | null
  jobsClaimed: number | null
  jobsDone: number | null
  published: number | null
}

export interface FeedRow {
  id: string
  source_key: string
  url: string
  label: string
  enabled: boolean
  robots_status: string | null
  robots_at: string | null
  last_polled_at: string | null
  last_found: number | null
  last_note: string | null
}

export interface BatchRow {
  id: string
  topic: string
  event_occurred_at: string | null
  status: string
  created_at: string
}

export interface JobRow {
  id: string
  batch_id: string
  track: string
  register: string
  target_v_level: number
  skill_focus: string
  words_min: number
  words_max: number
  status: string
  claimed_by: string | null
  claimed_at: string | null
  attempts: number
  last_error: string | null
  article_id: string | null
}

export interface FeedSourceOption {
  key: string
  publisher: string
  tier: string
}

export interface TrackRow {
  track: string
  label: string
  feasible: boolean
  composable: boolean
  topics: string
  sources: string
  words: { min: number; max: number }
  avgSentenceWords: number
  vBand: { min: number; max: number }
  registers: string[]
  skills: string[]
  activities: string[]
  note: string
}

// 라벨은 lib/admin/compose-tabs.ts 가 단일 출처 — 도움말이 이 문자열로 조회한다.
const TABS = COMPOSE_TABS
type Tab = ComposeTab

/** 표가 없으면(마이그레이션 미적용) 0 이 아니라 '—' 로 — 빈 것과 없는 것은 다르다. */
function num(n: number | null): string {
  return n === null ? '—' : String(n)
}

export function ComposeConsoleClient({
  counts,
  tracks,
  feeds,
  batches,
  jobs,
  feedSourceOptions,
  envMissing,
}: {
  counts: ComposeCounts
  tracks: TrackRow[]
  feeds: FeedRow[]
  batches: BatchRow[]
  jobs: JobRow[]
  feedSourceOptions: FeedSourceOption[]
  envMissing: boolean
}) {
  const [tab, setTab] = useState<Tab>('소스')

  return (
    <div className="flex flex-col gap-s-5 p-s-5">
      <header className="flex flex-wrap items-center gap-s-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-t1">
            재저작 파이프라인 (Compose)
          </h1>
          <p className="mt-s-1 font-body text-sm text-t2">
            여러 매체가 각각 취재한 사건에서 사실만 모아, 학습 유형에 맞는 지문을 새로 씁니다.
            소스 본문은 보관하지 않습니다.
          </p>
        </div>
        <AdminScreenHelp screen="compose" tab={tab} />
      </header>

      {envMissing && (
        <div
          role="alert"
          className="rounded-lg border border-warning bg-warning-light px-s-4 py-s-3 font-body text-sm text-warning"
        >
          Supabase 서비스 키가 없어 현황 수치를 읽지 못했습니다. 유형·소스 표는 레지스트리
          계산이라 그대로 보입니다.
        </div>
      )}

      {/* 파이프라인 현황 — 어느 단계에서 막혀 있는지 한 줄로 */}
      <section
        aria-label="파이프라인 현황"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-bd bg-bd sm:grid-cols-4"
      >
        {[
          { k: '활성 피드', v: `${num(counts.feedsEnabled)} / ${num(counts.feeds)}` },
          { k: '취재 묶음', v: num(counts.batches) },
          { k: '사실 카드', v: num(counts.facts) },
          { k: '대기 발주', v: num(counts.jobsPending) },
          { k: '진행 중', v: num(counts.jobsClaimed) },
          { k: '작성 완료', v: num(counts.jobsDone) },
          { k: '발행됨', v: num(counts.published) },
          { k: '학습 유형', v: `${tracks.filter((t) => t.feasible).length} / ${tracks.length}` },
        ].map((c) => (
          <div key={c.k} className="flex flex-col gap-s-1 bg-bg p-s-3">
            <span className="font-mono text-lg font-bold tabular-nums text-t1">{c.v}</span>
            <span className="font-body text-xs text-t2">{c.k}</span>
          </div>
        ))}
      </section>

      <nav aria-label="단계" className="flex flex-wrap gap-s-2 border-b border-bd">
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`-mb-px border-b-2 px-s-3 py-s-2 font-display text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p ${
              tab === t
                ? 'border-p text-t1'
                : 'border-transparent text-t2 hover:text-t1'
            }`}
          >
            <span className="font-mono text-xs text-t3">{i + 1}</span> {t}
          </button>
        ))}
      </nav>

      {tab === '소스' && <TrackTable tracks={tracks} />}
      {tab === '피드' && <FeedPanel feeds={feeds} options={feedSourceOptions} />}
      {tab === '작성' && <JobPanel batches={batches} jobs={jobs} tracks={tracks} />}
      {tab !== '소스' && tab !== '피드' && tab !== '작성' && <NotBuiltYet tab={tab} />}
    </div>
  )
}

/** 액션 실행 + 결과 메시지 — 조용히 실패하지 않게 한 곳에서 처리한다. */
function useAction(): {
  run: (fn: () => Promise<ActionResult>) => void
  pending: boolean
  error: string | null
  clear: () => void
} {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return {
    pending,
    error,
    clear: () => setError(null),
    run: (fn) =>
      start(async () => {
        setError(null)
        const r = await fn()
        if (!r.ok) setError(r.error ?? '알 수 없는 오류')
      }),
  }
}

function ErrorNote({ error, onClose }: { error: string | null; onClose: () => void }) {
  if (!error) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-s-3 rounded-lg border border-error bg-error-light px-s-4 py-s-3 font-body text-sm text-error"
    >
      <span className="min-w-0 flex-1">{error}</span>
      <button type="button" onClick={onClose} className="font-mono text-xs underline">
        닫기
      </button>
    </div>
  )
}

const INPUT =
  'rounded-md border border-bd bg-bg px-s-3 py-s-2 font-body text-sm text-t1 transition-colors focus:border-p focus:outline-none focus-visible:ring-2 focus-visible:ring-p disabled:opacity-50'
const BTN =
  'rounded-md border border-p bg-p px-s-3 py-s-2 font-display text-sm font-bold text-white transition-colors hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p disabled:opacity-50'
const BTN_GHOST =
  'rounded-md border border-bd bg-bg px-s-2 py-s-1 font-mono text-xs text-t2 transition-colors hover:text-t1 hover:border-t3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p disabled:opacity-50'

/** ② 피드 — 주소 등록과 활성화. 등록은 항상 꺼진 채로 들어온다. */
function FeedPanel({ feeds, options }: { feeds: FeedRow[]; options: FeedSourceOption[] }) {
  const act = useAction()
  const [sourceKey, setSourceKey] = useState(options[0]?.key ?? '')
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')

  return (
    <section aria-label="수집 피드" className="flex flex-col gap-s-4">
      <ErrorNote error={act.error} onClose={act.clear} />

      <form
        className="flex flex-wrap items-end gap-s-3 rounded-lg border border-bd bg-bg2 p-s-4"
        onSubmit={(e) => {
          e.preventDefault()
          act.run(async () => {
            const r = await addFeed({ sourceKey, url, label })
            if (r.ok) {
              setUrl('')
              setLabel('')
            }
            return r
          })
        }}
      >
        <label className="flex flex-col gap-s-1">
          <span className="font-body text-xs text-t2">발행사</span>
          <select
            className={INPUT}
            value={sourceKey}
            onChange={(e) => setSourceKey(e.target.value)}
            disabled={act.pending || options.length === 0}
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.key} ({o.publisher})
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[18rem] flex-1 flex-col gap-s-1">
          <span className="font-body text-xs text-t2">피드 주소 (https)</span>
          <input
            className={INPUT}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/rss"
            disabled={act.pending}
          />
        </label>
        <label className="flex flex-col gap-s-1">
          <span className="font-body text-xs text-t2">피드 이름</span>
          <input
            className={INPUT}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="세계 뉴스"
            disabled={act.pending}
          />
        </label>
        <button type="submit" className={BTN} disabled={act.pending || !sourceKey}>
          {act.pending ? '등록 중…' : '등록'}
        </button>
      </form>
      <p className="font-body text-xs text-t2">
        등록해도 수집은 시작되지 않습니다. 활성으로 바꾼 뒤 다음 수집부터 포함됩니다.
      </p>

      {feeds.length === 0 ? (
        <p className="rounded-lg border border-dashed border-bd bg-bg2 p-s-5 font-body text-sm text-t2">
          등록된 피드가 없습니다. 발행사가 공개한 피드 주소를 넣어 주세요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-bd bg-bg">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-bg2 font-mono text-[11px] uppercase tracking-wider text-t2">
                <th className="px-s-3 py-s-2 font-semibold">피드</th>
                <th className="px-s-3 py-s-2 font-semibold">활성</th>
                <th className="px-s-3 py-s-2 font-semibold">robots</th>
                <th className="px-s-3 py-s-2 font-semibold">마지막 수집</th>
                <th className="px-s-3 py-s-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {feeds.map((f) => (
                <tr key={f.id} className="border-t border-bd align-top">
                  <td className="px-s-3 py-s-2">
                    <div className="font-display text-sm font-bold text-t1">{f.label}</div>
                    <div className="font-mono text-[11px] text-t3">{f.source_key}</div>
                    <div className="max-w-[28rem] truncate font-mono text-[11px] text-t2">
                      {f.url}
                    </div>
                  </td>
                  <td className="px-s-3 py-s-2">
                    <button
                      type="button"
                      className={BTN_GHOST}
                      disabled={act.pending}
                      onClick={() => act.run(() => setFeedEnabled(f.id, !f.enabled))}
                    >
                      {f.enabled ? '활성 · 끄기' : '꺼짐 · 켜기'}
                    </button>
                  </td>
                  <td className="px-s-3 py-s-2 font-mono text-xs text-t2">
                    {f.robots_status === 'failed' ? (
                      <span className="text-error">실패 · 건너뜀</span>
                    ) : f.robots_status === 'ok' ? (
                      '확인'
                    ) : f.robots_status === 'absent' ? (
                      '없음(제한 없음)'
                    ) : (
                      '미확인'
                    )}
                  </td>
                  <td className="px-s-3 py-s-2 font-body text-xs text-t2">
                    {f.last_polled_at ? (
                      <>
                        <span className="font-mono tabular-nums">{f.last_found ?? 0}건</span>
                        {f.last_note && (
                          <div className="max-w-[20rem] text-t3">{f.last_note}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-t3">아직 없음</span>
                    )}
                  </td>
                  <td className="px-s-3 py-s-2 text-right">
                    <button
                      type="button"
                      className={BTN_GHOST}
                      disabled={act.pending}
                      onClick={() => act.run(() => deleteFeed(f.id))}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** ⑤ 작성 — 취재 묶음 개설 + 발주 큐. 작성 버튼은 없다(드레인이 한다). */
function JobPanel({
  batches,
  jobs,
  tracks,
}: {
  batches: BatchRow[]
  jobs: JobRow[]
  tracks: TrackRow[]
}) {
  const act = useAction()
  const composable = tracks.filter((t) => t.composable)
  const [topic, setTopic] = useState('')
  const [occurred, setOccurred] = useState('')
  const [batchId, setBatchId] = useState(batches[0]?.id ?? '')
  const [track, setTrack] = useState(composable[0]?.track ?? '')
  const selected = composable.find((t) => t.track === track)
  const [level, setLevel] = useState<number>(selected?.vBand.min ?? 4)

  return (
    <section aria-label="발주 큐" className="flex flex-col gap-s-4">
      <ErrorNote error={act.error} onClose={act.clear} />

      <form
        className="flex flex-wrap items-end gap-s-3 rounded-lg border border-bd bg-bg2 p-s-4"
        onSubmit={(e) => {
          e.preventDefault()
          act.run(async () => {
            const r = await createBatch({ topic, eventOccurredAt: occurred || null })
            if (r.ok) {
              setTopic('')
              setOccurred('')
            }
            return r
          })
        }}
      >
        <label className="flex min-w-[16rem] flex-1 flex-col gap-s-1">
          <span className="font-body text-xs text-t2">사건 / 주제</span>
          <input
            className={INPUT}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="2026-08 캘리포니아 중부 지진"
            disabled={act.pending}
          />
        </label>
        <label className="flex flex-col gap-s-1">
          <span className="font-body text-xs text-t2">사건 시각</span>
          <input
            className={INPUT}
            type="datetime-local"
            value={occurred}
            onChange={(e) => setOccurred(e.target.value)}
            disabled={act.pending}
          />
        </label>
        <button type="submit" className={BTN} disabled={act.pending}>
          취재 묶음 개설
        </button>
      </form>
      <p className="font-body text-xs text-t2">
        사건 시각을 비우면 발행 지연(48시간)을 검증할 수 없어 게이트에서 막힙니다.
      </p>

      {batches.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-s-3 rounded-lg border border-bd bg-bg2 p-s-4"
          onSubmit={(e) => {
            e.preventDefault()
            act.run(() =>
              createComposeJob({
                batchId,
                track: track as Parameters<typeof createComposeJob>[0]['track'],
                targetVLevel: level,
              }),
            )
          }}
        >
          <label className="flex min-w-[14rem] flex-1 flex-col gap-s-1">
            <span className="font-body text-xs text-t2">취재 묶음</span>
            <select
              className={INPUT}
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              disabled={act.pending}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.topic}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-s-1">
            <span className="font-body text-xs text-t2">학습 유형</span>
            <select
              className={INPUT}
              value={track}
              onChange={(e) => {
                setTrack(e.target.value)
                const t = composable.find((x) => x.track === e.target.value)
                if (t) setLevel(t.vBand.min)
              }}
              disabled={act.pending}
            >
              {composable.map((t) => (
                <option key={t.track} value={t.track}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-s-1">
            <span className="font-body text-xs text-t2">
              목표 레벨 {selected ? `(V${selected.vBand.min}–${selected.vBand.max})` : ''}
            </span>
            <input
              className={`${INPUT} w-24`}
              type="number"
              min={selected?.vBand.min ?? 0}
              max={selected?.vBand.max ?? 11}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              disabled={act.pending}
            />
          </label>
          <button type="submit" className={BTN} disabled={act.pending || !batchId || !track}>
            발주 추가
          </button>
          {selected && (
            <p className="w-full font-body text-xs text-t2">
              {selected.label} — {selected.words.min}~{selected.words.max}어 · 문장{' '}
              {selected.avgSentenceWords}어절 · 활동 {selected.activities.length}종
            </p>
          )}
        </form>
      )}

      {jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-bd bg-bg2 p-s-5 font-body text-sm text-t2">
          발주가 없습니다. 취재 묶음을 만들고 학습 유형·레벨을 골라 발주를 추가하세요. 작성은
          화면이 아니라 Claude Code 드레인이 합니다 — 절차는 화면 도움말에 있습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-bd bg-bg">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-bg2 font-mono text-[11px] uppercase tracking-wider text-t2">
                <th className="px-s-3 py-s-2 font-semibold">발주</th>
                <th className="px-s-3 py-s-2 font-semibold">상태</th>
                <th className="px-s-3 py-s-2 font-semibold">시도</th>
                <th className="px-s-3 py-s-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-bd align-top">
                  <td className="px-s-3 py-s-2">
                    <div className="font-display text-sm font-bold text-t1">
                      {j.track} · V{j.target_v_level}
                    </div>
                    <div className="font-mono text-[11px] text-t3">
                      {j.register} · {j.skill_focus} · {j.words_min}~{j.words_max}어
                    </div>
                    {j.last_error && (
                      <div className="mt-s-1 max-w-[28rem] font-body text-xs text-error">
                        {j.last_error}
                      </div>
                    )}
                  </td>
                  <td className="px-s-3 py-s-2 font-mono text-xs text-t2">
                    {j.status}
                    {j.claimed_by && <div className="text-t3">{j.claimed_by}</div>}
                  </td>
                  <td className="px-s-3 py-s-2 font-mono text-xs tabular-nums text-t2">
                    {j.attempts}
                  </td>
                  <td className="px-s-3 py-s-2 text-right">
                    {j.status === 'pending' && (
                      <button
                        type="button"
                        className={BTN_GHOST}
                        disabled={act.pending}
                        onClick={() => act.run(() => deleteComposeJob(j.id))}
                      >
                        취소
                      </button>
                    )}
                    {j.status === 'claimed' && (
                      <button
                        type="button"
                        className={BTN_GHOST}
                        disabled={act.pending}
                        onClick={() => act.run(() => releaseComposeJob(j.id))}
                      >
                        회수
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** ① 소스 — 유형별로 무엇을 쓸 수 있고 무엇이 막혔는지. 레지스트리 계산이라 DB 없이도 뜬다. */
function TrackTable({ tracks }: { tracks: TrackRow[] }) {
  return (
    <section aria-label="학습 유형별 소스 커버리지" className="flex flex-col gap-s-3">
      <p className="font-body text-sm text-t2">
        학습 유형이 나머지를 결정합니다 — 어느 소스를 볼지, 몇 어절로 쓸지, 어떤 활동을 붙일지.
      </p>
      <div className="overflow-x-auto rounded-lg border border-bd bg-bg">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-bg2 font-mono text-[11px] uppercase tracking-wider text-t2">
              <th className="px-s-3 py-s-2 font-semibold">유형</th>
              <th className="px-s-3 py-s-2 font-semibold">발주</th>
              <th className="px-s-3 py-s-2 font-semibold">V밴드</th>
              <th className="px-s-3 py-s-2 font-semibold">길이</th>
              <th className="px-s-3 py-s-2 font-semibold">주제</th>
              <th className="px-s-3 py-s-2 font-semibold">소스</th>
              <th className="px-s-3 py-s-2 font-semibold">활동</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t) => (
              <tr key={t.track} className="border-t border-bd align-top">
                <td className="px-s-3 py-s-2">
                  <div className="font-display text-sm font-bold text-t1">{t.label}</div>
                  <div className="font-mono text-[11px] text-t3">{t.track}</div>
                  <div className="mt-s-1 max-w-[26rem] font-body text-xs text-t2">{t.note}</div>
                </td>
                <td className="px-s-3 py-s-2">
                  {!t.composable ? (
                    <span className="rounded bg-error-light px-s-2 py-s-1 font-mono text-[11px] font-bold text-error">
                      대상 아님
                    </span>
                  ) : t.feasible ? (
                    <span className="rounded bg-success-light px-s-2 py-s-1 font-mono text-[11px] font-bold text-success">
                      가능
                    </span>
                  ) : (
                    <span className="rounded bg-warning-light px-s-2 py-s-1 font-mono text-[11px] font-bold text-warning">
                      소스 부족
                    </span>
                  )}
                </td>
                <td className="px-s-3 py-s-2 font-mono text-xs tabular-nums text-t2">
                  {t.composable ? `V${t.vBand.min}–${t.vBand.max}` : '—'}
                </td>
                <td className="px-s-3 py-s-2 font-mono text-xs tabular-nums text-t2">
                  {t.composable ? (
                    <>
                      {t.words.min}–{t.words.max}어
                      <div className="text-t3">문장 {t.avgSentenceWords}어절</div>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-s-3 py-s-2 font-mono text-xs tabular-nums text-t2">{t.topics}</td>
                <td className="max-w-[14rem] px-s-3 py-s-2 font-mono text-[11px] text-t2">
                  {t.sources}
                </td>
                <td className="max-w-[14rem] px-s-3 py-s-2 font-mono text-[11px] text-t2">
                  {t.activities.join(', ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** 아직 안 만든 면 — 무엇이 준비돼 있고 무엇이 없는지 말한다. 빈 화면으로 두지 않는다. */
function NotBuiltYet({ tab }: { tab: Tab }) {
  return (
    <section
      aria-label={`${tab} 준비 상태`}
      className="rounded-lg border border-dashed border-bd bg-bg2 p-s-5"
    >
      <h2 className="font-display text-sm font-bold text-t1">{tab} — 화면 미구현</h2>
      <p className="mt-s-2 max-w-[52rem] font-body text-sm text-t2">
        데이터 계층과 절차는 준비돼 있고 화면만 없습니다. 지금은 &ldquo;화면 도움말&rdquo;에서
        이 단계의 순서·전제·되돌리기 가능 여부를 읽을 수 있습니다.
      </p>
      <p className="mt-s-2 font-mono text-xs text-t3">{COMPOSE_TAB_BACKING[tab]}</p>
    </section>
  )
}
