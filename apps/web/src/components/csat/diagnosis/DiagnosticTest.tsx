// apps/web/src/components/csat/diagnosis/DiagnosticTest.tsx
//
// 진단 테스트 풀이 — 한 화면에 한 문항. 답을 고르고(모르면 비움), 헷갈렸거나 찍었으면 표시한다.
// 키보드: 1~5 고르기 · → 다음 · ← 이전. 마지막에 한 번에 제출한다(채점은 서버).

'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'

export interface TestItem {
  id: string
  stem: string
  passage: string
  choices: string[]
}

type Flag = 'sure' | 'unsure' | 'guess'
const CIRCLED = ['①', '②', '③', '④', '⑤']
const btn =
  'inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border px-3 font-body text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--p)] disabled:opacity-50'

export function DiagnosticTest({ items }: { items: TestItem[] }) {
  const [idx, setIdx] = useState(0)
  const [chosen, setChosen] = useState<Record<string, number | null>>({})
  const [flags, setFlags] = useState<Record<string, Flag>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ correct: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const clientKey = useRef<string>(crypto.randomUUID())
  const item = items[idx]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (/^[1-5]$/.test(e.key)) setChosen((c) => ({ ...c, [item.id]: Number(e.key) }))
      else if (e.key === 'ArrowRight') setIdx((i) => Math.min(items.length - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, items.length, done])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/csat/diagnosis/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: clientKey.current,
          answers: items.map((i) => ({ itemId: i.id, chosen: chosen[i.id] ?? null, confidence: flags[i.id] ?? 'sure' })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '제출하지 못했어요')
      setDone({ correct: json.correct, total: json.total })
      track({ name: 'csat_dx_test_submitted', props: { correct: json.correct, total: json.total } })
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section className="flex flex-col gap-3" aria-live="polite">
        <p className="font-display text-[18px] font-[800] text-[var(--t1)]">{done.total}문항 중 {done.correct}문항을 맞혔어요.</p>
        <p className="break-keep font-body text-[14px] text-[var(--t2)]">진단 테스트는 문항 수가 적어 신뢰도가 낮아요. 최근 모의고사 결과를 입력하면 훨씬 정확해져요.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/csat/diagnosis" className={`${btn} border-[var(--p)] bg-[var(--p)] font-[700] text-[var(--on-p)]`}>리포트 보기</Link>
          <Link href="/csat/diagnosis/attempts/new" className={`${btn} border-[var(--bd)] text-[var(--t1)]`}>시험 기록 입력</Link>
        </div>
      </section>
    )
  }

  const answered = items.filter((i) => chosen[i.id] != null).length
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 font-body text-[13px] text-[var(--t2)]">
        <span>{idx + 1} / {items.length}</span>
        <span>답한 문항 {answered}</span>
      </div>
      <article className="flex flex-col gap-3" aria-labelledby={`q-${item.id}`}>
        <h2 id={`q-${item.id}`} className="break-keep text-[16px] font-[800] text-[var(--t1)]">{item.stem}</h2>
        {item.passage && <div className="whitespace-pre-wrap rounded-[var(--r-md)] border border-[var(--bd)] p-4 font-body text-[15px] leading-relaxed text-[var(--t1)]" lang="en">{item.passage}</div>}
        <div role="radiogroup" aria-label="선지" className="flex flex-col gap-2">
          {item.choices.map((c, k) => {
            const v = k + 1
            const on = chosen[item.id] === v
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChosen({ ...chosen, [item.id]: on ? null : v })}
                className={`${btn} justify-start text-left ${on ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]' : 'border-[var(--bd)] text-[var(--t1)]'}`}
              >
                <span className="mr-2 font-[800]">{CIRCLED[k]}</span>
                <span className="break-keep">{c}</span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-body text-[13px] text-[var(--t2)]">확신이 없었다면:</span>
          {(['unsure', 'guess'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={flags[item.id] === f}
              onClick={() => setFlags((cur) => ({ ...cur, [item.id]: cur[item.id] === f ? 'sure' : f }))}
              className={`${btn} ${flags[item.id] === f ? 'border-[var(--p)] text-[var(--p)]' : 'border-[var(--bd)] text-[var(--t2)]'}`}
            >
              {f === 'unsure' ? '헷갈림' : '찍음'}
            </button>
          ))}
        </div>
      </article>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${btn} border-[var(--bd)] text-[var(--t1)]`} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>이전</button>
        {idx < items.length - 1 ? (
          <button type="button" className={`${btn} border-[var(--bd)] text-[var(--t1)]`} onClick={() => setIdx(idx + 1)}>다음</button>
        ) : (
          <button type="button" className={`${btn} border-[var(--p)] bg-[var(--p)] font-[700] text-[var(--on-p)]`} disabled={busy} onClick={submit}>
            {busy ? '제출하는 중…' : '제출하고 진단 받기'}
          </button>
        )}
      </div>
      {error && <p role="alert" className="font-body text-[14px] text-[var(--error-ink)]">{error}</p>}
    </div>
  )
}
