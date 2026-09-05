// apps/web/src/app/admin/csat/FactoryLineClient.tsx
//
// **공정 현황판** — "지금 어디가 막혔고, 다음에 무엇을 돌려야 하는가" 하나에 답한다.
//
// 표가 아니라 **라인**으로 그리는 이유: 공정은 순서가 있고, 앞이 막히면 뒤를 고쳐도 소용이 없다.
// 해설이 65%인데 조판을 돌리면 해설 빠진 책이 나온다. 그래서 화면 맨 위는 "가장 앞선 막힌 공정"
// 하나이고, 나머지 카드는 그 뒤를 잇는 순서로만 읽힌다.
//
// 각 카드에 **터미널 명령이 그대로 박혀 있다.** 지금까지 이 절차는 화면도움말 안에만 있었고,
// 관리자는 도움말을 펼쳐 읽고 손으로 옮겨 적었다. 명령이 화면에 있으면 그 왕복이 사라진다 —
// 그리고 명령이 낡으면 회귀 테스트가 잡는다(파일이 저장소에 실제로 있는지 본다).

'use client'

import { ClipboardCheck, Copy, Play, Sparkles, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  STATUS_KO,
  findBottleneck,
  lineCompletion,
  type StageGauge,
  type StageState,
} from '@/lib/csat/factory-model'

function fmtGauge(g: StageGauge): string {
  if (g.num == null) return '못 잼'
  if (g.unit === 'index') return g.num.toFixed(3)
  if (g.unit === 'count' || g.den == null) return g.num.toLocaleString()
  return `${g.num.toLocaleString()} / ${g.den.toLocaleString()}`
}

/** 눈금 하나. **분자/분모를 그대로 적는다** — 백분율만 적으면 반올림이 미달을 숨긴다. */
function Gauge({ g }: { g: StageGauge }) {
  const pct = g.num != null && g.den ? Math.round((100 * g.num) / g.den) : null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-body text-[12px] text-[var(--t3)]">{g.label}</span>
        <span className="font-mono text-[13px] tabular-nums text-[var(--t1)]">
          {fmtGauge(g)}
          {pct != null ? <span className="ml-1 text-[11px] text-[var(--t3)]">({pct}%)</span> : null}
          {g.unit === 'index' && g.target != null ? (
            <span className="ml-1 text-[11px] text-[var(--t3)]">목표 {g.target.toFixed(3)}</span>
          ) : null}
        </span>
      </div>
      {g.num == null ? (
        <p className="font-body text-[11px] text-[#8A8278]">{g.unmeasuredReason ?? '아직 안 쟀다'}</p>
      ) : g.den ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bd)]">
          <div
            className="h-full rounded-full transition-[width] duration-[var(--dur-normal)] ease-[var(--ease)]"
            style={{
              width: `${Math.min(100, pct ?? 0)}%`,
              background: (pct ?? 0) >= 100 ? '#2E7D5A' : (pct ?? 0) > 0 ? '#B5803A' : '#9C3A30',
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function CommandRow({ cmd, why, writes, claudeCode }: StageState['nextCommands'][number]) {
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
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-[var(--bd)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] active:bg-[var(--bd)]"
        >
          {copied ? (
            <ClipboardCheck size={15} strokeWidth={1.75} className="text-[#2E7D5A]" aria-hidden />
          ) : (
            <Copy size={15} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
      <p className="font-body text-[11.5px] leading-snug text-[var(--t3)]">
        {claudeCode ? (
          <span className="mr-1 inline-flex items-center gap-0.5 rounded bg-[#8B5CF6]/12 px-1 py-0.5 text-[10px] font-[600] text-[#8B5CF6]">
            <Sparkles size={10} strokeWidth={2} aria-hidden />
            Claude Code
          </span>
        ) : null}
        {writes ? (
          <span className="mr-1 rounded bg-[#9C3A30]/12 px-1 py-0.5 text-[10px] font-[600] text-[#9C3A30]">
            씀
          </span>
        ) : null}
        {why}
      </p>
    </li>
  )
}

function StageCard({ s, isBottleneck }: { s: StageState; isBottleneck: boolean }) {
  const st = STATUS_KO[s.status]
  return (
    <article
      className={`flex flex-col gap-3 rounded-[var(--r-md)] border bg-[var(--bg)] p-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] ${
        isBottleneck ? 'border-[#B5803A] shadow-[var(--sh-sm)]' : 'border-[var(--bd)]'
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-baseline gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
            <span className="font-mono text-[11px] text-[var(--t3)]">{s.def.ord}</span>
            {s.def.href ? (
              <a
                href={s.def.href}
                className="transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[#8B5CF6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
              >
                {s.def.name}
              </a>
            ) : (
              s.def.name
            )}
            <span className="font-body text-[11px] font-[400] text-[var(--t3)]">
              시중: {s.def.marketName}
            </span>
          </h3>
          <p className="mt-0.5 break-keep font-body text-[12px] text-[var(--t2)]">{s.def.question}</p>
        </div>
        <span
          className="shrink-0 rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[700]"
          style={{ background: `${st.color}1F`, color: st.color }}
        >
          {st.label}
        </span>
      </header>

      <div className="flex flex-col gap-2.5">
        {s.gauges.map((g) => (
          <Gauge key={g.label} g={g} />
        ))}
      </div>

      <p className="break-keep font-body text-[12px] leading-snug text-[var(--t2)]">
        <span className="text-[var(--t3)]">게이트 · </span>
        {s.def.gate}
      </p>

      {s.blocker ? (
        <p className="flex items-start gap-1.5 break-keep rounded-[var(--r-sm)] bg-[var(--bg2)] p-2 font-body text-[12px] leading-snug text-[var(--t2)]">
          <TriangleAlert size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#B5803A]" aria-hidden />
          {s.blocker}
        </p>
      ) : null}

      <details className="group">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 font-display text-[12px] font-[600] text-[#8B5CF6] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[#A78BFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]">
          <Play size={12} strokeWidth={2} aria-hidden />
          다음에 돌릴 것 {s.nextCommands.length}개
        </summary>
        <ul className="mt-2 flex flex-col gap-2 rounded-[var(--r-sm)] bg-[var(--bg2)] p-2.5">
          {s.nextCommands.map((c) => (
            <CommandRow key={c.cmd} {...c} />
          ))}
        </ul>
      </details>
    </article>
  )
}

export function FactoryLineClient({
  stages,
  loadError,
}: {
  stages: StageState[]
  loadError: string | null
}) {
  const bottleneck = findBottleneck(stages)
  const { passed, total } = lineCompletion(stages)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">공정 현황판</h2>
        <AdminScreenHelp screen="csat" />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[#9C3A30] bg-[var(--bg)] p-3 font-body text-[13px] text-[#9C3A30]"
        >
          {loadError}
        </p>
      ) : null}

      {/* 병목 하나 — 이 화면에서 가장 중요한 줄이다. 뒤 공정이 더 나빠 보여도 여기부터 푼다. */}
      <section
        aria-label="병목"
        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
      >
        {bottleneck ? (
          <>
            <p className="font-body text-[12px] text-[var(--t3)]">지금 라인을 막고 있는 공정</p>
            <p className="mt-1 break-keep font-display text-[18px] font-[800] text-[var(--t1)]">
              {bottleneck.def.ord}. {bottleneck.def.name}
              <span className="ml-2 font-body text-[13px] font-[400] text-[var(--t2)]">
                {bottleneck.blocker ?? bottleneck.def.gate}
              </span>
            </p>
            <p className="mt-1.5 break-keep font-body text-[12px] text-[var(--t3)]">
              앞이 막힌 채로 뒤 공정을 돌리면 그 결함이 그대로 책에 실린다. 공정 통과 {passed}/{total}.
            </p>
          </>
        ) : (
          <p className="font-display text-[16px] font-[700] text-[#2E7D5A]">
            공정 {total}칸이 모두 게이트를 넘었다 — 다음은 초과 개선이다
          </p>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {stages.map((s) => (
          <StageCard key={s.def.id} s={s} isBottleneck={s.def.id === bottleneck?.def.id} />
        ))}
      </div>
    </div>
  )
}
