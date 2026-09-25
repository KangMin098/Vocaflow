// apps/web/src/app/admin/csat/sources/PipelineBoard.tsx
//
// **원천별 작업 진행표** — 행은 원천, 열은 단계(모음 → 원문 점검 → 발췌 → 학년 분석 → 내용 판정 → 실을 수 있음).
// 칸을 누르면 표 아래에 그 원천 · 그 단계의 「하는 법」(명령 복사 · Claude 지시문 복사 · 재실행 안전 · 회차 κ)이 열린다.
//
// 복잡도 규칙(2026-09-25 · 사용자 요청 「가독성 · 화면 복잡도 해소」):
//   · 처음에는 **남은 일이 있는 원천만** 편다. 끝난 원천은 한 줄로 접는다.
//   · 칸마다 값 하나 · 한 줄 · 얇은 막대 하나 — 상태는 색 + 글자로(색만으로 말하지 않는다).
//   · 하는 법은 누른 칸 하나에 대해서만 보인다(한 번에 스물다섯 원천의 명령을 늘어놓지 않는다).

'use client'

import { Bot, ClipboardCheck, Copy, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { SOURCE_LABEL } from '@/lib/articles/source-guide'
import {
  PIPELINE_STAGES,
  TONE_LABEL,
  WHO_LABEL,
  cellOf,
  howTo,
  roundsReady,
  rowDone,
  type PipelineRow,
  type SourceRounds,
  type StageKey,
  type Tone,
} from '@/lib/textbook/source-pipeline'

const TONE_INK: Record<Tone, string> = {
  ok: 'var(--success-ink)',
  pile: 'var(--ios-orange-ink)',
  stop: 'var(--error-ink)',
  na: 'var(--t3)',
}
const TONE_BAR: Record<Tone, string> = {
  ok: 'var(--success)',
  pile: 'var(--ios-orange)',
  stop: 'var(--error)',
  na: 'transparent',
}

function Copyable({ text, label, children }: { text: string; label: string; children: React.ReactNode }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          window.setTimeout(() => setDone(false), 1500)
        })
      }}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--t1)] px-3 font-display text-[12.5px] font-[700] text-[var(--t1)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
    >
      {done ? <ClipboardCheck size={14} aria-hidden /> : children}
      {done ? '복사됨' : null}
    </button>
  )
}

export function PipelineBoard({
  rows,
  rounds,
  nextRound,
}: {
  rows: PipelineRow[]
  rounds: Record<string, SourceRounds>
  nextRound: number
}) {
  const [sel, setSel] = useState<{ source: string; stage: StageKey } | null>(null)
  // 하는 법은 **표 아래** 연다 — 옆에 두면 표가 좁아져 ⑥ 칸이 밀려났다(실측 2026-09-25). 누르면 그리로 내려간다.
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (sel) panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [sel])
  const [showAll, setShowAll] = useState(false)
  // 처음에는 **남은 일이 가장 많은 원천 8개**만 편다 — 스물다섯 줄을 한꺼번에 늘어놓으면 표가 곧 벽이 된다.
  const remaining = (r: PipelineRow) =>
    r.undecided + Math.max(0, r.total - r.levelled) + Math.max(0, r.total - r.judged)
  const open = rows.filter((r) => !rowDone(r)).sort((a, b) => remaining(b) - remaining(a))
  const done = rows.filter(rowDone)
  const TOP = 8
  const folded = [...open.slice(TOP), ...done]
  const visible = showAll ? [...open, ...done] : open.slice(0, TOP)
  const picked = sel ? rows.find((r) => r.source === sel.source) ?? null : null
  const stage = sel ? PIPELINE_STAGES.find((s) => s.key === sel.stage)! : null
  const how = picked && sel ? howTo(picked, sel.stage, nextRound) : null
  const label = (s: string) => SOURCE_LABEL[s] ?? s

  return (
    <section aria-labelledby="pipeline-title" className="flex flex-col gap-3">
      <div className="min-w-0 flex-1 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <h2 id="pipeline-title" className="font-display text-[15px] font-[800] text-[var(--t1)]">
            원천별 작업 진행표
          </h2>
          <p className="flex flex-wrap gap-3 font-body text-[11.5px] text-[var(--t2)]" aria-label="상태 표시">
            {(['ok', 'pile', 'stop', 'na'] as Tone[]).map((t) => (
              <span key={t} style={{ color: TONE_INK[t] }}>
                {t === 'na' ? '—' : '●'} {TONE_LABEL[t]}
              </span>
            ))}
          </p>
        </div>
        <p className="break-keep px-4 pb-2 font-body text-[12px] text-[var(--t2)]">
          칸을 누르면 그 원천 · 그 단계를 어떻게 진행하는지 표 아래에 열립니다. 숫자는 지금 DB 기준입니다.
        </p>
        <div className="overflow-x-auto [contain:paint]">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-y border-[var(--bd)] text-left">
                <th scope="col" className="px-4 py-2 font-display text-[12px] font-[700] text-[var(--t2)]">원천</th>
                {PIPELINE_STAGES.map((s) => (
                  <th key={s.key} scope="col" className="px-2 py-2 align-bottom font-display text-[12px] font-[700] text-[var(--t2)]">
                    {s.no} {s.name}
                    <span className="block font-body text-[11px] font-[400] text-[var(--t3)]">{WHO_LABEL[s.who]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.source} className="border-b border-[var(--bd)] last:border-0">
                  <th scope="row" className="px-4 py-2 text-left align-middle">
                    <span className="block font-display text-[13px] font-[700] text-[var(--t1)]">{label(r.source)}</span>
                    <span className="font-mono text-[11px] text-[var(--t3)]">{r.source}</span>
                  </th>
                  {PIPELINE_STAGES.map((s) => {
                    const c = cellOf(r, s.key)
                    const active = sel?.source === r.source && sel.stage === s.key
                    return (
                      <td key={s.key} className="px-1.5 py-1.5 align-middle">
                        <button
                          type="button"
                          aria-pressed={active}
                          aria-label={`${label(r.source)} ${s.name}: ${c.value}, ${c.note}, ${TONE_LABEL[c.tone]}`}
                          onClick={() => setSel(active ? null : { source: r.source, stage: s.key })}
                          className={`flex min-h-[44px] w-full min-w-[96px] flex-col gap-1 rounded-[var(--r-sm)] px-2 py-1 text-left hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] ${
                            active ? 'outline outline-2 outline-[var(--t1)]' : ''
                          }`}
                        >
                          <span className="font-mono text-[13px] font-[600] tabular-nums" style={{ color: c.tone === 'na' ? 'var(--t3)' : 'var(--t1)' }}>
                            {c.value}
                          </span>
                          {c.ratio != null ? (
                            <span aria-hidden className="block h-1 w-full overflow-hidden rounded-full bg-[var(--bd)]">
                              <span className="block h-full" style={{ width: `${Math.round(c.ratio * 100)}%`, background: TONE_BAR[c.tone] }} />
                            </span>
                          ) : null}
                          <span className="break-keep font-body text-[11px] font-[600]" style={{ color: TONE_INK[c.tone] }}>
                            {c.note}
                          </span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {folded.length ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="flex min-h-[44px] w-full flex-wrap items-center gap-x-2 px-4 text-left font-display text-[12.5px] font-[700] text-[var(--t1)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
          >
            {showAll ? '나머지 원천 접기 ▴' : `나머지 ${folded.length}개 원천 펼치기 ▾`}
            {!showAll ? (
              <span className="font-body text-[11.5px] font-[400] text-[var(--t2)]">
                남은 일 적은 원천 {Math.max(0, open.length - TOP)} · 끝난 원천 {done.length}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {picked && stage ? (
        <aside
          aria-label={`${label(picked.source)} ${stage.name} 하는 법`}
          ref={panelRef}
          className="flex w-full scroll-mt-4 flex-col gap-3 rounded-[var(--r-lg)] border-2 border-[var(--t1)] bg-[var(--bg)] p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-body text-[11.5px] text-[var(--t3)]">
                {label(picked.source)} · {stage.no} {stage.name} · {WHO_LABEL[stage.who]}
              </p>
              <h3 className="break-keep font-display text-[15px] font-[800] text-[var(--t1)]">{stage.says}</h3>
            </div>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setSel(null)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <dl className="flex flex-col gap-2 font-body text-[12.5px]">
            <div>
              <dt className="font-display text-[11px] font-[700] text-[var(--t3)]">지금</dt>
              <dd className="text-[var(--t1)]">
                {cellOf(picked, stage.key).value} · {cellOf(picked, stage.key).note}
              </dd>
            </div>
            {stage.key === 'retain' ? (
              <div>
                <dt className="font-display text-[11px] font-[700] text-[var(--t3)]">판정자 일치도 · 회차</dt>
                <dd className="text-[var(--t1)]">
                  {roundsReady(rounds[picked.source]).says}
                  {rounds[picked.source]?.keepPct != null
                    ? ` · 최근 표본 보관 ${rounds[picked.source]!.keepPct}% (${rounds[picked.source]!.keepRound})`
                    : ''}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="font-display text-[11px] font-[700] text-[var(--t3)]">먼저 끝나야 하는 것</dt>
              <dd className="break-keep text-[var(--t1)]">{stage.needs}</dd>
            </div>
          </dl>

          {how ? (
            <div className="flex flex-col gap-2">
              <p className="font-display text-[11px] font-[700] text-[var(--t3)]">하는 법 — 위에서부터 차례로</p>
              <ol className="flex flex-col gap-2">
                {how.steps.map((s) => (
                  <li key={s.cmd} className="flex flex-col gap-1 rounded-[var(--r-md)] bg-[var(--bg2)] p-2">
                    <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">{s.cmd}</code>
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="break-keep font-body text-[11.5px] text-[var(--t2)]">
                        {s.writes ? <b style={{ color: 'var(--error-ink)' }}>기록함 · </b> : <b>읽기만 · </b>}
                        {s.why}
                      </span>
                      <Copyable text={s.cmd} label={`명령 복사: ${s.cmd}`}>
                        <Copy size={14} aria-hidden /> 명령 복사
                      </Copyable>
                    </span>
                  </li>
                ))}
              </ol>
              {how.claude ? (
                <Copyable text={how.claude} label="Claude Code 지시문 복사">
                  <Bot size={14} aria-hidden /> Claude 에게 맡기기 (지시문 복사)
                </Copyable>
              ) : null}
              <p className="break-keep font-body text-[11.5px] text-[var(--t2)]">다시 돌려도 되나 — {how.rerun}</p>
            </div>
          ) : (
            <p className="break-keep font-body text-[12.5px] text-[var(--t2)]">
              {stage.key === 'usable'
                ? '결과 칸이라 따로 돌릴 것이 없습니다. 아래 「자세히 보기 → 적격 판정」에서 걸린 이유를 볼 수 있어요.'
                : '이 원천은 이 단계에서 남은 일이 없습니다.'}
            </p>
          )}
        </aside>
      ) : null}
    </section>
  )
}
