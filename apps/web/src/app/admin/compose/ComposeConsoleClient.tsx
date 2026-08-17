// apps/web/src/app/admin/compose/ComposeConsoleClient.tsx
// ACP §20 재저작 콘솔 — 7면(소스·피드·발견·원장·작성·가공·발행).
//
// 탭 라벨은 도움말 레지스트리(lib/admin/help/compose.ts)의 tabs 키와 **문자열이 같아야 한다**.
// AdminScreenHelp 가 라벨로 조회하므로 라벨만 바꾸면 도움말이 조용히 사라진다.

'use client'

import { useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { COMPOSE_TABS, COMPOSE_TAB_BACKING, type ComposeTab } from '@/lib/admin/compose-tabs'

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
  envMissing,
}: {
  counts: ComposeCounts
  tracks: TrackRow[]
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

      {tab === '소스' ? (
        <TrackTable tracks={tracks} />
      ) : (
        <NotBuiltYet tab={tab} />
      )}
    </div>
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
