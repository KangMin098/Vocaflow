// apps/web/src/components/csat/theater/EvidencePanel.tsx
// 문항 해설 아래 「이 문항에서 확인할 읽기 원리」 — E축 확인 과제(본문↔선지 · 근거 판단 · 2026-10-10).
// 정답이 다시 말한 본문 문장 · 빈칸을 정하는 근거 문장을 번호로 하나 고른다. 채점은 서버가 한다(근거 · 함정 위치는 화면에 오지 않는다).
// 지문 원문은 없다 — 공개 문제지를 곁에 두고 문장 번호로. 학습자에게 연구 용어를 보이지 않는다.
'use client'

import { useRef, useState } from 'react'

import { useTaskMeta } from './task-meta'

import type { EvidencePanelProps } from '@/lib/knowledge/evidence-locate'
import { EVIDENCE_PANEL_TEXT, LURE_NOTE } from '@/lib/knowledge/evidence-locate-labels'

interface Grade {
  evidenceOk: boolean
  lurePicked: boolean
  isCorrect: boolean
}

const BTN = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const on = 'border-[var(--p)] bg-[var(--p)] text-white'
const off = 'border-[var(--bd)] text-[var(--t1)]'

export function EvidencePanel({ slug, principle, why, taskKey, sentenceCount }: { slug: string; principle: string; why: string } & EvidencePanelProps) {
  const text = EVIDENCE_PANEL_TEXT[taskKey]
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<number | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needLogin, setNeedLogin] = useState(false)
  const [pending, setPending] = useState(false)
  const started = useRef<number | null>(null)
  const task = useTaskMeta(slug)

  const submit = async () => {
    if (pick === null) return
    setPending(true); setError(null)
    try {
      const response = { pick }
      const meta = await task.meta(JSON.stringify(response), started.current ? Math.min(7200, Math.round((performance.now() - started.current) / 1000)) : null)
      const res = await fetch(`/api/csat/item/${slug}/task`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response, ...meta }),
      })
      if (res.status === 401) { setNeedLogin(true); return }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error ?? '저장하지 못했어요. 잠시 뒤 다시 해 주세요'); return }
      task.settled()
      setGrade(body.grade as Grade)
    } catch {
      setError('저장하지 못했어요. 잠시 뒤 다시 해 주세요')
    } finally {
      setPending(false)
    }
  }
  const reset = () => { setPick(null); setGrade(null); started.current = performance.now(); task.restart() }

  return (
    <section id="principle" aria-labelledby="principle-title" data-testid="principle-panel" data-task={taskKey} className="mx-auto my-8 max-w-3xl rounded-lg border border-[var(--bd)] p-5 break-keep">
      <p className="text-xs text-[var(--t3)]">이 문항에서 확인할 읽기 원리</p>
      <h2 id="principle-title" className="mt-1 text-lg font-semibold text-[var(--t1)]">{principle}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--t2)]">{why}</p>
      {!open ? (
        <button type="button" className={`${BTN} mt-4 border-[var(--p)] font-medium text-[var(--p)]`} onClick={() => { setOpen(true); started.current = performance.now() }}>
          직접 확인하기
        </button>
      ) : (
        <div className="mt-5 grid gap-5" data-testid="principle-task">
          <p className="text-xs text-[var(--t3)]">공개 문제지의 지문을 보며 문장 번호로 고릅니다(문장 지도와 같은 번호). 해설을 보기 전에 혼자 고른 첫 답만 확인 기록으로 셉니다.</p>
          <fieldset disabled={!!grade}>
            <legend className="mb-2 text-sm font-medium text-[var(--t1)]">{text.question}</legend>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: sentenceCount }, (_, i) => i).map((i) => (
                <button key={i} type="button" aria-pressed={pick === i} className={`${BTN} ${pick === i ? on : off}`} onClick={() => setPick(i)} data-pick={i}>{i + 1}번째</button>
              ))}
            </div>
          </fieldset>
          {!grade ? (
            <div>
              <button type="button" className={`${BTN} border-[var(--p)] font-medium text-[var(--p)] disabled:opacity-50`} disabled={pick === null || pending} onClick={submit}>확인하기</button>
              {pick === null && <p className="mt-2 text-xs text-[var(--t3)]">문장을 하나 고르면 확인할 수 있어요.</p>}
            </div>
          ) : (
            <div role="status" data-testid="principle-result" data-correct={grade.isCorrect} data-lure={grade.lurePicked} className="grid gap-2 rounded border border-[var(--bd)] p-4 text-sm">
              <p className="font-medium text-[var(--t1)]">{grade.isCorrect ? text.ok : text.retry}</p>
              {grade.lurePicked && <p>{LURE_NOTE}</p>}
              <p className="text-xs text-[var(--t3)]">기록은 내 학습 기록에 남았어요. 이 결과는 이번 확인 한 번의 결과예요.</p>
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
