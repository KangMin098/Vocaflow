// apps/web/src/components/csat/theater/ContextSensePanel.tsx
// 문항 해설 아래 「이 문항에서 확인할 읽기 원리」 — V2 문맥 의미 선택(LM-G1.5a · F1 수정).
// 확인(기록) = ① 맞지 않는 밑줄 + ② 근거 문장(검수된 경우만 채점) → 제출. 채점은 서버가 한다.
// 뜻 선택(D)은 **제출 · 저장 확인 뒤** 서버가 B 를 맞혔다고 돌려준 경우에만 나오는 지도 연습이다 — 제출 전 화면 · DOM · props 에 뜻 선택지가 없다(F1).
//   뜻 연습은 원장에 쓰지 않고 확인 결과에 합치지 않는다. 밑줄 표지는 유형별(①~⑤ · (a)~(e) · F5).
// 지문 원문은 없다 — 공개 문제지를 곁에 두고 밑줄 번호 · 문장 번호로.
'use client'

import { useRef, useState } from 'react'

import { useTaskMeta } from './task-meta'

import { CONTEXTUAL_SENSE_TEXT as T } from '@/lib/knowledge/contextual-sense-labels'

interface Grade {
  misfitOk: boolean
  cueOk: boolean | null
  isCorrect: boolean
  followUp: { senseOptions: string[]; senseCorrect: number } | null
}
export interface ContextSensePanelProps {
  sentenceCount: number
  targets: number[]
  markers: string[]
  cueGraded: boolean
}

const BTN = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const on = 'border-[var(--p)] bg-[var(--p)] text-white'
const off = 'border-[var(--bd)] text-[var(--t1)]'

/** 저장된 채점 결과 모양 검사 — 어긋나면 기록 완료를 보이지 않는다(허위 완료 없음) */
export function savedGrade(body: unknown): Grade | null {
  const b = body as { outcome?: unknown; grade?: unknown } | null
  if (!b || !['inserted', 'duplicate'].includes(b.outcome as string)) return null
  const g = b.grade as Partial<Grade> | null
  if (!g || typeof g.misfitOk !== 'boolean' || !(g.cueOk === null || typeof g.cueOk === 'boolean') || g.isCorrect !== g.misfitOk) return null
  // 뜻 연습은 B 를 맞혔을 때만 와야 한다 — B 를 틀렸는데 선택지가 오면 버린다(F1)
  const f = g.followUp
  if (!g.misfitOk) return f == null ? { misfitOk: false, cueOk: g.cueOk, isCorrect: false, followUp: null } : null
  if (f == null) return { misfitOk: true, cueOk: g.cueOk, isCorrect: true, followUp: null }
  if (!Array.isArray(f.senseOptions) || f.senseOptions.length < 2 || !f.senseOptions.every((o) => typeof o === 'string') || !Number.isInteger(f.senseCorrect) || f.senseCorrect < 0 || f.senseCorrect >= f.senseOptions.length) return null
  return { misfitOk: true, cueOk: g.cueOk, isCorrect: true, followUp: { senseOptions: [...f.senseOptions], senseCorrect: f.senseCorrect } }
}

export function ContextSensePanel({ slug, principle, why, sentenceCount, targets, markers, cueGraded }: { slug: string; principle: string; why: string } & ContextSensePanelProps) {
  const [open, setOpen] = useState(false)
  const [misfit, setMisfit] = useState<number | null>(null)
  const [cue, setCue] = useState<number[]>([])
  const [grade, setGrade] = useState<Grade | null>(null)
  const [sense, setSense] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needLogin, setNeedLogin] = useState(false)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const started = useRef<number | null>(null)
  const task = useTaskMeta(slug)

  const submit = async () => {
    if (misfit === null || inFlight.current) return
    inFlight.current = true
    setPending(true); setError(null)
    try {
      const response = { misfit, cue: [...cue].sort((a, b) => a - b) }
      const meta = await task.meta(JSON.stringify(response), started.current ? Math.min(7200, Math.round((performance.now() - started.current) / 1000)) : null)
      const res = await fetch(`/api/csat/item/${slug}/task`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response, ...meta }) })
      if (res.status === 401) { setNeedLogin(true); return }
      const body = await res.json().catch(() => ({}))
      // 저장이 실패하면 결과를 보이지 않는다(허위 완료 없음)
      if (!res.ok) { setError(body.error ?? '저장하지 못했어요. 잠시 뒤 다시 해 주세요'); return }
      const g = savedGrade(body)
      if (!g) throw new Error('Invalid saved result')
      setNeedLogin(false)
      task.settled()
      setGrade(g)
    } catch {
      setError('저장하지 못했어요. 잠시 뒤 다시 해 주세요')
    } finally {
      setPending(false)
      inFlight.current = false
    }
  }
  const reset = () => { setMisfit(null); setCue([]); setGrade(null); setSense(null); started.current = performance.now(); task.restart() }
  const toggleCue = (i: number) => setCue((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))

  return (
    <section id="principle" aria-labelledby="principle-title" data-testid="principle-panel" data-task="contextual-sense" className="mx-auto my-8 max-w-3xl rounded-lg border border-[var(--bd)] p-5 break-keep">
      <p className="text-xs text-[var(--t3)]">이 문항에서 확인할 읽기 원리</p>
      <h2 id="principle-title" className="mt-1 text-lg font-semibold text-[var(--t1)]">{principle}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--t2)]">{why}</p>
      {!open ? (
        <button type="button" className={`${BTN} mt-4 border-[var(--p)] font-medium text-[var(--p)]`} onClick={() => { setOpen(true); started.current = performance.now() }}>
          직접 확인하기
        </button>
      ) : (
        <div className="mt-5 grid gap-5" data-testid="principle-task">
          <p className="text-xs text-[var(--t3)]">공개 문제지의 지문을 보며 밑줄 표지 · 문장 번호로 고릅니다. 해설을 보기 전에 혼자 고른 첫 답만 확인 기록으로 셉니다.</p>
          <fieldset disabled={!!grade || pending}>
            <legend className="mb-2 text-sm font-medium text-[var(--t1)]">{T.misfit}</legend>
            <div className="flex flex-wrap gap-2">
              {targets.map((s, i) => (
                <button key={i} type="button" aria-pressed={misfit === i} className={`${BTN} ${misfit === i ? on : off}`} onClick={() => setMisfit(i)} data-misfit={i}>{markers[i] ?? String(i + 1)} <span className="ml-1 text-xs opacity-80">{s + 1}번째 문장</span></button>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={!!grade || pending || misfit === null}>
            <legend className="mb-2 text-sm font-medium text-[var(--t1)]">{T.cue}</legend>
            {!cueGraded && <p className="mb-2 text-xs text-[var(--t3)]">{T.cueUngraded}</p>}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: sentenceCount }, (_, i) => i).map((i) => (
                <button key={i} type="button" aria-pressed={cue.includes(i)} className={`${BTN} ${cue.includes(i) ? on : off}`} onClick={() => toggleCue(i)} data-cue={i}>{i + 1}번째</button>
              ))}
            </div>
          </fieldset>
          {!grade ? (
            <div>
              <button type="button" className={`${BTN} border-[var(--p)] font-medium text-[var(--p)] disabled:opacity-50`} disabled={misfit === null || pending} onClick={submit} data-testid="cs-submit">확인하기</button>
              {misfit === null && <p className="mt-2 text-xs text-[var(--t3)]">맞지 않는 밑줄을 고르면 확인할 수 있어요.</p>}
            </div>
          ) : (
            <div role="status" data-testid="principle-result" data-correct={grade.isCorrect} data-cue={grade.cueOk === null ? 'ungraded' : String(grade.cueOk)} className="grid gap-2 rounded border border-[var(--bd)] p-4 text-sm">
              <p className="font-medium text-[var(--t1)]">{grade.isCorrect ? T.ok : T.misfitWrong}</p>
              {grade.cueOk !== null && <p>{grade.cueOk ? T.cueOk : T.cueNo}</p>}
              <p className="text-xs text-[var(--t3)]">기록은 내 학습 기록에 남았어요. 이 결과는 이번 확인 한 번의 결과예요.</p>
              {grade.followUp && (
                <fieldset data-testid="cs-sense-practice" className="mt-2 grid gap-2">
                  <legend className="mb-1 text-sm font-medium text-[var(--t1)]">{T.sense}</legend>
                  <p className="text-xs text-[var(--t3)]">{T.senseNote}</p>
                  <div className="flex flex-wrap gap-2">
                    {grade.followUp.senseOptions.map((o, i) => (
                      <button key={i} type="button" aria-pressed={sense === i} className={`${BTN} ${sense === i ? on : off}`} onClick={() => setSense(i)} data-sense={i}>{o}</button>
                    ))}
                  </div>
                  {sense !== null && <p data-testid="cs-sense-feedback" data-right={sense === grade.followUp.senseCorrect}>{sense === grade.followUp.senseCorrect ? T.senseRight : T.senseOther}</p>}
                </fieldset>
              )}
              <div><button type="button" className={`${BTN} ${off}`} onClick={reset}>다시 해 보기</button></div>
            </div>
          )}
          {needLogin && <p role="alert" className="text-sm text-[var(--t1)]">기록을 남기려면 로그인이 필요해요. <a className="underline" href={`/login?next=/csat/item/${slug}%23principle`}>로그인</a></p>}
          {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
        </div>
      )}
    </section>
  )
}
