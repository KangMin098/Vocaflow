// apps/web/src/components/csat/theater/PrinciplePanel.tsx
// 문항 해설 아래 「이 문항에서 확인할 읽기 원리」(Phase 3 첫 수직 경로 · 2026-10-08).
// 학습자에게는 연구 용어(탐구 · 근거 수준 · 채택 · 효과 · 적용 id)를 보이지 않는다 — 무엇을 확인하는지 · 왜 · 무엇을 하면 되는지 · 결과만.
// 지문 원문은 화면에 없다(평가원 저작물) — 공개 문제지를 곁에 두고 문장 번호로 고른다. 채점은 서버가 한다.
'use client'

import { useRef, useState } from 'react'

import { useTaskMeta } from './task-meta'

import { RELATIONS, RELATION_LABEL, type Relation } from '@/lib/knowledge/claim-support-labels'

interface Grade {
  claimOk: boolean
  claimRestated: boolean
  supportOk: boolean
  supportMissed: number[]
  supportExtra: number[]
  relationOk: boolean
  isCorrect: boolean
}

const BTN = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const on = 'border-[var(--p)] bg-[var(--p)] text-white'
const off = 'border-[var(--bd)] text-[var(--t1)]'
const nth = (i: number) => `${i + 1}번째`

export function PrinciplePanel({ slug, principle, why, sentenceCount, relationSentence }: { slug: string; principle: string; why: string; sentenceCount: number; relationSentence: number }) {
  const [open, setOpen] = useState(false)
  const [claim, setClaim] = useState<number | null>(null)
  const [support, setSupport] = useState<number[]>([])
  const [relation, setRelation] = useState<Relation | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needLogin, setNeedLogin] = useState(false)
  const [pending, setPending] = useState(false)
  const started = useRef<number | null>(null)
  // G2 기록 계약 — 세션 · 요청 멱등 id · 판단 시각 · 도움 수준(task-meta)
  const task = useTaskMeta(slug)
  const sentences = Array.from({ length: sentenceCount }, (_, i) => i)
  const ready = claim !== null && support.length > 0 && relation !== null

  const submit = async () => {
    if (!ready) return
    setPending(true); setError(null)
    try {
      const response = { claim, support, relation }
      const meta = await task.meta(JSON.stringify(response))
      const res = await fetch(`/api/csat/item/${slug}/task`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response, sec: started.current ? Math.min(7200, Math.round((performance.now() - started.current) / 1000)) : null, ...meta }),
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
  const reset = () => { setClaim(null); setSupport([]); setRelation(null); setGrade(null); started.current = performance.now(); task.restart() }

  return (
    <section id="principle" aria-labelledby="principle-title" data-testid="principle-panel" className="mx-auto my-8 max-w-3xl rounded-lg border border-[var(--bd)] p-5 break-keep">
      <p className="text-xs text-[var(--t3)]">이 문항에서 확인할 읽기 원리</p>
      <h2 id="principle-title" className="mt-1 text-lg font-semibold text-[var(--t1)]">{principle}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--t2)]">{why}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--t1)]">
        <li>이 글의 주장 문장은 무엇인가?</li>
        <li>어떤 문장이 그 주장을 뒷받침하는가?</li>
        <li>둘은 어떤 관계인가?</li>
      </ul>
      {!open ? (
        <button type="button" className={`${BTN} mt-4 border-[var(--p)] font-medium text-[var(--p)]`} onClick={() => { setOpen(true); started.current = performance.now() }}>
          직접 확인하기
        </button>
      ) : (
        <div className="mt-5 grid gap-5" data-testid="principle-task">
          <p className="text-xs text-[var(--t3)]">공개 문제지의 지문을 보며 문장 번호로 고릅니다(문장 지도와 같은 번호).</p>
          <fieldset disabled={!!grade}>
            <legend className="mb-2 text-sm font-medium text-[var(--t1)]">1. 필자의 주장이 가장 직접 드러난 문장</legend>
            <div className="flex flex-wrap gap-2">
              {sentences.map((i) => (
                <button key={i} type="button" aria-pressed={claim === i} className={`${BTN} ${claim === i ? on : off}`} onClick={() => { setClaim(i); setSupport((s) => s.filter((x) => x !== i)) }} data-claim={i}>{nth(i)}</button>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={!!grade}>
            <legend className="mb-2 text-sm font-medium text-[var(--t1)]">2. 이유 · 조건을 대며 주장을 떠받치는 문장(모두 — 주장을 다시 말한 문장 · 필자가 반박하는 생각은 빼요)</legend>
            <div className="flex flex-wrap gap-2">
              {sentences.filter((i) => i !== claim).map((i) => {
                const picked = support.includes(i)
                return <button key={i} type="button" aria-pressed={picked} className={`${BTN} ${picked ? on : off}`} onClick={() => setSupport(picked ? support.filter((x) => x !== i) : [...support, i].sort((a, b) => a - b))} data-support={i}>{nth(i)}</button>
              })}
            </div>
          </fieldset>
          <fieldset disabled={!!grade}>
            <legend className="mb-2 text-sm font-medium text-[var(--t1)]">3. {nth(relationSentence)} 문장은 주장과 어떤 관계인가요?</legend>
            <div className="grid gap-2">
              {RELATIONS.map((r) => (
                <label key={r} className={`flex min-h-11 items-center gap-2 rounded border px-3 text-sm text-[var(--t1)] focus-within:outline focus-within:outline-2 focus-within:outline-[var(--p)] ${relation === r ? 'border-[var(--p)]' : 'border-[var(--bd)]'}`}>
                  <input type="radio" name="relation" className="h-4 w-4 accent-[var(--p)]" checked={relation === r} onChange={() => setRelation(r)} data-relation={r} />
                  {RELATION_LABEL[r]}
                </label>
              ))}
            </div>
          </fieldset>
          {!grade ? (
            <div>
              <button type="button" className={`${BTN} border-[var(--p)] font-medium text-[var(--p)] disabled:opacity-50`} disabled={!ready || pending} onClick={submit}>확인하기</button>
              {!ready && <p className="mt-2 text-xs text-[var(--t3)]">세 가지를 모두 고르면 확인할 수 있어요.</p>}
            </div>
          ) : (
            <div role="status" data-testid="principle-result" data-correct={grade.isCorrect} className="grid gap-2 rounded border border-[var(--bd)] p-4 text-sm">
              <p className="font-medium text-[var(--t1)]">{grade.isCorrect ? '주장과 근거를 정확히 연결했어요.' : '한 군데 이상 다시 볼 곳이 있어요.'}</p>
              <p>주장 문장 — {grade.claimOk ? '맞아요' : grade.claimRestated ? '고른 문장은 주장을 다시 말한 문장이에요. 주장이 처음 드러난 문장을 찾아보세요' : '다시 보세요'}</p>
              <p>뒷받침 문장 — {grade.supportOk ? '맞아요' : [grade.supportMissed.length ? `빠진 문장: ${grade.supportMissed.map(nth).join(', ')}` : '', grade.supportExtra.length ? `뒷받침이 아닌 문장: ${grade.supportExtra.map(nth).join(', ')}` : ''].filter(Boolean).join(' · ')}</p>
              <p>관계 — {grade.relationOk ? '맞아요' : '다시 보세요'}</p>
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
