// apps/web/src/components/admin/csat/StageFrame.tsx
//
// **교재 공장 단계 화면의 공통 골격.**
//
// ── 왜 생겼나 (실측 2026-09-23 · DD-69) ─────────────────────────────
// 단계 화면 아홉을 11항목으로 채점했더니 같은 자리가 반복해서 비어 있었다:
//
//   A2 계약 명시   평균 1.22 — `StageDef` 가 question·output·gate 를 **모델에 갖고 있는데**
//                  화면은 대부분 `marketName` 한 줄만 썼다
//   B3 막힌 항목   평균 1.33 — 명령은 있는데 「몇 개가 왜 막혔는지」가 없다
//   B4 실패 목록   평균 0.67 — 개별 실패 항목을 여는 곳이 **아홉 중 둘**뿐이었다
//
// 셋 다 화면마다 따로 만들다 빠뜨린 것이지 어려운 것이 아니다. 그래서 자리를 고정한다.
// **값은 전부 기존 모델·DB 에서 온다 — 이 파일은 아무것도 짓지 않는다.**
//
// ── 자리 다섯 (순서가 곧 관리자가 묻는 순서다) ──────────────────────
//   ① 계약      입력 → 출력 → 완료 조건          `StageDef.input/.output/.gate`
//   ② 막힌 것   무엇이 몇 개 · 왜                 `StageState.blocker` + 단계별 실측
//   ③ 상태      항목 × status 매트릭스            화면마다 다르다 → `children`
//   ④ 드레인    마지막 실행 · 다음 명령(복사)     `StageCommand[]`
//   ⑤ 실패 목록 개별 항목                         `failures`
//
// ⚠️ **「못 잼」과 「0」을 섞지 않는다.** 이 저장소의 지배적 결함 유형이고
//   (`factory-model.ts` 머리말), 여기서도 `null` 과 `0` 을 다른 글자로 그린다.

'use client'

import { ClipboardCheck, Copy, ShieldAlert, Sparkles, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { STATUS_KO, type StageCommand, type StageDef, type StageStatus } from '@/lib/csat/factory-model'

/* ───────────────────────── ① 계약 ───────────────────────── */

/**
 * 입력 → 출력 → 완료 조건 한 덩어리.
 *
 * 세 칸을 **나란히** 놓는 이유: 앞 칸이 막히면 이 칸에서 할 일이 없다는 것이 입력 줄에서
 * 바로 보이게 하려는 것이다. 완료 조건만 적으면 「왜 못 하나」가 화면 밖에 남는다.
 */
export function StageContract({ stage }: { stage: StageDef }) {
  const rows: [string, string][] = [
    ['입력', stage.input],
    ['출력', stage.output],
    ['완료 조건', stage.gate],
  ]
  return (
    <section
      aria-label="이 단계의 계약"
      className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
    >
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-display text-[11.5px] font-[700] text-[var(--t3)] sm:text-right">
              {k}
            </dt>
            <dd className="break-keep font-body text-[12.5px] leading-snug text-[var(--t1)]">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ───────────────────────── ② 막힌 것 ───────────────────────── */

export interface StageBlock {
  /** 무엇이 막혔나 — 한 줄. */
  what: string
  /** 몇 개인가. **`null` 은 「못 잼」이고 0 과 다르다.** */
  count: number | null
  /** 못 쟀으면 왜 못 쟀나. */
  unmeasuredReason?: string
  /** 그 항목들을 여는 곳. 없으면 링크를 안 그린다(없는 화면을 가리키지 않는다). */
  href?: string
}

/**
 * 막힌 것 한 줄. 통과했으면 그렇게 적는다 — **빈 자리로 두지 않는다**(빈 자리는
 * 「통과」와 「아직 안 봤다」를 구별하지 못한다).
 */
export function StageBlocked({ status, blocks }: { status: StageStatus; blocks: StageBlock[] }) {
  const st = STATUS_KO[status]
  const measured = blocks.filter((b) => b.count != null && b.count > 0)
  const unmeasured = blocks.filter((b) => b.count == null)

  return (
    <section
      aria-label="지금 막힌 것"
      className="flex flex-col gap-2 rounded-[var(--r-md)] border p-4"
      style={{ borderColor: `color-mix(in srgb, ${st.color} 33.3%, transparent)`, background: `color-mix(in srgb, ${st.color} 5.9%, transparent)` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-1.5 py-0.5 font-display text-[11px] font-[700]"
          style={{ background: `color-mix(in srgb, ${st.color} 12.2%, transparent)`, color: st.color }}
        >
          {status === 'pass' ? null : <TriangleAlert size={11} strokeWidth={2} aria-hidden />}
          {st.label}
        </span>
        <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
          {measured.length === 0 && unmeasured.length === 0
            ? '막힌 것이 없다'
            : `막힌 것 ${measured.length + unmeasured.length}가지`}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {blocks.map((b) => (
          <li key={b.what} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="break-keep font-body text-[12.5px] text-[var(--t1)]">{b.what}</span>
            {b.count == null ? (
              // ⚠️ 못 잰 것을 0 으로 적지 않는다. 할 일이 정반대다.
              <span className="font-mono text-[12px] text-[var(--memory-new)]">
                못 잼{b.unmeasuredReason ? ` — ${b.unmeasuredReason}` : ''}
              </span>
            ) : (
              <span className="font-mono text-[12.5px] tabular-nums text-[var(--t1)]">
                {b.count.toLocaleString()}건
              </span>
            )}
            {b.href && (b.count ?? 0) > 0 ? (
              <a
                href={b.href}
                className="inline-flex min-h-[44px] items-center font-display text-[11.5px] font-[700] text-[var(--p)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
              >
                대상 보기 →
              </a>
            ) : null}
          </li>
        ))}
        {blocks.length === 0 ? (
          <li className="font-body text-[12px] text-[var(--t3)]">
            이 단계에서 막고 있는 항목이 없다 — 다음 칸으로 넘어간다.
          </li>
        ) : null}
      </ul>
    </section>
  )
}

/* ───────────────────────── ④ 드레인 ───────────────────────── */

/**
 * 마지막 드레인 실행. `csat_drain_runs` 한 행.
 *
 * ⚠️ `available: false` 는 **저장소가 없다**는 뜻이고 「한 번도 안 돌렸다」와 다르다
 *   (마이그레이션 미적용). 이 구별은 `my-shelf-query.ts` 가 세운 규칙이고 같은 이유로 지킨다 —
 *   뭉개면 화면이 「아직 안 돌렸다」고 **거짓말**한다.
 */
export interface DrainRunView {
  available: boolean
  run: {
    mode: string
    status: 'running' | 'ok' | 'failed'
    startedAt: string
    itemsDone: number | null
    itemsTotal: number | null
    itemsSkipped: number | null
    error: string | null
  } | null
}

function CommandRow({ cmd, why, writes, claudeCode }: StageCommand) {
  const [copied, setCopied] = useState(false)
  return (
    <li className="flex flex-col gap-1 border-t border-[var(--bd)] pt-2 first:border-0 first:pt-0">
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-[11.5px] leading-relaxed text-[var(--t1)]">
          {cmd}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(cmd).then(
              () => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              },
              () => setCopied(false),
            )
          }}
          aria-label={`명령 복사: ${cmd}`}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-[var(--bd)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)]"
        >
          {copied ? (
            <ClipboardCheck size={15} strokeWidth={1.75} className="text-[var(--memory-stable)]" aria-hidden />
          ) : (
            <Copy size={15} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
      <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
        {claudeCode ? (
          <span className="mr-1 inline-flex items-center gap-0.5 rounded bg-[color-mix(in_srgb,var(--p)_12%,transparent)] px-1 py-0.5 text-[10px] font-[600] text-[var(--p)]">
            <Sparkles size={10} strokeWidth={2} aria-hidden />
            Claude Code
          </span>
        ) : null}
        {writes ? (
          <span className="mr-1 rounded bg-[color-mix(in_srgb,var(--memory-risk)_12%,transparent)] px-1 py-0.5 text-[10px] font-[600] text-[var(--memory-risk)]">
            씀
          </span>
        ) : null}
        {/* 되돌릴 수 없는 동작에는 승인 지점을 함께 적는다 — 승인 표가 없으면 그 사실도 적는다. */}
        {why}
      </p>
    </li>
  )
}

export function StageDrain({
  commands,
  runs,
  approvalNote,
}: {
  commands: readonly StageCommand[]
  runs?: DrainRunView
  /** 이 단계에서 승인이 필요한 지점. 없으면 안 그린다. */
  approvalNote?: string
}) {
  if (!commands.length && !runs && !approvalNote) return null
  return (
    <section
      aria-label="드레인"
      className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">드레인</h3>
        {runs ? <LastRun runs={runs} /> : null}
      </div>

      {approvalNote ? (
        <p className="flex items-start gap-1.5 break-keep font-body text-[11.5px] leading-snug text-[var(--memory-shaky)]">
          <ShieldAlert size={13} strokeWidth={1.9} className="mt-0.5 shrink-0" aria-hidden />
          {approvalNote}
        </p>
      ) : null}

      {commands.length ? (
        <ol className="flex flex-col gap-2">
          {commands.map((c) => (
            <CommandRow key={c.cmd} {...c} />
          ))}
        </ol>
      ) : (
        <p className="break-keep font-body text-[12px] text-[var(--t3)]">
          이 단계에는 드레인 계약이 아직 없다 — 명령을 지어내지 않는다.
        </p>
      )}
    </section>
  )
}

function LastRun({ runs }: { runs: DrainRunView }) {
  if (!runs.available) {
    // ⚠️ 「저장소가 없다」와 「안 돌렸다」는 다른 사실이다. 할 일도 다르다
    //    (마이그레이션 적용 vs 드레인 실행).
    return (
      <span className="font-body text-[11px] text-[var(--memory-new)]">
        실행 기록 저장소가 없다 — 마이그레이션 <code className="font-mono">csat_drain_runs</code> 미적용
      </span>
    )
  }
  if (!runs.run) {
    return <span className="font-body text-[11px] text-[var(--t3)]">아직 한 번도 안 돌렸다</span>
  }
  const r = runs.run
  const tone = r.status === 'failed' ? 'var(--memory-risk)' : r.status === 'running' ? 'var(--memory-shaky)' : 'var(--memory-stable)'
  return (
    <span className="font-mono text-[11px] tabular-nums" style={{ color: tone }}>
      {r.mode} · {r.status}
      {r.itemsTotal != null ? ` · ${r.itemsDone ?? 0}/${r.itemsTotal}` : ''}
      {/* 건너뛴 수가 재실행 안전의 증거다. null 은 「안 셌다」. */}
      {r.itemsSkipped != null ? ` · 건너뜀 ${r.itemsSkipped}` : ' · 건너뜀 못 잼'}
    </span>
  )
}

/* ───────────────────────── ⑤ 실패 목록 ───────────────────────── */

export interface FailureRow {
  id: string
  /** 왼쪽 라벨 — 무엇인가(문항 id · 권 이름 …). */
  label: string
  /** 분류 — 유형·밴드·페르소나 등. 짧게. */
  tags: string[]
  /** 왜 걸렸나 — 한 줄. 지어내지 않는다. */
  says: string | null
  href?: string
}

/**
 * 개별 실패 항목. **수만 보이고 항목을 못 여는 것이 B4 0점의 실체**였다 —
 * 실측 2026-09-23: `revise` 501 · `fail` 159 가 어느 화면에도 없었다.
 */
export function StageFailures({
  title,
  total,
  rows,
  emptyNote,
  moreHref,
}: {
  title: string
  /** 전체 실패 수. `null` 은 못 잼. */
  total: number | null
  /** 화면에 그리는 앞쪽 몇 개. */
  rows: FailureRow[]
  /** 0건일 때 적을 말 — 「0건」과 「안 봤다」를 가른다. */
  emptyNote: string
  moreHref?: string
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">{title}</h3>
        <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
          {total == null ? <span className="text-[var(--memory-new)]">못 잼</span> : `${total.toLocaleString()}건`}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="break-keep font-body text-[12px] text-[var(--t3)]">{emptyNote}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--bd)]">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {r.href ? (
                  <a
                    href={r.href}
                    // 44px 미만 터치 타깃 금지 — 인라인 링크라 내용이 높이를 정하면 20px 이 된다.
                    className="inline-flex min-h-[44px] items-center font-mono text-[11.5px] text-[var(--p)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
                  >
                    {r.label}
                  </a>
                ) : (
                  <span className="font-mono text-[11.5px] text-[var(--t2)]">{r.label}</span>
                )}
                {r.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-1 py-0.5 font-display text-[10px] font-[600] text-[var(--t3)]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {/* 사유가 없으면 「없다」고 적는다 — 빈 줄은 「깨끗하다」로 읽힌다. */}
              <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t2)]">
                {r.says ?? <span className="text-[var(--memory-new)]">사유가 기록되지 않았다</span>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {moreHref && (total ?? 0) > rows.length ? (
        <a
          href={moreHref}
          className="inline-flex min-h-[44px] w-fit items-center font-display text-[12px] font-[700] text-[var(--p)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        >
          전체 보기 →
        </a>
      ) : null}
    </section>
  )
}

/* ───────────────────────── 골격 ───────────────────────── */

export function StageFrame({
  stage,
  status,
  help,
  blocks,
  commands,
  runs,
  approvalNote,
  failures,
  children,
}: {
  stage: StageDef
  status: StageStatus
  /** `<AdminScreenHelp …/>` — 화면이 넘긴다(공통 골격이 화면 슬러그를 알 이유가 없다). */
  help: ReactNode
  blocks: StageBlock[]
  commands: readonly StageCommand[]
  runs?: DrainRunView
  approvalNote?: string
  /** 실패 목록 절. 단계마다 모양이 달라 화면이 만든다. */
  failures?: ReactNode
  /** ③ 상태 매트릭스 — 단계마다 다르다. */
  children: ReactNode
}) {
  const ord = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'][stage.ord - 1] ?? ''
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="break-keep font-display text-[16px] font-[700] text-[var(--t1)]">
            {ord} {stage.name} — {stage.question}
          </h2>
          <p className="font-body text-[12px] text-[var(--t2)]">시중: {stage.marketName}</p>
        </div>
        {help}
      </div>

      <StageContract stage={stage} />
      <StageBlocked status={status} blocks={blocks} />
      {children}
      <StageDrain commands={commands} runs={runs} approvalNote={approvalNote} />
      {failures}
    </div>
  )
}
