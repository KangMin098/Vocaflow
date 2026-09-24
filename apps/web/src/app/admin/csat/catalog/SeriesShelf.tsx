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
  LIFECYCLE_KO,
  TRIGGER_KO,
} from '@vocaflow/library-pipeline/textbook-series-lifecycle'

import {
  SERIES_STEPS,
  VOLUME_STATUS_KO,
  readyToPrint,
  type SeriesCatalogView,
  type SeriesRow,
  type VolumeCell,
} from '@/lib/csat/series-model'

/**
 * **나가고 있는 시리즈인가.**
 *
 * 개정 중(`revising`)도 나가고 있는 것이다 — 옛 규격 권이 섞였을 뿐 매대에는 있다.
 * `null` 은 **못 잰 것**이라 어느 쪽으로도 안 센다(0 으로 뭉개면 「안 찍었네」가 된다).
 */
function isShipped(r: SeriesRow): boolean {
  return r.lifecycle === 'shipping' || r.lifecycle === 'revising'
}

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
      // 표지의 「준비 중」 빗금 — 나간 권이 하나도 없을 때만. 못 쟀으면 긋지 않는다.
      pending: row.lifecycle != null && !isShipped(row),
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
      className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-[var(--r-sm)] border px-1 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] ${
        picked
          ? 'border-[var(--p)] bg-[color-mix(in_srgb,var(--p)_10%,transparent)]'
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

export function SeriesShelf({
  rows,
  counts,
  gaps,
  inventoryAt,
  notMaking,
  loadError,
}: SeriesCatalogView) {
  const [sel, setSel] = useState<{ row: SeriesRow; v: VolumeCell } | null>(null)
  const ready = readyToPrint(rows)
  const unshipped = rows.filter((r) => r.lifecycle != null && !isShipped(r))
  const revising = rows.filter((r) => r.lifecycle === 'revising')
  const unmeasured = rows.filter((r) => r.lifecycle == null)
  // 시장에 있는데 우리가 아직 안 만든 자리. 막힌 칸은 빼고 센다 — 못 만드는 것을
  // 「안 한 일」로 세면 그 수가 영영 안 줄고, 안 줄면 아무도 안 본다.
  const openGaps = gaps.filter((g) => g.blockedWhy == null && g.ours < g.market)
  const openSlots = openGaps.reduce((n, g) => n + (g.market - g.ours), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            ⑨ 품목·운영 — 무엇을 더 낼 것인가, 낸 것을 어떻게 할 것인가
          </h2>
          {/*
            ⚠️ 제목이 ⓪ 에서 ⑨ 로 옮겨 왔다(2026-09-23 · DD-77). 이 화면은 공정의 **앞**에
               있는 것처럼 서 있었지만 하는 일은 **뒤**의 일이다 — 낸 책이 팔리는지 보고,
               제도가 바뀌면 개정하고, 안 팔리면 접고, 그 판단으로 다음 유형을 발의한다.
               그 발의가 ② 기획의 입력이라 여기가 **끝이면서 다음 바퀴의 시작**이다.
          */}
          <p className="break-keep font-body text-[12px] text-[var(--t2)]">
            한 칸이 한 권이다 · 여기서 나온 판단이 ② 기획으로 돌아간다
          </p>
        </div>
        <AdminScreenHelp screen="csat-catalog" />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[var(--memory-risk)] bg-[var(--bg)] p-3 font-body text-[13px] text-[var(--memory-risk)]"
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
        {unmeasured.length > 0 ? (
          <span className="text-[var(--memory-new)]">생애를 못 잰 시리즈 {unmeasured.length}개</span>
        ) : ready > 0 ? (
          <span className="text-[var(--memory-stable)]">찍기만 하면 되는 권 {ready}권</span>
        ) : revising.length > 0 ? (
          <span className="text-[var(--memory-shaky)]">개정이 밀린 시리즈 {revising.length}개</span>
        ) : unshipped.length > 0 ? (
          <span className="text-[var(--memory-shaky)]">한 번도 안 찍은 시리즈 {unshipped.length}개</span>
        ) : (
          /*
            ⚠️ **「다 냈다」로 끝나지 않는다.** 낼 수 있는 권을 다 냈다는 것은 이 시리즈들의
               이번 판이 끝났다는 뜻이지 품목이 끝났다는 뜻이 아니다 — 시중 출판사는 그
               자리에서 다음 라인을 발의한다. 그래서 빈 자리 수를 이어 붙인다(DD-76).
          */
          <span className="text-[var(--memory-stable)]">
            이번 판은 다 냈다
            {openSlots > 0 ? (
              <span className="text-[var(--t2)]">{` — 다음은 시장의 빈 자리 ${openSlots}칸`}</span>
            ) : null}
          </span>
        )}
        <span className="ml-2 font-mono text-[12px] font-[400] tabular-nums text-[var(--t3)]">
          시리즈 {counts.shipping}/{counts.market}
        </span>
        <span className="ml-1 font-body text-[11.5px] font-[400] text-[var(--t3)]">
          — 시장이 22개를 굴린다
        </span>
      </p>

      {/*
        ── 품목 층 (DD-76) ────────────────────────────────────────────────
        격자는 「이 시리즈의 어느 권이 있나」에 답한다. 그런데 한 권을 냈다고 그 유형이
        끝나는 것이 아니다 — 시중 출판사는 제도·시기·경쟁·재고를 보고 **다음 라인을
        계속 발의한다.** 그 층이 화면에 없으면 공장은 마지막 권을 찍는 날 초록으로 끝난다.

        그래서 여기서 셋을 말한다: 이 시리즈가 **생애 어디**에 있나 · **왜 생겼나** ·
        그리고 **다음 자리는 어디**인가.
      */}
      <section aria-label="품목" className="flex flex-col gap-2">
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rows.map((r) => {
            const life = r.lifecycle ? LIFECYCLE_KO[r.lifecycle] : null
            const trig = TRIGGER_KO[r.origin.trigger]
            return (
              <li
                key={r.id}
                className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-2.5"
              >
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                    {r.brand}
                  </span>
                  {/* 생애 자리 — 못 쟀으면 그렇다고 적는다. 0 으로 뭉개지 않는다. */}
                  <span
                    className="rounded-[var(--r-sm)] px-1.5 py-0.5 font-mono text-[10.5px]"
                    style={{
                      background: `color-mix(in srgb, ${life?.color ?? 'var(--memory-new)'} 12.2%, transparent)`,
                      color: life?.color ?? 'var(--memory-new)',
                    }}
                  >
                    {life?.label ?? '못 잼'}
                  </span>
                  <span className="font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
                    {`낸 권 ${r.published}/${r.rungs}`}
                  </span>
                  {r.stale != null && r.stale > 0 ? (
                    <span className="font-mono text-[10.5px] tabular-nums text-[var(--memory-shaky)]">
                      {`옛 규격 ${r.stale}권`}
                    </span>
                  ) : null}
                </p>
                <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t2)]">
                  {life?.what ?? "조판 기록이나 재고를 못 읽었다"}
                </p>
                {/* 왜 생겼나 — 계기 · 그때의 근거 · 날짜. 셋이 다 있어야 적힌다. */}
                <p className="break-keep font-body text-[11px] leading-snug text-[var(--t3)]">
                  {`${trig.label} · ${r.origin.evidence} (${r.origin.since})`}
                </p>
                <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t1)]">
                  {`다음 → ${r.nextAction}`}
                </p>
              </li>
            )
          })}
        </ul>

        {/*
          **다음 유형의 후보.** 이 목록이 비는 날은 오지 않는다 — 시장은 계속 늘어난다.
          못 만드는 칸은 지우지 않고 **이유와 함께** 남긴다: 빈칸으로 두면 「잊은 것」처럼
          읽히고, 매번 다시 검토된다.
        */}
        <div className="flex flex-col gap-1 rounded-[var(--r-md)] bg-[var(--bg2)] p-2.5">
          <h3 className="font-display text-[11.5px] font-[600] text-[var(--t2)]">
            다음 유형은 어디서 오나 — 시장 칸 대비
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {gaps.map((g) => (
              <li key={g.kind} className="break-keep font-body text-[11.5px] leading-snug">
                <span className="font-mono tabular-nums text-[var(--t1)]">
                  {`${g.kind} ${g.ours}/${g.market}`}
                </span>
                <span className="ml-1.5 text-[var(--t3)]">
                  {g.blockedWhy
                    ? `못 만든다 — ${g.blockedWhy}`
                    : g.ours < g.market
                      ? `빈 자리 ${g.market - g.ours}칸`
                      : '시장만큼 냈다'}
                </span>
              </li>
            ))}
          </ul>

          {/*
            만들지 않는 것은 **칸으로 그리지 않는다.** 예전 격자는 이 셋을 21칸으로 그렸고
            그 칸들은 영영 회색이었다 — 격자의 절반이 아무 행동도 안 부르는 색이었다.
            2026-09-23: 별도 구획이었던 것을 여기로 들였다. 「무엇을 더 낼 것인가」와
            「무엇은 안 내는가」는 **같은 물음의 양면**이라 떨어뜨려 두면 둘 다 안 읽힌다.
          */}
          <h3 className="mt-1 font-display text-[11.5px] font-[600] text-[var(--t2)]">
            안 만드는 것
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {notMaking.map((n) => (
              <li
                key={n.name}
                className="break-keep font-body text-[11px] leading-snug text-[var(--t3)]"
              >
                <span className="font-[600] text-[var(--t2)]">{n.name}</span> — {n.why}
              </li>
            ))}
          </ul>
        </div>
      </section>
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
                background: `color-mix(in srgb, ${VOLUME_STATUS_KO[sel.v.status].color} 12.2%, transparent)`,
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
          {/* 다음 한 걸음은 생애 자리가 소유한다 — 화면이 따로 짓지 않는다(`nextActionOf`). */}
          <p className="break-keep rounded-[var(--r-sm)] bg-[var(--bg2)] p-2 font-body text-[11.5px] leading-snug text-[var(--t2)]">
            {sel.row.nextAction}
          </p>
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

      {inventoryAt ? (
        <p className="font-body text-[10.5px] text-[var(--t3)]">
          재고는 {new Date(inventoryAt).toLocaleString('ko-KR')} 기준 (30분마다 갱신)
        </p>
      ) : null}
    </div>
  )
}
