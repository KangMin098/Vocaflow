// apps/web/src/components/csat/f08-proto/CandidateA.tsx
//
// 후보 A — 원문 중심 + 판단 도구 선택. 원문이 화면 중심을 차지하고, 오른쪽 도구 막대에서 **한 번에 하나**만 펼친다.
// 학습 행동: 읽다가 막힌 지점에서 필요한 도구를 스스로 고른다(요구 확인 → 범위 표시 → 선지 대입 → 판단).
// 대가: 두 선지를 동시에 보지 못한다 — 가까운 오답 비교는 선지를 번갈아 넣어 보는 왕복으로만 된다.

'use client'

import { useState } from 'react'

import type { ProtoItem } from '@/lib/csat/f08-proto/types'

import {
  MarkButtons, Passage, PrincipleLimits, ProvenanceNote, RevealControl, ReturnButton, RevisionLog, SentenceChips,
  VerdictLine, btn, btnOn, completed, useReturn, useRevealRequest,
} from './parts'
import type { useProtoState } from './useProtoState'

const TOOLS = [
  { id: 'task', label: '발문 요구·조건' },
  { id: 'choice', label: '선지 넣어 보기' },
  { id: 'reveal', label: '정답·해설' },
] as const

export function CandidateA({ item, proto, fault }: { item: ProtoItem; proto: ReturnType<typeof useProtoState>; fault: string }) {
  const { state, dispatch } = proto
  const [focus, setFocus] = useState<number | null>(null)
  const { origin, jump, back } = useReturn()
  const reveal = useRevealRequest(item.itemId, fault, dispatch)
  const meaningsHere = item.meanings.filter((m) => m.sentence === focus)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-8" data-candidate="a">
      <main aria-label="원문" className="mx-auto max-w-[70ch]">
        <p className="mb-3 text-sm font-medium text-[#3d3a35]">{item.stem}</p>
        <div className="mb-3 flex items-center gap-2">
          <button type="button" aria-pressed={state.scopeOn} onClick={() => dispatch({ type: 'scope', on: !state.scopeOn })} className={`${btn} ${state.scopeOn ? btnOn : ''}`}>
            부정·조건 범위 표시
          </button>
          {state.activeChoice && (
            <button type="button" aria-pressed={state.linking} onClick={() => dispatch({ type: 'linking', on: !state.linking })} className={`${btn} ${state.linking ? btnOn : ''}`}>
              {state.linking ? `${state.activeChoice}번 근거 연결 중 — 끝내기` : `${state.activeChoice}번 선지 근거 문장 고르기`}
            </button>
          )}
        </div>
        <Passage item={item} state={state} dispatch={dispatch} focusSentence={focus} onSentence={setFocus} large />
        {focus && meaningsHere.length > 0 && (
          <aside aria-label={`${focus}번 문장 표현 풀이`} className="mt-4 rounded-md border border-[#e3ded5] bg-[#faf8f4] p-3 text-sm break-keep">
            {meaningsHere.map((m) => (
              <p key={m.id}><span lang="en" className="font-medium">{m.expression}</span> — {m.meaningKo}{m.scopeNote && <span className="block text-xs text-[#6b655c]">{m.scopeNote}</span>}</p>
            ))}
          </aside>
        )}
        <div className="mt-6"><ProvenanceNote item={item} /></div>
      </main>

      <aside aria-label="판단 도구" className="sticky top-4 self-start">
        <div role="tablist" aria-label="도구 하나 고르기" className="mb-3 flex flex-wrap gap-1">
          {TOOLS.map((t) => (
            <button key={t.id} id={`f08a-tab-${t.id}`} role="tab" type="button" aria-selected={state.tool === t.id} aria-controls="f08a-tool" onClick={() => dispatch({ type: 'tool', tool: state.tool === t.id ? null : t.id })} className={`${btn} ${state.tool === t.id ? btnOn : ''}`}>
              {t.label}
            </button>
          ))}
        </div>
        {state.tool && (
          <div id="f08a-tool" role="tabpanel" aria-labelledby={`f08a-tab-${state.tool}`} className="rounded-md border border-[#c9c4bb] bg-white p-4 text-sm break-keep">
            {state.tool === 'task' && (
              <div className="space-y-2">
                <p className="font-semibold">발문이 요구하는 것</p>
                <p>{item.requirement.requested}</p>
                <p className="font-semibold">확인할 조건</p>
                <ol className="list-decimal space-y-1 pl-4">{item.requirement.conditions.map((c) => <li key={c}>{c}</li>)}</ol>
                <p className="text-xs text-[#6b655c]">읽을 범위: {item.requirement.readingScope}</p>
              </div>
            )}
            {state.tool === 'choice' && (
              <div className="space-y-3">
                <div role="group" aria-label="빈칸에 넣을 선지" className="flex flex-wrap gap-1">
                  {item.choices.map((_, i) => (
                    <button key={i} type="button" aria-pressed={state.activeChoice === i + 1} onClick={() => dispatch({ type: 'choose', n: state.activeChoice === i + 1 ? null : i + 1 })} className={`${btn} ${state.activeChoice === i + 1 ? btnOn : ''}`}>
                      {i + 1}번
                    </button>
                  ))}
                </div>
                {state.activeChoice ? (
                  <>
                    <p lang="en" className="rounded bg-[#faf8f4] p-2 italic">…{completed(item, state.activeChoice)}</p>
                    <MarkButtons n={state.activeChoice} state={state} dispatch={dispatch} />
                    <SentenceChips n={state.activeChoice} state={state} onJump={jump} />
                    {state.reveal && <VerdictLine reveal={state.reveal} n={state.activeChoice} state={state} />}
                  </>
                ) : <p className="text-[#6b655c]">선지를 고르면 원문 빈칸에 들어가 완성 명제로 읽힌다.</p>}
              </div>
            )}
            {state.tool === 'reveal' && (
              <div className="space-y-3">
                <RevealControl {...reveal} revealed={!!state.reveal} />
                {state.reveal && (
                  <>
                    <p className="font-semibold" data-testid="answer-line">공식 정답 {state.reveal.answer}번</p>
                    <p className="text-xs text-[#6b655c]">선지별 판정은 「선지 넣어 보기」에서 선지마다 본다.</p>
                    <PrincipleLimits reveal={state.reveal} />
                    <RevisionLog state={state} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
      <ReturnButton origin={origin} back={back} />
    </div>
  )
}
