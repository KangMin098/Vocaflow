// apps/web/src/app/admin/csat/sources/NextStepPipeline.tsx
//
// **다음 한 걸음 — 다섯 단계 중 어디가 막혔나.**
//
// ── 왜 도식인가 (2026-09-16) ────────────────────────────────────────
// 예전에는 이 자리가 문단 넷이었다. 각각은 맞는 말이었는데 **순서가 안 보였다** —
// 「게이트를 돌려라」와 「발췌 경로로 가라」와 「분석이 붙어야 한다」가 같은 톤으로
// 나열돼, 관리자가 **무엇을 먼저** 해야 하는지 읽어 내야 했다. 다섯 단계를 한 줄로 펴면
// 그 순서가 그림이 된다.
//
// ── ⚠️ 도식이 조건을 삼키지 않게 한다 ──────────────────────────────
// 줄이면서 가장 쉽게 사라지는 것이 **전제**다. 예를 들어 「미절단 원본은 게이트를 돌려도
// 판정이 안 붙는다」 — 이 한 줄이 없으면 관리자가 돌지 않을 배치를 돌린다(실측: 미판정
// 19,333편 중 13,459편이 여기 해당했다). 그래서 단계마다 **배지 옆에 조건 한 줄**을
// 남긴다. 배지는 「얼마나」를, 조건은 「그래도 되는가」를 말한다.
//
// ── 병목은 계산한다, 고르지 않는다 ──────────────────────────────────
// 강조할 단계는 **편수가 가장 큰 단계**다. 손으로 고르면 재고가 바뀌어도 그대로 남는다.

'use client'

import { useState } from 'react'

import type { SourceEligibilityPanel } from '@/lib/textbook/source-eligibility-view'

/**
 * 명령 + 복사 버튼.
 *
 * ⚠️ **명령을 `title` 속성에만 두면 안 된다.** 처음에 그렇게 짰다가 누락 가드가 잡았다 —
 *   화면 텍스트에서 사라지기 때문이다. 그리고 그건 검사만의 문제가 아니다:
 *   **무엇을 복사하는지 안 보이는 복사 버튼**은 눌러 보기 전에는 알 수 없다.
 *   그래서 명령을 그대로 적고 버튼은 옆에 둔다.
 */
function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          .writeText(command)
          .then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          })
          // 클립보드가 막힌 환경(비보안 컨텍스트)에서도 화면이 죽지 않게 한다.
          .catch(() => setCopied(false))
      }}
      aria-label={`명령 복사: ${command}`}
      className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-mono text-[10px] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[#8B5CF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] active:bg-[var(--bd)]"
    >
      {/* 아이콘 없이 글자로 — 복사됨을 색만으로 말하지 않는다. */}
      {copied ? '복사됨' : '명령 복사'}
    </button>
  )
}

/** 단계 하나의 명령 — 보이는 자리에 적고 버튼을 옆에 둔다. */
function CommandBlock({ command }: { command: string }) {
  return (
    <div className="flex flex-col gap-1">
      <code className="block overflow-wrap-anywhere rounded-[var(--r-sm)] bg-[var(--bg2)] px-1.5 py-1 font-mono text-[10px] leading-[1.45] text-[var(--t2)] [overflow-wrap:anywhere]">
        {command}
      </code>
      <CopyCommand command={command} />
    </div>
  )
}

interface Stage {
  key: string
  /** 화면에 보이는 단계 이름. */
  label: string
  /** 이 단계가 지금 안고 있는 편수. `null` = 셀 수 없다(스냅샷에 없는 값). */
  count: number | null
  /** 배지 아래 한 줄 — **이 단계의 전제/함정**. 줄이면서 이것을 지우면 안 된다. */
  note: string
  /** 복사해 갈 명령. 없으면 사람이 하는 단계다. */
  command?: string
  /** 사람이 채우는 단계인가 — 명령이 아니라 Claude Code 가 하는 일. */
  manual?: boolean
}

function buildStages(panel: SourceEligibilityPanel): Stage[] {
  const t = panel.total
  const unjudged = t.byGrade.unjudged ?? 0
  const structural = panel.structurallyUnjudged ?? 0
  // 드레인으로 **풀 수 있는** 미판정 — 미절단 원본은 게이트가 판정하지 않으므로 뺀다.
  const drainable = Math.max(0, unjudged - structural)
  const backlog = panel.extractBacklog

  return [
    {
      key: 'export',
      label: '① 청크 뽑기',
      count: drainable,
      note: '책 단위로 뽑는다 — 같은 책 조각은 장르가 같아 판정 수가 35배 준다. 이미 뽑힌 제목은 건너뛴다(재실행 안전).',
      command: 'pnpm dlx tsx scripts/csat/gate-book-export.mjs',
    },
    {
      key: 'claude',
      label: '② Claude Code 가 채움',
      count: drainable,
      note: '사람이 아니라 Claude Code 가 청크를 읽고 판정을 적는다. 이미 .out.json 이 있는 청크는 건너뛴다.',
      manual: true,
    },
    {
      key: 'import',
      label: '③ 적재',
      count: drainable,
      note: '⚠️ 검증을 건너뛰지 말 것 — gate-import 에는 어휘 검증이 하나도 없어 use+bias 같은 모순이 그대로 통과하고 차단 집계에도 안 잡힌다.',
      command: 'pnpm dlx tsx scripts/csat/gate-drain-validate.mjs',
    },
    {
      key: 'extract',
      label: '④ 발췌 경로',
      count: structural || null,
      // ⚠️ 「게이트를 돌려도 안 풀린다」는 **회귀가 문자 그대로 잠근 문구**다
      //   (sources-screen.test.tsx §헛일을 시킨다). 줄이거나 고쳐 적으면 검사가 잡는다 —
      //   그 문장이 없으면 관리자가 돌지 않을 배치를 돌리기 때문이다.
      note: '⚠️ 미절단 원본(purpose=raw)은 게이트를 돌려도 안 풀린다 — 자르기 전에는 무엇도 게시 불가다. ①~③ 을 돌리면 시간만 쓴다.',
      command: 'pnpm dlx tsx scripts/csat/plos-extract.mjs',
    },
    {
      key: 'queue',
      label: '⑤ 학령 분석',
      count: backlog ? backlog.pending : null,
      note: backlog
        // 「분석을 기다린다」도 회귀가 잠근 문구다(§이미 한 일을 다시 시킨다).
        ? `발췌 ${backlog.total.toLocaleString()}편 중 ${backlog.analyzed.toLocaleString()}편만 분석이 붙었고 ${backlog.pending.toLocaleString()}편이 분석을 기다린다. 분석이 붙어야 조판 가능이 될 수 있다 — 결정론 경로라 LLM 비용이 없고 편당 약 5초다.`
        : '분석이 붙어야 조판 가능이 될 수 있다 — 결정론 경로라 LLM 비용이 없고 편당 약 5초다.',
      command: backlog
        ? `pnpm dlx tsx scripts/acp/process-queue.mjs --feed ${backlog.feed} --commit --limit N`
        : 'pnpm dlx tsx scripts/acp/process-queue.mjs --commit',
    },
  ]
}

export function NextStepPipeline({ panel }: { panel: SourceEligibilityPanel }) {
  const stages = buildStages(panel)
  // 병목 = 편수가 가장 큰 단계. **고르지 않고 계산한다** — 재고가 바뀌면 강조도 옮겨간다.
  const bottleneck = stages.reduce<Stage | null>(
    (best, s) => (s.count != null && (!best || s.count > (best.count ?? 0)) ? s : best),
    null,
  )

  return (
    <section
      aria-label="다음 한 걸음"
      className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--warning)] bg-[var(--bg)] p-4"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-body text-[12px] font-[700] text-[var(--warning-ink)]">
          다음 한 걸음
        </span>
        {panel.topBlocker ? (
          <span className="font-body text-[14px] text-[var(--t1)]">
            <b className="tabular-nums">{panel.topBlocker.grade.count.toLocaleString()}편</b> 이{' '}
            <b>{panel.topBlocker.axis.label}</b> 에서 막혀 있다 — {panel.topBlocker.grade.label}.
          </span>
        ) : null}
      </div>

      {panel.topBlocker ? (
        <p className="font-body text-[13px] text-[var(--t2)]">{panel.topBlocker.grade.nextStep}</p>
      ) : null}

      {/* 1440 에서 다섯 칸이 한 줄, 1280 이하에서는 세 칸씩 접힌다 — 가로 스크롤을 만들지 않는다. */}
      <ol className="grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-3 xl:grid-cols-5">
        {stages.map((s) => {
          const hot = bottleneck?.key === s.key
          return (
            <li
              key={s.key}
              className="flex flex-col gap-1.5 rounded-[var(--r-sm)] border p-2.5"
              style={{
                borderColor: hot ? 'var(--warning)' : 'var(--bd)',
                background: hot ? 'var(--bg2)' : 'transparent',
              }}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[12px] font-[700] text-[var(--t1)]">
                  {s.label}
                </span>
                {/* 병목을 색만으로 말하지 않는다 — 글자로도 적는다. */}
                {hot ? (
                  <span className="font-mono text-[9px] font-[700] uppercase tracking-wider text-[var(--warning-ink)]">
                    병목
                  </span>
                ) : null}
              </div>
              <span
                className="font-display text-[17px] font-[800] tabular-nums"
                style={{ color: hot ? 'var(--warning-ink)' : 'var(--t1)' }}
              >
                {s.count == null ? '—' : s.count.toLocaleString()}
                <span className="ml-0.5 font-body text-[11px] font-[400] text-[var(--t3)]">
                  {s.count == null ? '' : '편'}
                </span>
              </span>
              <p className="font-body text-[11px] leading-[1.5] text-[var(--t2)]">{s.note}</p>
              {s.command ? (
                <CommandBlock command={s.command} />
              ) : s.manual ? (
                <span className="font-mono text-[10px] text-[var(--t3)]">명령 없음 — Claude Code</span>
              ) : null}
            </li>
          )
        })}
      </ol>

      <p className="font-body text-[11px] text-[var(--t3)]">
        ⑤ 까지 가야 조판 가능이 된다. <b>병목은 편수가 가장 큰 단계</b>이고 재고가 바뀌면 옮겨간다 —
        손으로 고른 값이 아니다. 명령은 전부 <b>읽고 쓰는 것이 갈려 있다</b>: 뽑기·검증은 읽기만 하고,
        적재만 <code>--commit</code> 이 필요하다.
      </p>
    </section>
  )
}
