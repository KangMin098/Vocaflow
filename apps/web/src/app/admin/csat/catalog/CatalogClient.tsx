// apps/web/src/app/admin/csat/catalog/CatalogClient.tsx
//
// **카탈로그 — 「뭘 만드나」에 답하는 유일한 화면.**
//
// ── 왜 이 화면이 없었나 ──────────────────────────────────────────────
// 교재 공장에는 공정 8칸이 있었지만 **제품 목록이 없었다.** 화면은 전부 "공장이 지금 어떤
// 상태인가" 를 말하고, "내가 교재 하나를 만들려면 무엇을 눌러야 하나" 에는 아무 데도 답하지
// 않았다. 관리자가 「뭘·어떻게·무엇으로」를 못 읽은 이유가 이것이다.
//
// ── 이 화면이 드러내는 것 ────────────────────────────────────────────
// 격자는 (유형 × 학령)이고 한 칸이 곧 한 권이다. 실측 2026-09-06 에 이 격자를 처음 그리자
// **낼 수 있는 권 24 중 실제로 찍힌 것은 7권(독해)뿐**임이 드러났다 — 어휘 28.8만 · 구문 15.4만 ·
// 내신 14.4만 문항이 재고에 있는데 담을 책이 정의돼 있지 않았다.
// 그래서 이 화면의 헤드라인은 재고도 커버리지도 아니고 **「낼 수 있는데 안 낸 권」** 이다.
//
// ── 색만으로 말하지 않는다 ───────────────────────────────────────────
// 칸의 상태는 여섯이고 색만으로는 갈리지 않는다(상태 4색의 CVD 분리가 ΔE 7.8). 그래서
// 칸마다 **기호 + 색 + 접근성 이름**을 함께 싣는다: ● 냈다 · ○ 낼 수 있다 · ◐ 모자라다 ·
// ✕ 없다 · — 못 낸다.

'use client'

import { useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  CELL_STATUS_KO,
  ITEMS_PER_VOLUME,
  STEPS,
  productLineGap,
  type CatalogCell,
  type CatalogRow,
} from '@/lib/csat/product-model'
import type { CatalogView } from '@/lib/csat/product-view'

/** 칸 하나의 기호. 색이 안 보여도 이것으로 갈린다. */
function mark(c: CatalogCell): string {
  if (c.status === 'blocked') return '—'
  if (c.status === 'unmeasured') return '?'
  // 재고가 아니라 **제품**이 없는 칸. 재고 없음(✕)과 다른 기호여야 할 일이 안 섞인다.
  if (c.status === 'noLine') return '▢'
  if (c.status === 'empty') return '✕'
  if (c.status === 'ready') return c.published ? '●' : '○'
  return '◐'
}

/** 칸이 지금 무엇을 기다리는지 — 한 줄. 상세 패널이 이걸 그대로 쓴다. */
function waitingFor(c: CatalogCell): string {
  switch (c.status) {
    case 'blocked':
      return c.blocked ?? '만들 수 없는 칸이다'
    case 'unmeasured':
      return '재고를 못 셌다 — 0 이 아니다'
    case 'noLine':
      return '재고는 있는데 **이 유형을 담는 권이 없다** — 찍을 것이 아니라 정의할 것이다'
    case 'empty':
      return '이 학령·유형 조합의 문항이 하나도 없다'
    case 'needsItems':
      return `한 권에 ${ITEMS_PER_VOLUME}문항이 드는데 ${(c.items ?? 0).toLocaleString()}개뿐이다`
    case 'needsExplain':
      return `문항은 ${(c.items ?? 0).toLocaleString()}개인데 해설이 ${(c.explained ?? 0).toLocaleString()}개다 — 해설 없는 책은 혼자 못 푼다`
    case 'ready':
      return c.published
        ? '조판돼 나갔다'
        : '재고도 해설도 찼다 — **아직 안 찍었을 뿐이다**'
  }
}

function Cell({
  c,
  band,
  on,
  onPick,
}: {
  c: CatalogCell
  band: string
  on: boolean
  onPick: () => void
}) {
  const st = CELL_STATUS_KO[c.status]
  const label = c.status === 'ready' && c.published ? '냈음' : st.label
  return (
    <button
      type="button"
      onClick={onPick}
      aria-current={on ? 'true' : undefined}
      aria-label={`${band} — ${label}. ${waitingFor(c).replace(/\*\*/g, '')}`}
      className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-[var(--r-sm)] border px-1 py-1.5 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] ${
        on
          ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
          : 'border-[var(--bd)] hover:bg-[var(--bg2)] active:bg-[var(--bd)]'
      }`}
      style={
        c.status === 'ready' && !c.published
          ? { background: on ? undefined : '#2E7D5A14' }
          : undefined
      }
    >
      <span aria-hidden className="font-mono text-[13px] leading-none" style={{ color: st.color }}>
        {mark(c)}
      </span>
      <span aria-hidden className="font-body text-[9.5px] leading-none text-[var(--t3)]">
        {c.status === 'ready' && !c.published ? '안 냄' : label}
      </span>
    </button>
  )
}

function Row({
  row,
  picked,
  onPick,
}: {
  row: CatalogRow
  picked: CatalogCell | null
  onPick: (c: CatalogCell) => void
}) {
  const stock = row.cells.reduce((n, c) => n + (c.items ?? 0), 0)
  return (
    <div className="grid grid-cols-[minmax(96px,1fr)_repeat(7,minmax(0,1fr))] items-stretch gap-1">
      <div className="flex flex-col justify-center py-1">
        <span className="break-keep font-display text-[13px] font-[700] text-[var(--t1)]">
          {row.genre.name}
        </span>
        <span className="break-keep font-body text-[10px] leading-tight text-[var(--t3)]">
          {row.genre.marketDocs != null ? `시중 ${row.genre.marketDocs}종 · ` : '시중에 없음 · '}
          재고 {stock.toLocaleString()}
        </span>
        <span className="font-mono text-[10px] text-[var(--t3)]">
          냄 {row.published} / 낼 수 있음 {row.ready}
        </span>
      </div>
      {row.cells.map((c) => (
        <Cell
          key={c.step}
          c={c}
          band={`${STEPS.find((s) => s.step === c.step)?.schoolBand ?? c.step} ${row.genre.name}`}
          on={picked?.genre === c.genre && picked?.step === c.step}
          onPick={() => onPick(c)}
        />
      ))}
    </div>
  )
}

export function CatalogClient({ rows, coverage, genres, loadError }: CatalogView) {
  // 격자가 그리는 칸 수와 **실제로 나오는 권 수**의 격차. 둘이 다르다는 것이
  // 이 화면이 드러내야 할 사실이다 — 42칸을 그리지만 시리즈는 하나뿐이다.
  const gap = productLineGap()
  const [picked, setPicked] = useState<CatalogCell | null>(null)
  const sel = picked ?? rows.flatMap((r) => r.cells).find((c) => c.status === 'ready' && !c.published) ?? null
  const selRow = sel ? rows.find((r) => r.genre.id === sel.genre) ?? null : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            카탈로그 — 무엇을 만들 수 있나
          </h2>
          <p className="break-keep font-body text-[12px] text-[var(--t2)]">
            칸 하나가 한 권이다 (유형 × 학령 · 한 권 {ITEMS_PER_VOLUME}문항)
          </p>
        </div>
        <AdminScreenHelp screen="csat-catalog" />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[#9C3A30] bg-[var(--bg)] p-3 font-body text-[13px] text-[#9C3A30]"
        >
          {loadError}
        </p>
      ) : null}

      {/*
        헤드라인은 **가장 앞을 막는 것** 하나만 말한다. 순서가 있다:
          ① 찍기만 하면 되는 권이 있으면 그것 (가장 싸다)
          ② 아니면 **재고는 있는데 담을 책이 없는 칸** — 실측 2026-09-06 에 18칸이었고,
             그동안 이 18칸이 「낼 수 있는데 안 낸 책」으로 세어져 있었다. 조판 명령을 줘도
             안 나온다. 할 일은 찍는 것이 아니라 **시리즈 단을 정의하는 것**이다.
      */}
      <p className="break-keep font-display text-[15px] font-[700] text-[var(--t1)]">
        {coverage.unpublished > 0 ? (
          <>
            <span className="text-[#2E7D5A]">찍기만 하면 되는 책 {coverage.unpublished}권</span>
            <span className="ml-2 font-body text-[12px] font-[400] text-[var(--t2)]">
              재고도 해설도 찼다
            </span>
          </>
        ) : coverage.noLine > 0 ? (
          <>
            <span className="text-[#B5803A]">담을 책이 없는 재고 {coverage.noLine}칸</span>
            <span className="ml-2 font-body text-[12px] font-[400] text-[var(--t2)]">
              찍을 것이 아니라 <strong>시리즈를 정의할</strong> 차례다
            </span>
          </>
        ) : (
          <span className="text-[#2E7D5A]">낼 수 있는 책은 다 냈다</span>
        )}
        <span className="ml-2 font-mono text-[12px] font-[400] tabular-nums text-[var(--t3)]">
          시리즈 {gap.volumes}권 · 격자 {gap.cells}칸 · 시중 유형 {genres.covered}/{genres.market}
        </span>
      </p>

      {/* 격자 */}
      <section aria-label="제품 격자" className="flex flex-col gap-1 overflow-x-auto">
        <div className="min-w-[620px] flex flex-col gap-1">
          <div className="grid grid-cols-[minmax(96px,1fr)_repeat(7,minmax(0,1fr))] gap-1">
            <span />
            {STEPS.map((s) => (
              <span
                key={s.step}
                className="break-keep text-center font-body text-[10px] leading-tight text-[var(--t3)]"
              >
                {s.schoolBand}
              </span>
            ))}
          </div>
          {rows.map((r) => (
            <Row key={r.genre.id} row={r} picked={sel} onPick={setPicked} />
          ))}
        </div>
      </section>

      <p className="flex flex-wrap gap-x-3 gap-y-1 font-body text-[10.5px] text-[var(--t3)]">
        <span>● 냈다</span>
        <span>○ 낼 수 있는데 안 냈다</span>
        <span>◐ 모자라다</span>
        <span>▢ 담을 책 없음</span>
        <span>✕ 재고 없음</span>
        <span>— 못 낸다</span>
        <span>? 못 잼</span>
      </p>

      {/* 고른 한 칸 — 그 권이 지금 무엇을 기다리는가 */}
      {sel && selRow ? (
        <section
          aria-label="고른 책"
          className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
        >
          <h3 className="break-keep font-display text-[15px] font-[700] text-[var(--t1)]">
            {STEPS.find((s) => s.step === sel.step)?.schoolBand} {selRow.genre.name}
            <span
              className="ml-2 rounded-[var(--r-full)] px-2 py-0.5 font-display text-[11px]"
              style={{
                background: `${CELL_STATUS_KO[sel.status].color}1F`,
                color: CELL_STATUS_KO[sel.status].color,
              }}
            >
              {sel.status === 'ready' && sel.published ? '냈음' : CELL_STATUS_KO[sel.status].label}
            </span>
          </h3>
          <p className="break-keep font-body text-[12px] text-[var(--t2)]">{selRow.genre.question}</p>
          <p className="break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">
            {waitingFor(sel).replace(/\*\*/g, '')}
          </p>
          <p className="font-mono text-[11.5px] tabular-nums text-[var(--t3)]">
            문항 {sel.items?.toLocaleString() ?? '못 잼'} · 해설{' '}
            {sel.explained?.toLocaleString() ?? '못 잼'} · 필요 {ITEMS_PER_VOLUME}
          </p>
          {sel.status === 'ready' && !sel.published ? (
            <div className="flex flex-col gap-1 rounded-[var(--r-sm)] bg-[var(--bg2)] p-2.5">
              <p className="font-display text-[11.5px] font-[600] text-[var(--t2)]">찍는 법</p>
              <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
                pnpm dlx tsx scripts/textbook/build-volume.mjs --band {sel.step} --units 20
              </code>
              <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
                pnpm dlx tsx scripts/textbook/render-volume.mjs --band {sel.step} --units 20 --out
                volume-v{sel.step}.html
              </code>
              <p className="break-keep font-body text-[10.5px] leading-snug text-[var(--t3)]">
                ⚠️ 조합기는 지금 <strong>독해 유형만</strong> 담는다(`SERIES_SPINE`). 어휘·구문·내신
                권을 찍으려면 그 유형을 쓰는 사다리 단을 먼저 정의해야 한다 — 그것이 이 격자가
                드러낸 진짜 일이다.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
