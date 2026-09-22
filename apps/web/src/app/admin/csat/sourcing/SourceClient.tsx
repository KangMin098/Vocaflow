// apps/web/src/app/admin/csat/sourcing/SourceClient.tsx
//
// **④ 소재 — 각 칸에 쓸 지문이 있는가.**
//
// 시중 출판사가 원고를 쓰기 전에 하는 일이 지문 섭외다. 우리는 공개 도메인·개방 접근에서
// 수확하므로 섭외비 대신 **수율**이 든다.
//
// ── 분모가 바뀌었다 (2026-09-15) ─────────────────────────────────────
// 이 화면은 오래 「지문 재고 562편」이라고 적었다. 그 562는 `csat_stage_catalog` 뷰가 센
// 것인데 **양쪽 갈래가 다 `status = published`** 였다 — 즉 **이미 학습자에게 나간 것**이고,
// 조판이 실제로 고르는 풀의 0.6% 다(실측 2026-09-13: 87,556편). 같은 공장 안에서 원문 적격
// 화면은 10만 편을 분모로 쓰고 있었으니, 두 화면이 같은 이름으로 다른 것을 말해 왔다.
//
// 지금은 6시간 스냅샷(`csat_source_rollup()`)을 읽는다. 방문마다 10만 행을 훑지 않고,
// **언제 잰 값인지**를 늘 함께 적는다. 출고분은 없애지 않았다 — 이름만 정직해졌다.

'use client'

import { useState, useTransition } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  StageFailures,
  StageFrame,
  type FailureRow,
  type StageBlock,
} from '@/components/admin/csat/StageFrame'
import { FACTORY_STAGES, judgeStage } from '@/lib/csat/factory-model'

import type { KidSourcePanel } from '@/lib/textbook/kid-source-stats'
import type { SourceConsoleView } from '@/lib/csat/source-console'

import { BandStrip } from './BandStrip'

const STAGE = FACTORY_STAGES.find((s) => s.id === 'source')!

// `import type` 이라 런타임에 사라진다 — 액션 모듈(그리고 그것이 끌고 오는 인증 경로)이
// 이 파일에 묶이지 않는다. 실제 함수는 page.tsx 가 prop 으로 내린다.
import type { RetakeResult } from './actions'

const BAND_KO: Record<string, string> = {
  S1: 'S1 입문 다독',
  S2: 'S2 자동화 다독',
  S3: 'S3 논증 정독',
  S4: 'S4 킬러 정독',
  S5: 'S5 병행 듣기',
}

/** 잰 지 얼마나 됐나 — **낡은 값을 최신인 척 보이지 않기 위해** 늘 함께 낸다. */
export function ago(iso: string, now = Date.now()): string {
  const h = Math.floor((now - new Date(iso).getTime()) / 3_600_000)
  if (h < 1) return '방금'
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

function signed(n: number): string {
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString()
}

export function SourceClient({
  view,
  kidSource,
  onRetake,
}: {
  view: SourceConsoleView
  kidSource: KidSourcePanel
  /** 크론과 같은 RPC 를 부르는 서버 액션. 서버 컴포넌트가 내려 준다. */
  onRetake: () => Promise<RetakeResult>
}) {
  const [pending, start] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const { rollup, bands, emptyBands, audioBands, delta, targets, audit, published } = view

  const behind = targets.filter((t) => t.pct != null && t.pct < 1)

  // ── ② 막힌 것 ──────────────────────────────────────────────────────
  // ⚠️ 오디오 축 밴드(S5)는 **지문을 수확해서 채우는 칸이 아니다.** 0편인 것이 결함이 아니므로
  //   막힌 것으로 세지 않는다 — 옛 판정이 그것을 세는 바람에 화면이 **아무리 수확해도 안 꺼지는
  //   빨간불**을 띄웠다(그 사고 기록은 `factory-line-model.ts` §④ 에 있다).
  const blocks: StageBlock[] = [
    {
      what: '지문으로 채워야 하는데 0편인 밴드',
      count: rollup == null ? null : emptyBands.length,
      unmeasuredReason: rollup == null ? '아직 한 번도 안 쟀다 — 0편이 아니다' : undefined,
    },
    {
      what: '몫에 미달한 소스 타겟',
      count: rollup == null ? null : behind.length,
      unmeasuredReason: rollup == null ? '아직 한 번도 안 쟀다' : undefined,
    },
    {
      what: '등록부에 없는 원천 — 누가 언제 왜 넣었는지 모른다',
      // 등록부에 없는 원천은 **원천 수가 아니라 편수**로 센다 — 한 원천이 수천 편일 수 있다.
      count: audit ? audit.unregistered.reduce((a, u) => a + u.n, 0) : null,
      unmeasuredReason: audit ? undefined : '등록부 대조를 못 했다',
    },
  ]

  const failureRows: FailureRow[] = [
    ...emptyBands.map((b) => ({
      id: `band:${b}`,
      label: BAND_KO[b] ?? b,
      tags: ['지문 0편'],
      says: '이 밴드의 책은 지금 못 만든다 — 문항을 더 만들어도 안 된다. 수확이 먼저다.',
    })),
    ...behind.slice(0, 6).map((t) => ({
      id: `target:${t.key}`,
      label: t.label,
      tags: ['몫 미달', t.pct == null ? '못 잼' : `${Math.round(t.pct * 100)}%`],
      says: t.basisLabel ?? t.note ?? '몫의 근거가 적혀 있지 않다',
    })),
  ].slice(0, 10)

  return (
    <StageFrame
      stage={STAGE}
      status={judgeStage([
        {
          label: '지문으로 채우는 밴드 중 재고 보유',
          num: rollup == null ? null : bands.length - emptyBands.length,
          den: bands.length,
          unit: 'ratio',
          unmeasuredReason: rollup == null ? '아직 한 번도 안 쟀다' : undefined,
        },
      ])}
      help={
        <div className="flex items-center gap-2">
          {/*
            크론(6시간)과 **같은 RPC** 를 부른다. 드레인을 막 돌린 사람에게 여섯 시간은 길고,
            그때 화면이 「안 늘었다」로 보이면 안 해도 될 일을 또 하게 된다. 재실행 안전.
          */}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await onRetake()
                setNote(
                  r.ok
                    ? `다시 쟀다 — ${Math.round((r.durationMs ?? 0) / 100) / 10}초`
                    : `못 쟀다: ${r.error}`,
                )
              })
            }
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] border border-[var(--bd)] px-3 font-body text-[12px] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:text-[var(--p)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? '재는 중…' : '지금 다시 잰다'}
          </button>
          <AdminScreenHelp screen="csat-sourcing" />
        </div>
      }
      blocks={blocks}
      commands={[
        {
          cmd: 'node scripts/csat/harvest-plos.mjs',
          why: '수확은 커서를 남긴다 — 다시 돌려도 같은 것을 두 번 안 가져온다',
          writes: true,
        },
        {
          cmd: 'node scripts/textbook/harvest-gutenberg-kid.mjs',
          why: '사다리 아래 계단(초·중)은 수능 지문으로 못 채운다 — 그 학령의 원문이 따로 있어야 한다',
          writes: true,
        },
        {
          cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/graded-source-probe.mjs',
          why: '수확한 글이 그 밴드 규격(어휘 커버리지 · 문장 수)에 드는지 먼저 잰다. 읽기만 한다',
        },
        {
          cmd: 'pnpm dlx tsx scripts/textbook/write-drain-import.mjs --dir <밴드 디렉터리> --commit',
          why: '에이전트가 쓴 원글을 적재한다. 재실행 안전(source_id 유일키) · 건너뛴 수를 출력한다',
          writes: true,
        },
      ]}
      approvalNote={
        '규격 밖 글을 적재하면 문항이 안 나오고 재고만 불어난다 — 수확 전에 graded-source-probe 로 먼저 잰다. 적재한 글을 지우는 길은 없다.'
      }
      failures={
        <StageFailures
          title="막고 있는 자리 — 밴드와 타겟"
          total={rollup == null ? null : emptyBands.length + behind.length}
          rows={failureRows}
          emptyNote={
            rollup == null
              ? '아직 한 번도 안 쟀다 — 0편이 아니다. 위 「지금 다시 잰다」를 누른다.'
              : '지문으로 채우는 밴드에 모두 재고가 있고 타겟도 다 찼다.'
          }
        />
      }
    >

      {view.errors.map((e) => (
        <p
          key={e}
          role="alert"
          className="break-keep rounded-[var(--r-md)] border border-[#9C3A30] bg-[var(--bg)] p-3 font-body text-[13px] text-[#9C3A30]"
        >
          {e}
        </p>
      ))}
      {note ? (
        <p role="status" className="break-keep font-body text-[12px] text-[var(--t2)]">
          {note}
        </p>
      ) : null}

      {rollup == null ? (
        <section className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
          <p className="break-keep font-display text-[15px] font-[700] text-[var(--t1)]">
            아직 한 번도 안 쟀다 — 0편이 아니다
          </p>
          <p className="break-keep font-body text-[12px] text-[var(--t2)]">
            위 「지금 다시 잰다」를 누르면 집계를 떠서 이 화면이 선다. 전수 훑기라 2~3초 걸린다.
          </p>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
            <p
              className="break-keep font-display text-[15px] font-[700]"
              style={{ color: emptyBands.length ? '#9C3A30' : '#2E7D5A' }}
            >
              {emptyBands.length
                ? `${emptyBands.map((b) => BAND_KO[b] ?? b).join(' · ')} 는 지문이 0편이다 — 문항을 더 만들어도 안 된다`
                : '지문으로 채우는 밴드에 모두 재고가 있다'}
              <span className="ml-2 font-body text-[12px] font-[400] text-[var(--t3)]">
                조판 후보 {rollup.pool.n.toLocaleString()}편(적격 판정 전) · 규격 안{' '}
                {rollup.pool.inMarket.toLocaleString()}편 · 적재 전체{' '}
                {rollup.rows.toLocaleString()}편
              </span>
            </p>
            <BandStrip bands={bands} />
            {audioBands.length ? (
              <p className="break-keep font-body text-[11.5px] text-[var(--t3)]">
                {audioBands.map((b) => BAND_KO[b] ?? b).join(' · ')} 의 합격선은 듣기 정합 하나뿐이라
                <strong> 지문을 수확해서 채우는 칸이 아니다</strong> — 여기가 0편인 것은 결함이 아니다.
              </p>
            ) : null}
          </section>

          <section className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
            <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">
              {view.takenAt ? `${ago(view.takenAt)} 잰 값` : '잰 시각 모름'}
            </h3>
            {delta ? (
              <p className="break-keep font-mono text-[12px] tabular-nums text-[var(--t2)]">
                직전 대비 적재 {signed(delta.rows)} · 풀 {signed(delta.pool)} · 규격 안{' '}
                {signed(delta.inMarket)}
                {delta.sources.length ? (
                  <span className="ml-2 font-body text-[11px] text-[var(--t3)]">
                    {delta.sources
                      .slice(0, 3)
                      .map((s) => `${s.src} ${signed(s.d)}`)
                      .join(' · ')}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="break-keep font-body text-[11.5px] text-[var(--t3)]">
                견줄 직전 스냅샷이 없다 — 증감은 두 번째부터 나온다.
              </p>
            )}
          </section>

          {/*
            타겟은 이 화면의 요점이지만 여섯 줄이라 늘 펴 두면 위쪽 판정을 밀어낸다.
            **접되, 접힌 손잡이가 결론을 말한다** — 열지 않고도 몇 칸이 미달인지 읽힌다.
          */}
          <details className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
            <summary className="flex min-h-[44px] cursor-pointer items-center break-keep font-display text-[13px] font-[700] text-[var(--t1)] marker:text-[var(--t3)]">
              소스 타겟 {targets.length}개 — 미달 {behind.length}개
            </summary>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full min-w-[520px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                    <th className="py-2 pr-3 font-[500]">칸</th>
                    <th className="py-2 pr-3 font-[500]">게시 가능</th>
                    <th className="py-2 pr-3 font-[500]">몫</th>
                    <th className="py-2 pr-3 font-[500]">남은 것</th>
                    <th className="py-2 font-[500]">몫의 근거</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t) => (
                    <tr key={t.key} className="border-b border-[var(--bd)] last:border-0">
                      <td className="py-2 pr-3 text-[var(--t1)]">{t.label}</td>
                      <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t1)]">
                        {t.publishable.toLocaleString()}
                        {t.unjudged ? (
                          <span className="ml-1 text-[10.5px] text-[#B5803A]">
                            미판정 {t.unjudged.toLocaleString()}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t2)]">
                        {t.goal.toLocaleString()}
                      </td>
                      <td
                        className="py-2 pr-3 font-mono tabular-nums"
                        style={{ color: t.left > 0 ? '#9C3A30' : '#2E7D5A' }}
                      >
                        {t.left > 0 ? t.left.toLocaleString() : '채움'}
                      </td>
                      <td className="break-keep py-2 text-[11px] text-[var(--t3)]">
                        {t.basisLabel ?? '고정'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {audit &&
          (audit.unregistered.length || audit.empty.length || audit.licenseMismatch.length) ? (
            <section
              aria-label="원천 등록부 대조"
              className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--warning)] bg-[var(--bg)] p-4"
            >
              <h3 className="font-display text-[13px] font-[700] text-[var(--warning-ink)]">
                등록부와 실재고가 어긋난다
              </h3>
              {audit.unregistered.length ? (
                <p className="break-keep font-body text-[12px] text-[var(--t1)]">
                  등록부에 없는 원천{' '}
                  <b className="tabular-nums">
                    {audit.unregistered.reduce((a, u) => a + u.n, 0).toLocaleString()}편
                  </b>{' '}
                  — {audit.unregistered.map((u) => `${u.src} ${u.n.toLocaleString()}`).join(' · ')}.
                  누가 언제 왜 넣었는지 아무도 모른다.
                </p>
              ) : null}
              {audit.empty.length ? (
                <p className="break-keep font-body text-[12px] text-[var(--t1)]">
                  등록은 됐는데 0편 — {audit.empty.map((e) => e.label).join(' · ')}. 수확이 안 돌았거나
                  죽었다.
                </p>
              ) : null}
              {audit.licenseMismatch.length ? (
                <p className="break-keep font-body text-[12px] text-[#9C3A30]">
                  라이선스 어긋남 —{' '}
                  {audit.licenseMismatch
                    .map((m) => `${m.src}: 등록 ${m.registered} / 실제 ${m.actual.join(',')}`)
                    .join(' · ')}
                  . <b>표지 저작권 표기가 틀어진다.</b>
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      {/*
        출고분 — **재고가 아니다.** 이 줄을 「지문 재고」라 부르던 것이 이 화면의 옛 결함이다.
      */}
      <section
        aria-label="출고분"
        className="flex flex-wrap items-baseline gap-x-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
      >
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">학습자에게 나간 것</h3>
        <p className="break-keep font-mono text-[12px] tabular-nums text-[var(--t2)]">
          짧은 글 {published.articles?.toLocaleString() ?? '못 잼'} · 도서{' '}
          {published.books?.toLocaleString() ?? '못 잼'}
        </p>
        <p className="break-keep font-body text-[11px] text-[var(--t3)]">
          출고분이지 조판이 고르는 풀이 아니다.
        </p>
      </section>

      {/*
        초·중 원문 재고 — TBP 콘솔에 있던 패널을 여기로 옮겼다(2026-09-06).
        지문 수급이 곧 이 공정이라 여기가 제자리다.
      */}
      <section
        aria-label="초·중 원문 재고"
        className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
      >
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">초·중 원문 재고</h3>
        {kidSource.error ? (
          <p className="break-keep font-body text-[12px] text-[#9C3A30]">{kidSource.error}</p>
        ) : kidSource.inventory == null ? (
          <p className="break-keep font-body text-[12px] text-[#8A8278]">
            못 잼 — 0 이 아니다. 조회가 값을 안 돌려줬다.
          </p>
        ) : (
          // ⚠️ 여기는 **`Object.entries` 로 통째로 펴고 있었다**(실측 2026-09-23 캡처):
          //   화면에 영어 키(`bands`·`adapted`·`total`·`pct`)와 `[object Object]` 가 여섯 줄
          //   찍혔다 — `bands` 는 배열이고 `adapted` 는 객체라 `String(v)` 가 그렇게 된다.
          //   타입도 린트도 안 잡는 종류의 결함이고, 스크립트도 오류를 안 냈다.
          //   모양을 모르는 값을 펴서 인쇄하지 않는다 — **칸을 이름으로 적는다.**
          <div className="flex flex-col gap-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                    <th className="py-1.5 pr-3 font-[500]">칸</th>
                    <th className="py-1.5 pr-3 font-[500]">적재</th>
                    <th className="py-1.5 pr-3 font-[500]">격리</th>
                    <th className="py-1.5 pr-3 font-[500]">게시 가능</th>
                    <th className="py-1.5 pr-3 font-[500]">조합 가능</th>
                    <th className="py-1.5 font-[500]">몫 남음</th>
                  </tr>
                </thead>
                <tbody>
                  {kidSource.inventory.bands.map((b) => (
                    <tr key={b.band} className="border-b border-[var(--bd)] last:border-0">
                      <td className="py-1.5 pr-3 break-keep text-[var(--t1)]">{b.band}</td>
                      <td className="py-1.5 pr-3 font-mono tabular-nums text-[var(--t2)]">
                        {b.held.toLocaleString()}
                      </td>
                      <td className="py-1.5 pr-3 font-mono tabular-nums text-[var(--t2)]">
                        {b.quarantined.toLocaleString()}
                        <span className="ml-1 text-[10.5px] text-[var(--t3)]">
                          {b.quarantinedPct}%
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 font-mono tabular-nums text-[var(--t1)]">
                        {b.publishable.toLocaleString()}
                      </td>
                      {/* ⚠️ **적재와 조합 가능은 다르다.** 실측 2026-09-07: 이 표가 97.8% 를
                          보고하는 동안 조판이 실제로 쓸 수 있는 것은 9편뿐이었다(나머지는
                          queued). 안 주면 `undefined` 이고 그때는 「못 잼」이다. */}
                      <td className="py-1.5 pr-3 font-mono tabular-nums">
                        {b.composable == null ? (
                          <span className="text-[#8A8278]">못 잼</span>
                        ) : (
                          <span style={{ color: b.composable > 0 ? '#2E7D5A' : '#9C3A30' }}>
                            {b.composable.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 font-mono tabular-nums text-[var(--t2)]">
                        {b.quotaLeft.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--bd)]">
                    <td className="py-1.5 pr-3 break-keep text-[var(--t1)]">각색분</td>
                    <td className="py-1.5 pr-3 font-mono tabular-nums text-[var(--t2)]">
                      {kidSource.inventory.adapted.held.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3 font-mono tabular-nums text-[var(--t2)]">
                      {kidSource.inventory.adapted.quarantined.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3 font-mono tabular-nums text-[var(--t1)]">
                      {kidSource.inventory.adapted.publishable.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3 text-[10.5px] text-[var(--t3)]">칸이 아니다</td>
                    <td className="py-1.5" />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="font-mono text-[12px] tabular-nums text-[var(--t1)]">
              게시 가능 합계 {kidSource.inventory.total.toLocaleString()}
              <span className="ml-1.5 font-body text-[11.5px] text-[var(--t3)]">
                목표 대비 {kidSource.inventory.pct}%
              </span>
            </p>
          </div>
        )}
        <p className="break-keep font-body text-[11px] leading-snug text-[var(--t3)]">
          사다리 아래 계단(초·중)은 수능 지문으로 못 채운다 — 그 학령의 원문이 따로 있어야 한다.
        </p>
      </section>

      <details className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <summary className="flex min-h-[44px] cursor-pointer items-center break-keep font-display text-[13px] font-[700] text-[var(--t1)] marker:text-[var(--t3)]">
          더 수확하는 법
        </summary>
        <div className="mt-2 flex flex-col gap-1">
          <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
            node scripts/csat/harvest-plos.mjs
          </code>
          <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
            node scripts/textbook/harvest-gutenberg-kid.mjs
          </code>
          <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
            npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/graded-source-probe.mjs
          </code>
          <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
            수확은 커서를 남기므로 다시 돌려도 같은 것을 두 번 안 가져온다. 마지막 것은 읽기만 하며,
            수확한 글이 그 밴드 규격(어휘 커버리지 · 문장 수)에 드는지 먼저 잰다 — 규격 밖 글을
            적재하면 문항이 안 나오고 재고만 불어난다.
          </p>
        </div>
      </details>
    </StageFrame>
  )
}
