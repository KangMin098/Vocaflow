// apps/web/src/app/admin/csat/catalog/SeriesShelf.tsx
//
// **카탈로그 — 시리즈가 행이고 학령이 열이다.**
//
// ⚠️ 축을 바꿨다(2026-09-06). 예전 격자는 (유형 × 학령) 42칸이었는데 그중 14칸이 영영 회색
//   («기출»·«개인 맞춤»·«내신»)이었고, 나머지도 **만들 수 없는 책을 세고 있었다**
//   (헤드라인이 「낼 수 있는데 안 낸 책 18권」이라고 적는데 실제로는 0권이었다).
//
//   시장이 파는 단위는 시리즈다 — 「독해 고1」이 아니라 「리딩튜터 주니어 Level 2」.
//   그래서 행을 시리즈로 바꿨고, **한 칸 = 한 권**이 됐다. 칸의 뜻이 분명해지자
//   격자가 21칸으로 줄고 죽은 칸이 사라졌다.
//
// ── 글자 대신 표지 ────────────────────────────────────────────────────
// 시리즈를 이름으로만 늘어놓으면 「어느 것이 어느 것인지」가 안 읽힌다. 그래서 행마다
// **조판기가 실제로 찍는 표지**(`coverSvg`)를 그대로 건다 — 화면과 손에 쥔 책이 같은 그림이다.
// 새 그림을 그리지 않는 것이 요점이다: 미리보기용 그림을 따로 만들면 둘이 갈린다.

'use client'

import { useState } from 'react'

import { coverSvg } from '@vocaflow/library-pipeline/textbook-cover'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  SERIES_STEPS,
  VOLUME_STATUS_KO,
  readyToPrint,
  type SeriesCatalogView,
  type SeriesRow,
  type VolumeCell,
} from '@/lib/csat/series-model'

/** 표지 미니어처 — 조판기와 **같은 함수**를 쓴다. 다른 그림을 쓰면 매대와 책이 달라진다. */
function Cover({ row, width = 44 }: { row: SeriesRow; width?: number }) {
  // 표지의 브랜드 칸은 **짧은 이름**이다(표지가 좁다). 시리즈마다 자기 이름을 써야
  // 세 권을 나란히 놓았을 때 서로 다른 시리즈로 읽힌다 — 전역 `COVER_BRAND` 를 쓰면
  // 셋 다 READING 이 된다(실측 2026-09-06 에 그렇게 나왔다).
  const short = row.brand.split(' ').slice(-1)[0] ?? row.brand
  const first = row.volumes.find((v) => v.title)
  const svg = coverSvg(
    {
      brand: short,
      // 시리즈 액센트를 넘겨야 같은 단의 세 권이 서로 다른 색으로 찍힌다.
      accent: row.accent,
      step: first?.step ?? 1,
      totalSteps: SERIES_STEPS.length,
      schoolBand: first?.schoolBand ?? '',
      pending: row.status === 'draft',
    },
    width,
  )
  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{ width, display: 'inline-block' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function Volume({
  v,
  brand,
  picked,
  onPick,
}: {
  v: VolumeCell
  brand: string
  picked: boolean
  onPick: () => void
}) {
  const k = VOLUME_STATUS_KO[v.status]
  if (v.status === 'noRung') {
    return (
      <span
        className="flex min-h-[44px] items-center justify-center rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] font-mono text-[11px] text-[var(--t3)]"
        title={`${brand} 에는 ${v.schoolBand} 단이 없다`}
      >
        ·
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      title={`${v.title} — ${k.label}`}
      className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-[var(--r-sm)] border px-1 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] ${
        picked
          ? 'border-[#8B5CF6] bg-[#8B5CF6]/10'
          : 'border-[var(--bd)] hover:bg-[var(--bg2)] active:bg-[var(--bd)]'
      }`}
    >
      {/* 기호 + 글자 + 색 셋을 함께 낸다 — 색만으로 말하면 색각 이상에서 사라진다. */}
      <span aria-hidden className="font-mono text-[13px] leading-none" style={{ color: k.color }}>
        {k.mark}
      </span>
      <span className="break-keep text-center font-body text-[9.5px] leading-tight text-[var(--t3)]">
        {k.label}
      </span>
    </button>
  )
}

function Row({
  row,
  picked,
  onPick,
}: {
  row: SeriesRow
  picked: VolumeCell | null
  onPick: (r: SeriesRow, v: VolumeCell) => void
}) {
  return (
    <div className="grid grid-cols-[minmax(150px,1.4fr)_repeat(7,minmax(0,1fr))] items-center gap-1">
      <div className="flex items-center gap-2 pr-2">
        <Cover row={row} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 break-keep font-display text-[12px] font-[700] text-[var(--t1)]">
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: row.accent }}
            />
            {row.brand}
          </p>
          <p className="font-mono text-[10px] tabular-nums text-[var(--t3)]">
            {row.published}/{row.rungs}권 · 시장 {row.marketSeries}
          </p>
        </div>
      </div>
      {row.volumes.map((v) => (
        <Volume
          key={v.step}
          v={v}
          brand={row.brand}
          picked={picked?.step === v.step && picked.title === v.title}
          onPick={() => onPick(row, v)}
        />
      ))}
    </div>
  )
}

export function SeriesShelf({ rows, counts, inventoryAt, notMaking, loadError }: SeriesCatalogView) {
  const [sel, setSel] = useState<{ row: SeriesRow; v: VolumeCell } | null>(null)
  const ready = readyToPrint(rows)
  const draft = rows.filter((r) => r.status === 'draft')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            ⓪ 카탈로그 — 어떤 시리즈를 파나
          </h2>
          <p className="font-body text-[12px] text-[var(--t2)]">한 칸이 한 권이다</p>
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
        헤드라인은 **가장 앞을 막는 것** 하나만 말한다.
          ① 찍기만 하면 되는 권이 있으면 그것 (가장 싸다)
          ② 아니면 아직 한 번도 안 찍은 시리즈 (정의는 끝났다)
      */}
      <p className="break-keep font-display text-[15px] font-[700] text-[var(--t1)]">
        {ready > 0 ? (
          <span className="text-[#2E7D5A]">찍기만 하면 되는 권 {ready}권</span>
        ) : draft.length > 0 ? (
          <span className="text-[#B5803A]">한 번도 안 찍은 시리즈 {draft.length}개</span>
        ) : (
          <span className="text-[#2E7D5A]">낼 수 있는 권은 다 냈다</span>
        )}
        <span className="ml-2 font-mono text-[12px] font-[400] tabular-nums text-[var(--t3)]">
          시리즈 {counts.shipping}/{counts.market}
        </span>
        <span className="ml-1 font-body text-[11.5px] font-[400] text-[var(--t3)]">
          — 시장이 22개를 굴린다
        </span>
      </p>

      <section aria-label="시리즈 격자" className="flex flex-col gap-1 overflow-x-auto">
        <div className="flex min-w-[620px] flex-col gap-1">
          <div className="grid grid-cols-[minmax(150px,1.4fr)_repeat(7,minmax(0,1fr))] gap-1">
            <span />
            {SERIES_STEPS.map((s) => (
              <span
                key={s.step}
                className="break-keep text-center font-body text-[10px] leading-tight text-[var(--t3)]"
              >
                {s.schoolBand}
              </span>
            ))}
          </div>
          {rows.map((r) => (
            <Row
              key={r.id}
              row={r}
              picked={sel?.row.id === r.id ? sel.v : null}
              onPick={(row, v) => setSel({ row, v })}
            />
          ))}
        </div>
      </section>

      <p className="flex flex-wrap gap-x-3 gap-y-1 font-body text-[10.5px] text-[var(--t3)]">
        {(['published', 'ready', 'needsExplain', 'needsItems', 'noRung'] as const).map((s) => (
          <span key={s}>
            <span aria-hidden style={{ color: VOLUME_STATUS_KO[s].color }}>
              {VOLUME_STATUS_KO[s].mark}
            </span>{' '}
            {VOLUME_STATUS_KO[s].label}
          </span>
        ))}
      </p>

      {sel ? (
        <section
          aria-label="고른 권"
          className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
        >
          <h3 className="flex flex-wrap items-baseline gap-2 break-keep font-display text-[14px] font-[700] text-[var(--t1)]">
            {sel.v.title}
            <span
              className="rounded-[var(--r-full)] px-2 py-0.5 font-body text-[11px] font-[400]"
              style={{
                background: `${VOLUME_STATUS_KO[sel.v.status].color}1F`,
                color: VOLUME_STATUS_KO[sel.v.status].color,
              }}
            >
              {VOLUME_STATUS_KO[sel.v.status].label}
            </span>
          </h3>
          <p className="font-mono text-[11.5px] tabular-nums text-[var(--t2)]">
            문항 {sel.v.items?.toLocaleString() ?? '못 잼'} · 해설{' '}
            {sel.v.explained?.toLocaleString() ?? '못 잼'} · 한 권 60
          </p>
          {/*
            **무엇으로 만드나** — 사용자가 책을 고르는 바로 그 자리에서 답한다.
            예전에는 이 답이 세 화면에 흩어져 있었다(카탈로그=권 · ④소재=밴드별 지문 ·
            ④-1=원문 판정). 셋을 잇는 것이 관리자 머릿속뿐이라 「어떤 원문을 어떤
            기준으로」에 아무 화면도 답하지 못했다.
          */}
          {sel.v.types.length ? (
            <div className="flex flex-col gap-1.5">
              <p className="flex flex-wrap items-baseline gap-x-2 font-body text-[11.5px] text-[var(--t2)]">
                <span className="font-display font-[600] text-[var(--t1)]">무엇으로</span>
                {sel.v.types.map((t) => (
                  <span
                    key={t}
                    className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-1.5 py-0.5 text-[11px]"
                  >
                    {t}
                  </span>
                ))}
              </p>
              {sel.v.recipe ? (
                <p className="break-keep font-body text-[11px] leading-snug text-[var(--t3)]">
                  {sel.v.recipe}
                </p>
              ) : null}
            </div>
          ) : null}
          {sel.row.status === 'draft' ? (
            <p className="break-keep rounded-[var(--r-sm)] bg-[var(--bg2)] p-2 font-body text-[11.5px] leading-snug text-[var(--t2)]">
              {sel.row.nextStep}
            </p>
          ) : null}
          {sel.v.status === 'ready' || sel.v.status === 'published' ? (
            <div className="flex flex-col gap-1 rounded-[var(--r-sm)] bg-[var(--bg2)] p-2.5">
              <p className="font-display text-[11.5px] font-[600] text-[var(--t2)]">찍는 법</p>
              {/*
                ⚠️ **`--series` 를 반드시 싣는다.** 밴드만 주면 조합기가 독해 사다리를 보고
                   그 밴드의 **독해 권**을 낸다 — 어휘 칸에서 어휘 권이 안 나온다.
                   실측 2026-09-06 에 이 화면이 밴드만 주고 있었다(같은 종류의 거짓을
                   축을 고치면서 새로 만들었다).
              */}
              <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
                pnpm dlx tsx scripts/textbook/build-volume.mjs --series {sel.row.id} --band{' '}
                {sel.v.step} --units 20
              </code>
              <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
                pnpm dlx tsx scripts/textbook/render-volume.mjs --series {sel.row.id} --band{' '}
                {sel.v.step} --units 20 --out {sel.row.id}-v{sel.v.step}.html
              </code>
            </div>
          ) : null}
        </section>
      ) : null}

      {/*
        만들지 않는 것은 **칸으로 그리지 않는다.** 예전 격자는 이 셋을 21칸으로 그렸고
        그 칸들은 영영 회색이었다 — 격자의 절반이 아무 행동도 안 부르는 색이었다.
      */}
      <section className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
        <h3 className="font-display text-[12px] font-[700] text-[var(--t1)]">안 만드는 것</h3>
        <ul className="flex flex-col gap-1">
          {notMaking.map((n) => (
            <li key={n.name} className="break-keep font-body text-[11px] leading-snug text-[var(--t3)]">
              <span className="font-[600] text-[var(--t2)]">{n.name}</span> — {n.why}
            </li>
          ))}
        </ul>
      </section>

      {inventoryAt ? (
        <p className="font-body text-[10.5px] text-[var(--t3)]">
          재고는 {new Date(inventoryAt).toLocaleString('ko-KR')} 기준 (30분마다 갱신)
        </p>
      ) : null}
    </div>
  )
}
