// apps/web/src/app/admin/compose/ComposeConsoleClient.tsx
// ACP §20 재저작 콘솔 — 7면(소스·피드·발견·원장·작성·가공·발행).
//
// 탭 라벨은 도움말 레지스트리(lib/admin/help/compose.ts)의 tabs 키와 **문자열이 같아야 한다**.
// AdminScreenHelp 가 라벨로 조회하므로 라벨만 바꾸면 도움말이 조용히 사라진다.

'use client'

import { useEffect, useState, useTransition } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { COMPOSE_TABS, type ComposeTab } from '@/lib/admin/compose-tabs'

import {
  addAttestation,
  addFactCard,
  addFeed,
  createBatch,
  createComposeJob,
  deleteComposeJob,
  deleteFactCard,
  deleteFeed,
  discoverFeedsForSource,
  publishComposedArticle,
  releaseComposeJob,
  runDiscovery,
  setFeedEnabled,
  startCoverage,
  startCoverageFromUrls,
  verifyFeedUrlAction,
  type ActionResult,
  type DiscoveryRunResult,
  type ScrapeResult,
} from './actions'

/** discoverFeedsForSource 가 돌려주는 항목 (패키지 타입을 화면까지 끌고 오지 않는다). */
interface DiscoveredFeedView {
  url: string
  title: string | null
  via: 'autodiscovery' | 'convention' | 'section'
  verified: boolean
  itemCount: number
}

/** 실패 1건 — 사유만이 아니라 **다음에 할 일**을 함께 보여 준다. */
interface FeedSkipView {
  url: string
  kind: string
  reason: string
  nextAction: string
}

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

export interface SourceRow {
  id: string
  batch_id: string
  publisher: string
  url: string
  published_at: string | null
  access_basis: string
  wire: string | null
}

export interface FactRow {
  id: string
  batch_id: string
  claim: string
  kind: string
  quote: string | null
  quote_is_public: boolean | null
  created_at: string
}

export interface AttestationRow {
  fact_id: string
  source_id: string
  ordinal: number
}

export interface ComposedRow {
  id: string
  title: string
  status: string
  register: string | null
  cefr_level: string | null
  article_v_level: number | null
  word_count: number | null
  audio_url: string | null
  compose_batch_id: string | null
  content_hash: string | null
}

export interface GateRow {
  article_id: string
  invariant: string
  severity: string
  verdict: string
  detail: string
  content_hash: string
}

/**
 * 콘텐츠 품질 게이트 판정 — 재저작 게이트(I12~I17)와 **다른 계열**이다.
 * 재저작 게이트가 전부 통과여도 이쪽이 막으면 발행이 안 된다(어휘 추출 0 등).
 */
export interface ContentGateRow {
  article_id: string
  invariant: string
  severity: string
  verdict: string
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

const TAB_STORE = 'vocaflow-compose-tab'

/**
 * 활성 단계를 세션에 남긴다.
 *
 * 서버 액션이 끝나면 `revalidatePath` 로 서버 컴포넌트가 다시 그려지고, 그때 이 컴포넌트의
 * 상태가 초기화되면서 **② 피드에서 피드를 추가했는데 ① 소스로 튕기는** 일이 있었다
 * (2026-08-17 사용자 보고). 작업하던 자리에서 튕기면 무엇이 반영됐는지도 알 수 없다.
 */
function usePersistedTab(initial?: Tab): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>(initial ?? '소스')

  useEffect(() => {
    if (initial) return // 렌더 스모크 등 진입 탭이 지정된 경우는 그대로 둔다
    try {
      const saved = sessionStorage.getItem(TAB_STORE)
      if (saved && (COMPOSE_TABS as ReadonlyArray<string>).includes(saved)) setTab(saved as Tab)
    } catch {
      /* private mode — 세션 한정으로만 동작 */
    }
  }, [initial])

  const set = (t: Tab): void => {
    setTab(t)
    try {
      sessionStorage.setItem(TAB_STORE, t)
    } catch {
      /* private mode */
    }
  }
  return [tab, set]
}

export function ComposeConsoleClient({
  counts,
  tracks,
  feeds,
  batches,
  jobs,
  sources,
  facts,
  attestations,
  composed,
  gates,
  feedSourceOptions,
  acpOverlap,
  contentGates,
  derived,
  envMissing,
  initialTab,
}: {
  counts: ComposeCounts
  tracks: TrackRow[]
  feeds: FeedRow[]
  batches: BatchRow[]
  jobs: JobRow[]
  sources: SourceRow[]
  facts: FactRow[]
  attestations: AttestationRow[]
  composed: ComposedRow[]
  gates: GateRow[]
  feedSourceOptions: FeedSourceOption[]
  /** ACP(본문 수집)에도 있는 소스 키 — 표 옆에 "겹치는데?" 의 답을 둔다. */
  acpOverlap: string[]
  /** 콘텐츠 품질 게이트 — 재저작 게이트와 **별개로** 발행을 막는다. */
  contentGates: ContentGateRow[]
  derived: Record<string, DerivedCounts>
  envMissing: boolean
  /** 렌더 스모크에서 각 면을 그려 보기 위한 진입 탭. 화면에서는 쓰지 않는다. */
  initialTab?: Tab
}) {
  const [tab, setTab] = usePersistedTab(initialTab)

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

      {tab === '소스' && <TrackTable tracks={tracks} acpOverlap={acpOverlap} />}
      {tab === '피드' && <FeedPanel feeds={feeds} options={feedSourceOptions} />}
      {tab === '발견' && <DiscoverPanel feedCount={counts.feedsEnabled ?? 0} />}
      {tab === '원장' && (
        <LedgerPanel
          batches={batches}
          sources={sources}
          facts={facts}
          attestations={attestations}
        />
      )}
      {tab === '작성' && <JobPanel batches={batches} jobs={jobs} tracks={tracks} />}
      {tab === '가공' && (
        <ActivityPanel composed={composed} jobs={jobs} tracks={tracks} derived={derived} />
      )}
      {tab === '발행' && (
        <PublishPanel composed={composed} gates={gates} contentGates={contentGates} />
      )}
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
        try {
          const r = await fn()
          if (!r.ok) setError(r.error ?? '알 수 없는 오류')
        } catch (e) {
          // 서버 액션이 **던지면** 트랜지션 안에서 조용히 사라진다 — 화면은 아무 반응도
          // 하지 않고, 운영자는 버튼이 고장 났다고 생각한다(2026-08-18 "반응 없음" 보고).
          // 실패는 반드시 보이게 한다.
          setError(
            `요청이 실패했습니다 — ${e instanceof Error ? e.message : String(e)}. 잠시 뒤 다시 시도하고, 반복되면 서버 로그를 확인하세요.`,
          )
        }
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

/**
 * ② 피드 — 발행사만 고르면 시스템이 찾아 준다.
 *
 * 주소를 직접 입력하게 두지 않는다. 발행사 사이트를 뒤져 RSS 링크를 찾아오는 것은
 * 사람의 일이 아니고, 주소가 바뀌면 조용히 0건이 되는데 왜인지도 알 수 없다.
 */
function FeedPanel({ feeds, options }: { feeds: FeedRow[]; options: FeedSourceOption[] }) {
  const act = useAction()
  const [sourceKey, setSourceKey] = useState(options[0]?.key ?? '')
  const [found, setFound] = useState<DiscoveredFeedView[] | null>(null)
  const [notes, setNotes] = useState<FeedSkipView[]>([])
  const [manualUrl, setManualUrl] = useState('')
  const registered = new Set(feeds.map((f) => f.url))

  return (
    <section aria-label="수집 피드" className="flex flex-col gap-s-4">
      <ErrorNote error={act.error} onClose={act.clear} />

      <form
        className="flex flex-wrap items-end gap-s-3 rounded-lg border border-bd bg-bg2 p-s-4"
        onSubmit={(e) => {
          e.preventDefault()
          setFound(null)
          setNotes([])
          act.run(async () => {
            const r = await discoverFeedsForSource(sourceKey)
            setFound(r.feeds ?? [])
            setNotes(r.skipped ?? [])
            return { ok: r.ok, error: r.error }
          })
        }}
      >
        <label className="flex flex-col gap-s-1">
          <span className="font-body text-xs text-t2">발행사</span>
          <select
            className={INPUT}
            value={sourceKey}
            onChange={(e) => {
              setSourceKey(e.target.value)
              setFound(null)
              setNotes([])
            }}
            disabled={act.pending || options.length === 0}
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.key} ({o.publisher})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={BTN} disabled={act.pending || !sourceKey}>
          {act.pending ? '찾는 중…' : '피드 찾기'}
        </button>
        <p className="w-full font-body text-xs text-t2">
          발행사가 스스로 알린 피드를 찾아 실제로 열어 본 뒤 목록으로 보여 줍니다. 주소를 직접
          찾아오실 필요가 없습니다.
        </p>
      </form>

      {found !== null && (
        <div className="flex flex-col gap-s-3 rounded-lg border border-bd bg-bg p-s-4">
          <h2 className="font-display text-sm font-bold text-t1">
            찾은 피드 {found.length}개
          </h2>
          {found.length === 0 && (
            <p className="font-body text-sm text-t2">
              이 발행사에서 열 수 있는 피드를 찾지 못했습니다.
            </p>
          )}
          <ul className="flex flex-col gap-s-2">
            {found.map((f) => (
              <li
                key={f.url}
                className="flex flex-wrap items-center gap-s-3 rounded-md border border-bd px-s-3 py-s-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-display text-sm font-bold text-t1">
                    {f.title ?? '(제목 없음)'}
                  </span>
                  <span className="ml-s-2 font-mono text-[11px] text-t3">
                    {f.via === 'autodiscovery'
                      ? '발행사 알림'
                      : f.via === 'section'
                        ? '섹션 목록'
                        : '관습 경로'}{' · 항목 '}
                    {f.itemCount}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-t2">{f.url}</span>
                </span>
                {registered.has(f.url) ? (
                  <span className="font-mono text-xs text-t3">등록됨</span>
                ) : (
                  <button
                    type="button"
                    className={BTN_GHOST}
                    disabled={act.pending}
                    onClick={() =>
                      act.run(() =>
                        addFeed({
                          sourceKey,
                          url: f.url,
                          label: f.title ?? `${sourceKey} 피드`,
                        }),
                      )
                    }
                  >
                    추가
                  </button>
                )}
              </li>
            ))}
          </ul>
          {notes.length > 0 && (
            <details className="font-body text-xs text-t2" open={found.length === 0}>
              <summary className="cursor-pointer">열지 못한 주소 {notes.length}건</summary>
              <ul className="mt-s-2 flex flex-col gap-s-2">
                {notes.map((n, i) => (
                  <li key={`${n.url}-${i}`} className="rounded border border-bd bg-bg2 p-s-2">
                    <div className="truncate font-mono text-[11px] text-t3">{n.url}</div>
                    <div className="font-body text-xs text-t2">{n.reason}</div>
                    {/* "안 되네" 에서 멈추지 않게 다음 행동을 함께 준다 */}
                    <div className="font-body text-xs text-t1">→ {n.nextAction}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* 자동 발견이 기본 경로이고 이것은 대안이다 — 막아 두면 파이프라인 전체가 멈춘다. */}
      <details className="rounded-lg border border-bd bg-bg2 p-s-4">
        <summary className="cursor-pointer font-display text-sm font-bold text-t1">
          찾지 못했을 때 — 주소를 직접 확인하기
        </summary>
        <p className="mt-s-2 font-body text-xs text-t2">
          발행사 RSS 안내 페이지에서 본 주소를 넣으면 똑같이 열어서 확인한 뒤에만 추가합니다.{' '}
          <strong className="text-t1">RSS 가 아닌 섹션 목록 페이지 주소도 됩니다</strong> — 학습에
          적합한 섹션(생활·문화·교육)이 RSS 를 안 주는 경우가 흔합니다. 그때는 기사 주소에 박힌
          날짜로 발행 시각을 채우고, 날짜를 못 찾은 기사는 제외합니다(48시간 보류를 검증할 수
          없기 때문). robots 를 어기는 주소는 여기서도 거부됩니다.
        </p>
        <form
          className="mt-s-3 flex flex-wrap items-end gap-s-3"
          onSubmit={(e) => {
            e.preventDefault()
            act.run(async () => {
              const r = await verifyFeedUrlAction(sourceKey, manualUrl)
              if (r.ok && r.feeds?.[0]) {
                const added = await addFeed({
                  sourceKey,
                  url: r.feeds[0].url,
                  label: r.feeds[0].title ?? `${sourceKey} 피드`,
                })
                if (added.ok) setManualUrl('')
                return added
              }
              return { ok: r.ok, error: r.error }
            })
          }}
        >
          <label className="flex min-w-[20rem] flex-1 flex-col gap-s-1">
            <span className="font-body text-xs text-t2">피드 주소 (https)</span>
            <input
              className={INPUT}
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://…/rss.xml"
              disabled={act.pending}
            />
          </label>
          <button type="submit" className={BTN} disabled={act.pending || !manualUrl}>
            확인하고 추가
          </button>
        </form>
      </details>

      <p className="font-body text-xs text-t2">
        추가해도 수집은 시작되지 않습니다. 활성으로 바꾼 뒤 다음 수집부터 포함됩니다.
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
function TrackTable({ tracks, acpOverlap }: { tracks: TrackRow[]; acpOverlap: string[] }) {
  return (
    <section aria-label="학습 유형별 소스 커버리지" className="flex flex-col gap-s-3">
      <p className="font-body text-sm text-t2">
        학습 유형이 나머지를 결정합니다 — 어느 소스를 볼지, 몇 어절로 쓸지, 어떤 활동을 붙일지.
      </p>

      {/* 표에 ACP 소스가 함께 보이므로 "겹치는데?" 라는 물음이 반드시 나온다. 표 옆에 답을 둔다. */}
      <div className="rounded-lg border border-bd bg-bg2 p-s-4">
        <h3 className="font-display text-sm font-bold text-t1">
          ACP 와 같은 소스가 {acpOverlap.length}곳 있습니다 — 겹치는 것은 소스이지 산출물이
          아닙니다
        </h3>
        <p className="mt-s-2 max-w-[60rem] font-body text-sm text-t2">
          같은 기관이 두 파이프라인에서 다른 역할을 합니다. <b>ACP</b> 는 그 소스의{' '}
          <b>본문이 그 자체로 학습 지문</b>일 때 씁니다(NOAA 기후 해설, VOA 기사).{' '}
          <b>재저작</b> 은 그 소스가 <b>사건에 대한 사실을 제공</b>할 때 씁니다(USGS 지진 속보,
          OWID 지표 발표) — 본문이 지문감은 아니지만 사실의 1차 출처인 자료들입니다.
        </p>
        <p className="mt-s-2 max-w-[60rem] font-body text-sm text-t1">
          갈릴 때의 기준은 하나입니다 — <b>본문을 그대로 가져와 발행할 수 있으면 ACP 로 갑니다.</b>{' '}
          재저작은 본문을 못 가져올 때 쓰는 우회로지 더 나은 경로가 아닙니다.
        </p>
        <ul className="mt-s-3 flex flex-col gap-s-1 font-body text-xs text-t2">
          <li>
            같은 사건이 서가에 두 번 오르는 것은 <b>I17 서가 중복</b> 게이트가 발행 시 막습니다.
          </li>
          <li>
            ACP 가 이미 본문으로 가져간 기사는 <b>취재 시작에서 자동으로 제외</b>됩니다.
          </li>
        </ul>
        <p className="mt-s-2 font-mono text-[11px] text-t3">{acpOverlap.join(', ')}</p>
      </div>
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

/**
 * ③-B URL 직접 취재 — 피드로는 안 잡히는 사건의 우회로.
 *
 * 피드는 최근분만 싣고 어떤 발행사는 쓸 만한 피드가 아예 없다. 운영자가 아는 기사 주소를
 * 넣으면 그 자리에서 취재가 시작된다. **규율은 피드 경로와 같다** — robots 를 보고,
 * 본문은 저장하지 않는다.
 */
function UrlCoveragePanel() {
  const act = useAction()
  const [topic, setTopic] = useState('')
  const [urls, setUrls] = useState('')
  const [res, setRes] = useState<ScrapeResult | null>(null)

  return (
    <details className="rounded-lg border border-bd bg-bg2 p-s-4">
      <summary className="cursor-pointer font-display text-sm font-bold text-t1">
        기사 주소로 바로 취재 시작하기
      </summary>
      <p className="mt-s-2 max-w-[62rem] font-body text-xs text-t2">
        피드에 안 잡히는 사건은 주소를 직접 넣으면 됩니다. <b>서로 다른 발행사 기사 2개 이상</b>이
        필요합니다 — 한 곳만으로는 사실을 확인할 수 없습니다. 본문은 읽고 나서 지문만 남기고
        버립니다.
      </p>
      <form
        className="mt-s-3 flex flex-col gap-s-3"
        onSubmit={(e) => {
          e.preventDefault()
          act.run(async () => {
            const r = await startCoverageFromUrls({
              urls: urls.split(/\s+/).filter(Boolean),
              topic,
              eventOccurredAt: null,
            })
            setRes(r)
            if (r.ok) {
              setUrls('')
              setTopic('')
            }
            return { ok: r.ok, error: r.error }
          })
        }}
      >
        <label className="flex flex-col gap-s-1">
          <span className="font-body text-xs text-t2">사건 / 주제</span>
          <input
            className={INPUT}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="캘리포니아 중부 지진"
            disabled={act.pending}
          />
        </label>
        <label className="flex flex-col gap-s-1">
          <span className="font-body text-xs text-t2">기사 주소 (한 줄에 하나)</span>
          <textarea
            className={`${INPUT} min-h-[6rem] font-mono text-xs`}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={'https://www.bbc.com/news/...\nhttps://www.theguardian.com/...'}
            disabled={act.pending}
          />
        </label>
        <div>
          <button type="submit" className={BTN} disabled={act.pending || !topic || !urls}>
            {act.pending ? '읽는 중…' : '읽고 취재 시작'}
          </button>
        </div>
      </form>

      {res && (
        <div className="mt-s-3 flex flex-col gap-s-2">
          {(res.sources ?? []).map((s) => (
            <div key={s.url} className="rounded-md border border-bd bg-bg p-s-3">
              <div className="font-display text-sm font-bold text-t1">{s.title ?? '(제목 없음)'}</div>
              <div className="font-mono text-[11px] text-t3">
                {s.publisher}
                {!s.known && <span className="text-warning"> · 미등록 발행사</span>}
                {s.wire && <span> · {s.wire} 계통</span>} · {s.wordCount}어 · 추출 {s.via}
                {s.via === 'density' && <span className="text-warning"> (신뢰도 낮음 — 확인 필요)</span>}
              </div>
              <details className="mt-s-1">
                <summary className="cursor-pointer font-body text-xs text-t2">
                  읽어 온 문장 {s.sentences.length}개 — 사실 카드를 적을 때 참고 (저장되지 않음)
                </summary>
                <ul className="mt-s-1 flex flex-col gap-s-1 font-body text-xs text-t2">
                  {s.sentences.slice(0, 12).map((x, i) => (
                    <li key={i}>· {x}</li>
                  ))}
                </ul>
                <p className="mt-s-1 font-body text-xs text-warning">
                  이 문장을 그대로 사실 카드에 옮기지 마세요 — 표현을 복사하면 발행 때 표현
                  독립성 게이트가 막습니다. 사실만 우리 말로 적습니다.
                </p>
              </details>
            </div>
          ))}
          {(res.failed ?? []).length > 0 && (
            <ul className="flex flex-col gap-s-1 font-body text-xs text-error">
              {res.failed!.map((f, i) => (
                <li key={i}>
                  {f.url} — {f.reason}
                </li>
              ))}
            </ul>
          )}
          {res.ok && (
            <p className="font-body text-sm text-success">
              취재 묶음을 만들었습니다 (독립 계통 {res.independentLines}). ④ 원장에서 사실 카드를
              적어 주세요.
            </p>
          )}
        </div>
      )}
    </details>
  )
}

/** ③ 발견 — 피드를 훑어 사건 묶음을 제안한다. 본문은 읽지 않는다. */
function DiscoverPanel({ feedCount }: { feedCount: number }) {
  const act = useAction()
  const [result, setResult] = useState<DiscoveryRunResult | null>(null)

  return (
    <section aria-label="사건 발견" className="flex flex-col gap-s-4">
      <UrlCoveragePanel />
      <ErrorNote error={act.error} onClose={act.clear} />

      {feedCount === 0 && (
        <div
          role="status"
          className="rounded-lg border border-warning bg-warning-light px-s-4 py-s-3 font-body text-sm text-warning"
        >
          활성 피드가 없어 수집할 곳이 없습니다. ② 피드에서 발행사를 고르고 &ldquo;피드
          찾기&rdquo; → 추가 → <b>활성으로 전환</b>까지 하셔야 합니다. 추가만 해서는 수집에
          포함되지 않습니다.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-s-3 rounded-lg border border-bd bg-bg2 p-s-4">
        {/* 버튼을 잠그지 않는다 — 눌렀는데 아무 일도 없으면 고장으로 읽힌다.
            누를 수 있게 두고 액션이 "활성 피드가 없습니다" 라고 답하게 한다. */}
        <button
          type="button"
          className={BTN}
          disabled={act.pending}
          onClick={() =>
            act.run(async () => {
              const r = await runDiscovery()
              setResult(r)
              return { ok: r.ok, error: r.error }
            })
          }
        >
          {act.pending ? '수집 중…' : '수집 실행'}
        </button>
        <p className="min-w-0 flex-1 font-body text-xs text-t2">
          활성 피드 {feedCount}개를 훑습니다. 이 단계는 기사 본문을 읽지 않고 피드와 robots 만
          묻습니다 — 실제로 읽는 것은 &ldquo;취재 시작&rdquo;을 누른 사건뿐입니다.
          <br />
          뉴스 피드는 최근 1~2일치만 싣는데 사건 후 48시간이 지나야 쓸 수 있으므로,{' '}
          <b>오늘 받은 것 대부분은 보류로 저장됩니다.</b> 목록에 뜨는 것은 모아 둔 후보 중 48시간이
          지난 사건입니다.
          <br />
          <b>하루 한 번은 돌려 주세요.</b> 피드는 최근 1~2일만 조밀하고 그 이전은 꼬리만 남습니다 —
          거른 날의 사건은 다시 받을 수 없습니다.
        </p>
      </div>

      {result?.ok && (
        <>
          <p className="font-mono text-xs text-t2">
            요청 {result.requests}건 · 취재 후보 {result.pursue?.length ?? 0} · 단독{' '}
            {result.singleLine?.length ?? 0} · 48시간 미달 {result.holdingCount ?? 0}
          </p>

          {(result.pursue ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-bd bg-bg2 p-s-5 font-body text-sm text-t2">
              독립 계통 2개 이상인 사건이 없습니다. 서로 다른 취재 계통의 피드를 더 켜면
              같은 사건이 묶일 확률이 올라갑니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-s-3">
              {result.pursue!.map((c) => (
                <li key={c.headline} className="rounded-lg border border-bd bg-bg p-s-4">
                  <div className="flex flex-wrap items-start gap-s-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-sm font-bold text-t1">{c.headline}</h3>
                      <p className="font-mono text-[11px] text-t3">
                        독립 계통 {c.independentLines} · 최초 보도{' '}
                        {c.earliestAt ? new Date(c.earliestAt).toLocaleString('ko-KR') : '—'}
                      </p>
                      <ul className="mt-s-2 flex flex-col gap-s-1">
                        {c.members.map((m) => (
                          <li key={m.url} className="font-mono text-[11px] text-t2">
                            <span className="text-t1">{m.publisher}</span>
                            {m.wire && <span className="text-t3"> ({m.wire} 계통)</span>} —{' '}
                            {m.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      className={BTN}
                      disabled={act.pending}
                      onClick={() => act.run(() => startCoverage(c))}
                    >
                      취재 시작
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {(result.skipped ?? []).length > 0 && (
            <details className="font-body text-xs text-t2">
              <summary className="cursor-pointer">건너뛴 항목 {result.skipped!.length}건</summary>
              <ul className="mt-s-2 flex flex-col gap-s-1 font-mono text-[11px] text-t3">
                {result.skipped!.map((s, i) => (
                  <li key={`${s.url}-${i}`}>
                    {s.url} — {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}

/** ④ 원장 — 사실 카드와 확인 표시. 등장 순서는 지금 안 적으면 복원할 수 없다. */
function LedgerPanel({
  batches,
  sources,
  facts,
  attestations,
}: {
  batches: BatchRow[]
  sources: SourceRow[]
  facts: FactRow[]
  attestations: AttestationRow[]
}) {
  const act = useAction()
  const [batchId, setBatchId] = useState(batches[0]?.id ?? '')
  const [claim, setClaim] = useState('')
  const [kind, setKind] = useState<FactRow['kind']>('event')
  const [quote, setQuote] = useState('')
  const [quotePublic, setQuotePublic] = useState(true)

  const batchSources = sources.filter((s) => s.batch_id === batchId)
  const batchFacts = facts.filter((f) => f.batch_id === batchId)
  const linesOf = (factId: string): number => {
    const ids = attestations.filter((a) => a.fact_id === factId).map((a) => a.source_id)
    const lines = new Set(
      ids
        .map((id) => sources.find((s) => s.id === id))
        .filter((s): s is SourceRow => !!s)
        .map((s) => s.wire ?? s.publisher.toLowerCase()),
    )
    return lines.size
  }

  if (batches.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-bd bg-bg2 p-s-5 font-body text-sm text-t2">
        취재 묶음이 없습니다. ③ 발견에서 사건을 골라 취재를 시작하세요.
      </p>
    )
  }

  return (
    <section aria-label="사실 원장" className="flex flex-col gap-s-4">
      <ErrorNote error={act.error} onClose={act.clear} />

      <label className="flex max-w-[28rem] flex-col gap-s-1">
        <span className="font-body text-xs text-t2">취재 묶음</span>
        <select
          className={INPUT}
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          disabled={act.pending}
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.topic} ({b.status})
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-lg border border-bd bg-bg p-s-4">
        <h3 className="font-display text-sm font-bold text-t1">
          이 묶음의 소스 {batchSources.length}건
        </h3>
        <ul className="mt-s-2 flex flex-col gap-s-1 font-mono text-[11px] text-t2">
          {batchSources.map((s, i) => (
            <li key={s.id}>
              <span className="text-t3">#{i + 1}</span> {s.publisher}
              {s.wire && <span className="text-t3"> ({s.wire} 계통)</span>} · {s.access_basis}
            </li>
          ))}
          {batchSources.length === 0 && <li className="text-t3">본문을 읽어 온 소스가 없습니다</li>}
        </ul>
      </div>

      <form
        className="flex flex-wrap items-end gap-s-3 rounded-lg border border-bd bg-bg2 p-s-4"
        onSubmit={(e) => {
          e.preventDefault()
          act.run(async () => {
            const r = await addFactCard({
              batchId,
              claim,
              kind: kind as 'event' | 'figure' | 'utterance' | 'background',
              quote: kind === 'utterance' ? quote : undefined,
              quoteIsPublic: kind === 'utterance' ? quotePublic : undefined,
            })
            if (r.ok) {
              setClaim('')
              setQuote('')
            }
            return r
          })
        }}
      >
        <label className="flex min-w-[20rem] flex-1 flex-col gap-s-1">
          <span className="font-body text-xs text-t2">사실 (우리 말로 · 원문 복사 금지)</span>
          <input
            className={INPUT}
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="3명이 경상으로 치료를 받았다"
            disabled={act.pending}
          />
        </label>
        <label className="flex flex-col gap-s-1">
          <span className="font-body text-xs text-t2">종류</span>
          <select
            className={INPUT}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            disabled={act.pending}
          >
            <option value="event">사건</option>
            <option value="figure">수치</option>
            <option value="utterance">발언</option>
            <option value="background">배경</option>
          </select>
        </label>
        {kind === 'utterance' && (
          <>
            <label className="flex min-w-[16rem] flex-1 flex-col gap-s-1">
              <span className="font-body text-xs text-t2">인용문 (25어절 이하)</span>
              <input
                className={INPUT}
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                disabled={act.pending}
              />
            </label>
            <label className="flex items-center gap-s-2 pb-s-2 font-body text-xs text-t2">
              <input
                type="checkbox"
                checked={quotePublic}
                onChange={(e) => setQuotePublic(e.target.checked)}
                disabled={act.pending}
              />
              공개 석상 발언
            </label>
          </>
        )}
        <button type="submit" className={BTN} disabled={act.pending || !batchId}>
          사실 추가
        </button>
      </form>

      {batchFacts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-bd bg-bg2 p-s-5 font-body text-sm text-t2">
          사실 카드가 없습니다. 소스에서 읽은 사실을 우리 말로 적어 주세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-s-2">
          {batchFacts.map((f) => {
            const lines = linesOf(f.id)
            const mine = attestations.filter((a) => a.fact_id === f.id)
            return (
              <li
                key={f.id}
                className={`rounded-lg border p-s-3 ${
                  lines >= 2 ? 'border-bd bg-bg' : 'border-error bg-error-light'
                }`}
              >
                <div className="flex flex-wrap items-start gap-s-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm text-t1">{f.claim}</p>
                    <p className="font-mono text-[11px] text-t3">
                      {f.kind} · 독립 계통 {lines}
                      {lines < 2 && <span className="text-error"> — 2 미만이면 쓸 수 없습니다</span>}
                    </p>
                    <ul className="mt-s-1 flex flex-wrap gap-s-2 font-mono text-[11px] text-t2">
                      {mine.map((a) => {
                        const s = sources.find((x) => x.id === a.source_id)
                        return (
                          <li key={a.source_id}>
                            {s?.publisher ?? a.source_id} #{a.ordinal}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <AttestForm
                    factId={f.id}
                    sources={batchSources.filter(
                      (s) => !mine.some((a) => a.source_id === s.id),
                    )}
                    disabled={act.pending}
                    onSubmit={(sourceId, ordinal) =>
                      act.run(() => addAttestation({ factId: f.id, sourceId, ordinal }))
                    }
                  />
                  <button
                    type="button"
                    className={BTN_GHOST}
                    disabled={act.pending}
                    onClick={() => act.run(() => deleteFactCard(f.id))}
                  >
                    삭제
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function AttestForm({
  factId,
  sources,
  disabled,
  onSubmit,
}: {
  factId: string
  sources: SourceRow[]
  disabled: boolean
  onSubmit: (sourceId: string, ordinal: number) => void
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '')
  const [ordinal, setOrdinal] = useState(0)
  if (sources.length === 0) return null
  return (
    <form
      className="flex items-end gap-s-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(sourceId || sources[0]!.id, ordinal)
      }}
    >
      <label className="flex flex-col gap-s-1">
        <span className="font-body text-[11px] text-t2">확인 소스</span>
        <select
          className={`${INPUT} py-s-1 text-xs`}
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          disabled={disabled}
          aria-label={`사실 ${factId} 확인 소스`}
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.publisher}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-s-1">
        <span className="font-body text-[11px] text-t2">등장 순서</span>
        <input
          className={`${INPUT} w-16 py-s-1 text-xs`}
          type="number"
          min={0}
          value={ordinal}
          onChange={(e) => setOrdinal(Number(e.target.value))}
          disabled={disabled}
        />
      </label>
      <button type="submit" className={BTN_GHOST} disabled={disabled}>
        확인 표시
      </button>
    </form>
  )
}

/** ⑥ 가공에서 실제로 만들어진 것 — 계획(트랙)과 대비해 보여 준다. */
export interface DerivedCounts {
  /** csat_dcp_items — 구문 재배열(order/insert) 문항 수 */
  dcp: number
  /** library_article_vocabularies — 어휘 추출 수 */
  vocab: number
  /** 공개 단어장이 실제로 발행돼 있는가 */
  wordSet: boolean
}

/** 활동이 서려면 무엇이 있어야 하는가 — 화면이 "붙는다" 고만 말하지 않게 하는 표. */
function activityState(
  key: string,
  d: DerivedCounts,
  hasAudio: boolean,
): { ok: boolean; note: string } {
  switch (key) {
    case 'read':
      return { ok: true, note: '본문' }
    case 'word_set':
      if (d.wordSet) return { ok: true, note: '세트 발행됨' }
      return { ok: false, note: d.vocab > 0 ? `어휘 ${d.vocab} · 발행 시 생성` : '어휘 없음' }
    case 'gapfill':
    case 'spelling':
      return d.vocab > 0 ? { ok: true, note: `어휘 ${d.vocab}` } : { ok: false, note: '어휘 없음' }
    case 'order':
    case 'insert':
      // 0 이면 대개 문단 문제다 — 단일 개행은 문단 구분이 아니라 글 전체가 한 문단으로 잡힌다.
      return d.dcp > 0
        ? { ok: true, note: `문항 ${d.dcp}` }
        : { ok: false, note: '미생성 — 가공 스크립트' }
    case 'dictation':
    case 'shadowing':
      return hasAudio ? { ok: true, note: '음성 있음' } : { ok: false, note: '음성 필요' }
    case 'comprehension':
    case 'discussion':
      // 유일한 유료 경로 — 자동으로 만들지 않는다. "아직 없음" 을 숨기지 않는다.
      return { ok: false, note: '유료 생성 · 미구현' }
    default:
      return { ok: false, note: '미상' }
  }
}

/** ⑥ 가공 — 지문마다 어떤 활동이 실제로 만들어졌는지. 기계 변환은 재생성 무료다. */
function ActivityPanel({
  composed,
  jobs,
  tracks,
  derived,
}: {
  composed: ComposedRow[]
  jobs: JobRow[]
  tracks: TrackRow[]
  derived: Record<string, DerivedCounts>
}) {
  if (composed.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-bd bg-bg2 p-s-5 font-body text-sm text-t2">
        아직 작성된 지문이 없습니다. ⑤ 작성에서 발주를 만들고 Claude Code 드레인으로 큐를
        비우면 여기에 나타납니다.
      </p>
    )
  }
  return (
    <section aria-label="활동 파생" className="flex flex-col gap-s-3">
      <p className="font-body text-sm text-t2">
        칸에 적힌 것은 계획이 아니라 지금 있는 것입니다. 기계 변환은 지문을 고쳐도 다시 만들면
        되므로 비용이 들지 않습니다 — 유료 호출은 이해 문항·토론 질문 둘뿐입니다.
      </p>
      <ul className="flex flex-col gap-s-2">
        {composed.map((a) => {
          const job = jobs.find((j) => j.article_id === a.id)
          const track = tracks.find((t) => t.track === job?.track)
          const hasAudio = !!a.audio_url?.trim()
          const planned = track?.activities ?? []
          const d = derived[a.id] ?? { dcp: 0, vocab: 0, wordSet: false }
          return (
            <li key={a.id} className="rounded-lg border border-bd bg-bg p-s-3">
              <div className="font-display text-sm font-bold text-t1">{a.title}</div>
              <div className="font-mono text-[11px] text-t3">
                {job?.track ?? '유형 미상'} · {a.register ?? '—'} ·{' '}
                {a.article_v_level !== null ? `V${a.article_v_level}` : '—'} ·{' '}
                {a.word_count ?? '—'}어
              </div>
              <ul className="mt-s-2 flex flex-wrap gap-s-2">
                {planned.map((k) => {
                  const { ok: open, note } = activityState(k, d, hasAudio)
                  return (
                    <li
                      key={k}
                      className={`rounded px-s-2 py-s-1 font-mono text-[11px] ${
                        open
                          ? 'bg-success-light text-success'
                          : 'bg-warning-light text-warning'
                      }`}
                    >
                      {k} · {note}
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** ⑦ 발행 — 게이트 판정과 본문을 함께 보고 사람이 결정한다. */
function PublishPanel({
  composed,
  gates,
  contentGates,
}: {
  composed: ComposedRow[]
  gates: GateRow[]
  contentGates: ContentGateRow[]
}) {
  const act = useAction()
  const ready = composed.filter((a) => a.status !== 'published')

  if (composed.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-bd bg-bg2 p-s-5 font-body text-sm text-t2">
        검수할 지문이 없습니다.
      </p>
    )
  }

  return (
    <section aria-label="검수와 발행" className="flex flex-col gap-s-4">
      <ErrorNote error={act.error} onClose={act.clear} />
      <p className="font-body text-sm text-t2">
        게이트 통과는 발행 조건이지 발행 이유가 아닙니다. 목표 레벨에 맞는 문장인지, 학습자가
        읽어도 되는 사건인지는 여기서 사람이 봅니다.
      </p>
      <ul className="flex flex-col gap-s-3">
        {composed.map((a) => {
          const mine = gates.filter((g) => g.article_id === a.id)
          const stale = mine.filter((g) => g.content_hash !== a.content_hash)
          const failed = mine.filter((g) => g.severity === 'critical' && g.verdict === 'FAIL')
          // 발행을 막는 게이트는 두 계열이다. 재저작 게이트만 보여 주면 "전부 통과인데
          // 발행이 안 된다" 가 된다 — 실제로 막는 건 콘텐츠 품질 게이트인 경우가 많다
          // (2026-08-17 E2E 점검에서 재현: 어휘 추출 0 이면 트리거가 조용히 막는다).
          const contentFailed = contentGates.filter(
            (g) => g.article_id === a.id && g.severity === 'critical' && g.verdict === 'FAIL',
          )
          const blocked =
            mine.length === 0 || stale.length > 0 || failed.length > 0 || contentFailed.length > 0
          return (
            <li key={a.id} className="rounded-lg border border-bd bg-bg p-s-4">
              <div className="flex flex-wrap items-start gap-s-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-sm font-bold text-t1">{a.title}</h3>
                  <p className="font-mono text-[11px] text-t3">
                    {a.status} · {a.register ?? '—'} · {a.cefr_level ?? '—'} ·{' '}
                    {a.word_count ?? '—'}어 · 음성 {a.audio_url ? '있음' : '없음'}
                  </p>
                  <ul className="mt-s-2 flex flex-col gap-s-1">
                    {mine.length === 0 && (
                      <li className="font-body text-xs text-error">
                        게이트 판정이 없습니다 — 드레인에서 게이트를 실행해야 발행할 수 있습니다.
                      </li>
                    )}
                    {mine.map((g) => (
                      <li key={g.invariant} className="font-body text-xs">
                        <span
                          className={`font-mono font-bold ${
                            g.verdict === 'FAIL'
                              ? 'text-error'
                              : g.verdict === 'WARN'
                                ? 'text-warning'
                                : 'text-success'
                          }`}
                        >
                          {g.verdict}
                        </span>{' '}
                        <span className="text-t1">{g.invariant}</span>{' '}
                        <span className="text-t2">{g.detail}</span>
                      </li>
                    ))}
                    {stale.length > 0 && (
                      <li className="font-body text-xs text-error">
                        본문이 판정 이후에 바뀌었습니다 — 게이트를 다시 실행해야 합니다.
                      </li>
                    )}
                    {(a.article_v_level === null || a.cefr_level === null) && (
                      <li className="font-body text-xs text-warning">
                        난이도가 아직 산출되지 않았습니다 — 이대로 발행하면 학습자 화면에서
                        추천 순위(i+1)가 매겨지지 않습니다. 드레인의 처리 단계를 먼저 실행하세요.
                      </li>
                    )}
                    {contentFailed.map((g) => (
                      <li key={g.invariant} className="font-body text-xs">
                        <span className="font-mono font-bold text-error">막힘</span>{' '}
                        <span className="text-t1">{g.invariant}</span>{' '}
                        <span className="text-t2">
                          {g.invariant.includes('추출')
                            ? '— 어휘 추출이 아직 안 됐습니다. 드레인의 처리 단계를 먼저 실행하세요.'
                            : '— 콘텐츠 품질 게이트가 막고 있습니다.'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {a.status !== 'published' && (
                  <button
                    type="button"
                    className={BTN}
                    disabled={act.pending || blocked}
                    onClick={() => act.run(() => publishComposedArticle(a.id))}
                    title={blocked ? '게이트를 통과해야 발행할 수 있습니다' : '되돌릴 수 없습니다'}
                  >
                    발행
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="font-mono text-xs text-t3">
        검수 대기 {ready.length} · 발행됨 {composed.length - ready.length}
      </p>
    </section>
  )
}
