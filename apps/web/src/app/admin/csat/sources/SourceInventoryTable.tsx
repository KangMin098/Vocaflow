// apps/web/src/app/admin/csat/sources/SourceInventoryTable.tsx
//
// **소스별 원문 관리 — 「언제 몇 편 받았고 지금 어떤 상태인가」.**
//
// ── 왜 이 표가 필요했나 (2026-09-16) ────────────────────────────────
// 이 화면은 원천 이름을 스물한 번 부르면서 **판정 결과만** 말했다. 「그 원천에서 언제
// 마지막으로 받았나 · 지금 몇 편이 검토 대기인가」는 어디에도 없었다. 그래서 관리자가
// 「PLOS 가 13.3%」를 읽고도 다음에 무엇을 할지 정할 수 없었다.
//
// ── 조작 버튼을 두지 않는다 ─────────────────────────────────────────
// 수집·판정은 전부 웹 요청 시간 안에 안 끝난다(적격 스캔 76~200초 · 재분석 편당 수 초).
// 그래서 **명령을 복사해 가는 것**만 낸다 — 이 화면의 다른 절들과 같은 규칙이다.
//
// ⚠️ 「조판 가능/탈락」 수는 여기 없다. 그것의 정본은 적격 스냅샷이고 이 표는 **판정을
//   받았는가**까지만 센다. 사본을 두면 같은 화면의 두 표가 다른 답을 하는 날이 온다.

'use client'

import { useState } from 'react'
import Link from 'next/link'

import type { SourceInventoryPanel, SourceInventoryRow } from '@/lib/textbook/source-inventory-view'

/**
 * 상태 세 칸의 색 — **단일 색조 순차 램프**(잉크 t2 → t1 → t4).
 *
 * ⚠️ 처음에는 `warning-ink`(대기) · `success-ink`(발행) · `t3`(그 외) 로 칠했다.
 *   두 가지가 틀렸다:
 *   ① **상태 색을 범주 색으로 썼다.** 검토 대기는 재고의 80%인 **정상 상태**인데
 *      경고색으로 칠하면 화면이 없는 경보를 만든다.
 *   ② **눈으로 구분이 안 된다.** dataviz 검증기 실측: `#1F6B49`↔`#7A5200` 이
 *      정상 시야에서 ΔE **12.7**(기준 15) — 색약이 아니어도 헷갈린다.
 *
 *   범주 3색으로 고치려면 이 시스템에 없는 색을 새로 만들어야 했다(저채도 팔레트라
 *   검증을 통과하는 조합이 토큰 밖에 있다). 색을 만드는 대신 **인코딩을 바꿨다** —
 *   세 상태는 실은 파이프라인 순서(그 외 → 대기 → 발행)라 순차 램프가 맞다.
 *   순차는 색조 하나에 명도만 달리하므로 구분이 명도로 보장된다.
 */
const BAR = {
  ready: 'var(--t2)',
  published: 'var(--t1)',
  other: 'var(--t4)',
}

/** 0 이 아닌데 0px 로 그려지지 않게 하는 바닥. 21원천 중 11곳의 발행분이 1px 미만이었다. */
const MIN_SEG_PX = 2

/**
 * **접힌 위에 놓는 소스 한 줄.**
 *
 * ⚠️ 완료 조건은 「스크롤 없이 KPI·병목·**소스 현황**이 파악될 것」인데, 절 순서는
 *   소스 표를 일곱 축 **뒤**에 둔다(판정 기준을 먼저 읽어야 표가 읽히기 때문이다).
 *   둘은 그냥 충돌한다 — 표를 위로 올리면 순서가 깨지고, 두면 접힌 위에 소스가 없다.
 *   그래서 **표는 제자리에 두고 요약 한 줄만 위로 올린다.** 한 줄이 답하는 것은 셋뿐이다:
 *   원천이 몇이고 · 재고가 얼마고 · **판정이 하나도 없는 원천이 어디인가**.
 *   마지막 것이 이 화면에서 가장 자주 쓰는 신호다(재고는 있는데 조판 가능이 못 된다).
 */
export function SourceInventoryStrip({ panel }: { panel: SourceInventoryPanel }) {
  const total = panel.rows.reduce((n, r) => n + r.total, 0)
  const unjudged = panel.rows.filter((r) => r.judged === 0 && r.total > 0)
  const newest = panel.rows.reduce<string | null>(
    (best, r) => (r.lastGet && (!best || r.lastGet > best) ? r.lastGet : best),
    null,
  )
  return (
    <p className="rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-2 font-body text-[12px] text-[var(--t2)]">
      <b className="text-[var(--t1)]">소스 {panel.rows.length}</b> · 재고{' '}
      <b className="tabular-nums text-[var(--t1)]">{total.toLocaleString()}편</b> · 마지막 GET{' '}
      <span className="font-mono">{newest ? newest.slice(0, 10) : '—'}</span>
      {unjudged.length ? (
        <>
          {' · '}
          <b style={{ color: 'var(--error-ink)' }}>
            {`판정 0인 원천 ${unjudged.length}`}
          </b>{' '}
          <span className="font-mono text-[11px]">
            {unjudged
              .slice(0, 4)
              .map((r) => `${r.source} ${r.total.toLocaleString()}`)
              .join(' · ')}
          </span>{' '}
          — 재고는 있는데 조판 가능이 못 된다. 아래 「소스별 원문」 표에서 다음 명령을 본다.
        </>
      ) : null}
    </p>
  )
}

export function SourceInventoryTable({ panel }: { panel: SourceInventoryPanel }) {
  const [open, setOpen] = useState<string | null>(null)
  const max = Math.max(1, ...panel.rows.map((r) => r.total))

  return (
    <section aria-label="소스별 원문 관리" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">소스별 원문</h2>
        <span className="font-body text-[12px] text-[var(--t2)]">
          언제 몇 편 받았고 지금 어떤 상태인가 — <b>판정 결과가 아니라 재고</b>
        </span>
        <span className="ml-auto font-body text-[11px] text-[var(--t3)]">
          {panel.measuredAt.slice(0, 10)} 에 잰 값 ·{' '}
          {panel.ageDays === 0 ? '오늘' : `${panel.ageDays}일 전`} ·{' '}
          {panel.scanned.toLocaleString()}편 훑음 · {panel.elapsedSeconds}초
        </span>
      </div>

      <p className="font-body text-[12px] text-[var(--t2)]">
        갱신: <code>{panel.refreshCommand}</code> (본문을 안 받으므로 <b>9초</b> · 읽기만 하므로
        재실행 안전). 원천 이름을 누르면 그 원천의 원문 목록으로, 행을 누르면 다음 할 일이 펼쳐진다.
      </p>

      {/* 계열이 둘 이상이면 범례는 **항상** 있어야 한다 — 행마다 숫자를 적었어도 색이 무엇인지는
          한 번 말해 줘야 한다(dataviz §6). 색조는 하나이고 명도만 다르다. */}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-[11px] text-[var(--t3)]">
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="inline-block h-[10px] w-[14px] rounded-[2px]" style={{ background: BAR.ready }} />
          검토 대기
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="inline-block h-[10px] w-[14px] rounded-[2px]" style={{ background: BAR.published }} />
          발행
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="inline-block h-[10px] w-[14px] rounded-[2px]" style={{ background: BAR.other }} />
          그 외 (보관 · 실패 · 큐)
        </span>
        <span>0 이 아닌 칸은 최소 2px — 안 보이면 「없다」와 구별되지 않는다</span>
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse font-body text-[13px]">
          <thead>
            <tr className="border-b border-[var(--bd)] text-left text-[12px] text-[var(--t2)]">
              <th className="py-2 pr-3 font-[600]">원천</th>
              <th className="py-2 pr-3 text-right font-[600]">수집 편수</th>
              <th className="py-2 pr-3 font-[600]">상태 분포</th>
              <th className="py-2 pr-3 text-right font-[600]">판정 받음</th>
              <th className="py-2 pr-3 text-right font-[600]">학령 붙음</th>
              <th className="py-2 pr-3 font-[600]">탈락 사유 상위</th>
              <th className="py-2 font-[600]">마지막 GET</th>
            </tr>
          </thead>
          <tbody>
            {panel.rows.map((r) => (
              <Row
                key={r.source}
                row={r}
                max={max}
                open={open === r.source}
                onToggle={() => setOpen(open === r.source ? null : r.source)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-body text-[11px] text-[var(--t3)]">
        「판정 받음」은 <code>csat_fit.gate.verdict</code> 가 붙은 편수다 — <b>조판 가능과 다르다</b>
        (그 수는 위 「등급 분포」가 정본). 「마지막 GET」은 <code>created_at</code> 의 최댓값이다 —{' '}
        <code>source_fetched_at</code> 열이 있지만 수집기가 안 채워 PLOS 45,096편이 전부 비어 있다.
      </p>
    </section>
  )
}

function Row({
  row,
  max,
  open,
  onToggle,
}: {
  row: SourceInventoryRow
  max: number
  open: boolean
  onToggle: () => void
}) {
  // ⚠️ **0 이 아닌 세그먼트는 최소 ${MIN_SEG_PX}px 을 준다.** 실측: 발행 세그먼트가
  //   21원천 중 11곳에서 1px 미만이었고 9곳은 0px 이었다 — 보이지 않는 마크는
  //   「없다」와 구별되지 않는다. 0 은 그대로 0 으로 둔다(없는 것을 있다고 그리지 않는다).
  const w = (n: number) =>
    n === 0 ? '0px' : `max(${MIN_SEG_PX}px, ${(n / row.total) * 100}%)`
  return (
    <>
      <tr className="border-b border-[var(--bd)]/50 align-middle">
        <td className="pr-3 font-mono text-[12px]">
          <Link
            href={`/admin/articles?stage=review&status=all&src=${encodeURIComponent(row.source)}`}
            title={`${row.label} 원문 목록 열기`}
            className="inline-flex min-h-[44px] items-center text-[var(--t2)] underline decoration-dotted underline-offset-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[#8B5CF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] active:text-[#8B5CF6]"
          >
            {row.source}
          </Link>
        </td>
        <td className="py-2 pr-3 text-right font-[700] tabular-nums text-[var(--t1)]">
          {row.total.toLocaleString()}
          <span
            aria-hidden
            className="ml-2 inline-block h-[6px] rounded-[var(--r-full)] bg-[var(--bd)] align-middle"
            style={{ width: `${Math.max(2, (row.total / max) * 56)}px` }}
          />
        </td>
        <td className="py-2 pr-3">
          {/* 색만으로 말하지 않는다 — 숫자를 옆에 둔다(색맹 대응). */}
          {/* 세그먼트 사이 2px 틈 — 인접한 두 칸이 한 덩어리로 안 읽히게(dataviz §marks). */}
          <span className="flex h-[10px] w-[120px] gap-[2px] overflow-hidden rounded-[var(--r-sm)] bg-[var(--bg2)]">
            <i style={{ width: w(row.ready), background: BAR.ready }} />
            <i style={{ width: w(row.published), background: BAR.published }} />
            <i style={{ width: w(row.other), background: BAR.other }} />
          </span>
          <span className="mt-0.5 block font-mono text-[10px] text-[var(--t3)]">
            대기 {row.ready.toLocaleString()} · 발행 {row.published.toLocaleString()} · 그 외{' '}
            {row.other.toLocaleString()}
          </span>
        </td>
        <td className="py-2 pr-3 text-right tabular-nums">
          {/* ⚠️ 상태색은 **아이콘·라벨과 함께** 온다 — 빨간 「0」만 두면 색이 유일한 신호가 된다. */}
          <span style={{ color: row.judged === 0 ? 'var(--error-ink)' : 'var(--t1)' }}>
            {row.judged === 0 ? '⚠ 0' : row.judged.toLocaleString()}
          </span>
          <span className="ml-1 font-mono text-[10px] text-[var(--t3)]">
            {row.judged === 0 ? '판정 없음' : `${row.judgedPct}%`}
          </span>
        </td>
        <td className="py-2 pr-3 text-right tabular-nums text-[var(--t2)]">
          {row.levelled.toLocaleString()}
          <span className="ml-1 font-mono text-[10px] text-[var(--t3)]">{row.levelledPct}%</span>
        </td>
        <td className="py-2 pr-3 text-[11px] text-[var(--t3)]">
          {row.topBlocked.length
            ? row.topBlocked.map((b) => `${b.reason} ${b.count.toLocaleString()}`).join(' · ')
            : row.legalBlocked
              ? `법적 ${row.legalBlocked.toLocaleString()}`
              : '—'}
        </td>
        <td className="py-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="inline-flex min-h-[44px] items-center gap-1 font-mono text-[11px] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[#8B5CF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
          >
            {row.lastGet ? row.lastGet.slice(0, 10) : '—'}
            {row.staleDays != null && row.staleDays > 7 ? (
              <span style={{ color: 'var(--warning-ink)' }}>· {row.staleDays}일</span>
            ) : null}
            <span aria-hidden>{open ? '▾' : '▸'}</span>
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-[var(--bd)]">
          <td colSpan={7} className="bg-[var(--bg2)] px-3 py-3">
            <p className="font-body text-[12px] text-[var(--t1)]">
              <b>다음 할 일</b> — {row.nextWhy}
            </p>
            <p className="mt-1 font-body text-[12px] text-[var(--t2)]">
              <code>{row.nextCommand}</code>
            </p>
            <p className="mt-1 font-mono text-[10px] text-[var(--t3)]">
              상태 전체: {row.byStatus.map((s) => `${s.status} ${s.count.toLocaleString()}`).join(' · ')}
              {row.rawPurpose ? ` · 미절단 원본 ${row.rawPurpose.toLocaleString()}` : ''}
              {row.legalBlocked ? ` · 되돌릴 수 없는 법적 탈락 ${row.legalBlocked.toLocaleString()}` : ''}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  )
}
