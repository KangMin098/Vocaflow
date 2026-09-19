'use client'

// apps/web/src/components/csat/session/ReflowPassage.tsx
//
// **지문이 곧 인터페이스다.** 학습자 PDF 에서 뽑은 지문을 큰 글자로 다시 흘려 넣고, 답을 고른 뒤에는
// 근거 문장에 밑줄을 긋는다. 문장을 누르면 **바로 아래** 설명이 열린다(지시문 A7 — 좌우 2열 금지).
//
// ── 어떻게 「바로 아래」에 여나 ────────────────────────────────────────
// 문단은 한 흐름(inline)이라 문장 사이에 블록을 끼울 수 없다. 그래서 **열린 문장에서 문단을 쪼갠다**:
// 앞 문장들(한 <p>) → 설명(블록) → 뒤 문장들(한 <p>). 닫으면 다시 한 문단이다.
//
// ── 무엇이 DOM 에 있는가 ──────────────────────────────────────────────
// 답을 고르기 전(`model` 이 null)에는 밑줄·단추·설명이 **하나도 없다** — 평범한 글이다(A4).
//
// ⚠️ 강의 타깃(`anchor:sentence:k`)은 **골격 번호**다. reflow 문장과 번호가 다를 수 있어
//    정렬 결과(`PassageSentence.skeleton`)로 붙인다(`lib/csat/reflow/align.ts`).

import { Fragment } from 'react'

import { segmentsOf, type MarkKind, type PassageModel, type PassageSentence } from '@/lib/csat/session/passage-model'
import { splitSentences } from '@/lib/csat/passage-skeleton'

import styles from './session.module.css'

/** 문장 하나에 붙는 설명(화면이 정한 순서대로 최대 5개가 단추가 된다) */
export interface SentenceNote {
  kind: MarkKind
  title: string
  body: string
}

export const PASSAGE_TEXT =
  'font-english text-[18px] leading-[1.65] text-[var(--t1)] sm:text-[19px] break-words'

// 밑줄 셋 — 근거 자리만 주묵(앱이 지면에 남기는 표식)이고, 나머지 둘은 무채색 점선·물결이다.
// 주묵은 학습자에 대한 평가가 아니다(docs/design/03-system.md §주묵을 쓰지 않는 자리).
const MARK_CLASS: Record<MarkKind, string> = {
  evidence: 'underline decoration-[var(--ju)] decoration-2 underline-offset-[5px]',
  reject: 'underline decoration-[var(--t2)] decoration-dotted decoration-2 underline-offset-[5px]',
  tempt: 'underline decoration-[var(--t3)] decoration-wavy decoration-1 underline-offset-[5px]',
}

function paragraphs<T extends { breakBefore: boolean }>(xs: T[]): T[][] {
  const out: T[][] = []
  for (const s of xs) {
    if (!out.length || s.breakBefore) out.push([])
    out[out.length - 1].push(s)
  }
  return out
}

/** 답을 고르기 전 — 글만. 문단 나눔만 살린다. */
export function PlainPassage({ passage }: { passage: string }) {
  const bounds = splitSentences(passage)
  const sents = bounds.map((b, i) => ({
    text: passage.slice(b.start, b.end),
    breakBefore: i > 0 && /\n\s*\n/.test(passage.slice(bounds[i - 1].end, b.start)),
  }))
  return (
    <div className={`${PASSAGE_TEXT} flex max-w-[65ch] flex-col gap-4`} lang="en" data-testid="passage">
      {paragraphs(sents).map((p, k) => (
        <p key={k}>{p.map((s) => s.text).join(' ')}</p>
      ))}
    </div>
  )
}

function Sentence({
  s,
  note,
  open,
  flash,
  lit,
  onToggle,
}: {
  s: PassageSentence
  note: SentenceNote | null
  open: boolean
  flash: boolean
  lit: boolean
  onToggle: () => void
}) {
  const kinds: MarkKind[] = note ? ['evidence', 'reject', 'tempt'] : []
  const body = segmentsOf(s, kinds).map((seg, i) =>
    seg.marked ? (
      <span key={i} className={MARK_CLASS[seg.marked]}>
        {seg.text}
      </span>
    ) : (
      <Fragment key={i}>{seg.text}</Fragment>
    ),
  )
  const tone = `${flash ? 'bg-[var(--ju-light)]' : ''} ${lit ? 'bg-[var(--bg3)]' : ''} rounded-[2px] transition-colors duration-[var(--dur-normal)] motion-reduce:transition-none`

  // ⚠️ `<button>` 을 쓰지 않는다 — 버튼은 `display:inline` 을 받아 주지 않고(inline-block 으로 선다)
  //    긴 문장이 **한 줄을 통째로 차지해** 문단이 문장마다 끊겼다(실측 2026-09-17 · 375px).
  //    글 흐름 안의 단추는 `span[role=button]` + Enter/Space 로 만든다.
  let inner = note ? (
    <span
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      aria-expanded={open}
      aria-controls={`note-${s.i}`}
      data-sentence={s.i}
      data-note-kind={note.kind}
      className={`cursor-pointer [-webkit-box-decoration-break:clone] [box-decoration-break:clone] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ju)] ${tone}`}
    >
      {body}
    </span>
  ) : (
    <span data-sentence={s.i} className={tone}>
      {body}
    </span>
  )
  // 강의가 가리키는 골격 문장 — 대응이 여럿이면 감싸기를 겹친다(한 요소에 속성 하나뿐이라)
  for (const k of [...s.skeleton].reverse()) {
    inner = <span data-lecture-target={`anchor:sentence:${k}`}>{inner}</span>
  }
  return inner
}

export function RevealedPassage({
  model,
  notes,
  openSentence,
  flashSentence,
  litSentences,
  onToggle,
}: {
  model: PassageModel
  /** 문장 번호 → 설명. 여기 없는 문장은 단추가 아니다 */
  notes: Map<number, SentenceNote>
  openSentence: number | null
  flashSentence: number | null
  /** 강의가 지금 말하는 문장(reflow 번호) */
  litSentences: number[]
  onToggle: (i: number) => void
}) {
  return (
    <div className={`${PASSAGE_TEXT} flex max-w-[65ch] flex-col gap-4`} lang="en" data-testid="passage" data-lecture-target="analysis:map">
      {paragraphs(model.sentences).map((para, k) => {
        // 열린 문장이 이 문단에 있으면 거기서 쪼갠다
        const cut = para.findIndex((s) => s.i === openSentence)
        const chunks = cut < 0 ? [para] : [para.slice(0, cut + 1), para.slice(cut + 1)]
        return (
          <Fragment key={k}>
            {chunks.map((chunk, c) =>
              chunk.length ? (
                <Fragment key={c}>
                  <p>
                    {chunk.map((s, j) => (
                      <Fragment key={s.i}>
                        {j > 0 ? ' ' : null}
                        <Sentence
                          s={s}
                          note={notes.get(s.i) ?? null}
                          open={openSentence === s.i}
                          flash={flashSentence === s.i}
                          lit={litSentences.includes(s.i)}
                          onToggle={() => onToggle(s.i)}
                        />
                      </Fragment>
                    ))}
                  </p>
                  {c === 0 && cut >= 0 ? <NotePanel id={`note-${openSentence}`} note={notes.get(openSentence!)!} /> : null}
                </Fragment>
              ) : null,
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

const NOTE_TONE: Record<MarkKind, string> = {
  evidence: 'border-[var(--ju)]',
  reject: 'border-[var(--t2)]',
  tempt: 'border-[var(--t3)]',
}

function NotePanel({ id, note }: { id: string; note: SentenceNote }) {
  if (!note) return null
  return (
    <div
      id={id}
      role="region"
      aria-label={note.title}
      data-testid="sentence-note"
      className={`${styles.reveal} -mt-1 border-l-2 ${NOTE_TONE[note.kind]} bg-[var(--bg2)] py-2 pl-3 pr-2 font-body not-italic`}
      lang="ko"
    >
      <p className="text-[14px] font-[600] text-[var(--t2)]">{note.title}</p>
      <p className="mt-1 break-keep text-[16px] leading-[1.65] text-[var(--t1)]">{note.body}</p>
    </div>
  )
}
