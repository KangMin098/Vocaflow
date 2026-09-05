// apps/web/src/app/admin/csat/evidence/CsatConsoleClient.tsx
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
// 드레인 자체는 Claude Code 배치가 터미널에서 돌린다(청크를 채우는 것은 LLM 이지 버튼이 아니다).
// 그래서 이 화면에 「분석 시작」 버튼은 없다. 대신 **분석이 끝난 뒤 나오는 것**은 여기서 꺼낸다 —
// 「가이드 원천」 탭이 802문항 분석을 교재·학습 가이드가 바로 쓸 수 있는 한 벌로 접어 내려 준다.
// 절차는 화면도움말에 있다.

'use client'

import {
  BookOpenCheck,
  CircleCheck,
  CircleDashed,
  Download,
  Layers,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { CsatCoverageRow, CsatOverview, CsatTypeRow } from '@/lib/csat/client'
import type { CsatGuideSource } from '@/lib/csat/guide-fold'

const TABS = ['회차 커버리지', '유형별 진행', '가이드 원천'] as const
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

const DL_BUTTON =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--bd)] px-3 text-sm text-[var(--tx-2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--sf-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] active:bg-[var(--bd)]'

/**
 * 「가이드 원천」 — 이 파이프라인이 **무엇을 내놓았는지**를 보여 주는 유일한 자리.
 *
 * 첫 화면에 얹지 않고 탭을 열 때 받아 온다. 사전 대조가 낱말 3천 개를 15번에 나눠 묻기 때문에,
 * 콘솔을 열 때마다 치르면 회차 커버리지를 보러 온 사람이 그 값을 대신 낸다.
 */
function GuideTab() {
  const [src, setSrc] = useState<CsatGuideSource | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [openType, setOpenType] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setErr(null)
    try {
      const res = await fetch('/api/admin/csat/guide', { cache: 'no-store' })
      const json = (await res.json()) as { ok?: boolean; source?: CsatGuideSource; error?: string }
      if (!res.ok || !json.ok || !json.source) throw new Error(json.error ?? `HTTP ${res.status}`)
      setSrc(json.source)
      setState('idle')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (state === 'loading' && !src) {
    return <p className="py-6 text-center text-sm text-[var(--tx-3)]">분석 802문항을 접는 중…</p>
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-start gap-3 py-4">
        <p className="text-sm text-[var(--tx-2)]">가이드 원천을 만들지 못했다 — {err}</p>
        <button type="button" onClick={() => void load()} className={DL_BUTTON}>
          다시 시도
        </button>
      </div>
    )
  }

  if (!src) return null

  const t = src.totals
  const gap = src.vocab.filter((v) => !v.in_dictionary)

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="함정 라벨 → 계열"
          value={`${t.trapLabels} → ${t.trapFamilies}`}
          hint="같은 함정이 다른 이름으로 쌓인 것을 접은 수 — 교재 꼭지 수의 상한이다"
        />
        <Stat
          label="필수 어휘"
          value={String(t.vocabLemmas)}
          hint={`사전 등재 ${t.vocabInDictionary} · 미등재 ${t.vocabLemmas - t.vocabInDictionary}`}
        />
        <Stat
          label="사정권 권장 시간"
          value={`${Math.round(t.timeBudgetSec / 60)}분`}
          hint={`${t.items}문항 합 — 회차별 분배의 근거`}
        />
        <Stat label="접은 유형" value={`${t.types}`} hint={`분석 ${t.analyzed}문항에서`} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <a href="/api/admin/csat/guide?format=md" className={DL_BUTTON} download>
          <Download className="h-4 w-4" aria-hidden />
          교재용 Markdown
        </a>
        <a href="/api/admin/csat/guide?format=json&download=1" className={DL_BUTTON} download>
          <Download className="h-4 w-4" aria-hidden />
          JSON (기계 판독)
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-xs text-[var(--tx-3)]">
              <th className="py-2 pr-3 font-medium">유형</th>
              <th className="py-2 pr-3 font-medium">최근 4개년</th>
              <th className="py-2 pr-3 font-medium">절차</th>
              <th className="py-2 pr-3 font-medium">함정 라벨 → 계열</th>
              <th className="py-2 pr-3 font-medium">미끄러지는 자리</th>
              <th className="py-2 font-medium">요구 어휘</th>
            </tr>
          </thead>
          <tbody>
            {src.types.map((ty) => {
              const open = openType === ty.type_id
              return (
                <tr key={ty.type_id} className="border-b border-[var(--bd)] align-top last:border-0">
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => setOpenType(open ? null : ty.type_id)}
                      aria-expanded={open}
                      className="min-h-[44px] text-left text-[var(--tx)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[#8B5CF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
                    >
                      {ty.name}
                      <code className="ml-2 text-xs text-[var(--tx-3)]">{ty.type_id}</code>
                    </button>
                    {open ? (
                      <ul className="mb-2 mt-1 space-y-2">
                        {ty.trap_families.map((f) => (
                          <li key={f.key} className="text-xs text-[var(--tx-2)]">
                            <span className="font-medium text-[var(--tx)]">{f.key}</span>
                            <span className="ml-1 tabular-nums text-[var(--tx-3)]">{f.count}회</span>
                            {f.labels.length > 1 ? (
                              <span className="ml-1 text-[var(--tx-3)]">
                                (병합 라벨 {f.labels.length}: {f.labels.join(' · ')})
                              </span>
                            ) : null}
                          </li>
                        ))}
                        {!ty.trap_families.length ? (
                          <li className="text-xs text-[var(--tx-3)]">유형 리포트가 아직 없다</li>
                        ) : null}
                      </ul>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-[var(--tx-2)]">{ty.recent}</td>
                  <td className="py-2 pr-3 tabular-nums text-[var(--tx-2)]">{ty.procedure.length}단계</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1 tabular-nums text-[var(--tx-2)]">
                      <Layers className="h-3.5 w-3.5 text-[var(--tx-3)]" aria-hidden />
                      {ty.traps_raw} → {ty.trap_families.length}
                    </span>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-[var(--tx-2)]">{ty.failure_modes.length}</td>
                  <td className="py-2 tabular-nums text-[var(--tx-2)]">{ty.vocab.length}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 border-t border-[var(--bd)] pt-4">
        <h3 className="text-sm font-medium text-[var(--tx)]">
          사전에 없는 기출 필수 어휘 {gap.length}낱말
        </h3>
        <p className="mt-1 text-xs text-[var(--tx-3)]">
          분석이 「이 문항을 풀려면 알아야 한다」고 지목했는데 `shared_dictionary` 에 뜻이 없다 — 교재에 실을
          뜻을 아직 못 만든 낱말이다. 요구 문항 수가 많은 순.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--tx-2)]">
          {gap.slice(0, 60).map((v) => `${v.lemma}(${v.items})`).join(' · ')}
          {gap.length > 60 ? ` … 외 ${gap.length - 60}` : ''}
        </p>
      </div>
    </>
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
        <AdminScreenHelp screen="csat-evidence" tab={tab} />
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
            : tab === '유형별 진행'
              ? '남은 몫이 많은 유형이 위에 온다 — 다음에 돌릴 드레인을 여기서 고른다'
              : '분석이 교재·학습 가이드로 나가는 모양 — 유형을 눌러 함정 계열을 편다'}
        </div>
        {tab === '회차 커버리지' ? (
          <CoverageTable rows={coverage} />
        ) : tab === '유형별 진행' ? (
          <TypeTable rows={types} />
        ) : (
          <GuideTab />
        )}
      </section>
    </div>
  )
}
