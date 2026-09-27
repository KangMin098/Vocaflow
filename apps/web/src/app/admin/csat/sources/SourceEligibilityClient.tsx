// apps/web/src/app/admin/csat/sources/SourceEligibilityClient.tsx
// 원문 적격 — 교재에 실을 수 있는 원문인가를 일곱 축으로 판정한 결과. 조작은 없다(판정은 스캔).
//
// ── 왜 원천 이름이 링크인가 (2026-09-13) ────────────────────────────
// 이 화면은 원천 이름을 스물한 번 부르면서 **그 원천의 원문을 어디서 보는지 한 번도 말하지
// 않았다.** 링크가 0개였다. 그래서 "PLOS 가 13.3% 밖에 안 된다" 를 읽은 관리자가 그 다음에
// 할 일(그 원문을 열어 보는 것)을 하려면 사이드바에서 **다른 이름의 메뉴**(「짧은 글 · ACP」)를
// 찾아 들어가 필터를 손으로 맞춰야 했다. 판정과 원본이 두 화면으로 갈라져 있으면 판정만 읽고
// 끝난다.

'use client'

import type { EligibilityDrift } from '@/lib/textbook/eligibility-drift'
import Link from 'next/link'

import { SourceWorkspace } from './SourceWorkspace'
import type { SourceLiveResult } from '@/lib/textbook/source-live'
import type { SourceRounds } from '@/lib/textbook/source-pipeline'
import type { SourceWorkspaceState } from '@/lib/textbook/source-workspace'
import type { SourceInventoryPanel } from '@/lib/textbook/source-inventory-view'

import { NextStepPipeline } from './NextStepPipeline'
import type {
  AxisRow,
  BandRow,
  DefectPanel,
  TypeInventoryPanel,
  FillPlanPanel,
  DrainAuditPanel,
  SourceYieldPanel,
  GradeRow,
  SourceEligibilityPanel,
} from '@/lib/textbook/source-eligibility-view'

/**
 * 등급 색 — **색만으로 말하지 않는다.** 옆에 「조판 가능/불가」 글자를 함께 둔다.
 * 색맹 대응이자, 흑백 인쇄된 화면에서도 읽히게 하는 장치다.
 */
const GRADE_TONE: Record<string, string> = {
  usable: 'var(--success-ink)',
  excerpt: 'var(--success-ink)',
  'excerpt-blind': 'var(--warning-ink)',
  unjudged: 'var(--warning-ink)',
  unknown: 'var(--warning-ink)',
  blocked: 'var(--error-ink)',
}

/**
 * 원천 이름 → **그 원천의 원문 목록.**
 *
 * `status=all` 을 명시하는 이유: 검수 단계의 기본 상태 필터는 `ready` 라, 안 적으면
 * 보관·실패·처리 중인 것이 조용히 빠진다. 여기서 보낸 사람은 "이 원천이 지금 어떤가" 를
 * 보러 가는 것이므로 전체가 맞다(`lib/articles/console-view.ts` 의 `defaultStatusFilter`).
 */
function SourceLink({ source, children }: { source: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/admin/articles?stage=review&status=all&src=${encodeURIComponent(source)}`}
      title={`${source} 원문 목록 열기`}
      className="inline-flex min-h-[44px] items-center text-[var(--t2)] underline decoration-dotted underline-offset-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--admin)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)] active:text-[var(--admin)]"
    >
      {children}
    </Link>
  )
}

/**
 * **스냅샷 이후 DB 가 얼마나 움직였나.**
 *
 * 이 화면의 수치는 커밋된 스냅샷이다 — 깊은 판정(발췌창·추출 결함)이 들어 있어 요청마다
 * 다시 못 잰다. 그런데 그것만 그리면 **드레인을 돌려도 화면이 안 움직인다**. 관리자는
 * 「안 늘었다」를 보고 안 해도 될 일을 또 한다(실측 2026-09-23: 스냅샷 87,716 vs DB 87,720).
 *
 * ⚠️ 못 읽었으면 **「못 읽었다」고 적는다** — 「안 움직였다」와 정반대다.
 */
function DriftBar({ drift }: { drift: EligibilityDrift }) {
  if (!drift.available) {
    return (
      <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3 font-body text-[12px] text-[var(--memory-new)]">
        지금 값을 못 읽었다 — 스냅샷과의 차이를 모른다(0 이 아니다).
        {drift.error ? <span className="ml-1">{drift.error}</span> : null}
      </p>
    )
  }
  const delta = (drift.nowTotal ?? 0) - drift.snapshotTotal
  const moved = delta !== 0 || drift.grades.length > 0
  return (
    <div
      className="flex flex-col gap-1 rounded-[var(--r-md)] border p-3"
      style={{
        borderColor: moved ? 'color-mix(in srgb, var(--memory-shaky) 33.3%, transparent)' : 'var(--bd)',
        background: moved ? 'color-mix(in srgb, var(--memory-shaky) 5.9%, transparent)' : 'var(--bg2)',
      }}
    >
      <p className="break-keep font-display text-[12.5px] font-[700] text-[var(--t1)]">
        {moved ? '스냅샷 이후 DB 가 움직였다' : '스냅샷과 지금이 같다'}
        <span className="ml-2 font-mono text-[12px] font-[400] tabular-nums text-[var(--t2)]">
          {drift.snapshotTotal.toLocaleString()} → {(drift.nowTotal ?? 0).toLocaleString()}
          {delta !== 0 ? (
            <span className="ml-1" style={{ color: delta > 0 ? 'var(--memory-stable)' : 'var(--memory-risk)' }}>
              ({delta > 0 ? '+' : ''}
              {delta.toLocaleString()})
            </span>
          ) : null}
        </span>
      </p>
      {drift.grades.length ? (
        <p className="break-keep font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
          {drift.grades
            .slice(0, 6)
            .map((g) => `${g.grade} ${g.delta > 0 ? '+' : ''}${g.delta.toLocaleString()}`)
            .join(' · ')}
        </p>
      ) : null}
      <p className="break-keep font-body text-[11px] leading-snug text-[var(--t3)]">
        위 표는 <strong>스냅샷</strong>이다(본문을 읽어야 나오는 판정이 들어 있다). 이 줄은{' '}
        <strong>지금 DB</strong>다. 둘이 갈라져 있으면 스냅샷을 다시 구울 때가 됐다 —{' '}
        <code className="font-mono text-[10.5px]">source-eligibility-scan.mjs</code>.
      </p>
    </div>
  )
}

export function SourceEligibilityClient({ panel, inventory, initialState, drift, live, rounds, nextRound }: {
  panel: SourceEligibilityPanel
  inventory: SourceInventoryPanel
  initialState?: SourceWorkspaceState
  drift: EligibilityDrift
  live?: SourceLiveResult
  rounds?: Record<string, SourceRounds>
  nextRound?: number
}) {
  return <SourceWorkspace panel={panel} inventory={inventory} initialState={initialState} live={live} rounds={rounds} nextRound={nextRound}
    eligibility={<>
      <DriftBar drift={drift} />
      <GradeTable grades={panel.grades} total={panel.total.total} />
      <AxisTable axes={panel.axes} />
      <p className="text-[12px] text-[var(--t2)]">지금 조판이 받으면 안 되는 편수: {(panel.total.total - panel.total.composable).toLocaleString()}편</p>
      <details><summary>학령과 유형별 요건</summary><div><RequirementTable panel={panel} /><BandTable bands={panel.bands} /></div></details>
      <details><summary>원천별 제외 기록과 수율</summary><div><BlockedSources rows={panel.blockedBySource} />{panel.sourceYield ? <SourceYieldTable yieldPanel={panel.sourceYield} /> : null}</div></details>
      <details><summary>본문 추출 결함</summary><div><DefectTable defects={panel.defects} /></div></details>
    </>}
    operations={<>
      <FreshnessBar panel={panel} />
      <p className="text-[12px] text-[var(--t2)]">문항이 붙은 원문 {panel.articlesWithItems == null ? '미측정' : panel.articlesWithItems.toLocaleString() + '편'}. 조판 통과와의 교집합은 이 집계로 알 수 없습니다.</p>
      <NextStepPipeline panel={panel} />
      {panel.fillPlan && panel.typeInventory && new Date(panel.fillPlan.computedAt).getTime() < new Date(panel.typeInventory.measuredAt).getTime() ? <p role="status" className="text-[12px] text-[var(--warning-ink)]">보충 계획이 유형 재고보다 오래되었습니다. 아래 계획을 실행하기 전에 item-fill-plan.mjs로 다시 계산하세요.</p> : null}
      <details><summary>유형별 문항과 보충 계획</summary><div>{panel.typeInventory ? <TypeInventoryTable inv={panel.typeInventory} /> : null}{panel.fillPlan ? <FillPlanTable plan={panel.fillPlan} /> : null}</div></details>
      <details><summary>문항 검수 드레인 결과</summary><div>{panel.drainAudit ? <DrainAuditTable audit={panel.drainAudit} /> : null}</div></details>
    </>}
  />
}

/**
 * 언제 잰 값인가.
 *
 * ⚠️ **이 줄을 지우면 안 된다.** 이 화면은 실시간 집계가 아니라 스냅샷을 읽는다
 * (`library_articles` 는 본문이 1.3GB 라 조건부 exact count 가 8초 타임아웃에 걸린다).
 * 낡은 값을 최신인 척 보이는 것이 가장 나쁜 실패다.
 */
function FreshnessBar({ panel }: { panel: SourceEligibilityPanel }) {
  const stale = panel.ageDays >= 7 || panel.specStale
  return (
    <p
      className="rounded-[var(--r-sm)] border px-3 py-2 font-body text-[12px]"
      style={{
        borderColor: stale ? 'var(--warning)' : 'var(--bd)',
        color: stale ? 'var(--warning-ink)' : 'var(--t3)',
      }}
    >
      {panel.measuredAt.slice(0, 16).replace('T', ' ')} UTC 에 잰 값
      {panel.ageDays > 0 ? ` · ${panel.ageDays}일 전` : ' · 오늘'} · 대상 {panel.scope}
      {panel.specStale ? ' · ⚠️ 판정 규격이 바뀌었다 — 다시 재야 한다' : ''}
      <span className="ml-2 text-[var(--t3)]">
        갱신: <code>pnpm dlx tsx scripts/textbook/source-eligibility-scan.mjs</code>
      </span>
    </p>
  )
}

/** 일곱 축 — **자의 출처를 함께 보인다.** "왜 이 원문을 골랐나" 에 답하는 자리다. */
function AxisTable({ axes }: { axes: AxisRow[] }) {
  // 막대의 분모 — **가장 큰 축**이다. 전체 재고로 나누면 일곱 줄이 전부 실선이 되어
  // 서로 안 견줘진다(내용 판정 48,811 vs 학령 분석 16).
  const maxBlocked = Math.max(1, ...axes.map((a) => a.blocked ?? 0))
  return (
    <section aria-label="판정 기준" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">판정 기준 — 일곱 축</h2>
      <p className="font-body text-[12px] text-[var(--t3)]">
        순서가 곧 판정 순서다. <b>되돌릴 수 없는 축을 먼저</b> 본다 — 그래야 “고치면 되는 문제” 와
        “고칠 수 없는 문제” 가 사유에 섞이지 않는다. 임계값은 전부 실측에서 나온 값이고, 그 출처를
        함께 적는다.
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-[11px] text-[var(--t3)]">
        <span>
          <span aria-hidden className="font-mono">🔒</span> <b style={{ color: 'var(--error-ink)' }}>되돌릴 수 없는 축</b> — 빼는 것이 유일한 처방
        </span>
        <span>
          <span aria-hidden className="font-mono">↺</span> 되돌릴 수 있는 축 — 그 축의 드레인을 돌린다
        </span>
        <span>막대는 <b>가장 큰 축 대비</b> 탈락 수다</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
              <th className="py-2 pr-3 font-[600]">축</th>
              <th className="py-2 pr-3 font-[600]">무엇을 묻나</th>
              <th className="py-2 pr-3 font-[600]">자의 출처</th>
              <th className="py-2 pr-3 text-right font-[600]">지금 탈락</th>
              <th className="py-2 font-[600]">되돌리기</th>
            </tr>
          </thead>
          <tbody>
            {/*
              ⚠️ **되돌릴 수 없는 축을 눈으로 갈라 놓는다.** 일곱 줄이 같은 톤이면
              「고치면 되는 문제」와 「고칠 수 없는 문제」가 섞여 읽힌다 — 이 표 머리말이
              그러지 말라고 적고 있는데 정작 표가 그러고 있었다. 왼쪽 띠 + 자물쇠 기호로
              가르되 **색만으로 말하지 않는다**(맨 오른쪽 글자가 그대로 남아 있다).
            */}
            {axes.map((a) => {
              const bar = maxBlocked > 0 ? ((a.blocked ?? 0) / maxBlocked) * 100 : 0
              return (
                <tr key={a.id} className="border-b border-[var(--bd)] align-top">
                  <td
                    className="py-2 pr-3 font-[700] text-[var(--t1)]"
                    style={{
                      borderLeft: `3px solid ${a.recoverable ? 'var(--bd)' : 'var(--error-ink)'}`,
                      paddingLeft: '8px',
                    }}
                  >
                    <span aria-hidden className="mr-1 font-mono text-[10px] text-[var(--t3)]">
                      {a.recoverable ? '↺' : '🔒'}
                    </span>
                    {a.label}
                  </td>
                  <td className="py-2 pr-3 text-[var(--t2)]">{a.question}</td>
                  <td className="py-2 pr-3">
                    {/* 자의 출처는 **코드 칩**이다 — 산문이 아니라 「어느 파일·어느 상수」다. */}
                    <code className="inline-block rounded-[var(--r-sm)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[10px] leading-[1.4] text-[var(--t3)] [overflow-wrap:anywhere]">
                      {a.source}
                    </code>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">
                    {a.blocked ? a.blocked.toLocaleString() : '—'}
                    {/* 가로 막대 — 일곱 축의 탈락 수가 서로 견줘진다(가장 큰 축이 100%). */}
                    <span
                      aria-hidden
                      className="mt-1 block h-[4px] overflow-hidden rounded-[var(--r-full)] bg-[var(--bg2)]"
                    >
                      <i
                        className="block h-full rounded-[var(--r-full)]"
                        style={{
                          width: `${bar}%`,
                          background: a.recoverable ? 'var(--warning-ink)' : 'var(--error-ink)',
                        }}
                      />
                    </span>
                  </td>
                  <td
                    className="py-2 text-[12px]"
                    style={{ color: a.recoverable ? 'var(--t2)' : 'var(--error-ink)' }}
                  >
                    {a.recoverable ? '가능' : '불가 — 영영 못 쓴다'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * 연령 × 유형별 원문 요건.
 *
 * 위 표들이 "지금 몇 편인가" 를 말한다면 이 표는 **"무엇을 갖춰야 하는가"** 를 말한다.
 * 둘이 함께 있어야 "이 지문을 왜 이 학년 이 유형에 썼나" 에 답할 수 있다 —
 * 그 답이 없으면 원문 선택은 감이다.
 *
 * ⚠️ **DB 를 안 본다.** 정본(`SERIES_SPINE` + `itemWordSpec`)에서 바로 펴므로
 *   스냅샷이 낡아도 이 표는 늘 지금 규격이다.
 */
/**
 * 매트릭스의 행 — **유형 union**.
 *
 * 학년마다 열리는 유형이 다르다(V1 은 셋, V5~V7 은 열아홉). 그래서 행은 전 학년에서
 * 한 번이라도 열리는 유형 전부이고, 안 열리는 칸은 `byBand` 에 없다 —
 * 화면이 그 칸을 「없음」이 아니라 「안 열림」으로 그린다.
 */
function typeRows(panel: SourceEligibilityPanel) {
  const rows = new Map<
    string,
    {
      type: string
      label: string
      familyLabel: string
      byBand: Record<number, { window: { min: number; max: number } | null; narrowed: boolean }>
    }
  >()
  for (const b of panel.requirements) {
    for (const t of b.types) {
      if (!rows.has(t.type)) {
        rows.set(t.type, { type: t.type, label: t.label, familyLabel: t.familyLabel, byBand: {} })
      }
      rows.get(t.type)!.byBand[b.vLevel] = { window: t.window, narrowed: t.narrowed }
    }
  }
  // 열리는 학년이 많은 유형부터 — 위쪽이 전 학년 공통이라 표가 읽히는 순서가 된다.
  return [...rows.values()].sort(
    (a, z) => Object.keys(z.byBand).length - Object.keys(a.byBand).length,
  )
}

function RequirementTable({ panel }: { panel: SourceEligibilityPanel }) {
  const families = [...new Set(panel.requirements.flatMap((b) => b.types.map((t) => t.family)))]
  return (
    <section aria-label="연령별 유형별 원문 요건" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
        연령 × 유형별 원문 요건
      </h2>
      <p className="font-body text-[12px] text-[var(--t3)]">
        어느 학년에 어느 유형이 열리는지는 <b>학령 사다리 7단</b>이 정하고, 그 유형이 요구하는 지문
        어수창은
        <b> 유형 계열</b>이 정한 뒤 <b>그 학년대 시중 분포(p10~p90)</b>가 좁힌다. 좁히지 못한 칸은
        그렇게 적는다 — 좁혀진 척하면 근거가 거짓이 된다.
      </p>
      {/*
        ⚠️ **칩 나열에서 매트릭스로** (2026-09-16). 예전에는 학년 카드 7장에 유형 칩이
        수십 개 흩어져 있었다 — 「어느 유형이 어느 학년에서 열리나」를 보려면 카드 일곱 장을
        눈으로 오가야 했고, 그 비교가 이 표의 유일한 쓸모다. 행을 유형으로 세우면 그 비교가
        한 줄이 된다.

        ⚠️ **빈 칸은 「없음」이 아니라 「그 학년에 안 열림」이다.** 둘을 같게 그리면
        「재료가 없다」로 읽혀 없는 문제를 쫓게 된다.
      */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse font-body text-[12px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[11px] text-[var(--t2)]">
              <th className="sticky left-0 bg-[var(--bg)] py-2 pr-3 font-[600]">유형</th>
              {panel.requirements.map((b) => (
                <th key={b.vLevel} className="px-1.5 py-2 text-center font-[600] align-bottom">
                  <span className="block font-display text-[12px] font-[700] text-[var(--t1)]">
                    V{b.vLevel}
                  </span>
                  <span className="block text-[10px] text-[var(--t2)]">{b.schoolBand}</span>
                  <span className="block text-[9px] font-[400] leading-tight text-[var(--t3)]">
                    {b.step}단 · {b.volumeTitle}
                  </span>
                  <span className="block text-[9px] font-[400] text-[var(--t3)]">
                    {b.marketBucket ? `시중 버킷 ${b.marketBucket}` : '시중 버킷 없음'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {typeRows(panel).map((row) => (
              <tr key={row.type} className="border-b border-[color-mix(in_srgb,var(--bd)_50%,transparent)]">
                <th
                  scope="row"
                  className="sticky left-0 bg-[var(--bg)] py-1.5 pr-3 text-left font-[600] text-[var(--t1)]"
                  title={row.familyLabel}
                >
                  {row.label}
                </th>
                {panel.requirements.map((b) => {
                  const cell = row.byBand[b.vLevel]
                  if (!cell) {
                    // 그 학년에 이 유형이 **안 열린다** — 재료가 없는 것과 다르다.
                    return (
                      <td
                        key={b.vLevel}
                        className="px-1.5 py-1.5 text-center text-[10px] text-[var(--t5)]"
                        title="이 학년에서는 이 유형을 내지 않는다"
                      >
                        ·
                      </td>
                    )
                  }
                  if (!cell.window) {
                    return (
                      <td
                        key={b.vLevel}
                        className="px-1.5 py-1.5 text-center text-[10px] text-[var(--t3)]"
                      >
                        지문 없음
                      </td>
                    )
                  }
                  return (
                    <td key={b.vLevel} className="px-1.5 py-1.5 text-center">
                      {/* 색만으로 말하지 않는다 — 좁혔는지는 아래 글자로도 적는다. */}
                      <span
                        className="block tabular-nums"
                        style={{ color: cell.narrowed ? 'var(--success-ink)' : 'var(--t2)' }}
                      >
                        {/* ⚠️ **한 표현식으로 만든다** — 표현식과 리터럴을 붙여 쓰면 서버 렌더가
                            사이에 주석 마커를 넣어 `120–178어` 가 한 문자열로 안 남는다(회귀가 잡는다). */}
                        {`${cell.window.min}–${cell.window.max}어`}
                      </span>
                      <span className="block text-[9px] text-[var(--t3)]">
                        {cell.narrowed ? '학년으로 좁힘' : '유형 창 그대로'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-[11px] text-[var(--t3)]">
        <span>
          <b style={{ color: 'var(--success-ink)' }}>학년으로 좁힘</b> — 그 학년대 시중 분포가 창을 좁혔다
        </span>
        <span>
          <b style={{ color: 'var(--t2)' }}>유형 창 그대로</b> — 교차가 비어 좁히지 못했다
        </span>
        <span>
          <b>지문 없음</b> — 그 유형은 지문을 안 쓴다
        </span>
        <span>
          <b>·</b> — 그 학년에서는 이 유형을 내지 않는다
        </span>
      </p>
      <details className="rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-2">
        <summary className="cursor-pointer font-body text-[12px] font-[600] text-[var(--t2)]">
          계열별 창의 출처 — 짐작으로 정한 값이 없다는 근거
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          {families.map((f) => (
            <li key={f} className="font-body text-[11px] text-[var(--t3)]">
              <b className="text-[var(--t2)]">
                {
                  panel.requirements.flatMap((b) => b.types).find((t) => t.family === f)
                    ?.familyLabel
                }
              </b>{' '}
              — {panel.familySource[f]}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

/** 등급 여섯 — **다음에 할 일**로 가른 결과. */
function GradeTable({ grades, total }: { grades: GradeRow[]; total: number }) {
  return (
    <section aria-label="등급 분포" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
        등급 분포
        <span className="ml-2 font-body text-[13px] font-[500] tabular-nums text-[var(--t2)]">
          {total.toLocaleString()}편
        </span>
      </h2>
      <ul className="flex flex-col gap-1">
        {grades.map((g) => (
          <li
            key={g.grade}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-2 font-body text-[13px]"
          >
            <span className="w-[110px] font-[700]" style={{ color: GRADE_TONE[g.grade] }}>
              {g.label}
            </span>
            <span
              aria-hidden
              className="h-[6px] w-[120px] overflow-hidden rounded-[var(--r-sm)] bg-[var(--bd)]"
            >
              <span
                className="block h-full rounded-[var(--r-sm)]"
                style={{
                  width: `${Math.max(1, Math.round(g.pct))}%`,
                  background: GRADE_TONE[g.grade],
                }}
              />
            </span>
            <span className="tabular-nums text-[var(--t1)]">{g.count.toLocaleString()}</span>
            <span className="tabular-nums text-[var(--t3)]">{g.pct}%</span>
            <span className="text-[11px] font-[700] text-[var(--t2)]">
              {g.composable ? '조판 가능' : '조판 불가'}
            </span>
            <span className="ml-auto text-[12px] text-[var(--t2)]">{g.nextStep}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 밴드별 — 어느 학년 교재가 지금 만들어질 수 있는가. */
function BandTable({ bands }: { bands: BandRow[] }) {
  return (
    <section aria-label="학령별 적격" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">학령별 적격</h2>
      <p className="font-body text-[12px] text-[var(--t3)]">
        조판 가능이 0 인 칸은 <b>그 학년 교재를 지금 만들 수 없다</b>는 뜻이다. 재고가 있어도 판정을
        통과하지 못하면 실을 수 없다.{' '}
        {/*
          ⚠️ **지문을 안 쓰는 학년이 있다.** V1 은 유형 셋이 전부 no-passage(운율·낱말뜻·철자빈칸)라
          지문을 한 편도 안 쓴다. 그런데 조판 가능 비율은 5/80 = 6.3% 로 찍혀 "이 학년은 거의 다 못
          쓴다" 로 읽힌다 — 그 학년에서는 애초에 판단 근거가 아닌 수치다. 요건표가 정본이다.
        */}
        <b>「지문 없음」으로 표시된 학년은 이 수치가 판단 근거가 아니다</b> — 그 학년 유형이 지문을
        쓰지 않는다(요건표가 정본).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
              <th className="py-2 pr-3 font-[600]">V</th>
              <th className="py-2 pr-3 font-[600]">학령</th>
              <th className="py-2 pr-3 text-right font-[600]">원문</th>
              <th className="py-2 pr-3 text-right font-[600]">조판 가능</th>
              <th className="py-2 pr-3 text-right font-[600]">비율</th>
              <th className="py-2 pr-3 text-right font-[600]">그대로</th>
              <th className="py-2 pr-3 text-right font-[600]">발췌</th>
              <th className="py-2 pr-3 text-right font-[600]">미판정</th>
              <th className="py-2 text-right font-[600]">불가</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b) => (
              <tr key={String(b.vLevel)} className="border-b border-[var(--bd)]">
                <td className="py-2 pr-3 font-[700] tabular-nums text-[var(--t1)]">
                  {b.vLevel == null ? '없음' : `V${b.vLevel}`}
                </td>
                <td className="py-2 pr-3 text-[var(--t2)]">
                  {b.schoolBand ?? <span className="text-[var(--t3)]">사다리 밖</span>}
                  {b.volumeTitle ? (
                    <span className="ml-1 text-[11px] text-[var(--t3)]">{b.volumeTitle}</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">
                  {b.total.toLocaleString()}
                </td>
                <td
                  className="py-2 pr-3 text-right font-[700] tabular-nums"
                  style={{
                    color: !b.needsPassage
                      ? 'var(--t3)'
                      : b.composable
                        ? 'var(--success-ink)'
                        : 'var(--error-ink)',
                  }}
                >
                  {b.composable.toLocaleString()}
                  {!b.needsPassage ? (
                    <span className="ml-1 text-[11px] font-[400]">지문 없음</span>
                  ) : b.composable === 0 ? (
                    <span className="ml-1 text-[11px]">만들 수 없음</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">
                  {b.composablePct}%
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t3)]">
                  {b.byGrade.usable.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t3)]">
                  {b.byGrade.excerpt.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t3)]">
                  {b.byGrade.unjudged.toLocaleString()}
                </td>
                <td className="py-2 text-right tabular-nums text-[var(--t3)]">
                  {b.byGrade.blocked.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** 원천별 — 한 원천이 통째로 막혀 있으면 그 원천의 처리 단계가 밀린 것이다. */
function BlockedSources({ rows }: { rows: { source: string; count: number }[] }) {
  if (!rows.length) return null
  return (
    <section aria-label="조판 불가 원천" className="flex flex-col gap-2">
      <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">
        조판 불가가 많은 원천
      </h2>
      <p className="font-body text-[12px] text-[var(--t3)]">
        한 원천이 통째로 막혀 있으면 대개 <b>그 원천의 처리 단계가 밀린 것</b>이지 원천이 나쁜 것이
        아니다.
      </p>
      <ul className="flex flex-wrap gap-2">
        {rows.slice(0, 12).map((r) => (
          <li
            key={r.source}
            className="rounded-[var(--r-sm)] border border-[var(--bd)] px-3 font-body text-[12px] text-[var(--t2)]"
          >
            <SourceLink source={r.source}>
              {r.source} <b className="ml-1 tabular-nums text-[var(--t1)]">{r.count.toLocaleString()}</b>
            </SourceLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * 추출 결함 — **일곱 축이 통과시킨 뒤에도 남는 것.**
 *
 * 축은 「이 원문을 써도 되는가」를 묻고, 그 질문은 본문이 온전하다는 것을 전제한다.
 * 전제가 깨진 경우는 축이 못 잡는다 — 장르도 저작권도 어수도 맞는데 본문 첫 문단이
 * `You are using an outdated browser…` 이거나 초록이 두 번 들어 있다.
 * 그대로 조판하면 **그 문자열이 학생이 읽는 지문에 인쇄된다.**
 *
 * ⚠️ **비율만 보이면 오해를 부른다.** 한 원천이 그 결함의 80% 이상을 차지하면 그 사실을
 * 함께 말한다 — "본문 절반이 깨졌다" 와 "한 원천의 수확기가 한 군데서 겹쳐 붙인다" 는
 * 처방이 완전히 다르다.
 */
/**
 * **유형 재고 — 원문이 아니라 유형이 병목인지 말한다.**
 *
 * 일곱 축을 다 통과한 원문이 아무리 많아도, 시중이 내는 **유형**을 우리가 못 내면 교재는
 * 시중을 못 따라간다. 조판 로그가 오래 「시장 유형 적합도 99.4%(가진 유형 안에서) ·
 * **시장 전체 기준 30.1%**」라고 말해 왔고, 그 격차의 정체가 이 표다.
 *
 * ⚠️ **「재고가 있다」로 세면 안 된다.** 유형당 26개만 있어도 「있다」가 된다 — 한 권이
 * 120문항이고 `blank` 목표가 14% 면 권당 17개가 필요하므로 26개는 **한 권 쓰면 바닥**이다.
 * 그래서 재는 것은 **「몇 권까지 갈 수 있는가」** 이고, 그 권수는 **가장 얇은 유형**이 정한다.
 */
function TypeInventoryTable({ inv }: { inv: TypeInventoryPanel }) {
  return (
    <section aria-label="유형 재고" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">유형 재고</h2>
        <span className="font-body text-[12px] text-[var(--t2)]">
          시중 구성 그대로 <b>몇 권까지</b> 낼 수 있는가 — 원문이 아니라 <b>유형</b>이 병목이다
        </span>
        <span className="ml-auto font-body text-[11px] text-[var(--t3)]">
          {inv.measuredAt.slice(0, 10)} 에 잰 값 · {inv.ageDays === 0 ? '오늘' : `${inv.ageDays}일 전`} ·
          문항 {inv.totalItems.toLocaleString()}
        </span>
      </div>

      <p className="font-body text-[12px] text-[var(--t2)]">
        지금 낼 수 있는 권{' '}
        <b className="tabular-nums" style={{ color: inv.totalVolumes > 0 ? 'var(--t1)' : 'var(--error-ink)' }}>
          {inv.totalVolumes}권
        </b>
        . 갱신: <code>pnpm dlx tsx scripts/textbook/type-inventory-scan.mjs</code>
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
              <th className="py-2 pr-3 font-[600]">V</th>
              <th className="py-2 pr-3 text-right font-[600]">만들 수 있는 권</th>
              <th className="py-2 pr-3 font-[600]">가장 얇은 유형</th>
              <th className="py-2 pr-3 text-right font-[600]">그 유형 재고 / 권당 필요</th>
              <th className="py-2 font-[600]">재고 0 유형</th>
            </tr>
          </thead>
          <tbody>
            {inv.bands.map((b) => {
              const t0 = b.types.find((t) => t.type === b.bindingType)
              return (
                <tr key={b.vLevel} className="border-b border-[color-mix(in_srgb,var(--bd)_50%,transparent)]">
                  <td className="py-2 pr-3 font-[700] tabular-nums text-[var(--t1)]">V{b.vLevel}</td>
                  <td
                    className="py-2 pr-3 text-right font-[700] tabular-nums"
                    style={{ color: b.volumes > 0 ? 'var(--success-ink)' : 'var(--error-ink)' }}
                  >
                    {b.volumes}권
                  </td>
                  <td className="py-2 pr-3 font-mono text-[12px] text-[var(--t2)]">{b.bindingType ?? '—'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">
                    {t0 ? `${t0.items.toLocaleString()} / ${t0.needPerVolume}` : '—'}
                  </td>
                  <td className="py-2 text-[12px] text-[var(--t3)]">
                    {b.missingTypes.length
                      ? `${b.missingTypes.length}종 — ${b.missingTypes.slice(0, 4).join(', ')}`
                      : '없음'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="font-body text-[11px] text-[var(--t3)]">
        목표 비중의 정본은 <code>rungMix</code> — 시중 79종 실측에서 유도했고 이 화면이 다시 계산하지
        않는다. <b>가장 얇은 유형을 늘리기 전에는 다른 유형을 아무리 늘려도 권수가 안 는다.</b>
      </p>
    </section>
  )
}

/**
 * **그래서 무엇부터 쓰는가.**
 *
 * ⚠️ 재고표만 두면 관리자가 다음 할 일을 **눈으로 센다.** 실측 2026-09-08 에 내가 그렇게
 * 세다가 틀렸다 — 표를 보고 「제목·주제·빈칸 셋이 병목」이라 적었는데, 계산해 보니 병목은
 * **생성형 유형 전부**였다(내용일치·주장·심경도 같이 비어 있었다). 눈으로 세면 눈에 띄는
 * 것만 센다.
 *
 * 비용이 100배 다른 둘을 **갈라 놓는다** — 결정론 유형은 생성기 한 번이고, 생성형 유형은
 * 사람이 글을 읽고 써야 한다. 섞어 놓으면 「1,118문항」이 한 덩어리로 보여 계획이 안 선다.
 */
function FillPlanTable({ plan }: { plan: FillPlanPanel }) {
  const remaining = Math.max(0, plan.totalChunks - plan.readyChunks)
  return (
    <section aria-label="채울 몫" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">채울 몫</h2>
        <span className="font-body text-[12px] text-[var(--t2)]">
          학년마다 <b>{plan.targetVolumes}권</b>을 내려면 무엇을 얼마나 더 써야 하는가
        </span>
        <span className="ml-auto font-body text-[11px] text-[var(--t3)]">
          {plan.computedAt.slice(0, 10)} 계산 · {plan.ageDays === 0 ? '오늘' : `${plan.ageDays}일 전`}
        </span>
      </div>

      <p className="font-body text-[12px] text-[var(--t2)]">
        사람이 써야 하는 문항 <b className="tabular-nums text-[var(--t1)]">{plan.totalItems.toLocaleString()}</b>
        {' = '}
        <b className="tabular-nums text-[var(--t1)]">{plan.totalChunks.toLocaleString()}청크</b>. 그중{' '}
        <b className="tabular-nums" style={{ color: 'var(--success-ink)' }}>
          {plan.readyChunks.toLocaleString()}청크
        </b>
        는 이미 뽑혀 있어 <b>지금 바로 집필할 수 있다</b>
        {remaining > 0 ? `. 나머지 ${remaining.toLocaleString()}청크는 먼저 뽑아야 한다` : ''}.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
              <th className="py-2 pr-3 font-[600]">V</th>
              <th className="py-2 pr-3 text-right font-[600]">지금</th>
              <th className="py-2 pr-3 text-right font-[600]">써야 할 문항</th>
              <th className="py-2 pr-3 text-right font-[600]">청크</th>
              <th className="py-2 pr-3 text-right font-[600]">지금 시작 가능</th>
              <th className="py-2 font-[600]">가장 큰 몫</th>
            </tr>
          </thead>
          <tbody>
            {plan.bands.map((b) => {
              const drainTop = b.types.filter((t) => t.drain).slice(0, 3)
              const deterministic = b.types.filter((t) => !t.drain)
              return (
                <tr key={b.vLevel} className="border-b border-[color-mix(in_srgb,var(--bd)_50%,transparent)]">
                  <td className="py-2 pr-3 font-[700] tabular-nums text-[var(--t1)]">V{b.vLevel}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">{b.volumes}권</td>
                  <td className="py-2 pr-3 text-right font-[700] tabular-nums text-[var(--t1)]">
                    {b.drainItems.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">{b.drainChunks}</td>
                  <td
                    className="py-2 pr-3 text-right font-[700] tabular-nums"
                    style={{ color: b.readyChunks > 0 ? 'var(--success-ink)' : 'var(--t3)' }}
                  >
                    {b.readyChunks}
                  </td>
                  <td className="py-2 text-[12px] text-[var(--t3)]">
                    {drainTop.length
                      ? drainTop.map((t) => `${t.type} +${t.shortItems}`).join(', ')
                      : '—'}
                    {deterministic.length ? (
                      <span className="ml-1 text-[var(--t3)]">
                        · 결정론 {deterministic.map((t) => t.type).join(', ')}
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="font-body text-[11px] text-[var(--t3)]">
        갱신: <code>pnpm dlx tsx scripts/textbook/item-fill-plan.mjs</code> (재고 스냅샷을 먼저 뜬 뒤).
        집필 규격은 <code>scripts/textbook/item-drain-brief.md</code> 한 벌이고, 쓴 것은
        <code>item-selfcheck.mjs</code> 로 적재 전에 스스로 채점한다.{' '}
        <b>결정론 유형은 생성기 한 번이면 되지만 생성형 유형은 글을 읽어야 만든다</b> — 권수를
        올리는 것은 뒤쪽뿐이다.
      </p>
    </section>
  )
}

/**
 * **쓰고도 못 싣는 것.**
 *
 * ⚠️ 게이트는 시간이 지나며 엄해지는데 **청크와 산출은 게이트보다 오래 산다.** 그래서
 * 예전에 쓴 문항이 조용히 적재에서 걸리기 시작한다 — 아무도 안 보면 그 일은 두 번 하게 된다.
 *
 * 이 표의 요점은 **한 수로 보이지 않는 것**이다. 「315개가 걸렸다」로 적으면 다시 써야 할
 * 산더미로 읽혀 아무도 손대지 않는다. 그중 142는 **한국어 해설 한 줄**이면 살아나고
 * (선택지·정답은 이미 검증됐다), 173은 지문이 문제라 집필로 못 고친다. 비용이 100배 다르다.
 */
/**
 * **원천이 지면에 닿는 비율 — 「원문 선택의 기준」의 바닥.**
 *
 * ⚠️ 이 화면의 다른 표들은 「몇 편 있는가」를 센다. 그런데 **편수는 공급이 아니다.**
 * 실측 2026-09-13: 집필 배치 다섯이 독립으로 같은 것을 보고했다 — 같은 밴드·같은 규격인데
 * 원천이 다르면 생존율이 스무 배 갈린다(PLOS/Europe PMC 초록 **5.6%** vs Gutenberg 산문 **100%**).
 * 그래서 「9만 편 있다」가 상위 밴드 독해에 대해서는 참이 아니다.
 *
 * 표가 답하는 질문은 하나다 — **어느 원천을 더 수확할 것인가.**
 */
function SourceYieldTable({ yieldPanel }: { yieldPanel: SourceYieldPanel }) {
  const pct = yieldPanel.totalStock
    ? ((yieldPanel.totalUsable / yieldPanel.totalStock) * 100).toFixed(1)
    : '0.0'
  // 재고가 큰 칸부터 — 작은 칸의 100% 는 결정을 안 바꾼다.
  const rows = [...yieldPanel.rows].sort((a, b) => b.articles - a.articles).slice(0, 24)
  return (
    <section aria-label="원천 생존율" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">원천 생존율</h2>
        <span className="font-body text-[12px] text-[var(--t2)]">
          원천 한 곳이 실제로 <b>지문이 되는 비율</b> — 편수는 공급이 아니다
        </span>
        <span className="ml-auto font-body text-[11px] text-[var(--t3)]">
          {yieldPanel.measuredAt.slice(0, 10)} 에 잰 값 ·{' '}
          {yieldPanel.ageDays === 0 ? '오늘' : `${yieldPanel.ageDays}일 전`} · 유형{' '}
          <code>{yieldPanel.type}</code> 창 · 칸당 표본 {yieldPanel.perCell}
        </span>
      </div>

      <p className="font-body text-[12px] text-[var(--t2)]">
        재고 <b className="tabular-nums text-[var(--t1)]">{yieldPanel.totalStock.toLocaleString()}</b>편 중{' '}
        <b className="tabular-nums" style={{ color: 'var(--success-ink)' }}>
          약 {yieldPanel.totalUsable.toLocaleString()}편
        </b>
        ({pct}%)만 지문이 된다. 나머지는 재고에 있어도 지면에 못 온다 — 어느 원천을 더 수확할지가
        여기서 갈린다.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
              <th className="py-2 pr-3 font-[600]">원천</th>
              <th className="py-2 pr-3 font-[600]">V</th>
              <th className="py-2 pr-3 text-right font-[600]">재고</th>
              <th className="py-2 pr-3 text-right font-[600]">표본</th>
              <th className="py-2 pr-3 text-right font-[600]">지문이 되는 비율</th>
              <th className="py-2 pr-3 text-right font-[600]">쓸 수 있는 편수</th>
              <th className="py-2 font-[600]">주된 사인</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const worst = Object.entries(r.reasons)
                .filter(([k]) => k !== 'ok')
                .sort((a, b) => b[1] - a[1])[0]
              return (
                <tr key={`${r.source}-${r.vLevel}`} className="border-b border-[color-mix(in_srgb,var(--bd)_50%,transparent)]">
                  <td className="pr-3 font-mono text-[12px]">
                    <SourceLink source={r.source}>{r.source}</SourceLink>
                  </td>
                  <td className="py-2 pr-3 font-[700] tabular-nums text-[var(--t1)]">V{r.vLevel}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">
                    {r.articles.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--t3)]">{r.sampled}</td>
                  <td
                    className="py-2 pr-3 text-right font-[700] tabular-nums"
                    style={{
                      color:
                        r.yieldPct >= 70
                          ? 'var(--success-ink)'
                          : r.yieldPct >= 30
                            ? 'var(--t1)'
                            : 'var(--error-ink)',
                    }}
                  >
                    {r.yieldPct}%
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">
                    {r.usableEstimate.toLocaleString()}
                  </td>
                  <td className="py-2 text-[12px] text-[var(--t3)]">
                    {worst && worst[1] > 0 ? `${worst[0]} ${worst[1]}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="font-body text-[11px] text-[var(--t3)]">
        갱신: <code>pnpm dlx tsx scripts/textbook/source-yield-scan.mjs</code> (읽기만 하므로 재실행 안전).
        <b>표본이다</b> — 칸마다 최대 {yieldPanel.perCell}편을 보고, 표본을 결정론으로 골라 어제 값과
        비교할 수 있게 한다. 규격은 뽑기와 같은 자(<code>itemWordSpec</code> ·{' '}
        <code>isPrintablePassage</code>)를 그대로 부른다 — 사본을 두면 이 표가 뽑기와 다른 말을 한다.
      </p>
    </section>
  )
}

function DrainAuditTable({ audit }: { audit: DrainAuditPanel }) {
  const pct = audit.filled ? ((audit.blocked / audit.filled) * 100).toFixed(1) : '0.0'
  return (
    <section aria-label="쓰고도 못 싣는 것" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">쓰고도 못 싣는 것</h2>
        <span className="font-body text-[12px] text-[var(--t2)]">
          이미 집필했는데 <b>지금 게이트가 막고 있는</b> 문항 — 게이트는 산출보다 나중에 엄해진다
        </span>
        <span className="ml-auto font-body text-[11px] text-[var(--t3)]">
          {audit.measuredAt.slice(0, 10)} 에 잰 값 · {audit.ageDays === 0 ? '오늘' : `${audit.ageDays}일 전`}
        </span>
      </div>

      <p className="font-body text-[12px] text-[var(--t2)]">
        집필한 문항 <b className="tabular-nums text-[var(--t1)]">{audit.filled.toLocaleString()}</b> 중{' '}
        <b className="tabular-nums" style={{ color: audit.blocked > 0 ? 'var(--error-ink)' : 'var(--t1)' }}>
          {audit.blocked.toLocaleString()}
        </b>
        ({pct}%)이 막혀 있다. 그중{' '}
        <b className="tabular-nums" style={{ color: 'var(--success-ink)' }}>
          {audit.rationaleOnly.toLocaleString()}
        </b>
        는 <b>해설 한 칸만 고치면 살아난다</b> — 선택지와 정답은 이미 검증됐다. 나머지{' '}
        <b className="tabular-nums">{audit.passageBlocked.toLocaleString()}</b>는 지문이 문제라 다시 뽑아야 한다.
      </p>

      {audit.reasons.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse font-body text-[13px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
                <th className="py-2 pr-3 text-right font-[600]">건수</th>
                <th className="py-2 pr-3 font-[600]">게이트가 막은 이유</th>
                <th className="py-2 font-[600]">고치는 법</th>
              </tr>
            </thead>
            <tbody>
              {audit.reasons.map((r) => {
                const rationale = /근거/.test(r.reason)
                return (
                  <tr key={r.reason} className="border-b border-[color-mix(in_srgb,var(--bd)_50%,transparent)]">
                    <td className="py-2 pr-3 text-right font-[700] tabular-nums text-[var(--t1)]">
                      {r.count.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-[12px] text-[var(--t2)]">{r.reason}</td>
                    <td
                      className="py-2 text-[12px]"
                      style={{ color: rationale ? 'var(--success-ink)' : 'var(--t3)' }}
                    >
                      {rationale ? '해설만 다시 쓴다' : '지문을 다시 뽑는다'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="font-body text-[11px] text-[var(--t3)]">
        갱신: <code>pnpm dlx tsx scripts/textbook/item-drain-audit.mjs</code> (읽기만 하므로 재실행 안전 ·
        DB 를 안 본다). 고칠 파일·칸 번호까지 보려면 <code>--fixable</code>. 규칙의 정본은{' '}
        <code>item-gate.ts</code> 한 벌이고 이 감사가 그 함수를 그대로 부른다 — 사본을 두면 갈린다.
      </p>
    </section>
  )
}

function DefectTable({ defects }: { defects: DefectPanel }) {
  return (
    <section aria-label="추출 결함" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">추출 결함</h2>
        <span className="font-body text-[12px] text-[var(--t2)]">
          적격 판정이 통과시켜도 <b>지문으로 못 쓰는</b> 본문 — 따로 잰다
        </span>
        <span className="ml-auto font-body text-[11px] text-[var(--t3)]">
          {defects.measuredAt.slice(0, 10)} 에 잰 값 ·{' '}
          {defects.ageDays === 0 ? '오늘' : `${defects.ageDays}일 전`} ·{' '}
          {defects.scanned.toLocaleString()}편 훑음
        </span>
      </div>

      <p className="font-body text-[12px] text-[var(--t2)]">
        하나라도 걸린 편 <b className="tabular-nums">{defects.defective.toLocaleString()}편</b> (
        {defects.defectivePct}%). 갱신:{' '}
        <code>pnpm dlx tsx scripts/textbook/extraction-defect-scan.mjs --all</code>
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
              <th className="py-2 pr-3 font-[600]">결함</th>
              <th className="py-2 pr-3 text-right font-[600]">편수</th>
              <th className="py-2 pr-3 text-right font-[600]">비율</th>
              <th className="py-2 font-[600]">무엇인가 · 어디에 몰려 있나</th>
            </tr>
          </thead>
          <tbody>
            {defects.rules.map((r) => (
              <tr key={r.id} className="border-[color-mix(in_srgb,var(--bd)_50%,transparent)] border-b align-top">
                <td className="py-2 pr-3 font-[600] text-[var(--t1)]">{r.label}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t1)]">
                  {r.count.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">{r.pct}%</td>
                <td className="py-2 text-[12px] text-[var(--t2)]">
                  {r.why}
                  {r.concentrated && r.topSource ? (
                    <span className="mt-1 block text-[var(--warning-ink)]">
                      ⚠ 사실상{' '}
                      <b>
                        <SourceLink source={r.topSource.source}>{r.topSource.source}</SourceLink>
                      </b>{' '}
                      하나의 문제다 —{' '}
                      {/* ⚠️ 한 표현식으로 만든다 — 표현식과 리터럴을 붙여 쓰면 서버 렌더가
                          사이에 주석 마커를 넣어 `99.7%` 가 문자열로 남지 않는다. */}
                      <span className="tabular-nums">
                        {`${r.topSource.count.toLocaleString()} / ${r.count.toLocaleString()}건(${r.topSource.share}%)`}
                      </span>
                      {' 전체 비율로 읽지 말고 그 수확기를 볼 것.'}
                    </span>
                  ) : r.bySource.length ? (
                    <span className="mt-1 block text-[var(--t3)]">
                      원천별{' '}
                      {r.bySource
                        .slice(0, 4)
                        .map((b) => `${b.source} ${b.count.toLocaleString()}`)
                        .join(' · ')}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-body text-[11px] text-[var(--t3)]">
        이 스캔은 <b>고치지 않는다</b> — 어디에 몇 편 있는지만 센다. 무엇을 지울지는 소스별 추출기를
        고칠 때 사람이 정한다(<code>==</code> 는 수식에도, <code>Media</code> 는 본문 낱말로도
        나온다).
      </p>
    </section>
  )
}
