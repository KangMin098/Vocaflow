// apps/web/src/components/csat/f08-proto/CandidateC.tsx
//
// 후보 C — 원문·강의·판단 연동. 강의 큐(자막 원고)를 한 단계씩 넘기면 그 큐가 가리키는 문장이 원문에 표시되고,
// 아무 큐에서나 「여기서 멈추고 판단」으로 판단 칸에 넘어간다. 강의 위치·판단·스크롤은 전환해도 그대로다.
// 정답을 말하는 큐(c4 이후)는 공개 전에 오지 않는다 — 공개 전 강의는 과제·전략·구조 세 큐뿐이다.
// 대가: 강의 원고가 판단을 앞질러 결론을 말하면(이 문항의 c1 「지문이 거부하는 견해」) 학습자 판단을 끌고 간다.

'use client'

import { useState } from 'react'

import type { ProtoCue, ProtoItem } from '@/lib/csat/f08-proto/types'

import {
  MarkButtons, Passage, PrincipleLimits, ProvenanceNote, RevealControl, ReturnButton, RevisionLog,
  SentenceChips, VerdictLine, btn, btnOn, completed, useReturn, useRevealRequest,
} from './parts'
import type { useProtoState } from './useProtoState'

export function CandidateC({ item, proto, fault }: { item: ProtoItem; proto: ReturnType<typeof useProtoState>; fault: string }) {
  const { state, dispatch } = proto
  const [focus, setFocus] = useState<number | null>(null)
  const { origin, jump, back } = useReturn()
  const reveal = useRevealRequest(item.itemId, fault, dispatch)
  const mode = state.tool === 'judge' ? 'judge' : 'lecture'
  const lectureFailed = fault === 'lecture-fail' || item.lecture.state !== 'ready'
  const cues: ProtoCue[] = item.lecture.state === 'ready' ? [...item.lecture.cues, ...(state.reveal?.cues ?? [])] : []
  const cueIndex = Math.min(state.cue, Math.max(cues.length - 1, 0))
  const cue = cues[cueIndex]
  const locked = item.lecture.state === 'ready' && !state.reveal ? item.lecture.lockedCount : 0

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_420px] gap-8" data-candidate="c">
      <main aria-label="원문" className="min-w-0">
        <p className="mb-3 text-sm font-medium">{item.stem}</p>
        <div className="mb-3 flex gap-2">
          <button type="button" aria-pressed={state.scopeOn} onClick={() => dispatch({ type: 'scope', on: !state.scopeOn })} className={`${btn} ${state.scopeOn ? btnOn : ''}`}>
            부정·조건 범위 표시
          </button>
          {mode === 'judge' && state.activeChoice && (
            <button type="button" aria-pressed={state.linking} onClick={() => dispatch({ type: 'linking', on: !state.linking })} className={`${btn} ${state.linking ? btnOn : ''}`}>
              {state.linking ? '근거 연결 끝내기' : `${state.activeChoice}번 근거 문장 고르기`}
            </button>
          )}
        </div>
        <Passage item={item} state={state} dispatch={dispatch} focusSentence={focus} onSentence={setFocus} cueSentence={mode === 'lecture' && !lectureFailed ? cue?.sentence ?? null : null} large />
        <div className="mt-6"><ProvenanceNote item={item} /></div>
      </main>

      <aside aria-label="강의와 판단" className="sticky top-4 self-start text-sm break-keep">
        <div role="tablist" aria-label="강의·판단 전환" className="mb-3 flex gap-1">
          <button id="f08c-tab-lecture" role="tab" type="button" aria-selected={mode === 'lecture'} aria-controls="f08c-panel" onClick={() => dispatch({ type: 'tool', tool: 'lecture' })} className={`${btn} ${mode === 'lecture' ? btnOn : ''}`}>강의</button>
          <button id="f08c-tab-judge" role="tab" type="button" aria-selected={mode === 'judge'} aria-controls="f08c-panel" onClick={() => dispatch({ type: 'tool', tool: 'judge' })} className={`${btn} ${mode === 'judge' ? btnOn : ''}`}>내 판단</button>
        </div>
        <div id="f08c-panel" role="tabpanel" aria-labelledby={`f08c-tab-${mode}`} className="rounded-md border border-[var(--csat-edge)] bg-white p-4">
          {mode === 'lecture' && (lectureFailed ? (
            <div role="alert" className="space-y-2" data-testid="lecture-failed">
              <p className="font-semibold">강의를 불러오지 못했다</p>
              <p>원문과 판단 도구는 그대로 쓸 수 있다.</p>
              <button type="button" className={btn} onClick={() => dispatch({ type: 'tool', tool: 'judge' })}>판단으로 가기</button>
            </div>
          ) : cue ? (
            <div className="space-y-3">
              <p className="rounded bg-[#fff4d6] p-2 text-xs" role="note">검수 미확인 강의 원고(자막) — 음성 재생 없음. 판단 근거로는 원문을 본다.</p>
              <p className="text-xs text-[var(--csat-muted)]" aria-live="polite">강의 {cueIndex + 1}/{cues.length}{locked ? ` · 정답을 말하는 큐 ${locked}개는 공개 뒤에 열린다` : ''}</p>
              <div data-testid="cue-text">
                {cue.lines.map((l, i) => <p key={i} lang={l.lang === 'en-US' ? 'en' : 'ko'} className={l.lang === 'en-US' ? 'italic' : ''}>{l.text}</p>)}
              </div>
              {cue.sentence && (
                <button type="button" className={`${btn} text-xs`} onClick={() => jump(cue.sentence!)}>강의가 가리키는 {cue.sentence}번 문장 보기</button>
              )}
              <div className="flex gap-2">
                <button type="button" className={btn} disabled={cueIndex === 0} onClick={() => dispatch({ type: 'cue', index: cueIndex - 1 })}>이전 큐</button>
                <button type="button" className={btn} disabled={cueIndex >= cues.length - 1} onClick={() => dispatch({ type: 'cue', index: cueIndex + 1 })}>다음 큐</button>
                <button type="button" className={`${btn} ${btnOn}`} onClick={() => dispatch({ type: 'tool', tool: 'judge' })}>여기서 멈추고 판단</button>
              </div>
            </div>
          ) : <p>이 문항에는 강의 원고가 없다.</p>)}

          {mode === 'judge' && (
            <div className="space-y-3">
              {!lectureFailed && cues.length > 0 && <p className="text-xs text-[var(--csat-muted)]">강의는 {cueIndex + 1}번째 큐에 멈춰 있다.</p>}
              <div role="group" aria-label="빈칸에 넣을 선지" className="flex flex-wrap gap-1">
                {item.choices.map((_, i) => (
                  <button key={i} type="button" aria-pressed={state.activeChoice === i + 1} onClick={() => dispatch({ type: 'choose', n: state.activeChoice === i + 1 ? null : i + 1 })} className={`${btn} ${state.activeChoice === i + 1 ? btnOn : ''}`}>{i + 1}번</button>
                ))}
              </div>
              {state.activeChoice && (
                <>
                  <p lang="en" className="rounded bg-[var(--csat-hover)] p-2 italic">…{completed(item, state.activeChoice)}</p>
                  <MarkButtons n={state.activeChoice} state={state} dispatch={dispatch} />
                  <SentenceChips n={state.activeChoice} state={state} onJump={jump} />
                  {state.reveal && <VerdictLine reveal={state.reveal} n={state.activeChoice} state={state} />}
                </>
              )}
              <details>
                <summary className="cursor-pointer rounded py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--csat-accent)]">발문 요구·조건</summary>
                <p className="mt-1">{item.requirement.requested}</p>
                <ol className="mt-1 list-decimal pl-4">{item.requirement.conditions.map((c) => <li key={c}>{c}</li>)}</ol>
              </details>
              <RevealControl {...reveal} revealed={!!state.reveal} />
              {state.reveal && (
                <>
                  <p className="font-semibold" id="f08-answer" tabIndex={-1} data-testid="answer-line">공식 정답 {state.reveal.answer}번 · 강의 해설 큐가 열렸다</p>
                  <PrincipleLimits reveal={state.reveal} />
                  <RevisionLog state={state} />
                </>
              )}
            </div>
          )}
        </div>
      </aside>
      <ReturnButton origin={origin} back={back} />
    </div>
  )
}
