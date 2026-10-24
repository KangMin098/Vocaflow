// apps/web/src/components/csat/f08-proto/CandidateB.tsx
//
// 후보 B — 원문·선지·근거 병렬 비교. 다섯 선지가 **완성 명제**로 한 열에 서고, 고른 두 선지를
// 발문 조건별로 대조표에 나란히 놓는다. 학습 행동: 가까운 오답과 정답 후보를 같은 조건 앞에 세워 차이를 찾는다.
// 대가: 세 열이라 원문 칸이 좁아지고, 처음 보는 학습자에게 조작 요소가 한꺼번에 보인다.

'use client'

import { useState } from 'react'

import type { ProtoItem } from '@/lib/csat/f08-proto/types'

import {
  MarkButtons, Passage, PrincipleLimits, ProvenanceNote, RevealControl, ReturnButton, RevisionLog,
  SentenceChips, VerdictLine, btn, btnOn, completed, useReturn, useRevealRequest,
} from './parts'
import type { useProtoState } from './useProtoState'

const COND_LABEL = { met: '충족', unmet: '어긋남', unsure: '모름' } as const

export function CandidateB({ item, proto, fault }: { item: ProtoItem; proto: ReturnType<typeof useProtoState>; fault: string }) {
  const { state, dispatch } = proto
  const [focus, setFocus] = useState<number | null>(null)
  const { origin, jump, back } = useReturn()
  const reveal = useRevealRequest(item.itemId, fault, dispatch)

  return (
    <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,4fr)] gap-5" data-candidate="b">
      <main aria-label="원문" className="min-w-0">
        <p className="mb-2 text-sm font-medium">{item.stem}</p>
        <button type="button" aria-pressed={state.scopeOn} onClick={() => dispatch({ type: 'scope', on: !state.scopeOn })} className={`${btn} mb-2 ${state.scopeOn ? btnOn : ''}`}>
          부정·조건 범위 표시
        </button>
        {state.linking && state.activeChoice && (
          <p role="status" className="mb-2 rounded bg-[#efe9df] p-2 text-xs break-keep">{state.activeChoice}번 선지 근거로 묶을 문장을 고른다. 다시 누르면 풀린다.</p>
        )}
        <Passage item={item} state={state} dispatch={dispatch} focusSentence={focus} onSentence={setFocus} />
        <div className="mt-4"><ProvenanceNote item={item} /></div>
      </main>

      <section aria-labelledby="f08b-props" className="min-w-0">
        <h2 id="f08b-props" className="mb-2 text-sm font-semibold">완성 명제 다섯 개</h2>
        <ol className="space-y-2">
          {item.choices.map((_, i) => {
            const n = i + 1
            const inCompare = state.compare.includes(n)
            const linkingThis = state.linking && state.activeChoice === n
            return (
              <li key={n} className={`rounded-md border p-2 ${inCompare ? 'border-[#1f1d1a]' : 'border-[#e3ded5]'}`} data-testid={`prop-${n}`}>
                <p className="text-xs font-semibold">{n}번</p>
                <p lang="en" className="text-sm italic">…{completed(item, n)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button type="button" aria-pressed={inCompare} onClick={() => dispatch({ type: 'compare', n })} className={`${btn} text-xs ${inCompare ? btnOn : ''}`}>
                    {inCompare ? '대조 중' : '대조표에 놓기'}
                  </button>
                  <button
                    type="button"
                    aria-pressed={linkingThis}
                    onClick={() => {
                      dispatch({ type: 'choose', n: linkingThis ? null : n })
                      dispatch({ type: 'linking', on: !linkingThis })
                    }}
                    className={`${btn} text-xs ${linkingThis ? btnOn : ''}`}
                  >
                    {linkingThis ? '근거 고르기 끝' : '근거 문장 고르기'}
                  </button>
                </div>
                <div className="mt-1"><MarkButtons n={n} state={state} dispatch={dispatch} /></div>
                <div className="mt-1"><SentenceChips n={n} state={state} onJump={jump} /></div>
                {state.reveal && <VerdictLine reveal={state.reveal} n={n} state={state} />}
              </li>
            )
          })}
        </ol>
      </section>

      <section aria-labelledby="f08b-compare" className="sticky top-4 min-w-0 self-start text-sm break-keep">
        <h2 id="f08b-compare" className="mb-2 font-semibold">조건 대조표</h2>
        {state.compare.length < 2 ? (
          <p className="text-[#6b655c]">완성 명제 두 개를 대조표에 놓으면 발문 조건마다 나란히 판단한다. {state.compare.length === 1 ? `(${state.compare[0]}번 놓임)` : ''}</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">{state.compare.join('번과 ')}번 선지의 조건별 대조</caption>
            <thead>
              <tr><th scope="col" className="border-b p-1 text-left">조건</th>{state.compare.map((n) => <th key={n} scope="col" className="border-b p-1">{n}번</th>)}</tr>
            </thead>
            <tbody>
              {item.requirement.conditions.map((c, ci) => (
                <tr key={c}>
                  <th scope="row" className="border-b p-1 text-left align-top font-normal">{c}</th>
                  {state.compare.map((n) => {
                    const key = `${n}:${ci}`
                    return (
                      <td key={n} className="border-b p-1 align-top">
                        <div role="group" aria-label={`${n}번 · 조건 ${ci + 1}`} className="flex flex-col gap-1">
                          {(Object.keys(COND_LABEL) as (keyof typeof COND_LABEL)[]).map((v) => (
                            <button key={v} type="button" aria-pressed={state.conditions[key] === v} onClick={() => dispatch({ type: 'condition', key, value: v })} className={`${btn} min-h-[44px] text-xs ${state.conditions[key] === v ? btnOn : ''}`}>
                              {COND_LABEL[v]}
                            </button>
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row" className="p-1 text-left align-top font-normal">연결한 근거</th>
                {state.compare.map((n) => (
                  <td key={n} className="p-1 align-top">
                    {(state.links[n] ?? []).map((s) => <p key={s} lang="en" className="mb-1 border-l-2 border-[#c9c4bb] pl-1">{s}. {item.sentences[s - 1].slice(0, 90)}…</p>)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
        <div className="mt-4 space-y-3">
          <RevealControl {...reveal} revealed={!!state.reveal} />
          {state.reveal && (
            <>
              <p className="font-semibold" data-testid="answer-line">공식 정답 {state.reveal.answer}번</p>
              <PrincipleLimits reveal={state.reveal} />
              <RevisionLog state={state} />
            </>
          )}
        </div>
      </section>
      <ReturnButton origin={origin} back={back} />
    </div>
  )
}
