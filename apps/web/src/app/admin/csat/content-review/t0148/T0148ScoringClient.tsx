// apps/web/src/app/admin/csat/content-review/t0148/T0148ScoringClient.tsx
//
// **T-0148 블라인드 채점 — 대본 하나씩, 두 기준 나란히.**
// 1단계(블라인드) → 잠금 → 2단계(반례 자료를 보고 「틀린 규칙」 다시 판정, 1단계 값은 그대로) → 잠금 → CSV.
// 초안은 이 브라우저에만 남는다(localStorage). 판정 키는 이 화면에 없다.

'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  advance,
  counterexamplesVisible,
  editField,
  newSheet,
  rowProblems,
  stage1Complete,
  stage2Complete,
  toCsv,
  type ScoreRow,
  type ScoringSheet,
  type Stage,
  type YesNoUnknown,
} from '@/lib/csat/content-review/t0148/scoring'

export interface BlindData {
  criterionA: string
  criterionB: { steps: { step: number; q: string; score: string }[]; notes: string[] }
  scripts: { blind: string; item_id: string; text: string }[]
}
interface Probe { item_id: string; applies: boolean; verdict: string; where: string; why: string }
export interface CounterexampleData {
  note: string
  items: { blind: string; rule_ko: string; probes: Probe[]; summary: string }[]
}

const DRAFT_KEY = 'csat-content-review:t0148-draft:v1'
const STAGE_LABEL: Record<Stage, string> = {
  stage1: '1단계 · 블라인드 채점',
  locked1: '1단계 잠금 · 2단계 시작 전',
  stage2: '2단계 · 반례 자료 판정',
  locked2: '제출용 잠금',
}
const YNU: YesNoUnknown[] = ['예', '아니오', '모름']

const card = 'rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4'
const small = 'font-body text-[12px] text-[var(--t3)]'
const ctl =
  'min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[13px] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:opacity-50'

export function T0148ScoringClient({ blind }: { blind: BlindData }) {
  const blinds = useMemo(() => blind.scripts.map((s) => s.blind), [blind])
  const [sheet, setSheet] = useState<ScoringSheet>(() => newSheet('', blinds))
  const [msg, setMsg] = useState<string | null>(null)
  const [ce, setCe] = useState<CounterexampleData | null>(null)
  const [ceError, setCeError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const s = JSON.parse(raw) as ScoringSheet
        if (Array.isArray(s.rows) && s.rows.length === blinds.length) setSheet(s)
      }
    } catch {
      // 저장이 막힌 브라우저 — 새 초안으로 시작한다
    }
  }, [blinds])

  function save(s: ScoringSheet) {
    setSheet(s)
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(s)) } catch { /* 이 탭에서만 유지 */ }
  }

  const showCe = counterexamplesVisible(sheet.stage)
  useEffect(() => {
    if (!showCe || ce) return
    fetch('/api/admin/csat/content-review/t0148-counterexamples', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        setCe((await r.json()) as CounterexampleData)
      })
      .catch((e: unknown) => setCeError(`반례 자료를 못 받았다(${e instanceof Error ? e.message : '오류'}) — 2단계 판정은 자료 없이 하지 않는다`))
  }, [showCe, ce])

  function edit<K extends keyof Omit<ScoreRow, 'blind'>>(b: string, f: K, v: ScoreRow[K]) {
    const r = editField(sheet, b, f, v)
    if (!r.ok) { setMsg(r.message); return }
    save(r.sheet)
  }
  function next() {
    if (!sheet.scorer.trim()) { setMsg('채점자 이름(약칭)을 적어야 잠글 수 있다'); return }
    const r = advance(sheet)
    if (!r.ok) { setMsg(r.message); return }
    save(r.sheet)
    setMsg(`${STAGE_LABEL[r.sheet.stage]}`)
  }
  function download() {
    const blob = new Blob([toCsv(sheet)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `human_scores_${sheet.scorer.trim() || 'scorer'}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const done1 = sheet.rows.filter(stage1Complete).length
  const done2 = sheet.rows.filter(stage2Complete).length
  const s1Locked = sheet.stage !== 'stage1'

  return (
    <div className="flex flex-col gap-4 p-6">
      <header>
        <h1 className="font-display text-[20px] font-[700] text-[var(--t1)]">T-0148 정리 cue 블라인드 채점</h1>
        <p role="status" className="mt-2 rounded-[var(--r-md)] border border-[var(--memory-risk)] p-3 font-body text-[13px] text-[var(--t1)] break-keep">
          <strong>사람 채점 제출 0/26</strong> · 판정 키는 이 화면에 없다 · T-0148 BLOCKED · 결과는 CSV 로만 나가며 DB·생성 지침에 반영되지 않는다.
        </p>
      </header>

      <section className={`${card} grid grid-cols-2 gap-4`} aria-label="채점 기준">
        <div>
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">기준 A · 현재 main</h2>
          <p className="mt-1 font-body text-[13px] text-[var(--t2)] break-keep">{blind.criterionA}</p>
        </div>
        <div>
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">기준 B · v3 후보(판정 순서)</h2>
          <ol className="mt-1 flex flex-col gap-0.5">
            {blind.criterionB.steps.map((s) => (
              <li key={s.step} className="font-body text-[12.5px] leading-snug text-[var(--t2)] break-keep">{s.step}. {s.q} → {s.score}</li>
            ))}
          </ol>
          {blind.criterionB.notes.map((n) => <p key={n} className={`${small} mt-1 break-keep`}>{n}</p>)}
        </div>
      </section>

      <section className={`${card} flex flex-wrap items-end gap-3`} aria-label="진행">
        <label className="flex flex-col gap-1">
          <span className={small}>채점자(약칭)</span>
          <input className={ctl} value={sheet.scorer} disabled={s1Locked} onChange={(e) => save({ ...sheet, scorer: e.target.value })} />
        </label>
        <p className="font-body text-[13px] text-[var(--t1)]">
          {STAGE_LABEL[sheet.stage]} · 1단계 {done1}/26 · 2단계 {done2}/26
        </p>
        <button type="button" className={ctl} onClick={next} disabled={sheet.stage === 'locked2'}>
          {sheet.stage === 'stage1' ? '1단계 잠금' : sheet.stage === 'locked1' ? '2단계 시작' : '제출용 잠금'}
        </button>
        <button type="button" className={ctl} onClick={download}>CSV 내려받기</button>
        {msg ? <p role="status" className="font-body text-[12.5px] text-[var(--t2)] break-keep">{msg}</p> : null}
        {ceError ? <p role="alert" className="font-body text-[12.5px] text-[var(--error-ink)] break-keep">{ceError}</p> : null}
      </section>

      <ol className="flex flex-col gap-3">
        {blind.scripts.map((s) => {
          const row = sheet.rows.find((r) => r.blind === s.blind)!
          const probes = ce?.items.find((x) => x.blind === s.blind)
          const problems = rowProblems(row, sheet.stage)
          const id = (f: string) => `t0148-${s.blind}-${f}`
          return (
            <li key={s.blind} className={card} aria-labelledby={id('h')}>
              <h3 id={id('h')} className="font-display text-[14px] font-[700] text-[var(--t1)]">
                {s.blind} <span className="ml-1 font-mono text-[12px] font-[400] text-[var(--t3)]">{s.item_id}</span>
              </h3>
              <p className="mt-1 font-body text-[14px] leading-relaxed text-[var(--t1)] break-keep">{s.text}</p>
              <div className="mt-3 grid grid-cols-[repeat(4,minmax(0,1fr))] gap-3">
                {(['score_A', 'score_B'] as const).map((f) => (
                  <label key={f} className="flex flex-col gap-1" htmlFor={id(f)}>
                    <span className={small}>{f === 'score_A' ? 'A 점수 0~10' : 'B 점수 0~10'}</span>
                    <input
                      id={id(f)} type="number" min={0} max={10} step={1} inputMode="numeric" className={ctl} disabled={s1Locked}
                      value={row[f] ?? ''}
                      onChange={(e) => edit(s.blind, f, e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-1" htmlFor={id('w1')}>
                  <span className={small}>틀린 일반 규칙을 가르치나(1단계)</span>
                  <select id={id('w1')} className={ctl} disabled={s1Locked} value={row.teaches_wrong_rule_1 ?? ''}
                    onChange={(e) => edit(s.blind, 'teaches_wrong_rule_1', (e.target.value || null) as YesNoUnknown | null)}>
                    <option value="">선택</option>
                    {YNU.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1" htmlFor={id('own')}>
                  <span className={small}>스스로 찾은 반례 문항 ID</span>
                  <input id={id('own')} className={ctl} disabled={s1Locked} value={row.own_counterexample}
                    onChange={(e) => edit(s.blind, 'own_counterexample', e.target.value)} />
                </label>
              </div>

              {showCe ? (
                <div className="mt-3 border-t border-[var(--bd)] pt-3">
                  <p className={`${small} break-keep`}>2단계 · AI 사전 반례 점검(판정 아님) — {probes?.rule_ko ?? (ce ? '자료 없음' : '받는 중')}</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {(probes?.probes ?? []).map((p) => (
                      <li key={p.item_id} className="font-body text-[12.5px] leading-snug text-[var(--t2)] break-keep">
                        <span className="font-mono">{p.item_id}</span> · {p.verdict} · {p.where} — {p.why}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
                    <label className="flex flex-col gap-1" htmlFor={id('ce')}>
                      <span className={small}>반례 후보 판정(예: 2020#41 성립 · 후보 없으면 「해당 없음」) — 필수</span>
                      <input id={id('ce')} className={ctl} disabled={sheet.stage !== 'stage2'} value={row.ce_adjudication}
                        onChange={(e) => edit(s.blind, 'ce_adjudication', e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1" htmlFor={id('w2')}>
                      <span className={small}>틀린 규칙(2단계)</span>
                      <select id={id('w2')} className={ctl} disabled={sheet.stage !== 'stage2'} value={row.teaches_wrong_rule_2 ?? ''}
                        onChange={(e) => edit(s.blind, 'teaches_wrong_rule_2', (e.target.value || null) as YesNoUnknown | null)}>
                        <option value="">선택</option>
                        {YNU.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              ) : null}

              <label className="mt-3 flex flex-col gap-1" htmlFor={id('memo')}>
                <span className={small}>메모</span>
                <input id={id('memo')} className={ctl} disabled={sheet.stage === 'locked2'} value={row.memo}
                  onChange={(e) => edit(s.blind, 'memo', e.target.value)} />
              </label>
              {problems.length ? <p className={`${small} mt-1`}>남은 것: {problems.join(' · ')}</p> : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
