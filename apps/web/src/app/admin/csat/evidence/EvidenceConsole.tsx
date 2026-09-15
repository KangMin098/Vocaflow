// apps/web/src/app/admin/csat/evidence/EvidenceConsole.tsx
//
// **기출 원천 — 문항 집합 하나 위에 축을 겹치는 판.**
//
// ── 탭도, 세로로 세운 렌즈 목록도 아닌 이유 ──────────────────────────
// 여기 있던 탭 4장(회차 커버리지 / 유형별 진행 / 문항 분석 / 가이드 원천)은 **같은 802문항을
// 축 하나씩 잘라 놓은 표**였다. 그래서 「2025학년도의 R-BLANK 중 지문이 잘린 것」을 물으면
// 표 세 장을 눈으로 대조해야 했다 — 축을 겹칠 자리가 구조적으로 없었다.
//
// 처음 고친 안은 렌즈 여덟을 **왼쪽에 세로로** 세우는 것이었는데, 그건 **탭을 90° 돌린 것**이다.
// 여전히 한 번에 한 축이고, 두 축을 겹치려면 화면이 28개 필요해진다. 그래서 축을 네비게이션이
// 아니라 **값**으로 내렸다 — 행 축과 열 축을 고르는 드롭다운 둘이면 8×8 = 64 조합이 한 화면에서
// 나오고 화면 수는 1로 고정된다.
//
// ── 「합계가 맞다」를 화면이 스스로 증명한다 ──────────────────────────
// 피벗 가장자리에 행 합계·열 합계가 늘 붙어 있고, 오른쪽 아래 총합은 **어느 조합에서도 모집단과
// 같아야 한다.** 함정·결함처럼 한 문항이 여러 칸에 들어가는 축에서는 칸 합이 총합보다 크고,
// 그때는 두 수를 나란히 적는다(`802 · 칸 합 3,208`) — 숨기면 「합이 안 맞는다」로 보인다.
//
// ── 숫자는 전부 누를 수 있다 ─────────────────────────────────────────
// 이 화면은 근거(evidence)다. 집계만 보이고 그 집계를 이루는 문항으로 못 내려가면 하류 공정은
// 결국 원본 표를 다시 뒤진다. 그래서 「누를 수 없는 숫자는 두지 않는다」를 규칙으로 두었고,
// 부수 효과로 **장식용 숫자가 저절로 사라졌다** — 링크가 될 수 없는 숫자는 의미가 없는 숫자다.
//
// ⚠️ 문항 전문은 목록에 펼치지 않는다. 802개를 훑을 수 없게 만들었던 것이 그 인라인 펼침이다.

'use client'

import { Download, PanelRightClose, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  AXES,
  applyFilter,
  axisDef,
  coverageOf,
  DEFECTS,
  defectDef,
  filterToQuery,
  labelOf,
  MEASURES,
  pivot,
  axisContext,
  type AxisContext,
  type AxisId,
  type DefectCode,
  type EvidenceData,
  type EvidenceItem,
  type Filter,
  type Measure,
} from '@/lib/csat/evidence-fold'

import { EvidenceAxisPanel, hasAxisPanel } from './EvidenceAxisPanel'

// ── 공통 클래스 ─────────────────────────────────────────────────────────

const ACCENT = 'var(--admin)'

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]'

const CONTROL =
  `min-h-[44px] rounded-md border border-[var(--bd)] bg-[var(--bg)] px-2.5 text-sm text-[var(--t1)] ` +
  `transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] ` +
  `active:bg-[var(--bd)] disabled:opacity-50 ${FOCUS}`

const LINKNUM =
  `rounded tabular-nums underline decoration-[var(--bd)] decoration-dotted underline-offset-4 ` +
  `transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--admin)] ` +
  `hover:decoration-[var(--admin)] active:text-[var(--admin-strong)] ${FOCUS}`

const nf = new Intl.NumberFormat('ko-KR')

function mmss(sec: number): string {
  if (sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`
}

/** 값을 그 측정값의 단위로 — 시간만 분으로 접는다. */
function fmt(value: number, measure: Measure): string {
  return measure === 'time' ? mmss(value) : nf.format(value)
}

// ── 상단 한 줄 ──────────────────────────────────────────────────────────

/**
 * **이 화면에서 눈에 띄는 것은 이 한 줄뿐이다.**
 *
 * 옛 눈금 넉 장은 전부 「이상 없음」만 말했다 — 29/29 · 802/802 · 검수 기록 9,207 · 정답 미상 0.
 * 관리자가 알고 싶은 것은 **「지금 내보내도 되나」** 하나이고, 그 답은 막힌 문항 수 하나로
 * 결정된다. 나머지는 그 숫자를 눌렀을 때 나오면 된다.
 */
function CoverageLine({
  items,
  all,
  onPick,
  onAll,
  showDefectChips,
}: {
  items: EvidenceItem[]
  all: EvidenceItem[]
  onPick: (defect: DefectCode | 'blocked' | 'clean') => void
  /** 조건을 전부 지운다 — 분모(문항 수)를 누르면 전량으로 돌아간다. */
  onAll: () => void
  /**
   * 결함 칩을 여기 그릴까.
   *
   * 결함 축을 골랐으면 아래 「고치는 순서」 패널이 칩이 말하는 것을 **전부 담고** 순서·원인·
   * 다음 걸음까지 더한다. 둘 다 그리면 같은 말이 두 번이라 첫 화면의 밀도만 깎인다.
   */
  showDefectChips: boolean
}) {
  const cov = useMemo(() => coverageOf(items), [items])
  const [fields, setFields] = useState(false)
  const scoped = items.length !== all.length
  const ok = cov.blockedItems === 0

  return (
    <div className="rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-4 py-3">
      {/* **「채움 12,558」을 여기서 뺐다.** 아무 행동으로도 이어지지 않는 수였다 — 멀쩡한 칸은
          고칠 것이 없다는 뜻이라 관리자는 못 쓰는 칸만 본다. 분모(문항 × 필드)와 함께 아래
          펼침으로 내렸고, 거기서는 **어느 필드가 몇 칸을 막는지 · 그 칸을 누가 읽는지**가 나온다. */}
      <p className="text-[13px] leading-relaxed text-[var(--t2)]">
        <button
          type="button"
          onClick={onAll}
          title="조건을 전부 지우고 전량으로 돌아간다"
          className={`${LINKNUM} text-[var(--t1)]`}
        >
          {nf.format(cov.items)}
        </button>
        문항 ×{' '}
        <button type="button" onClick={() => setFields((v) => !v)} aria-expanded={fields} className={LINKNUM}>
          {cov.fields}필드
        </button>{' '}
        ={' '}
        <button type="button" onClick={() => setFields((v) => !v)} aria-expanded={fields} className={LINKNUM}>
          {nf.format(cov.cells)}셀
        </button>{' '}
        중 쓸 수 없는 칸{' '}
        <button
          type="button"
          onClick={() => onPick('blocked')}
          disabled={cov.cells - cov.fill === 0}
          className={`${LINKNUM} font-semibold text-[var(--error-ink)] disabled:cursor-default disabled:text-[var(--success-ink)]`}
        >
          {nf.format(cov.cells - cov.fill)}
        </button>
        {scoped ? <span className="text-[var(--t3)]"> · 필터 적용 중</span> : null}
      </p>

      {fields ? (
        <ul className="mt-2 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          {cov.byField.map((f) => (
            <li key={f.key} className="flex items-baseline gap-2 border-b border-[var(--bd)] py-0.5 last:border-0">
              <span className={f.bad ? 'text-[var(--t1)]' : 'text-[var(--t3)]'}>{f.label}</span>
              <span className="flex-1 truncate text-[var(--t3)]">{f.stage}</span>
              {f.bad ? (
                <button
                  type="button"
                  onClick={() => (f.defect ? onPick(f.defect) : onPick('blocked'))}
                  className={`${LINKNUM} text-[var(--error-ink)]`}
                >
                  {nf.format(f.bad)}
                </button>
              ) : (
                <span className="tabular-nums text-[var(--t3)]">0</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-1.5 font-display text-[19px] font-[750] leading-tight text-[var(--t1)]">
        {ok ? (
          <>
            막힌 문항 <span className="tabular-nums text-[var(--success-ink)]">0</span> / {nf.format(cov.items)} — 내보낼 수 있다
          </>
        ) : (
          <>
            막힌 문항{' '}
            <button type="button" onClick={() => onPick('blocked')} className={`${LINKNUM} text-[var(--error-ink)]`}>
              {nf.format(cov.blockedItems)}
            </button>{' '}
            / {nf.format(cov.items)} — 내보낼 수 없다
          </>
        )}
      </p>

      {showDefectChips ? (
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        {cov.byDefect.map(({ code, items: n }) => {
          const d = defectDef(code)
          return (
            <button
              key={code}
              type="button"
              onClick={() => onPick(code)}
              disabled={n === 0}
              title={`${d.why} — ${d.blocks} 이(가) 막힌다`}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded border border-[var(--bd)] px-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] active:bg-[var(--bd)] disabled:opacity-40 ${FOCUS}`}
            >
              <span aria-hidden className={n > 0 ? 'text-[var(--error-ink)]' : 'text-[var(--t3)]'}>
                {n > 0 ? '✕' : '·'}
              </span>
              <span className="text-[var(--t2)]">{d.label}</span>
              <span className="tabular-nums font-semibold text-[var(--t1)]">{nf.format(n)}</span>
              <span className="text-[var(--t3)]">{d.blocks}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => onPick('clean')}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded border border-[var(--bd)] px-2 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] active:bg-[var(--bd)] ${FOCUS}`}
        >
          <span aria-hidden className="text-[var(--success-ink)]">
            ✓
          </span>
          <span className="text-[var(--t2)]">결함 없음</span>
          <span className="tabular-nums font-semibold text-[var(--t1)]">
            {nf.format(cov.items - cov.blockedItems)}
          </span>
        </button>
      </div>
      ) : null}
    </div>
  )
}

// ── 피벗 ────────────────────────────────────────────────────────────────

/** 셀 농도 — 색만으로 말하지 않는다. 값은 언제나 숫자로 함께 적힌다. */
function heat(v: number, max: number): string {
  if (v <= 0 || max <= 0) return 'transparent'
  const t = Math.min(1, v / max)
  return `color-mix(in srgb, ${ACCENT} ${Math.round(8 + t * 30)}%, transparent)`
}

function PivotGrid({
  items,
  rowAxis,
  colAxis,
  measure,
  ctx,
  onCell,
  onRow,
  onCol,
}: {
  items: EvidenceItem[]
  rowAxis: AxisId
  colAxis: AxisId
  measure: Measure
  ctx: AxisContext
  onCell: (r: string, c: string) => void
  onRow: (r: string) => void
  onCol: (c: string) => void
}) {
  const p = useMemo(() => pivot(items, rowAxis, colAxis, measure, ctx), [items, rowAxis, colAxis, measure, ctx])
  const max = useMemo(() => {
    let m = 0
    for (const line of p.cells.values()) for (const c of line.values()) if (c.value > m) m = c.value
    return m
  }, [p])

  // **로빙 탭 인덱스** — 칸이 최대 30×27 = 810개다. 전부 탭 정지점으로 두면 키보드 사용자가
  // 표 하나를 지나가는 데 810번 탭을 눌러야 한다. 표 전체가 한 정지점이고 안에서는 방향키로 돈다.
  const [cur, setCur] = useState<[number, number]>([0, 0])
  const gridRef = useRef<HTMLTableSectionElement | null>(null)

  const move = useCallback(
    (dr: number, dc: number) => {
      setCur(([r, c]) => {
        const nr = Math.max(0, Math.min(p.rows.length - 1, r + dr))
        const nc = Math.max(0, Math.min(p.cols.length - 1, c + dc))
        return [nr, nc]
      })
    },
    [p.rows.length, p.cols.length],
  )

  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLElement>('[data-cur="1"]')
    if (el && document.activeElement && gridRef.current?.contains(document.activeElement)) el.focus()
  }, [cur])

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      // 축이 서른 칸이면 방향키만으로는 끝까지 가는 데 서른 번이 든다.
      Home: [0, -9999],
      End: [0, 9999],
      PageUp: [-9999, 0],
      PageDown: [9999, 0],
    }
    const d = map[e.key]
    if (d) {
      e.preventDefault()
      move(d[0], d[1])
    }
  }

  const rowAxisLabel = axisDef(rowAxis).label
  const colAxisLabel = axisDef(colAxis).label

  return (
    <>
      {/* **키보드 안내를 눈에 보이게 적는다.** 칸이 최대 810개라 표 전체를 한 정지점으로 두고
          안에서 방향키로 도는데(로빙 탭인덱스), 그 규칙은 화면에 쓰여 있지 않으면 아무도
          모른다 — `<caption class="sr-only">` 은 스크린리더에만 들린다. */}
      <p className="mb-1.5 text-xs text-[var(--t3)]">
        {axisDef(rowAxis).label} × {axisDef(colAxis).label} — 표 안에서 <kbd>방향키</kbd>로 칸을 옮기고{' '}
        <kbd>Enter</kbd> 로 그 칸만 남긴다 (<kbd>Home</kbd>/<kbd>End</kbd> 는 행의 끝)
      </p>
      {/* **세로도 가둔다.** 함정 축은 계열이 280개라(라벨 513을 접은 것) 가두지 않으면 표 하나가
          페이지를 수백 줄로 늘려 아래 문항 목록이 화면 밖으로 밀린다. 행을 **버리지는 않는다**
          (B3 누락 0) — 머리행·머리열·합계열이 붙박여 있어 스크롤해도 좌표를 잃지 않는다. */}
      <div className="max-h-[62vh] overflow-auto">
      <table className="w-full border-collapse text-[13px]" onKeyDown={onKey}>
        <caption className="sr-only">
          {rowAxisLabel} × {colAxisLabel} 교차표. 방향키로 칸을 옮기고 Enter 로 그 칸의 문항만 남긴다.
        </caption>
        <thead className="sticky top-0 z-20 bg-[var(--bg)]">
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-30 bg-[var(--bg)] px-2 py-1.5 text-left text-xs font-medium text-[var(--t3)]"
            >
              {rowAxisLabel} ＼ {colAxisLabel}
            </th>
            {p.cols.map((c) => (
              <th
                key={c.key}
                scope="col"
                className="px-1 py-1.5 text-right align-bottom text-xs font-medium text-[var(--t3)]"
              >
                <button
                  type="button"
                  onClick={() => onCol(c.key)}
                  title={c.label}
                  className={`max-w-[92px] truncate ${LINKNUM} block w-full text-right`}
                >
                  {c.short ?? c.label}
                </button>
              </th>
            ))}
            {/* **총합 열은 오른쪽에 붙박는다.** 이 화면의 약속(「어느 조합에서도 총합 = 모집단」)이
                걸린 칸인데, 열이 서른이면 가로 스크롤 밖으로 밀려 **증명이 안 보인다** —
                실측 2026-09-16 의 첫 캡처가 정확히 그랬다. */}
            <th
              scope="col"
              className="sticky right-0 z-10 border-l border-[var(--bd)] bg-[var(--bg)] px-2 py-1.5 text-right text-xs font-medium text-[var(--t2)]"
            >
              합계
            </th>
          </tr>
        </thead>
        <tbody ref={gridRef}>
          {p.rows.map((r, ri) => {
            const line = p.cells.get(r.key)
            const total = p.rowTotal.get(r.key) ?? 0
            return (
              <tr key={r.key} className="border-t border-[var(--bd)]">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[200px] truncate bg-[var(--bg)] px-2 py-1 text-left font-normal"
                >
                  <button type="button" onClick={() => onRow(r.key)} title={r.label} className={LINKNUM}>
                    {r.label}
                  </button>
                </th>
                {p.cols.map((c, ci) => {
                  const cell = line?.get(c.key)
                  const v = cell?.value ?? 0
                  const isCur = cur[0] === ri && cur[1] === ci
                  return (
                    <td key={c.key} className="p-0 text-right" style={{ background: heat(v, max) }}>
                      <button
                        type="button"
                        data-cur={isCur ? '1' : '0'}
                        tabIndex={isCur ? 0 : -1}
                        onFocus={() => setCur([ri, ci])}
                        onClick={() => onCell(r.key, c.key)}
                        disabled={v === 0}
                        aria-label={`${r.label} × ${c.label} — ${fmt(v, measure)}`}
                        className={`block w-full px-1.5 py-1 text-right tabular-nums transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] active:bg-[var(--bd)] disabled:cursor-default ${FOCUS} ${
                          v === 0 ? 'text-[var(--t3)]' : 'text-[var(--t1)]'
                        }`}
                      >
                        {v === 0 ? '·' : fmt(v, measure)}
                      </button>
                    </td>
                  )
                })}
                <td className="sticky right-0 z-10 border-l border-[var(--bd)] bg-[var(--bg)] px-2 py-1 text-right">
                  <button type="button" onClick={() => onRow(r.key)} className={`${LINKNUM} text-[var(--t2)]`}>
                    {fmt(total, measure)}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="sticky bottom-0 z-20 bg-[var(--bg)]">
          <tr className="border-t-2 border-[var(--bd)]">
            <th scope="row" className="sticky left-0 z-10 bg-[var(--bg)] px-2 py-1.5 text-left text-xs text-[var(--t2)]">
              합계
            </th>
            {p.cols.map((c) => (
              <td key={c.key} className="px-1.5 py-1.5 text-right tabular-nums text-[var(--t2)]">
                {fmt(p.colTotal.get(c.key) ?? 0, measure)}
              </td>
            ))}
            <td className="sticky right-0 z-10 border-l border-[var(--bd)] bg-[var(--bg)] px-2 py-1.5 text-right">
              <span
                className="tabular-nums font-semibold text-[var(--t1)]"
                title={
                  p.multi
                    ? '한 문항이 여러 칸에 들어가는 축이라 칸 합이 총합보다 크다 — 총합은 서로 다른 문항 수다'
                    : '어느 축 조합에서도 이 수는 모집단과 같아야 한다'
                }
              >
                {fmt(p.grand, measure)}
              </span>
              {p.multi && p.cellSum !== p.grand ? (
                <span className="ml-1 whitespace-nowrap text-[11px] text-[var(--t3)]">
                  칸 합 {fmt(p.cellSum, measure)}
                </span>
              ) : null}
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
    </>
  )
}

// ── 문항 목록 ───────────────────────────────────────────────────────────

function ItemList({ items, onOpen }: { items: EvidenceItem[]; onOpen: (id: string) => void }) {
  if (!items.length) {
    return (
      <p className="px-2 py-6 text-center text-sm text-[var(--t3)]">
        이 조건에 드는 문항이 없다 — 위의 칩이나 칸을 눌러 조건을 지운다
      </p>
    )
  }
  return (
    <div className="max-h-[52vh] overflow-y-auto">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-[var(--bg)]">
          <tr className="border-b border-[var(--bd)] text-left text-xs text-[var(--t3)]">
            <th className="py-1.5 pr-3 font-medium">문항</th>
            <th className="py-1.5 pr-3 font-medium">유형</th>
            <th className="py-1.5 pr-3 text-right font-medium">배점</th>
            <th className="py-1.5 pr-3 text-right font-medium">근거</th>
            <th className="py-1.5 pr-3 text-right font-medium">배제</th>
            <th className="py-1.5 pr-3 text-right font-medium">절차</th>
            <th className="py-1.5 pr-3 text-right font-medium">어휘</th>
            <th className="py-1.5 font-medium">결함</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-[var(--bd)] last:border-0">
              <td className="py-0.5 pr-3">
                <button type="button" onClick={() => onOpen(it.id)} className={`${LINKNUM} min-h-[44px] text-left`}>
                  {it.examLabel} <span className="tabular-nums">{it.no}번</span>
                </button>
              </td>
              <td className="py-0.5 pr-3 text-[var(--t2)]">{it.typeName}</td>
              <td className="py-0.5 pr-3 text-right tabular-nums text-[var(--t2)]">{it.points}</td>
              <td className="py-0.5 pr-3 text-right tabular-nums text-[var(--t2)]">{it.whyLen}자</td>
              <td className="py-0.5 pr-3 text-right tabular-nums text-[var(--t2)]">
                {it.rejected}/{it.distractors}
              </td>
              <td className="py-0.5 pr-3 text-right tabular-nums text-[var(--t2)]">{it.steps}</td>
              <td className="py-0.5 pr-3 text-right tabular-nums text-[var(--t2)]">{it.vocab}</td>
              <td className="py-0.5 text-xs">
                {it.defects.length ? (
                  <span className="text-[var(--error-ink)]">
                    <span aria-hidden>✕ </span>
                    {it.defects.map((d) => defectDef(d).label).join(' · ')}
                  </span>
                ) : (
                  <span className="text-[var(--success-ink)]">
                    <span aria-hidden>✓ </span>없음
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── drawer ──────────────────────────────────────────────────────────────

interface ItemFull {
  item_id: string
  exam_label: string
  no: number
  type_name: string | null
  answer: number | null
  measured_ability: string | null
  design_intent: string | null
  quote: string | null
  reasoning: string | null
  choices: { n: number; verdict: string | null; trap: string | null; text: string | null }[]
  procedure: { step: string; on_fail?: string }[]
  required_vocab: string[]
  time_budget_sec: number | null
  predicted: number | null
  drivers: string[]
}

/** 문항 전문 — **목록이 아니라 여기서만 펼친다.** 목록에 펼치면 802개를 훑을 수 없게 된다. */
function ItemDrawer({ id, row, onClose }: { id: string; row: EvidenceItem | null; onClose: () => void }) {
  const [full, setFull] = useState<ItemFull | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let alive = true
    setFull(null)
    setErr(null)
    void (async () => {
      try {
        const res = await fetch(`/api/admin/csat/items?item=${encodeURIComponent(id)}`, { cache: 'no-store' })
        const json = (await res.json()) as { ok?: boolean; item?: ItemFull; error?: string }
        if (!alive) return
        if (!res.ok || !json.ok || !json.item) throw new Error(json.error ?? `HTTP ${res.status}`)
        setFull(json.item)
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label="문항 전문"
      className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[520px] flex-col border-l border-[var(--bd)] bg-[var(--bg)] shadow-[var(--el-3,0_8px_24px_rgba(0,0,0,.12))]"
    >
      <header className="flex items-center justify-between gap-2 border-b border-[var(--bd)] px-4 py-2">
        <h3 className="truncate text-sm font-semibold text-[var(--t1)]">
          {row ? `${row.examLabel} ${row.no}번` : id}
          {row ? <span className="ml-2 text-xs font-normal text-[var(--t3)]">{row.typeName}</span> : null}
        </h3>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="문항 전문 닫기 (Esc)"
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] active:bg-[var(--bd)] ${FOCUS}`}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed text-[var(--t2)]">
        {row?.defects.length ? (
          <ul className="mb-3 space-y-1 rounded border border-[var(--error-ink)] px-3 py-2">
            {row.defects.map((d) => {
              const def = defectDef(d)
              return (
                <li key={d} className="text-xs">
                  <span aria-hidden className="text-[var(--error-ink)]">
                    ✕{' '}
                  </span>
                  <span className="font-medium text-[var(--t1)]">{def.label}</span>
                  <span className="text-[var(--t3)]"> — {def.blocks} 이(가) 막힌다.</span> {def.why}
                </li>
              )
            })}
          </ul>
        ) : null}

        {err ? <p className="text-[var(--error-ink)]">전문을 열지 못했다 — {err}</p> : null}
        {!full && !err ? <p className="text-[var(--t3)]">여는 중…</p> : null}

        {full ? (
          <dl className="space-y-3">
            {full.measured_ability ? (
              <div>
                <dt className="text-xs text-[var(--t3)]">재는 능력</dt>
                <dd>{full.measured_ability}</dd>
              </div>
            ) : null}
            {full.design_intent ? (
              <div>
                <dt className="text-xs text-[var(--t3)]">출제 의도</dt>
                <dd>{full.design_intent}</dd>
              </div>
            ) : null}
            {full.quote ? (
              <div>
                <dt className="text-xs text-[var(--t3)]">
                  근거 인용{row && !row.quoteLocated ? ' — 지문에서 찾지 못했다' : ''}
                </dt>
                <dd className="border-l-2 border-[var(--bd)] pl-2 font-editorial italic">“{full.quote}”</dd>
              </div>
            ) : null}
            {full.reasoning ? (
              <div>
                <dt className="text-xs text-[var(--t3)]">근거 설명</dt>
                <dd>{full.reasoning}</dd>
              </div>
            ) : null}
            {full.choices.length ? (
              <div>
                <dt className="text-xs text-[var(--t3)]">선지</dt>
                <dd>
                  <ul className="space-y-1">
                    {full.choices.map((c) => (
                      <li key={c.n}>
                        <span className={c.n === full.answer ? 'font-semibold text-[var(--success-ink)]' : 'text-[var(--t3)]'}>
                          {c.n}
                          {c.n === full.answer ? ' (정답)' : ''}
                        </span>
                        {c.trap ? <span className="ml-1 text-[var(--warning-ink)]">[{c.trap}]</span> : null}
                        {c.text ? <span className="ml-1">{c.text}</span> : null}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            {full.procedure.length ? (
              <div>
                <dt className="text-xs text-[var(--t3)]">풀이 절차</dt>
                <dd>
                  <ol className="list-decimal space-y-0.5 pl-4">
                    {full.procedure.map((s, i) => (
                      <li key={i}>
                        {s.step}
                        {s.on_fail ? <span className="text-[var(--t3)]"> — 막히면: {s.on_fail}</span> : null}
                      </li>
                    ))}
                  </ol>
                </dd>
              </div>
            ) : null}
            {full.required_vocab.length ? (
              <div>
                <dt className="text-xs text-[var(--t3)]">필수 어휘</dt>
                <dd>{full.required_vocab.join(' · ')}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-[var(--t3)]">권장 시간 · 예측 정답률</dt>
              <dd className="tabular-nums">
                {full.time_budget_sec ?? '—'}초 ·{' '}
                {full.predicted === null ? '—' : `${Math.round(full.predicted * 100)}%`}
                {full.drivers.length ? <span className="text-[var(--t3)]"> — {full.drivers.join(' · ')}</span> : null}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </aside>
  )
}

// ── 판 ──────────────────────────────────────────────────────────────────

export interface EvidenceConsoleProps extends EvidenceData {
  initialFilter: Filter
  initialRow: AxisId
  initialCol: AxisId
  initialMeasure: Measure
}

export function EvidenceConsole({
  items,
  exams,
  types,
  loadError,
  initialFilter,
  initialRow,
  initialCol,
  initialMeasure,
}: EvidenceConsoleProps) {
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [rowAxis, setRowAxis] = useState<AxisId>(initialRow)
  const [colAxis, setColAxis] = useState<AxisId>(initialCol)
  const [measure, setMeasure] = useState<Measure>(initialMeasure)
  const [open, setOpen] = useState<string | null>(null)

  const ctx = useMemo<AxisContext>(
    () => axisContext(items, exams, types),
    [exams, types, items],
  )

  const shown = useMemo(() => applyFilter(items, filter, ctx), [items, filter, ctx])

  // **조건은 URL 에 실린다** — 공정 담당자가 「이 조건의 근거」를 링크로 넘길 수 있어야
  // 하류 공정과 연결된다. 서버 왕복 없이 주소만 갈아 끼운다(화면은 이미 전량을 들고 있다).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = filterToQuery(filter)
    sp.set('row', rowAxis)
    sp.set('col', colAxis)
    sp.set('m', measure)
    const q = sp.toString()
    window.history.replaceState(null, '', q ? `?${q}` : window.location.pathname)
  }, [filter, rowAxis, colAxis, measure])

  const toggle = useCallback((axis: AxisId, key: string) => {
    setFilter((f) => {
      const cur = f[axis] ?? []
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
      const out = { ...f }
      if (next.length) out[axis] = next
      else delete out[axis]
      return out
    })
  }, [])

  const pickDefect = useCallback((d: DefectCode | 'blocked' | 'clean') => {
    setFilter((f) => {
      const out = { ...f }
      if (d === 'blocked') out.defect = DEFECTS.map((x) => x.code)
      else if (d === 'clean') out.defect = ['__clean__']
      else out.defect = [d]
      return out
    })
  }, [])

  const chips = useMemo(
    () =>
      (Object.entries(filter) as [AxisId, string[]][])
        .filter(([, v]) => v?.length)
        .flatMap(([axis, keys]) => keys.map((k) => ({ axis, key: k, label: labelOf(axis, k, ctx) }))),
    [filter, ctx],
  )

  const openRow = useMemo(() => shown.find((i) => i.id === open) ?? items.find((i) => i.id === open) ?? null, [open, shown, items])

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[var(--admin)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--t1)]">기출 원천</h2>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/admin/csat/guide?format=md" download className={`${CONTROL} inline-flex items-center gap-1.5`}>
            <Download className="h-4 w-4" aria-hidden />
            교재용 MD
          </a>
          <a
            href="/api/admin/csat/guide?format=json&download=1"
            download
            className={`${CONTROL} inline-flex items-center gap-1.5`}
          >
            <Download className="h-4 w-4" aria-hidden />
            JSON
          </a>
          {/* 탭이 없으므로 `tab` 을 넘기지 않는다 — 넘기면 도움말 머리에 없는 탭 이름이 찍힌다.
              축별 안내는 축 선택자 옆 한 줄(`AxisDef.hint`)이 이미 하고 있어 겹쳐 적지 않는다. */}
          <AdminScreenHelp screen="csat-evidence" />
        </div>
      </header>

      {loadError ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--error-ink)] bg-[var(--bg)] p-3 text-sm text-[var(--t2)]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--error-ink)]" aria-hidden />
          <span>불러오지 못했다 — {loadError}</span>
        </div>
      ) : null}

      <CoverageLine
        items={shown}
        all={items}
        onPick={pickDefect}
        onAll={() => setFilter({})}
        showDefectChips={rowAxis !== 'defect' && colAxis !== 'defect'}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2">
        <label className="flex items-center gap-1.5 text-xs text-[var(--t3)]">
          행
          <select value={rowAxis} onChange={(e) => setRowAxis(e.target.value as AxisId)} className={CONTROL}>
            {AXES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--t3)]">
          열
          <select value={colAxis} onChange={(e) => setColAxis(e.target.value as AxisId)} className={CONTROL}>
            {AXES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--t3)]">
          값
          <select value={measure} onChange={(e) => setMeasure(e.target.value as Measure)} className={CONTROL}>
            {MEASURES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-[var(--t3)]">{axisDef(rowAxis).hint}</span>

        {chips.length ? (
          <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-[var(--bd)] pt-2">
            {chips.map((c) => (
              <button
                key={`${c.axis}:${c.key}`}
                type="button"
                onClick={() => toggle(c.axis, c.key)}
                className={`inline-flex min-h-[44px] items-center gap-1 rounded-full border border-[var(--admin)] px-2.5 text-xs text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] active:bg-[var(--bd)] ${FOCUS}`}
              >
                <span className="text-[var(--t3)]">{axisDef(c.axis).label}</span>
                {c.label}
                <X className="h-3 w-3" aria-hidden />
              </button>
            ))}
            <button type="button" onClick={() => setFilter({})} className={`${LINKNUM} min-h-[44px] text-xs text-[var(--t3)]`}>
              전부 지우기
            </button>
          </div>
        ) : null}
      </div>

      {/* 축이 고른 것에 따라 하나 붙는다 — 피벗이 **구조상 말할 수 없는 것**만 담는다.
          없는 축에서는 아예 안 그린다(빈 상자를 두지 않는다). */}
      <EvidenceAxisPanel axis={rowAxis} items={shown} ctx={ctx} filter={filter} onToggle={toggle} />
      {colAxis !== rowAxis && hasAxisPanel(colAxis) ? (
        <EvidenceAxisPanel axis={colAxis} items={shown} ctx={ctx} filter={filter} onToggle={toggle} />
      ) : null}

      <section className="rounded-lg border border-[var(--bd)] bg-[var(--bg)] p-3">
        <PivotGrid
          items={shown}
          rowAxis={rowAxis}
          colAxis={colAxis}
          measure={measure}
          ctx={ctx}
          onCell={(r, c) => {
            toggle(rowAxis, r)
            toggle(colAxis, c)
          }}
          onRow={(r) => toggle(rowAxis, r)}
          onCol={(c) => toggle(colAxis, c)}
        />
      </section>

      <section className="rounded-lg border border-[var(--bd)] bg-[var(--bg)] p-3">
        <h3 className="mb-2 flex items-center gap-2 text-xs text-[var(--t3)]">
          <PanelRightClose className="h-4 w-4" aria-hidden />이 조건의 문항 {nf.format(shown.length)}개 — 누르면
          전문이 오른쪽에 열린다
        </h3>
        <ItemList items={shown} onOpen={setOpen} />
      </section>

      {open ? <ItemDrawer id={open} row={openRow} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}
