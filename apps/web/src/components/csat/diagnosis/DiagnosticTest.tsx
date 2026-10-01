// apps/web/src/components/csat/diagnosis/DiagnosticTest.tsx
//
// 진단 테스트 풀이 — 한 화면에 한 문항. 학습자는 **자기 문제지**에서 그 회차 그 번호를 풀고 답만 고른다.
// 원문은 이 화면에 없다(학습자 원문은 기기 PDF 에서만 — csat-learner-brief A5). 헷갈렸거나 찍었으면 표시한다.
// 키보드: 1~5 고르기 · → 다음 · ← 이전. 마지막에 한 번에 제출한다(채점은 서버).

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'

export interface TestItem {
  id: string
  examLabel: string
  no: number
}

type Flag = 'sure' | 'unsure' | 'guess'
const CIRCLED = ['①', '②', '③', '④', '⑤']
const btn =
  'inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border px-3 font-body text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--p)] disabled:opacity-50'

export function DiagnosticTest({ items }: { items: TestItem[] }) {
  const [idx, setIdx] = useState(0)
  const [chosen, setChosen] = useState<Record<string, number | null>>({})
  const [flags, setFlags] = useState<Record<string, Flag>>({})
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ correct: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 한 번 보낸 답은 바꾸지 않는다 — 저장은 됐는데 응답만 끊겼을 수 있어, 같은 키·같은 답으로만 다시 보낸다
  const [sent, setSent] = useState(false)
  const clientKey = useRef<string>(crypto.randomUUID())
  const item = items[idx]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || busy || sent || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (/^[1-5]$/.test(e.key)) setChosen((c) => ({ ...c, [item.id]: Number(e.key) }))
      else if (e.key === 'ArrowRight') setIdx((i) => Math.min(items.length - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, items.length, done, busy, sent])

  const submit = async () => {
    setSent(true)
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
      router.refresh() // 리포트·홈 카드가 새 스냅샷을 읽게
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
        <h2 id={`q-${item.id}`} className="break-keep text-[18px] font-[800] text-[var(--t1)]">{item.examLabel} {item.no}번</h2>
        <p className="break-keep font-body text-[14px] text-[var(--t2)]">문제지에서 이 문항을 풀고, 고른 답을 눌러 주세요. 모르면 비워 두세요.</p>
        <div role="radiogroup" aria-label="고른 답" className="flex flex-wrap gap-2">
          {CIRCLED.map((c, k) => {
            const v = k + 1
            const on = chosen[item.id] === v
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={busy || sent}
                onClick={() => setChosen({ ...chosen, [item.id]: on ? null : v })}
                aria-label={`${v}번`}
                className={`${btn} min-w-[56px] justify-center text-[18px] font-[800] ${on ? 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]' : 'border-[var(--bd)] text-[var(--t1)]'}`}
              >
                {c}
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
              disabled={busy || sent}
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
      {error && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="font-body text-[14px] text-[var(--error-ink)]">{error}</p>
          <p className="break-keep font-body text-[13px] text-[var(--t2)]">「제출하고 진단 받기」를 다시 누르면 같은 답으로 다시 보내요.</p>
        </div>
      )}
    </div>
  )
}
