// apps/web/src/app/admin/csat/evidence/EvidenceAxisPanel.tsx
//
// **축이 고른 것에 따라 피벗 위에 하나 붙는 판 — 화면은 계속 하나다.**
//
// ── 왜 렌즈별 「화면」이 아니라 「패널」인가 ───────────────────────────
// 렌즈마다 전용 화면을 만들면 축을 겹칠 수 없게 되어(그게 탭 4장의 결함이었다) 처음으로
// 되돌아간다. 그렇다고 전부 피벗 하나로 밀면 **피벗이 구조상 말할 수 없는 것**이 빠진다:
//
//   · 함정 — 라벨 513종은 행으로 못 쓴다. 계열로 접어 축에 세우되, **어떤 라벨이 묶였는지**는
//     행 이름이 말할 수 없다(휴리스틱 병합이라 사람이 확인해야 한다).
//   · 결함 — 「몇 개인가」는 피벗이 말한다. **어느 순서로 고치나**는 못 말한다.
//   · 유형 — 유형 리포트의 상태(계수 정합 · 배포 가능)는 문항 줄에 없는 값이라 집계로 안 나온다.
//
// 그래서 피벗은 늘 있고, 그 위에 **그 축에서만 말이 되는 것 한 판**이 붙는다. 축을 바꾸면
// 패널만 바뀌고 피벗·목록·필터는 그대로 있다 — 겹쳐 보는 일이 끊기지 않는다.

'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  DEFECTS,
  type AxisContext,
  type AxisId,
  type DefectCode,
  type EvidenceItem,
  type EvidenceType,
  type Filter,
} from '@/lib/csat/evidence-fold'

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]'

const LINK =
  `rounded tabular-nums underline decoration-[var(--bd)] decoration-dotted underline-offset-4 ` +
  `transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--admin)] ` +
  `hover:decoration-[var(--admin)] active:text-[var(--admin-strong)] ${FOCUS}`

const nf = new Intl.NumberFormat('ko-KR')

// ── 함정 — 계열 트리 ────────────────────────────────────────────────────

/**
 * 계열 > 라벨 > (문항).
 *
 * 축의 행 이름은 계열 대표 하나뿐이라, **무엇이 그 아래로 묶였는지**를 행 이름이 말할 수 없다.
 * 병합이 라벨 문자열 휴리스틱이라 과잉 병합이 원리적으로 남으므로(「A / B / C」 같은 합성
 * 라벨이 남의 계열을 끌어온다), 원 라벨을 언제나 펼 수 있어야 사람이 확정 분류를 할 수 있다.
 */
function TrapTree({
  items,
  ctx,
  filter,
  onPick,
}: {
  items: EvidenceItem[]
  ctx: AxisContext
  filter: Filter
  onPick: (familyKey: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)

  // 지금 보이는 문항만으로 다시 센다 — 필터를 걸어 두고 트리가 전체 수를 말하면 두 세계가 겹친다.
  const { perFamily, perLabel } = useMemo(() => {
    const fam = new Map<string, Set<string>>()
    const lab = new Map<string, Set<string>>()
    for (const it of items) {
      for (const t of new Set(it.traps)) {
        const k = ctx.trap.familyOf.get(t) ?? t
        if (!fam.has(k)) fam.set(k, new Set())
        fam.get(k)!.add(it.id)
        if (!lab.has(t)) lab.set(t, new Set())
        lab.get(t)!.add(it.id)
      }
    }
    return { perFamily: fam, perLabel: lab }
  }, [items, ctx])

  const rows = useMemo(
    () =>
      ctx.trap.families
        .map((f) => ({ f, n: perFamily.get(f.key)?.size ?? 0 }))
        .filter((r) => r.n > 0)
        .sort((a, b) => b.n - a.n || b.f.labels.length - a.f.labels.length),
    [ctx, perFamily],
  )

  const merged = rows.filter((r) => r.f.labels.length > 1).length
  const picked = new Set(filter.trap ?? [])

  if (!rows.length) {
    return <p className="py-3 text-sm text-[var(--t3)]">이 조건에 함정 라벨이 달린 문항이 없다</p>
  }

  return (
    <>
      <p className="mb-2 text-xs text-[var(--t3)]">
        오답 선지 라벨 <span className="tabular-nums">{nf.format(perLabel.size)}</span>종을 계열{' '}
        <span className="tabular-nums">{nf.format(rows.length)}</span>개로 접었다 (묶인 계열{' '}
        <span className="tabular-nums">{merged}</span>) — 묶음은 **라벨이 겹치는 낱말**로 판정한 것이라 과잉
        병합이 남는다. 계열을 펴서 원 라벨을 확인한다
      </p>
      <ul className="max-h-[38vh] space-y-0.5 overflow-y-auto pr-1">
        {rows.map(({ f, n }) => {
          const isOpen = open === f.key
          const isPicked = picked.has(f.key)
          return (
            <li key={f.key} className="border-b border-[var(--bd)] last:border-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : f.key)}
                  aria-expanded={isOpen}
                  aria-label={`${f.key} 계열의 원 라벨 ${f.labels.length}개 ${isOpen ? '접기' : '펴기'}`}
                  disabled={f.labels.length < 2}
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] disabled:opacity-25 ${FOCUS}`}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onPick(f.key)}
                  aria-pressed={isPicked}
                  className={`flex min-h-[44px] flex-1 items-center gap-2 text-left text-[13px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--admin)] active:text-[var(--admin-strong)] ${FOCUS} ${
                    isPicked ? 'font-semibold text-[var(--admin)]' : 'text-[var(--t1)]'
                  }`}
                >
                  <span className="flex-1 truncate">{f.key}</span>
                  {f.labels.length > 1 ? (
                    <span className="shrink-0 text-xs text-[var(--t3)]">라벨 {f.labels.length}</span>
                  ) : null}
                  <span className="shrink-0 tabular-nums text-[var(--t2)]">{nf.format(n)}문항</span>
                </button>
              </div>
              {isOpen ? (
                <ul className="mb-1.5 ml-8 space-y-0.5 border-l border-[var(--bd)] pl-3">
                  {f.labels.map((l) => (
                    <li key={l} className="flex items-baseline gap-2 text-xs text-[var(--t2)]">
                      <span className="flex-1">{l}</span>
                      <span className="tabular-nums text-[var(--t3)]">
                        {nf.format(perLabel.get(l)?.size ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}

// ── 결함 — 고치는 순서 ─────────────────────────────────────────────────

/**
 * 「몇 개인가」는 피벗이 말한다. 여기서 말하는 것은 **어느 것부터 고치나**다.
 *
 * 순서는 취향이 아니라 **막는 공정의 이른 정도**다 — 배점이 어긋나면 커버리지 숫자가 틀리고,
 * 틀린 커버리지 위에서 고른 다음 드레인은 헛일이 된다. 학습자 배포만 막는 결함은 마지막이다.
 */
function DefectOrder({
  items,
  filter,
  onPick,
}: {
  items: EvidenceItem[]
  filter: Filter
  onPick: (code: DefectCode) => void
}) {
  const count = useMemo(() => {
    const m = new Map<DefectCode, number>()
    for (const it of items) for (const d of it.defects) m.set(d, (m.get(d) ?? 0) + 1)
    return m
  }, [items])

  const ordered = useMemo(
    () =>
      [...DEFECTS]
        .map((d) => ({ d, n: count.get(d.code) ?? 0 }))
        .sort((a, b) => a.d.stageOrd - b.d.stageOrd || b.n - a.n),
    [count],
  )
  const picked = new Set(filter.defect ?? [])

  return (
    <>
      <p className="mb-2 text-xs text-[var(--t3)]">
        막는 공정이 이른 것부터 — 커버리지를 틀리게 만드는 결함을 남겨 두면 그 위에서 고른 다음
        드레인이 헛일이 된다
      </p>
      <ol className="space-y-1">
        {ordered.map(({ d, n }) => (
          <li
            key={d.code}
            className={`rounded-md border px-3 py-2 ${
              n === 0 ? 'border-[var(--bd)] opacity-55' : 'border-[var(--bd)]'
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span aria-hidden className={n > 0 ? 'text-[var(--error-ink)]' : 'text-[var(--success-ink)]'}>
                {n > 0 ? '✕' : '✓'}
              </span>
              <button
                type="button"
                onClick={() => onPick(d.code)}
                aria-pressed={picked.has(d.code)}
                disabled={n === 0}
                className={`min-h-[44px] text-[13px] font-medium transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--admin)] disabled:cursor-default ${FOCUS} ${
                  picked.has(d.code) ? 'text-[var(--admin)]' : 'text-[var(--t1)]'
                }`}
              >
                {d.label}
              </button>
              <span className="tabular-nums text-[13px] font-semibold text-[var(--t1)]">{nf.format(n)}문항</span>
              <span className="text-xs text-[var(--t3)]">{d.blocks} 이(가) 막힌다</span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--t2)]">{d.why}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--t3)]">→ {d.fix}</p>
          </li>
        ))}
      </ol>
    </>
  )
}

// ── 유형 — 리포트 상태 ─────────────────────────────────────────────────

/**
 * 유형 리포트의 상태는 **문항 줄에 없는 값**이라 아무리 접어도 피벗에서 안 나온다.
 *
 * 그런데 이 두 칸(계수 정합 · 학습자 배포 가능)이 막는 문항이 각각 288 · 562 로 이 화면에서
 * 가장 크다. 유형 축을 골랐을 때 그것이 안 보이면 「유형별로 몇 문항」만 세던 옛 표와 같아진다.
 */
function TypeReports({
  types,
  items,
  filter,
  onPick,
}: {
  types: readonly EvidenceType[]
  items: EvidenceItem[]
  filter: Filter
  onPick: (typeId: string) => void
}) {
  const shown = useMemo(() => {
    const n = new Map<string, number>()
    for (const it of items) n.set(it.typeId, (n.get(it.typeId) ?? 0) + 1)
    return [...types]
      .map((t) => ({ t, here: n.get(t.id) ?? 0 }))
      .filter((r) => r.here > 0)
      .sort(
        (a, b) =>
          Number(b.t.analystMeta.length > 0) - Number(a.t.analystMeta.length > 0) ||
          Number(b.t.reportN !== null && b.t.reportN !== b.t.items) -
            Number(a.t.reportN !== null && a.t.reportN !== a.t.items) ||
          b.here - a.here,
      )
  }, [types, items])

  const picked = new Set(filter.type ?? [])
  const blocked = shown.filter((r) => r.t.analystMeta.length > 0).length
  const mismatched = shown.filter((r) => r.t.reportN !== null && r.t.reportN !== r.t.items).length

  return (
    <>
      <p className="mb-2 text-xs text-[var(--t3)]">
        학습자 배포 가능 <span className="tabular-nums">{shown.length - blocked}</span> /{' '}
        <span className="tabular-nums">{shown.length}</span> · 계수 어긋남{' '}
        <span className="tabular-nums">{mismatched}</span> — 배포 판정은 학습자 화면이 실제로 그리는 세
        필드(근거 서술 · 상위 6 미끄러지는 자리 · 풀이 절차)를 전부 본다
      </p>
      <div className="max-h-[38vh] overflow-y-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-[var(--bg)]">
            <tr className="border-b border-[var(--bd)] text-left text-xs text-[var(--t3)]">
              <th className="py-1.5 pr-3 font-medium">유형</th>
              <th className="py-1.5 pr-3 text-right font-medium">문항</th>
              <th className="py-1.5 pr-3 text-right font-medium">리포트 n</th>
              <th className="py-1.5 pr-3 font-medium">학습자 배포</th>
              <th className="py-1.5 font-medium">막는 것</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ t, here }) => {
              const mismatch = t.reportN !== null && t.reportN !== t.items
              return (
                <tr key={t.id} className="border-b border-[var(--bd)] last:border-0">
                  <td className="py-0.5 pr-3">
                    <button
                      type="button"
                      onClick={() => onPick(t.id)}
                      aria-pressed={picked.has(t.id)}
                      className={`min-h-[44px] text-left ${LINK} ${
                        picked.has(t.id) ? 'font-semibold text-[var(--admin)]' : 'text-[var(--t1)]'
                      }`}
                    >
                      {t.name}
                    </button>
                    {t.status === 'retired' ? (
                      <span className="ml-1.5 text-[11px] text-[var(--t3)]">폐지</span>
                    ) : null}
                  </td>
                  <td className="py-0.5 pr-3 text-right tabular-nums text-[var(--t2)]">{here}</td>
                  <td
                    className={`py-0.5 pr-3 text-right tabular-nums ${
                      mismatch ? 'text-[var(--error-ink)]' : 'text-[var(--t2)]'
                    }`}
                  >
                    {t.reportN ?? '—'}
                    {mismatch ? <span aria-hidden> ✕</span> : null}
                  </td>
                  <td className="py-0.5 pr-3 text-xs">
                    {t.analystMeta.length ? (
                      <span className="text-[var(--error-ink)]">
                        <span aria-hidden>✕ </span>막힘
                      </span>
                    ) : (
                      <span className="text-[var(--success-ink)]">
                        <span aria-hidden>✓ </span>가능
                      </span>
                    )}
                  </td>
                  <td className="py-0.5 text-xs text-[var(--t3)]">
                    {[
                      t.analystMeta.length ? `작업 로그 — ${t.analystMeta.join(' · ')}` : null,
                      mismatch ? `계수 ${t.reportN} ≠ 실제 ${t.items}` : null,
                    ]
                      .filter(Boolean)
                      .join(' / ') || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── 판 ──────────────────────────────────────────────────────────────────

/** 이 축에 붙는 패널이 있나 — 없으면 피벗만 그린다(빈 상자를 두지 않는다). */
export function hasAxisPanel(axis: AxisId): boolean {
  return axis === 'trap' || axis === 'defect' || axis === 'type'
}

const TITLE: Partial<Record<AxisId, string>> = {
  trap: '함정 계열 — 무엇이 한 묶음으로 접혔나',
  defect: '고치는 순서 — 막는 공정이 이른 것부터',
  type: '유형 리포트 — 문항 수로는 안 보이는 두 칸',
}

export function EvidenceAxisPanel({
  axis,
  items,
  ctx,
  filter,
  onToggle,
}: {
  axis: AxisId
  items: EvidenceItem[]
  ctx: AxisContext
  filter: Filter
  onToggle: (axis: AxisId, key: string) => void
}) {
  if (!hasAxisPanel(axis)) return null

  return (
    <section className="rounded-lg border border-[var(--bd)] bg-[var(--bg)] p-3">
      <h3 className="mb-1.5 text-xs font-medium text-[var(--t2)]">{TITLE[axis]}</h3>
      {axis === 'trap' ? (
        <TrapTree items={items} ctx={ctx} filter={filter} onPick={(k) => onToggle('trap', k)} />
      ) : axis === 'defect' ? (
        <DefectOrder items={items} filter={filter} onPick={(c) => onToggle('defect', c)} />
      ) : (
        <TypeReports types={ctx.types} items={items} filter={filter} onPick={(id) => onToggle('type', id)} />
      )}
    </section>
  )
}
