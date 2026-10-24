// apps/web/src/components/csat/f08-proto/parts.tsx
//
// 세 후보가 공유하는 부품. 원문 문장은 모두 버튼이다 — 근거 연결 중이면 고른 선지에 문장을 묶고,
// 아니면 그 문장을 「지금 보는 문장」으로 둔다. 색만으로 상태를 말하지 않게 굵기·밑줄·글자 표지를 함께 쓴다.

'use client'

import { useCallback, useState } from 'react'

import type { ProtoItem, ProtoMeaning, ProtoReveal } from '@/lib/csat/f08-proto/types'
import { MARK_LABEL, type OwnMark } from '@/lib/csat/f08-proto/types'

import type { Action, ProtoState } from './useProtoState'

export const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]'
export const btn = `min-h-[44px] rounded-md border border-[#c9c4bb] bg-white px-3 text-sm text-[#1f1d1a] hover:bg-[#f4f1ec] ${focusRing}`
// btn 의 bg-white 가 CSS 순서상 이겨 눌린 버튼이 흰 바탕 흰 글자로 사라졌다 — 켜짐 상태는 important 로 덮는다.
export const btnOn = '!border-[#1f1d1a] !bg-[#1f1d1a] !text-white hover:!bg-[#33302b]'

const SCOPE_LABEL: Record<string, string> = { negation: '부정 범위', condition: '조건·한정' }

export function sentenceId(n: number) {
  return `f08-s${n}`
}

function withScope(text: string, meanings: ProtoMeaning[]) {
  const marks = meanings.filter((m) => m.scope !== 'none' && text.includes(m.expression))
  if (!marks.length) return [text]
  const out: React.ReactNode[] = []
  let rest = text
  for (const m of marks) {
    const i = rest.indexOf(m.expression)
    if (i < 0) continue
    out.push(rest.slice(0, i))
    out.push(
      <mark key={m.id} className={m.scope === 'negation' ? 'bg-[#fde9c8] font-semibold underline decoration-2' : 'bg-[#dbeafe] underline decoration-dotted decoration-2'}>
        {m.expression}
        <span className="ml-1 align-super text-[10px] font-medium no-underline">[{SCOPE_LABEL[m.scope]}]</span>
      </mark>,
    )
    rest = rest.slice(i + m.expression.length)
  }
  out.push(rest)
  return out
}

export function Passage({
  item, state, dispatch, focusSentence, onSentence, cueSentence, large,
}: {
  item: ProtoItem
  state: ProtoState
  dispatch: (a: Action) => void
  focusSentence: number | null
  onSentence: (n: number) => void
  cueSentence?: number | null
  large?: boolean
}) {
  const active = state.activeChoice
  const linked = active ? state.links[active] ?? [] : []
  return (
    <div className={`leading-[1.9] text-[#1f1d1a] ${large ? 'text-[19px]' : 'text-[17px]'}`} lang="en">
      {item.sentences.map((s, i) => {
        const n = i + 1
        const isBlank = n === item.blankSentence
        const parts = isBlank ? s.split('______') : [s]
        const isLinked = linked.includes(n)
        const isFocus = focusSentence === n
        const isCue = cueSentence === n
        return (
          <button
            key={n}
            id={sentenceId(n)}
            type="button"
            aria-pressed={state.linking && active ? isLinked : undefined}
            onClick={() => {
              if (state.linking && active) dispatch({ type: 'toggleLink', n: active, sentence: n })
              onSentence(n)
            }}
            className={`mr-1 inline rounded px-0.5 text-left ${focusRing} ${isLinked ? 'border-b-2 border-[#1f1d1a] bg-[#efe9df]' : ''} ${isFocus ? 'outline outline-1 outline-[#8a8278]' : ''} ${isCue ? 'bg-[#fff4d6] shadow-[inset_3px_0_0_#b5803a]' : ''}`}
          >
            <sup className="mr-0.5 select-none font-sans text-[11px] text-[#6b655c]" aria-hidden>{n}</sup>
            <span className="sr-only" lang="ko">{n}번 문장{isLinked ? ' (근거로 연결됨)' : ''}{isCue ? ' (강의가 가리키는 문장)' : ''}: </span>
            {isBlank ? (
              <>
                {state.scopeOn ? withScope(parts[0], item.meanings) : parts[0]}
                <span className="mx-1 inline-block min-w-[6em] border-b-2 border-dashed border-[#1f1d1a] px-1 font-medium" aria-label={active ? `빈칸에 ${active}번 선지를 넣어 봄` : '빈칸'}>
                  {active ? item.choices[active - 1] : ' '}
                </span>
                {parts[1]}
              </>
            ) : state.scopeOn ? withScope(s, item.meanings) : s}
          </button>
        )
      })}
    </div>
  )
}

/** 빈칸에 선지를 넣은 완성 명제 — 「cannot be」가 선지 전체를 부정한다는 것을 문장으로 보게 한다. */
export function completed(item: ProtoItem, n: number) {
  const s = item.sentences[item.blankSentence - 1]
  const tail = s.slice(s.lastIndexOf('then'))
  return tail.replace('______', item.choices[n - 1])
}

export function MarkButtons({ n, state, dispatch }: { n: number; state: ProtoState; dispatch: (a: Action) => void }) {
  return (
    <div role="group" aria-label={`${n}번 선지에 대한 내 판단`} className="flex flex-wrap gap-1">
      {(Object.keys(MARK_LABEL) as OwnMark[]).map((m) => (
        <button key={m} type="button" aria-pressed={state.marks[n] === m} onClick={() => dispatch({ type: 'mark', n, mark: m })} className={`${btn} ${state.marks[n] === m ? btnOn : ''} text-xs`}>
          {state.marks[n] === m ? '✓ ' : ''}{MARK_LABEL[m]}
        </button>
      ))}
    </div>
  )
}

export function SentenceChips({ n, state, onJump }: { n: number; state: ProtoState; onJump: (s: number) => void }) {
  const linked = state.links[n] ?? []
  if (!linked.length) return <p className="text-xs text-[#6b655c]">연결한 근거 문장 없음</p>
  return (
    <ul className="flex flex-wrap gap-1" aria-label={`${n}번 선지 근거 문장`}>
      {linked.map((s) => (
        <li key={s}><button type="button" onClick={() => onJump(s)} className={`${btn} text-xs`}>{s}번 문장으로</button></li>
      ))}
    </ul>
  )
}

/** 원문으로 갔다가 판단하던 자리로 돌아오기. */
export function useReturn() {
  const [origin, setOrigin] = useState<HTMLElement | null>(null)
  const jump = useCallback((sentence: number) => {
    const from = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    const el = document.getElementById(sentenceId(sentence))
    if (!el) return
    setOrigin(from)
    el.scrollIntoView({ block: 'center' })
    el.focus()
  }, [])
  const back = useCallback(() => {
    if (!origin) return
    const el = origin.isConnected ? origin : null
    el?.scrollIntoView({ block: 'center' })
    el?.focus()
    setOrigin(null)
  }, [origin])
  return { origin, jump, back }
}

export function ReturnButton({ origin, back }: { origin: HTMLElement | null; back: () => void }) {
  if (!origin) return null
  return (
    <button type="button" onClick={back} className={`${btn} fixed bottom-6 left-1/2 z-30 -translate-x-1/2 shadow-lg`} data-testid="return-to-judgment">
      판단하던 자리로 돌아가기
    </button>
  )
}

export type RevealStatus = 'idle' | 'confirm' | 'loading' | 'refused' | 'error'

export function useRevealRequest(itemId: string, fault: string, dispatch: (a: Action) => void) {
  const [status, setStatus] = useState<RevealStatus>('idle')
  const request = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/dev/f08-reveal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, confirm: true, fault }),
      })
      if (res.status === 403) return setStatus('refused')
      if (!res.ok) return setStatus('error')
      const { reveal } = (await res.json()) as { reveal: ProtoReveal }
      dispatch({ type: 'reveal', reveal })
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }, [itemId, fault, dispatch])
  return { status, setStatus, request }
}

export function RevealControl({ status, setStatus, request, revealed }: ReturnType<typeof useRevealRequest> & { revealed: boolean }) {
  if (revealed) return null
  return (
    <div className="space-y-2" aria-live="polite">
      {status === 'idle' && (
        <button type="button" className={btn} onClick={() => setStatus('confirm')}>정답·해설 보기</button>
      )}
      {status === 'confirm' && (
        <div className="rounded-md border border-[#c9c4bb] bg-[#faf8f4] p-3 text-sm">
          <p className="break-keep">정답과 선지별 판정이 열린다. 지금까지 남긴 판단은 그대로 두고 나중에 고칠 수 있다.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={`${btn} ${btnOn}`} onClick={request}>공개하기</button>
            <button type="button" className={btn} onClick={() => setStatus('idle')}>아직 안 본다</button>
          </div>
        </div>
      )}
      {status === 'loading' && <p className="text-sm">불러오는 중…</p>}
      {status === 'refused' && (
        <div role="alert" className="rounded-md border border-[#9c3a30] bg-[#fbeeec] p-3 text-sm break-keep">
          <p className="font-semibold">공개가 거절됐다</p>
          <p>이 문항의 정답 공개가 지금 허용되지 않는다. 원문·조건·내 판단 도구는 계속 쓸 수 있다.</p>
          <button type="button" className={`${btn} mt-2`} onClick={() => setStatus('idle')}>닫기</button>
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="rounded-md border border-[#9c3a30] bg-[#fbeeec] p-3 text-sm break-keep">
          <p className="font-semibold">해설을 불러오지 못했다</p>
          <p>남긴 판단은 저장돼 있다.</p>
          <button type="button" className={`${btn} mt-2`} onClick={request}>다시 시도</button>
        </div>
      )}
    </div>
  )
}

const TRUTH_LABEL = { true: '지문과 맞음', false: '지문과 어긋남', unknown: '지문이 다루지 않음' }

export function VerdictLine({ reveal, n, state }: { reveal: ProtoReveal; n: number; state: ProtoState }) {
  const v = reveal.verdicts.find((x) => x.n === n)
  if (!v) return null
  const mine = state.marks[n]
  const agrees = mine && mine !== 'unsure' ? (mine === 'fits') === v.isAnswer : null
  return (
    <div className="mt-2 rounded-md border-l-4 border-[#1f1d1a] bg-[#faf8f4] p-2 text-sm break-keep" data-testid={`verdict-${n}`}>
      <p className="font-semibold">{v.isAnswer ? '정답' : '오답'} · 완성 명제: {TRUTH_LABEL[v.truth]} · 근거 {v.sentences.join('·')}번 문장</p>
      <p className="mt-1">{v.decisive}</p>
      {mine && <p className="mt-1 text-xs text-[#6b655c]">내 판단: {MARK_LABEL[mine]}{agrees === null ? '' : agrees ? ' — 판정과 같은 쪽' : ' — 판정과 다른 쪽(고칠 수 있다)'}</p>}
    </div>
  )
}

export function PrincipleLimits({ reveal }: { reveal: ProtoReveal }) {
  return (
    <section aria-labelledby="f08-principle" className="space-y-2 text-sm break-keep">
      <h3 id="f08-principle" className="font-semibold">출제 원리와 그 한계</h3>
      <p>{reveal.principle.statement}</p>
      <div className="grid grid-cols-2 gap-3">
        <div><p className="text-xs font-semibold">통하는 경우</p><ul className="list-disc pl-4">{reveal.principle.whenApplies.map((t) => <li key={t}>{t}</li>)}</ul></div>
        <div><p className="text-xs font-semibold">통하지 않는 경우</p><ul className="list-disc pl-4">{reveal.principle.whenNot.map((t) => <li key={t}>{t}</li>)}</ul></div>
      </div>
      <p className="text-xs text-[#6b655c]">확인할 수 없는 것: {reveal.limitation}</p>
    </section>
  )
}

export function RevisionLog({ state }: { state: ProtoState }) {
  const after = state.revisions.filter((r) => r.afterReveal)
  if (!after.length) return null
  return (
    <p className="text-xs text-[#6b655c]" data-testid="revision-log">
      공개 뒤 고친 판단 {after.length}건: {after.map((r) => `${r.n}번 ${r.from ? MARK_LABEL[r.from] : '없음'}→${MARK_LABEL[r.to]}`).join(' · ')}
    </p>
  )
}

export function ProvenanceNote({ item }: { item: ProtoItem }) {
  return (
    <p className="text-[11px] text-[#6b655c]">
      원문 csat_items {item.itemId} 스냅숏(sha256 {item.provenance.passageSha256.slice(0, 12)}) · 분석 v{item.provenance.analysisVersion} {item.provenance.review} · units {item.provenance.unitsHash}
    </p>
  )
}
