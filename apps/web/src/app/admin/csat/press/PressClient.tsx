// apps/web/src/app/admin/csat/press/PressClient.tsx
//
// **⑧ 조판 · 발행 — 권으로 나왔는가.**
//
// 공정의 끝이다. 여기까지 와야 학습자가 손에 쥐는 것이 생긴다 — 그 앞의 모든 수치는 **재고**이지
// 책이 아니다.
//
// 이 화면이 보는 것 셋:
//   ① 계단마다 권이 있는가 — 빈 계단에서 학습자는 다른 출판사로 간다.
//   ② **옛 규격으로 찍힌 권** — 브랜드 지문이 지금 값과 다르면 그 책은 지금 규격이 아니다.
//   ③ **문항이 안 붙은 원글** — 조판이 재고로 세지 않는 글이다. 여기가 크면 집필보다 문항 붙이기가
//      먼저다(실측 2026-08-30 에 V6 은 원글 9,992편 중 8,235편이 그 상태였다).

// ── ④ 「찍었다」가 「학습자가 본다」를 뜻하지 않는다 (2026-09-23 · DD-74) ──
// 실측: 조판 산출물(`out_path` 로컬 HTML)을 읽는 학습자 코드가 **0곳**이다. 매대는 재고에서
// 그려지고 상세면의 목차는 커밋된 스냅샷에서 온다. 그래서 3인 검수 1/60 인 권이 카탈로그에
// 「냈음」으로 서고 공개 URL 로 열려 있었다. 이 화면이 그 사실을 적는다.

'use client'

import { useState, useTransition } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  StageFailures,
  StageFrame,
  type FailureRow,
  type StageBlock,
} from '@/components/admin/csat/StageFrame'
import { judgePressGate, type PressGateVerdict } from '@vocaflow/library-pipeline/textbook-press-gate'

import type { PressView, PressVolumeRow } from '@/lib/csat/factory-line-model'
import { FACTORY_STAGES, judgeStage } from '@/lib/csat/factory-model'

import type { PublishResult } from './actions'
import { LadderFill } from './LadderFill'

/** 화면이 부르는 발행 판정. 실제 함수는 서버 컴포넌트가 prop 으로 내린다. */
export type PressDecide = (
  series: string,
  band: number,
  decision: 'approved' | 'withdrawn',
  reason?: string,
) => Promise<PublishResult>

const STAGE = FACTORY_STAGES.find((s) => s.id === 'press')!

const PUBLISH_KO: Record<string, string> = {
  rendered: '찍힘',
  review: '검수 대기',
  approved: '승인됨',
  published: '매대에 있음',
  withdrawn: '내림',
}

/**
 * 그 권의 조판 게이트 판정 — **드레인과 같은 함수**를 쓴다.
 *
 * ⚠️ 여기서 따로 세지 않는다. 판정이 세 곳(드레인 export · 이 화면 · 발행 승인)에 필요한데
 *   각자 세면 언젠가 다른 수를 말하고, 그때부터 셋 다 못 믿는다. 이 저장소는 그 사고를
 *   이미 겪었다 — 「3인 검수」가 두 가지를 뜻하는 동안 ⑦ 눈금이 다른 것을 세면서 초록이었다.
 */
export function verdictOf(v: PressVolumeRow): PressGateVerdict {
  return judgePressGate({
    series: v.series,
    band: v.band,
    items: v.items,
    missingExplanations: Math.max(0, v.missingExplanations),
    personaBlocked: v.personaBlocked,
    autoPassed: v.autoPassed,
    autoTotal: v.autoTotal,
    brandCurrent: v.brandCurrent,
    hasContents: v.reach.hasContents,
    publishStatus: v.publish?.status ?? null,
  })
}

/** 막는 이유만. 「못 잼」은 여기 안 들어간다 — 할 일이 정반대다. */
export function blockersOf(v: PressVolumeRow): string[] {
  return verdictOf(v).blockers
}

/**
 * 발행 판정 버튼 — **되돌릴 수 없는 동작 앞의 유일한 사람 입력.**
 *
 * ⚠️ 막는 것이 있거나 **못 잰 것이 있으면** 누를 수 없다. 화면이 감추는 것만으로는
 *   부족해서 서버 액션이 같은 판정을 다시 한다 — 화면만 믿으면 요청을 직접 보내는 길이
 *   열린 채로 남는다.
 */
function DecideButtons({
  v,
  verdict,
  onDecide,
}: {
  v: PressVolumeRow
  verdict: PressGateVerdict
  onDecide: PressDecide
}) {
  const [pending, start] = useTransition()
  const [says, setSays] = useState<string | null>(null)
  const published = v.publish?.status === 'published'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {!published ? (
          <button
            type="button"
            disabled={pending || !verdict.approvable}
            title={
              verdict.approvable
                ? '이 권을 매대에 올린다'
                : [...verdict.blockers, ...verdict.unmeasured].join(' · ')
            }
            onClick={() =>
              start(async () => setSays((await onDecide(v.series, v.band, 'approved')).says))
            }
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] border border-[var(--bd)] px-2.5 font-display text-[11.5px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--memory-stable)] hover:text-[var(--memory-stable)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? '남기는 중…' : '발행 승인'}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () =>
                setSays(
                  (
                    await onDecide(
                      v.series,
                      v.band,
                      'withdrawn',
                      '관리자가 화면에서 내렸다 — 사유를 기록에 남긴다',
                    )
                  ).says,
                ),
              )
            }
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] border border-[var(--bd)] px-2.5 font-display text-[11.5px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--memory-risk)] hover:text-[var(--memory-risk)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? '남기는 중…' : '내린다'}
          </button>
        )}
      </div>
      {says ? (
        <p role="status" className="break-keep font-body text-[10.5px] leading-snug text-[var(--t2)]">
          {says}
        </p>
      ) : null}
    </div>
  )
}

export function PressClient({
  volumes,
  rungs,
  brandFingerprint,
  brand,
  loadError,
  onDecide,
}: PressView & { onDecide: PressDecide }) {
  const stale = volumes.filter((v) => !v.brandCurrent)
  const missingExpl = volumes.reduce((n, v) => n + Math.max(0, v.missingExplanations), 0)
  const idle = volumes.filter((v) => v.articlesIdle != null)
  const idleSum = idle.length ? idle.reduce((n, v) => n + (v.articlesIdle ?? 0), 0) : null

  const blocked = volumes.filter((v) => blockersOf(v).length > 0)
  const unjudged = volumes.filter((v) => v.publish == null)
  const noContents = volumes.filter((v) => !v.reach.hasContents)

  const status = judgeStage([
    {
      label: '조판된 계단',
      num: loadError ? null : new Set(volumes.map((v) => v.band)).size,
      den: rungs,
      unit: 'ratio',
      unmeasuredReason: loadError ?? undefined,
    },
    {
      label: '학습자에게 나갈 수 있는 권',
      num: loadError ? null : volumes.length - blocked.length,
      den: volumes.length,
      unit: 'ratio',
      unmeasuredReason: loadError ?? undefined,
    },
  ])

  const blocks: StageBlock[] = [
    { what: '나갈 수 없는 권 (막는 이유가 있다)', count: loadError ? null : blocked.length },
    {
      // 「막혔다」가 아니라 「아무도 안 봤다」 — 할 일이 다르다.
      what: '발행 판정이 아예 없는 권',
      count: loadError ? null : unjudged.length,
    },
    {
      what: '목차 스냅샷이 없는 시리즈의 권 — 상세면에 목차 절이 안 나간다',
      count: loadError ? null : noContents.length,
    },
  ]

  const failureRows: FailureRow[] = volumes
    .filter((v) => blockersOf(v).length > 0)
    .slice(0, 10)
    .map((v) => ({
      id: `${v.series}:${v.band}`,
      label: `${v.volumeTitle ?? `V${v.band}`}`,
      tags: [v.series, `V${v.band}`, PUBLISH_KO[v.publish?.status ?? ''] ?? '판정 없음'],
      says: blockersOf(v).join(' · '),
      href: v.reach.href ?? undefined,
    }))

  return (
    <StageFrame
      stage={STAGE}
      status={status}
      help={<AdminScreenHelp screen="csat-press" />}
      blocks={blocks}
      commands={[
        {
          cmd: 'pnpm dlx tsx scripts/textbook/press-candidates.mjs',
          why: '찍을 후보 권과 권마다의 차단 사유를 낸다. 읽기만 하고 재실행 안전',
        },
        {
          cmd: 'pnpm dlx tsx scripts/textbook/build-volume.mjs --band 6 --units 20',
          why: '읽기만 하며 3관점 채점표를 낸다',
        },
        {
          cmd: 'pnpm dlx tsx scripts/textbook/render-volume.mjs --band 6 --units 20 --out volume-v6.html',
          why: '지정한 파일을 덮어쓴다 — 되돌릴 원장이 없다',
          writes: true,
        },
        {
          cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/contents-snapshot.mjs --series vocab --units 20',
          why: '그 시리즈의 목차 스냅샷을 굽는다 — 없으면 학습자 상세면에 목차 절이 안 나간다',
          writes: true,
        },
      ]}
      approvalNote={
        '발행(매대 노출)은 되돌리기 어렵다 — 차단 사유가 0 인 권만 승인 대상이다. 승인 기록을 담을 표(csat_pipeline_approvals)는 마이그레이션 승인 대기이고, 그때까지 판정은 colophon.publish 에 남는다.'
      }
      failures={
        <StageFailures
          title="나갈 수 없는 권 — 막는 이유"
          total={loadError ? null : blocked.length}
          rows={failureRows}
          emptyNote={
            loadError
              ? '조판 기록을 못 읽었다 — 0건이 아니다.'
              : '막는 이유가 있는 권이 없다. 다만 「발행 판정이 없는 권」은 위 「막힌 것」에서 따로 센다 — 안 막힌 것과 안 본 것은 다르다.'
          }
        />
      }
    >
      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[var(--memory-risk)] bg-[var(--bg)] p-3 font-body text-[13px] text-[var(--memory-risk)]"
        >
          {loadError}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
          <p className="font-body text-[11px] text-[var(--t3)]">조판된 계단</p>
          <p className="mt-1 font-mono text-[20px] font-[700] tabular-nums text-[var(--t1)]">
            {new Set(volumes.map((v) => v.band)).size} / {rungs}
          </p>
          <p className="mt-1 break-keep font-body text-[11px] text-[var(--t3)]">
            빈 계단에서 학습자는 다른 출판사로 간다
          </p>
        </div>
        <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
          <p className="font-body text-[11px] text-[var(--t3)]">옛 규격으로 찍힌 권</p>
          <p
            className="mt-1 font-mono text-[20px] font-[700] tabular-nums"
            style={{ color: stale.length ? 'var(--memory-shaky)' : 'var(--memory-stable)' }}
          >
            {stale.length}
          </p>
          <p className="mt-1 break-keep font-body text-[11px] text-[var(--t3)]">
            현재 지문 <code className="font-mono">{brandFingerprint.slice(0, 12)}</code>
          </p>
        </div>
        <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
          <p className="font-body text-[11px] text-[var(--t3)]">해설 안 붙은 문항</p>
          <p
            className="mt-1 font-mono text-[20px] font-[700] tabular-nums"
            style={{ color: missingExpl ? 'var(--memory-risk)' : 'var(--memory-stable)' }}
          >
            {missingExpl.toLocaleString()}
          </p>
          <p className="mt-1 break-keep font-body text-[11px] text-[var(--t3)]">
            0 이 아니면 해설 빠진 책이 나간다
          </p>
        </div>
      </section>

      {/* 사다리 — 어느 학령이 비었는지 숫자 대신 계단으로. 브랜드는 채울 수 있는 계단이다. */}
      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="mb-2 font-display text-[13px] font-[700] text-[var(--t1)]">학령 사다리</h3>
        <LadderFill volumes={volumes} rungs={rungs} />
      </section>

      {/* ── 학습자 도달 ────────────────────────────────────────────────
          이 절이 없던 동안 ⑧ 은 **A5 0점**이었다. 「찍었다」까지만 말하고 그 책이
          학습자에게 닿는지는 어느 화면도 말하지 않았다 — 그래서 3인 검수 1/60 인 권이
          카탈로그에 「냈음」으로 서고 공개 URL 로 열려 있었다(실측 2026-09-23). */}
      <section
        aria-label="학습자 도달"
        className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
      >
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">
          학습자에게 닿는가 — 권마다
        </h3>
        <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
          ⚠️ <strong>조판 산출물은 학습자 경로에 없다.</strong> 매대는 <strong>재고</strong>에서
          그려지고 상세면의 목차는 커밋된 스냅샷에서 온다 — 즉 <strong>찍는 것과 나가는 것이
          서로 다른 길</strong>이고, 여기서 막아도 매대는 안 막힌다. 그 두 길을 잇는 것은{' '}
          <code className="font-mono text-[11px]">textbook_volume_renders.status</code> 마이그레이션
          (승인 대기)이다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                <th className="py-1.5 pr-3 font-[500]">권</th>
                <th className="py-1.5 pr-3 font-[500]">발행 판정</th>
                <th className="py-1.5 pr-3 font-[500]">목차 스냅샷</th>
                <th className="py-1.5 pr-3 font-[500]">막는 이유</th>
                <th className="py-1.5 pr-3 font-[500]">매대 주소</th>
                <th className="py-1.5 font-[500]">판정</th>
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => {
                const why = blockersOf(v)
                return (
                  <tr key={`${v.series}:${v.band}`} className="border-b border-[var(--bd)] last:border-0">
                    <td className="break-keep py-1.5 pr-3 text-[var(--t1)]">
                      <span className="font-mono text-[10px] text-[var(--t3)]">
                        {v.series} V{v.band}
                      </span>{' '}
                      {v.volumeTitle ?? '—'}
                    </td>
                    <td className="py-1.5 pr-3">
                      {v.publish == null ? (
                        // ⚠️ 「찍힘」으로 채우지 않는다 — 사람이 그렇게 판정한 것과 다르다.
                        <span className="text-[var(--memory-new)]">판정 없음</span>
                      ) : (
                        <span
                          style={{
                            color:
                              v.publish.status === 'published' || v.publish.status === 'approved'
                                ? 'var(--memory-stable)'
                                : v.publish.status === 'withdrawn'
                                  ? 'var(--memory-risk)'
                                  : 'var(--memory-shaky)',
                          }}
                        >
                          {PUBLISH_KO[v.publish.status]}
                          {v.publish.reason ? (
                            <span className="ml-1 break-keep text-[10.5px] text-[var(--t3)]">
                              {v.publish.reason}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      {v.reach.hasContents ? (
                        <span style={{ color: 'var(--memory-stable)' }}>있음</span>
                      ) : (
                        <span style={{ color: 'var(--memory-risk)' }}>없음 — 목차 절이 안 나간다</span>
                      )}
                    </td>
                    <td className="break-keep py-1.5 pr-3 text-[11px]">
                      {why.length ? (
                        <span style={{ color: 'var(--memory-shaky)' }}>{why.join(' · ')}</span>
                      ) : (
                        <span className="text-[var(--t3)]">없음</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      {v.reach.href ? (
                        <a
                          href={v.reach.href}
                          className="inline-flex min-h-[44px] items-center font-mono text-[11px] text-[var(--p)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
                        >
                          {v.reach.href}
                        </a>
                      ) : (
                        // 단이 없으면 주소를 지어내지 않는다.
                        <span className="text-[var(--memory-new)]">단 없음</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      <DecideButtons v={v} verdict={verdictOf(v)} onDecide={onDecide} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="mb-1 font-display text-[13px] font-[700] text-[var(--t1)]">
          조판 기록 {volumes.length}권
        </h3>
        <p className="mb-3 break-keep font-body text-[11.5px] text-[var(--t3)]">
          수치는 <strong>조판기가 찍은 그 값</strong>이다 — 여기서 다시 계산하지 않는다. 그래야 화면과
          손에 쥔 책이 같은 것을 말한다. 「못 잼」은 그 항목이 없던 시절에 찍힌 권이다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                <th className="py-2 pr-3 font-[500]">권</th>
                <th className="py-2 pr-3 font-[500]">학령</th>
                <th className="py-2 pr-3 font-[500]">단원 · 문항</th>
                <th className="py-2 pr-3 font-[500]">해설 없음</th>
                <th className="py-2 pr-3 font-[500]">유형 구성 적합</th>
                <th className="py-2 pr-3 font-[500]">겹치지 않는 권수</th>
                <th className="py-2 pr-3 font-[500]">문항 없는 원글</th>
                <th className="py-2 font-[500]">규격</th>
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => (
                <tr key={`${v.series ?? 'reading'}|${v.band}`} className="border-b border-[var(--bd)] last:border-0">
                  <td className="py-2 pr-3 text-[var(--t1)]">
                    <span className="font-mono text-[10px] text-[var(--t3)]">V{v.band}</span>{' '}
                    {v.volumeTitle ?? '—'}
                    {v.renderCount > 1 ? (
                      <span className="ml-1 text-[10px] text-[var(--t3)]">×{v.renderCount}</span>
                    ) : null}
                  </td>
                  <td className="break-keep py-2 pr-3 text-[var(--t2)]">{v.schoolBand ?? '—'}</td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t2)]">
                    {v.units} · {v.items}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    <span style={{ color: v.missingExplanations > 0 ? 'var(--memory-risk)' : 'var(--memory-stable)' }}>
                      {v.missingExplanations}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {v.typeMixFit == null ? (
                      <span className="text-[var(--memory-new)]">못 잼</span>
                    ) : (
                      <span style={{ color: v.typeMixFit >= 0.8 ? 'var(--memory-stable)' : 'var(--memory-shaky)' }}>
                        {Math.round(v.typeMixFit * 100)}%
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t2)]">
                    {v.distinctVolumes ?? <span className="text-[var(--memory-new)]">해당 없음</span>}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {v.articlesIdle == null ? (
                      <span className="text-[var(--memory-new)]">못 잼</span>
                    ) : (
                      <span style={{ color: v.articlesIdle > 0 ? 'var(--memory-shaky)' : 'var(--memory-stable)' }}>
                        {v.articlesIdle.toLocaleString()}
                        {v.articlesWithItems != null ? (
                          <span className="ml-1 text-[10.5px] text-[var(--t3)]">
                            /{(v.articlesWithItems + v.articlesIdle).toLocaleString()}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    {v.brandCurrent ? (
                      <span className="text-[11px] text-[var(--memory-stable)]">최신</span>
                    ) : (
                      <span className="text-[11px] text-[var(--memory-shaky)]">옛 규격</span>
                    )}
                  </td>
                </tr>
              ))}
              {!volumes.length ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-[var(--t3)]">
                    조판된 권이 없다 — 앞 공정이 다 끝나도 여기까지 와야 책이다
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">다시 찍는 법</h3>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          pnpm dlx tsx scripts/textbook/build-volume.mjs --band 6 --units 20
        </code>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          pnpm dlx tsx scripts/textbook/render-volume.mjs --band 6 --units 20 --out volume-v6.html
        </code>
        <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
          첫 명령은 읽기만 하며 3관점 채점표를 낸다. 둘째는 <strong>지정한 파일을 덮어쓴다.</strong>
          {idleSum != null && idleSum > 0
            ? ` 문항 없는 원글이 ${idleSum.toLocaleString()}편이다 — 새 글을 쓰기 전에 store-new-types 로 문항부터 붙인다.`
            : ''}
        </p>
      </section>
      {/*
        브랜드 규격 — TBP 콘솔에 있던 표를 여기로 옮겼다(2026-09-06). 규격은 조판기의 **입력**이라
        조판 공정의 것이다. 별도 관측 화면에 두면 "규격이 바뀌었는데 왜 옛 규격으로 찍혔지" 를
        두 화면을 오가며 맞춰 봐야 한다.
      */}
      {/* 규격 표는 **참고**다 — 이 화면의 물음은 「나갈 수 있는가」이고 규격은 그 이유 중 하나다.
          펴 두면 표 두 개가 나란히 서서 어느 쪽이 결론인지 안 읽힌다. 접힌 것은 밀집도에서 안 센다. */}
      <details
        aria-label="브랜드 규격"
        className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
      >
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-display text-[13px] font-[700] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]">
          조판 규격 — 이 값으로 찍힌다 ▾
        </summary>
        <p className="break-keep font-body text-[11.5px] text-[var(--t3)]">
          값은 디자인 토큰에서 온다 — 조판기가 색을 따로 갖고 있으면 손에 쥔 책이 화면과 달라진다.
          위 사다리에서 <strong>옛 규격</strong>으로 뜨는 권은 이 표가 바뀌기 전에 찍힌 것이다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                <th className="py-1.5 pr-3 font-[500]">지면에서의 자리</th>
                <th className="py-1.5 pr-3 font-[500]">라이트</th>
                <th className="py-1.5 font-[500]">다크</th>
              </tr>
            </thead>
            <tbody>
              {brand.rows.map((r) => (
                <tr key={r.key} className="border-b border-[var(--bd)] last:border-0">
                  <td className="break-keep py-1.5 pr-3 text-[var(--t2)]">{r.label}</td>
                  <td className="py-1.5 pr-3 font-mono text-[11px] text-[var(--t1)]">
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block h-3 w-3 rounded-[2px] border border-[var(--bd)] align-middle"
                      style={{ background: r.light }}
                    />
                    {r.light}
                  </td>
                  <td className="py-1.5 font-mono text-[11px] text-[var(--t1)]">
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block h-3 w-3 rounded-[2px] border border-[var(--bd)] align-middle"
                      style={{ background: r.dark }}
                    />
                    {r.dark}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 font-body text-[11px] text-[var(--t3)]">
          <span>영문 지문 · {brand.fonts.english}</span>
          <span>한국어 해설 · {brand.fonts.body}</span>
          <span>문항 번호·수치 · {brand.fonts.mono}</span>
        </p>
      </details>
    </StageFrame>
  )
}
