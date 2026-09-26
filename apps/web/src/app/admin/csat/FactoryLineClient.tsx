// apps/web/src/app/admin/csat/FactoryLineClient.tsx
//
// **공정 현황판** — "지금 어디가 막혔고, 다음에 무엇을 돌려야 하는가" 하나에 답한다.
//
// ── 왜 카드 8장을 걷어냈나 (2026-09-05) ──────────────────────────────
// 처음에는 공정마다 카드를 세워 눈금·게이트·병목·명령을 **전부 펼쳐** 놓았다. 실측하니
// 덩어리 284 · 글자 2,171 로 다른 공장 화면(62~143)의 **2~4배**였다 — 한 번에 다 보이지만
// 그래서 아무것도 안 보였다. 공정은 본래 순서가 있는 한 줄이므로:
//
//   ① 병목 한 줄  → 지금 무엇을 해야 하는지
//   ② 라인 도식   → 여덟 칸의 상태를 글자 없이 (색 + 모양 + 짧은 라벨)
//   ③ 고른 칸 하나의 상세 → 눈금 · 게이트 · 명령
//
// 기본 선택은 **병목**이다. 관리자가 화면을 열면 고를 것 없이 고쳐야 할 칸이 이미 펼쳐져 있다.
// 나머지 일곱 칸은 **누를 때만** 펼쳐진다 — 철학 2 Progressive Disclosure.
//
// 각 카드에 터미널 명령이 그대로 박혀 있는 것은 그대로다. 명령이 낡으면 회귀가 잡는다
// (파일이 저장소에 실제로 있는지 본다).

'use client'

import { ClipboardCheck, Copy, Sparkles, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  STATUS_KO,
  findBottleneck,
  lineCompletion,
  type StageGauge,
  type StageState,
} from '@/lib/csat/factory-model'

import { FactoryLineDiagram } from './FactoryLineDiagram'

function fmtGauge(g: StageGauge): string {
  if (g.num == null) return '못 잼'
  // 추정값에는 `≈` 를 붙인다 — 정확한 값처럼 적으면 그 수로 계산한 비율이 조용히 틀린다.
  const approx = g.approx ? '≈' : ''
  if (g.unit === 'index') return approx + g.num.toFixed(3)
  if (g.unit === 'count' || g.den == null) return approx + g.num.toLocaleString()
  return `${approx}${g.num.toLocaleString()} / ${g.den.toLocaleString()}`
}

/**
 * 눈금 하나. **분자/분모를 그대로 적는다** — 백분율만 적으면 반올림이 미달을 숨긴다.
 *
 * 숫자는 **본문 색**으로 쓴다(`dataviz`: 텍스트는 텍스트 토큰을 입고, 색은 옆의 마크가 진다).
 * 상태는 막대 색 + 목표선으로 말한다.
 */
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
        <p className="break-keep font-body text-[11px] text-[var(--memory-new)]">
          {g.unmeasuredReason ?? '아직 안 쟀다'}
        </p>
      ) : g.approx && g.unmeasuredReason ? (
        <p className="break-keep font-body text-[11px] text-[var(--memory-shaky)]">{g.unmeasuredReason}</p>
      ) : g.den ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bd)]">
          <div
            className="h-full rounded-full transition-[width] duration-[var(--dur-normal)] ease-[var(--ease)]"
            style={{
              width: `${Math.min(100, pct ?? 0)}%`,
              background: (pct ?? 0) >= 100 ? 'var(--memory-stable)' : (pct ?? 0) > 0 ? 'var(--memory-shaky)' : 'var(--memory-risk)',
            }}
          />
        </div>
      ) : null}
      {/* 값은 맞지만 **시점이 지금이 아닐 수 있는** 눈금 — 언제 잰 것인지 적는다.
          드레인을 막 돌린 직후 "왜 안 늘었지" 로 읽는 것을 막는 유일한 장치다. */}
      {g.num != null && g.note ? (
        <p className="break-keep font-body text-[10.5px] text-[var(--t3)]">{g.note}</p>
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
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-[var(--bd)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)]"
        >
          {copied ? (
            <ClipboardCheck size={15} strokeWidth={1.75} className="text-[var(--memory-stable)]" aria-hidden />
          ) : (
            <Copy size={15} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
      <p className="font-body text-[11.5px] leading-snug text-[var(--t3)]">
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
        {why}
      </p>
    </li>
  )
}

/** 고른 공정 하나의 상세. 한 번에 **하나만** 펼친다. */
function StageDetail({ s }: { s: StageState }) {
  const st = STATUS_KO[s.status]
  return (
    <section
      aria-label={`${s.def.name} 상세`}
      className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-baseline gap-x-2 font-display text-[15px] font-[700] text-[var(--t1)]">
            <span className="font-mono text-[11px] text-[var(--t3)]">{s.def.ord}</span>
            {s.def.href ? (
              <a
                href={s.def.href}
                className="underline decoration-[var(--bd)] underline-offset-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
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
          style={{ background: `color-mix(in srgb, ${st.color} 12.2%, transparent)`, color: st.color }}
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
          <TriangleAlert
            size={13}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-[var(--memory-shaky)]"
            aria-hidden
          />
          {s.blocker}
        </p>
      ) : null}

      <div>
        <h4 className="mb-2 font-display text-[12px] font-[600] text-[var(--t2)]">
          다음에 돌릴 것 {s.nextCommands.length}개
        </h4>
        <ul className="flex flex-col gap-2 rounded-[var(--r-sm)] bg-[var(--bg2)] p-2.5">
          {s.nextCommands.map((c) => (
            <CommandRow key={c.cmd} {...c} />
          ))}
        </ul>
      </div>
    </section>
  )
}

export function FactoryLineClient({
  stages,
  loadError,
}: {
  stages: StageState[]
  loadError: string | null
}) {
  // ── 병목을 레인마다 따로 고른다 (2026-09-23 · DD-74) ───────────────
  // ⚠️ 여기까지 병목이 하나였고 `ord` 만 봤다. `ord 2` 는 ② 기획이고 그것은 **연구소**라
  //   라인을 막지 않는다 — 실측 2026-09-23 에 화면이 「막힌 곳 · 2. 기획」이라 적는 동안
  //   ④⑤⑧ 은 전부 통과였고, 기획의 미달 사유는 생산이 아니라 **증거 부족**이었다.
  //   즉 화면이 가리킨 곳에서 **할 수 있는 생산 작업이 하나도 없었다.**
  //
  //   라인 병목을 먼저 적는다 — 「지금 무엇을 돌릴까」의 답은 거의 항상 라인에 있다.
  const lineBottleneck = findBottleneck(stages, 'line')
  const labBottleneck = findBottleneck(stages, 'lab')
  // 매대(⑨)는 라인을 **막지 않는다** — 낸 책이 안 팔려도 다음 권은 찍힌다. 그래서
  // 기본 선택에서는 라인·연구소 뒤에 온다. 다만 **안 보이면 안 된다**: 이 칸이 빠져 있던
  // 동안 공장은 ⑧ 에서 끝났고, 그 끝이 곧 「완료」로 읽혔다(DD-77).
  const shelfBottleneck = findBottleneck(stages, 'shelf')
  const bottleneck = lineBottleneck ?? labBottleneck ?? shelfBottleneck
  const { passed, total } = lineCompletion(stages)
  // 기본 선택은 병목이다 — 열자마자 고쳐야 할 칸이 이미 펼쳐져 있다.
  const [picked, setPicked] = useState<string | null>(null)
  const selected =
    stages.find((s) => s.def.id === picked) ?? bottleneck ?? stages[0] ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">공정 현황판</h2>
        <AdminScreenHelp screen="csat" />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[var(--memory-risk)] bg-[var(--bg)] p-3 font-body text-[13px] text-[var(--memory-risk)]"
        >
          {loadError}
        </p>
      ) : null}

      {/* ① 한 줄 — 이 화면에서 가장 중요한 문장. 뒤 공정이 더 나빠 보여도 여기부터 푼다.
          **라인과 연구소를 갈라 적는다** — 둘은 할 일이 다르다(만드는 것 vs 무엇을 만들지). */}
      <div className="flex flex-col gap-1">
        <p className="break-keep font-display text-[15px] font-[700] text-[var(--t1)]">
          {lineBottleneck ? (
            <>
              <span className="text-[var(--t3)]">생산 라인이 막힌 곳 · </span>
              {lineBottleneck.def.ord}. {lineBottleneck.def.name}
              <span className="ml-2 font-body text-[12px] font-[400] text-[var(--t2)]">
                {lineBottleneck.blocker ?? lineBottleneck.def.gate}
              </span>
            </>
          ) : (
            <span className="text-[var(--memory-stable)]">생산 라인이 게이트를 다 넘었다</span>
          )}
          <span className="ml-2 font-mono text-[12px] font-[400] tabular-nums text-[var(--t3)]">
            {passed}/{total}
          </span>
        </p>
        {/* 연구소는 **라인을 막지 않는다.** 그래서 작게, 아래에 적는다 — 여기가 미달이어도
            ④⑤⑧ 은 그대로 돌고, 할 일도 대개 생산이 아니라 증거 모으기다. */}
        <p className="break-keep font-body text-[12px] text-[var(--t2)]">
          {labBottleneck ? (
            <>
              <span className="text-[var(--t3)]">전략 연구소 · </span>
              {labBottleneck.def.ord}. {labBottleneck.def.name}
              <span className="ml-1.5 text-[var(--t3)]">
                {labBottleneck.blocker ?? labBottleneck.def.gate} — 라인을 막지는 않는다
              </span>
            </>
          ) : (
            <span className="text-[var(--t3)]">전략 연구소도 게이트를 다 넘었다</span>
          )}
        </p>
        {/*
          매대 — **낸 다음**의 일. 라인이 다 통과해도 여기가 막혀 있으면 「더 찍자」가 답이
          아니다(2026-09-23 · DD-77). 실측: 나간 19권 중 결재 1 · 학습자가 고른 권 3.
          이 줄이 없던 동안 공장은 ⑧ 에서 끝났고, 그 끝이 곧 「완료」로 읽혔다.
        */}
        <p className="break-keep font-body text-[12px] text-[var(--t2)]">
          {shelfBottleneck ? (
            <>
              <span className="text-[var(--t3)]">매대 · </span>
              {shelfBottleneck.def.ord}. {shelfBottleneck.def.name}
              <span className="ml-1.5 text-[var(--t3)]">
                {shelfBottleneck.blocker ?? shelfBottleneck.def.gate} — 더 찍어서 풀리지 않는다
              </span>
            </>
          ) : (
            <span className="text-[var(--t3)]">낸 책도 결재와 수요가 붙어 있다</span>
          )}
        </p>
      </div>

      {/* ② 도식 — 여덟 칸을 한 그림으로. 색 + 모양 + 라벨 삼중이라 색약에서도 갈린다. */}
      {stages.length ? (
        <FactoryLineDiagram
          stages={stages}
          selectedId={selected?.def.id ?? ''}
          onSelect={setPicked}
          bottleneckOrd={bottleneck?.def.ord ?? null}
        />
      ) : null}

      {/* ③ 고른 칸 하나만 편다 */}
      {selected ? <StageDetail s={selected} /> : null}
    </div>
  )
}
