// apps/web/src/components/csat/theater/CohesionPanel.tsx
// 문항 해설 아래 「이 문항에서 확인할 읽기 원리 — 앞 문장과 이어 주는 단서」(Phase 3 두 번째 수직 경로 · 2026-10-08).
// 단서(지시어 · the + 명사 · 연결어)가 가리키는 문장을 번호로 고르고, 그 연결로 단락 순서를 고른다. 채점은 서버가 한다(정답은 화면에 오지 않는다).
// 학습자에게는 연구 용어(탐구 · 근거 수준 · 채택 · 효과 · 적용 id)를 보이지 않는다. 지문 원문은 없다 — 공개 문제지를 곁에 두고 문장 번호로.
'use client'

import { useRef, useState } from 'react'

import { useTaskMeta } from './task-meta'

import type { CohesionPanelProps } from '@/lib/knowledge/cohesion-link-labels'

interface Grade {
  probes: Record<string, boolean>
  orderOk: boolean
  isCorrect: boolean
}

const BTN = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const on = 'border-[var(--p)] bg-[var(--p)] text-white'
const off = 'border-[var(--bd)] text-[var(--t1)]'
const nth = (i: number) => `${i + 1}번째`

export function CohesionPanel({ slug, principle, why, sentenceCount, probes, orderOptions }: { slug: string; principle: string; why: string } & CohesionPanelProps) {
  const [open, setOpen] = useState(false)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const [order, setOrder] = useState<number | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needLogin, setNeedLogin] = useState(false)
  const [pending, setPending] = useState(false)
  const started = useRef<number | null>(null)
  // G2 기록 계약 — 세션 · 요청 멱등 id · 판단 시각 · 도움 수준(task-meta)
  const task = useTaskMeta(slug)
  const ready = probes.every((p) => Number.isInteger(picks[p.id])) && order !== null

  const submit = async () => {
    if (!ready) return
    setPending(true); setError(null)
    try {
      const response = { picks, order }
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
  const reset = () => { setPicks({}); setOrder(null); setGrade(null); started.current = performance.now(); task.restart() }

  return (
    <section id="principle" aria-labelledby="principle-title" data-testid="principle-panel" data-task="cohesion-link" className="mx-auto my-8 max-w-3xl rounded-lg border border-[var(--bd)] p-5 break-keep">
      <p className="text-xs text-[var(--t3)]">이 문항에서 확인할 읽기 원리</p>
      <h2 id="principle-title" className="mt-1 text-lg font-semibold text-[var(--t1)]">{principle}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--t2)]">{why}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--t1)]">
        <li>이 단서는 앞의 어떤 문장을 가리키나?</li>
        <li>그 연결을 따라가면 단락은 어떤 순서로 놓이나?</li>
      </ul>
      {!open ? (
        <button type="button" className={`${BTN} mt-4 border-[var(--p)] font-medium text-[var(--p)]`} onClick={() => { setOpen(true); started.current = performance.now() }}>
          직접 확인하기
        </button>
      ) : (
        <div className="mt-5 grid gap-5" data-testid="principle-task">
          <p className="text-xs text-[var(--t3)]">공개 문제지의 지문을 보며 문장 번호로 고릅니다(문장 지도와 같은 번호 · (A)(B)(C) 표시도 한 문장으로 셉니다).</p>
          {probes.map((p, k) => (
            <fieldset key={p.id} disabled={!!grade}>
              <legend className="mb-2 text-sm font-medium text-[var(--t1)]">{k + 1}. {p.cueLabel} — 이 단서가 가리키는 내용이 나온 문장</legend>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: sentenceCount }, (_, i) => i).filter((i) => i !== p.cueSentence).map((i) => (
                  <button key={i} type="button" aria-pressed={picks[p.id] === i} className={`${BTN} ${picks[p.id] === i ? on : off}`} onClick={() => setPicks({ ...picks, [p.id]: i })} data-probe={p.id} data-pick={i}>{nth(i)}</button>
                ))}
              </div>
            </fieldset>
          ))}
          <fieldset disabled={!!grade}>
            <legend className="mb-2 text-sm font-medium text-[var(--t1)]">{probes.length + 1}. 이 연결로 정한 단락 순서</legend>
            <div className="grid gap-2">
              {orderOptions.map((o, i) => (
                <label key={o} className={`flex min-h-11 items-center gap-2 rounded border px-3 text-sm text-[var(--t1)] focus-within:outline focus-within:outline-2 focus-within:outline-[var(--p)] ${order === i ? 'border-[var(--p)]' : 'border-[var(--bd)]'}`}>
                  <input type="radio" name="cohesion-order" className="h-4 w-4 accent-[var(--p)]" checked={order === i} onChange={() => setOrder(i)} data-order={i} />
                  {o}
                </label>
              ))}
            </div>
          </fieldset>
          {!grade ? (
            <div>
              <button type="button" className={`${BTN} border-[var(--p)] font-medium text-[var(--p)] disabled:opacity-50`} disabled={!ready || pending} onClick={submit}>확인하기</button>
              {!ready && <p className="mt-2 text-xs text-[var(--t3)]">모두 고르면 확인할 수 있어요.</p>}
            </div>
          ) : (
            <div role="status" data-testid="principle-result" data-correct={grade.isCorrect} className="grid gap-2 rounded border border-[var(--bd)] p-4 text-sm">
              <p className="font-medium text-[var(--t1)]">{grade.isCorrect ? '단서를 따라 단락을 바르게 이었어요.' : '한 군데 이상 다시 볼 곳이 있어요.'}</p>
              {probes.map((p, k) => (
                <p key={p.id}>{k + 1}번 단서 — {grade.probes[p.id] ? '맞아요' : '가리키는 문장을 다시 보세요. 단서와 같은 말이나 같은 일을 먼저 말한 문장이에요'}</p>
              ))}
              <p>단락 순서 — {grade.orderOk ? '맞아요' : '단서가 가리키는 문장이 들어 있는 단락이 먼저 와요'}</p>
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
