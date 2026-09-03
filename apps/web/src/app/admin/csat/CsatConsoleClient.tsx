// apps/web/src/app/admin/csat/CsatConsoleClient.tsx
//
// 기출 분석 콘솔.
//
// 이 화면이 답해야 하는 질문은 하나다 — **"이 회차를 지금 풀면 독해에서 실점이 나오나?"**
//
// ⚠️ **「99점」이라고 쓰지 않는다. 두 번 틀린 말이었다.**
//   ① 배점 단위가 2·3점이라 **99점이라는 점수 자체가 안 나온다** — 100 다음은 98이다.
//      곧 「99점 이상」은 실질적으로 **100점**이다.
//   ② 100점은 듣기까지 만점이어야 한다. 독해를 다 맞혀도 총점은 100 − 듣기 실점이다.
//   듣기는 이 파이프라인이 다루지 않으므로(사용자 지시 2026-09-03), 이 화면은
//   **우리가 책임지는 것만** 말한다 — 독해 사정권 배점(2015~ 63점 · 2014학년도 53점)에서 실점 0.
//
// 그래서 진행률을 문항 수 백분율로 보여 주지 않는다 — 96% 는 실점 0이 아니다.
// 회차마다 **덮은 배점 / 사정권 배점**을 그대로 적고, 같을 때만 초록이다.
//
// 조작 버튼을 두지 않았다. 드레인은 Claude Code 배치가 터미널에서 돌리고, 이 화면은
// **어디까지 됐는지와 다음에 무엇을 돌릴지**를 말한다. 절차는 화면도움말에 있다.

'use client'

import { BookOpenCheck, CircleCheck, CircleDashed, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { CsatCoverageRow, CsatOverview, CsatTypeRow } from '@/lib/csat/client'

const TABS = ['회차 커버리지', '유형별 진행'] as const
type Tab = (typeof TABS)[number]

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[var(--bd)] bg-[var(--sf)] p-4">
      <div className="text-xs text-[var(--tx-3)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[var(--tx)]">{value}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--tx-3)]">{hint}</div> : null}
    </div>
  )
}

/** 배점 막대 — 백분율이 아니라 **점수 두 개**를 보여 준다. 반올림이 숨을 자리를 없앤다. */
function PointsBar({ covered, total }: { covered: number; total: number }) {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0
  const full = total > 0 && covered === total
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-[var(--bd)]">
        <div
          className="h-full rounded-full transition-[width] duration-[var(--dur-normal)] ease-[var(--ease)]"
          style={{ width: `${pct}%`, background: full ? '#2E7D5A' : pct > 0 ? '#B5803A' : 'transparent' }}
        />
      </div>
      <span className="tabular-nums text-xs text-[var(--tx-2)]">
        {covered}/{total}점
      </span>
    </div>
  )
}

function CoverageTable({ rows }: { rows: CsatCoverageRow[] }) {
  const [kind, setKind] = useState<'all' | 'suneung' | 'mock'>('all')
  const shown = useMemo(() => (kind === 'all' ? rows : rows.filter((r) => r.kind === kind)), [rows, kind])

  return (
    <>
      <div className="mb-3 flex gap-1">
        {(
          [
            ['all', '전체'],
            ['suneung', '수능'],
            ['mock', '모의평가'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`min-h-[44px] rounded-md px-3 text-sm transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] disabled:opacity-50 ${
              kind === k
                ? 'bg-[#8B5CF6] text-white'
                : 'border border-[var(--bd)] text-[var(--tx-2)] hover:bg-[var(--sf-2)] active:bg-[var(--bd)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-xs text-[var(--tx-3)]">
              <th className="py-2 pr-3 font-medium">회차</th>
              <th className="py-2 pr-3 font-medium">사정권</th>
              <th className="py-2 pr-3 font-medium">분석</th>
              <th className="py-2 pr-3 font-medium">검수 통과</th>
              <th className="py-2 pr-3 font-medium">덮은 배점</th>
              <th className="py-2 font-medium">독해 실점 0</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.exam_id} className="border-b border-[var(--bd)] last:border-0">
                <td className="py-2 pr-3 text-[var(--tx)]">{r.label}</td>
                <td className="py-2 pr-3 tabular-nums text-[var(--tx-2)]">{r.in_scope_items}문항</td>
                <td className="py-2 pr-3 tabular-nums text-[var(--tx-2)]">{r.analyzed}</td>
                <td className="py-2 pr-3 tabular-nums text-[var(--tx-2)]">{r.published}</td>
                <td className="py-2 pr-3">
                  <PointsBar covered={r.covered_points} total={r.scope_points} />
                </td>
                <td className="py-2">
                  {r.covers_99 ? (
                    <span className="inline-flex items-center gap-1 text-[#2E7D5A]">
                      <CircleCheck className="h-4 w-4" aria-hidden />
                      <span className="text-xs">가능</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[var(--tx-3)]">
                      <CircleDashed className="h-4 w-4" aria-hidden />
                      <span className="text-xs">미달</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!shown.length ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-[var(--tx-3)]">
                  회차가 없다 — `node scripts/csat/corpus-sync.mjs --commit` 을 먼저 돌린다
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  )
}

function TypeTable({ rows }: { rows: CsatTypeRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-[var(--bd)] text-left text-xs text-[var(--tx-3)]">
            <th className="py-2 pr-3 font-medium">유형</th>
            <th className="py-2 pr-3 font-medium">문항</th>
            <th className="py-2 pr-3 font-medium">검수 통과</th>
            <th className="py-2 pr-3 font-medium">남은 몫</th>
            <th className="py-2 font-medium">유형 리포트</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.type_id} className="border-b border-[var(--bd)] last:border-0">
              <td className="py-2 pr-3">
                <span className="text-[var(--tx)]">{t.name}</span>
                <code className="ml-2 text-xs text-[var(--tx-3)]">{t.type_id}</code>
                {t.status === 'retired' ? (
                  <span className="ml-2 rounded bg-[var(--sf-2)] px-1.5 py-0.5 text-[10px] text-[var(--tx-3)]">
                    폐지
                  </span>
                ) : null}
              </td>
              <td className="py-2 pr-3 tabular-nums text-[var(--tx-2)]">{t.items}</td>
              <td className="py-2 pr-3 tabular-nums text-[var(--tx-2)]">{t.published}</td>
              <td className="py-2 pr-3 tabular-nums text-[var(--tx-2)]">{t.items - t.published}</td>
              <td className="py-2">
                {t.has_report ? (
                  <span className="text-xs text-[#2E7D5A]">있음 (n={t.report_n})</span>
                ) : (
                  <span className="text-xs text-[var(--tx-3)]">없음</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CsatConsoleClient({ coverage, types, totals, loadError }: CsatOverview) {
  const [tab, setTab] = useState<Tab>(TABS[0])

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#8B5CF6]" aria-hidden />
          <h1 className="text-lg font-semibold text-[var(--tx)]">기출 분석 (CSAT)</h1>
        </div>
        <AdminScreenHelp screen="csat" tab={tab} />
      </header>

      {loadError ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#9C3A30] bg-[var(--sf)] p-3 text-sm text-[var(--tx-2)]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#9C3A30]" aria-hidden />
          <span>불러오지 못했다 — {loadError}</span>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="독해 실점 0 회차"
          value={`${totals.exams99} / ${totals.exams}`}
          hint="사정권 배점을 전부 덮은 회차 (듣기는 다루지 않는다)"
        />
        <Stat
          label="검수 통과 문항"
          value={`${totals.published} / ${totals.inScopeItems}`}
          hint="3인 전원 pass"
        />
        <Stat label="검수 기록" value={String(totals.reviews)} hint="문항당 3건" />
        <Stat
          label="정답 미상"
          value={String(totals.answerUnknown)}
          hint="평가원 정답표 부재 — 정답 근거를 못 쓴다"
        />
      </div>

      <div className="mb-3 flex gap-1 border-b border-[var(--bd)]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-[44px] px-3 text-sm transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] ${
              tab === t
                ? 'border-b-2 border-[#8B5CF6] text-[var(--tx)]'
                : 'text-[var(--tx-3)] hover:text-[var(--tx-2)]'
            }`}
            aria-current={tab === t ? 'page' : undefined}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-[var(--bd)] bg-[var(--sf)] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs text-[var(--tx-3)]">
          <BookOpenCheck className="h-4 w-4" aria-hidden />
          {tab === '회차 커버리지'
            ? '덮은 배점이 사정권 배점과 같아야 「가능」이다 — 듣기는 세지 않는다'
            : '남은 몫이 많은 유형이 위에 온다 — 다음에 돌릴 드레인을 여기서 고른다'}
        </div>
        {tab === '회차 커버리지' ? <CoverageTable rows={coverage} /> : <TypeTable rows={types} />}
      </section>
    </div>
  )
}
