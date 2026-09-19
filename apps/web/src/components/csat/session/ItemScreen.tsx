'use client'

// apps/web/src/components/csat/session/ItemScreen.tsx
//
// **한 문항 = 한 화면.** ① 풀기 → ② 이해 → ③ 한 줄. 열이 하나다.
//
//   ① 풀기  발문 · 지문(reflow) · 선지 카드 5 · 작은 타이머. 카드를 누르면 곧바로 정오.
//   ② 이해  같은 화면이 살아난다 — 근거 문장 밑줄(누르면 바로 아래 설명) · 오답 카드를 누르면
//           「왜 아닌지」 한 줄 + 관련 문장으로 스크롤 · 함정 마커 하나 · [강의 듣기] · [더 보기]
//   ③ 한 줄 「다음에 이 유형: …」 + [알겠어요] [헷갈려요]
//
// ⚠️ 답을 고르기 전에는 해설 데이터가 **브라우저에 없다** — 고르는 순간 `/api/csat/session/reveal`
//    을 부른다(지시문 A4 · DECISIONS D9). 그래서 ① 의 DOM 에는 밑줄도 설명도 있을 수가 없다.
// ⚠️ 시간은 재되 몰아붙이지 않는다 — 권장 시간을 넘겨도 색이 그대로다(CLAUDE.md 빨간 글씨 압박 금지).
// ⚠️ 틀린 답은 빨강이 아니다 — 흑연색(`--learn-error`) + ✕ 아이콘 + 「고른 답」 글자(3중 · 색 단독 금지).

import { Check, ChevronDown, Headphones, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { LecturePlayerBar } from '@/components/csat/lecture/LecturePlayerBar'
import { LectureStage, useLecture, useLectureFocus } from '@/components/csat/lecture/LectureStage'
import { track } from '@/lib/analytics/client'
import { toItemSlug } from '@/lib/csat/item-slug'
import type { ReflowItem } from '@/lib/csat/reflow/types'
import type { CatalogItem } from '@/lib/csat/session/model'
import { buildPassageModel, type PassageModel } from '@/lib/csat/session/passage-model'
import type { RevealPayload } from '@/lib/csat/session/reveal'

import { PlainPassage, RevealedPassage, type SentenceNote } from './ReflowPassage'
import { PRIMARY } from './SessionHome'
import styles from './session.module.css'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']
/** 기본으로 단추가 되는 설명 수 — 나머지는 [더 보기](지시문 B) */
export const NOTE_LIMIT = 5

const SECONDARY =
  'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-5 text-[17px] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--t2)] active:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

export interface ItemResult {
  correct: boolean | null
  confused: boolean
  sec: number
}

const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 부드럽게 한 번. reduced-motion 이면 즉시 — 그래도 **간다**. */
function scrollToSentence(i: number) {
  const el = document.querySelector<HTMLElement>(`[data-sentence="${i}"]`)
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
}

/**
 * 문장 → 설명. **근거 먼저, 고른 오답, 나머지 오답, 함정** 순으로 5개까지.
 * 한 문장에 설명이 여럿이면 앞 순서의 것 하나만 — 문장 하나에 단추 하나.
 */
export function buildNotes(
  model: PassageModel,
  reveal: RevealPayload,
  picked: number | null,
): { notes: Map<number, SentenceNote>; extra: SentenceNote[]; trap: { sentence: number; note: SentenceNote } | null } {
  const ordered: { sentence: number; note: SentenceNote }[] = []
  const firstOf = (pred: (m: { anchorId: string; kind: string; choice: number | null }) => boolean) =>
    model.sentences.find((s) => s.marks.some(pred))?.i ?? null

  const ev = firstOf((m) => m.kind === 'evidence')
  if (ev !== null && reveal.evidence.text) {
    ordered.push({ sentence: ev, note: { kind: 'evidence', title: '여기가 근거예요', body: reveal.evidence.text } })
  }
  const byN = new Map(reveal.distractors.map((d) => [d.n, d]))
  const rejectOrder = [...reveal.distractors.map((d) => d.n)].sort((a, b) => (a === picked ? -1 : b === picked ? 1 : a - b))
  for (const n of rejectOrder) {
    const d = byN.get(n)
    if (!d?.line) continue
    const at = firstOf((m) => m.kind === 'reject' && m.choice === n)
    if (at === null) continue
    ordered.push({ sentence: at, note: { kind: 'reject', title: `${CIRCLED[n]} 이 아닌 이유`, body: d.line } })
  }

  // 함정 마커 — 하나만. 고른 오답의 미끼 자리가 있으면 그것
  let trap: { sentence: number; note: SentenceNote } | null = null
  for (const n of rejectOrder) {
    const d = byN.get(n)
    if (!d?.tempting) continue
    const at = firstOf((m) => m.kind === 'tempt' && m.choice === n)
    if (at === null) continue
    trap = { sentence: at, note: { kind: 'tempt', title: `함정${d.trap ? ` · ${d.trap}` : ''} (${CIRCLED[n]})`, body: d.tempting } }
    break
  }

  const notes = new Map<number, SentenceNote>()
  const extra: SentenceNote[] = []
  for (const o of ordered) {
    if (!notes.has(o.sentence) && notes.size < NOTE_LIMIT) notes.set(o.sentence, o.note)
    else extra.push(o.note)
  }
  return { notes, extra, trap }
}

export function ItemScreen({
  item,
  typeName,
  seq,
  total,
  paper,
  crop,
  review,
  onDone,
}: {
  item: CatalogItem
  typeName: string
  seq: number
  total: number
  /** 복습 칸으로 온 문항인가 — 계측에만 쓴다 */
  review: boolean
  /** reflow 결과 — 없으면(`ok=false`) 크롭 그림으로 */
  paper: ReflowItem
  crop: string | null
  onDone: (r: ItemResult) => void
}) {
  const t0 = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [skipped, setSkipped] = useState(false)
  const [reveal, setReveal] = useState<RevealPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [solvedAt, setSolvedAt] = useState<number | null>(null)

  useEffect(() => {
    if (reveal) return
    const id = window.setInterval(() => setElapsed((Date.now() - t0.current) / 1000), 1000)
    return () => window.clearInterval(id)
  }, [reveal])

  const submit = useCallback(
    async (n: number | null) => {
      if (loading || reveal) return
      setPicked(n)
      setSkipped(n === null)
      setLoading(true)
      setError(null)
      const sec = (Date.now() - t0.current) / 1000
      try {
        const res = await fetch('/api/csat/session/reveal', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ item: toItemSlug(item.id) }),
        })
        const json = (await res.json()) as { ok: boolean; error?: string } & RevealPayload
        if (!json.ok) throw new Error(json.error ?? '해설을 불러오지 못했어요')
        setReveal(json)
        setSolvedAt(sec)
        setElapsed(sec)
        const correct = n !== null && json.answer === n
        track({
          name: 'csat_session_answered',
          props: { seq, correct, skipped: n === null, sec: Math.round(sec), review },
        })
      } catch (e) {
        setPicked(null)
        setSkipped(false)
        setError(e instanceof Error ? e.message : '해설을 불러오지 못했어요')
      } finally {
        setLoading(false)
      }
    },
    [item.id, loading, reveal, seq, review],
  )

  // 키보드 — 1~5 로 바로 고른다(카드도 Tab 으로 닿는다)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reveal || e.altKey || e.ctrlKey || e.metaKey) return
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (/^[1-5]$/.test(e.key)) void submit(Number(e.key))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reveal, submit])

  const correct = reveal ? picked !== null && reveal.answer === picked : null
  const body = (
    <div className="flex flex-col gap-5" data-testid="item-screen" data-phase={reveal ? 'understand' : 'solve'}>
      <header className="flex items-start justify-between gap-3" data-lecture-target="analysis:head">
        <div className="min-w-0">
          <p className="font-mono text-[14px] tabular-nums text-[var(--t3)]" aria-label={`${total}문항 중 ${seq}번째`}>
            {seq} / {total}
          </p>
          <p className="mt-0.5 break-keep text-[14px] text-[var(--t3)]">
            {typeName}
            {item.points ? ` · ${item.points}점` : ''}
          </p>
        </div>
        <p className="shrink-0 font-mono text-[14px] tabular-nums text-[var(--t3)]" aria-label={`푼 시간 ${mmss(elapsed)}`}>
          {mmss(elapsed)}
        </p>
      </header>

      {paper.stem ? (
        <h2 className="break-keep font-body text-[17px] font-[600] leading-relaxed text-[var(--t1)]" data-testid="stem">
          {paper.stem}
        </h2>
      ) : null}

      {paper.ok ? (
        reveal ? (
          <Understand reveal={reveal} paper={paper} picked={picked} />
        ) : (
          <PlainPassage passage={paper.passage} />
        )
      ) : crop ? (
        // 글로 못 뽑은 문항 — 종이 그대로(2.5배). 설명은 아래 카드 목록으로 간다(지시문 C6)
        // eslint-disable-next-line @next/next/no-img-element -- 이 탭 메모리의 data URL 이다(최적화 대상 아님)
        <img src={crop} alt={`${seq}번째 문항 문제지 부분`} className="w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-white" />
      ) : (
        <p className="break-keep text-[16px] text-[var(--t2)]">이 문항은 문제지를 한 번 더 놓아야 보여 드릴 수 있어요.</p>
      )}

      {paper.notes.length ? (
        <ul className="flex flex-col gap-0.5 font-body text-[14px] text-[var(--t3)]">
          {paper.notes.map((n) => (
            <li key={n}>* {n}</li>
          ))}
        </ul>
      ) : null}

      <Choices
        paper={paper}
        picked={picked}
        reveal={reveal}
        loading={loading}
        onPick={(n) => void submit(n)}
      />

      {error ? (
        <p role="status" className="break-keep text-[15px] text-[var(--t2)]">
          {error} — 다시 골라 주세요.
        </p>
      ) : null}

      {!reveal ? (
        <button
          type="button"
          onClick={() => void submit(null)}
          disabled={loading}
          className="self-center min-h-[44px] px-3 text-[15px] text-[var(--t3)] underline decoration-[var(--bd)] underline-offset-4 transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] disabled:opacity-40 motion-reduce:transition-none"
        >
          모르겠어요 · 답 보기
        </button>
      ) : (
        <>
          <Verdict correct={correct} skipped={skipped} picked={picked} answer={reveal.answer} sec={solvedAt ?? elapsed} />
          {!paper.ok || !reveal.skeleton ? <NoteCards reveal={reveal} /> : null}
          <More reveal={reveal} />
          <OneLine
            text={reveal.one_liner}
            onMark={(confused) => {
              track({ name: 'csat_session_marked', props: { seq, confused, correct: correct === true } })
              onDone({ correct: skipped ? null : correct, confused, sec: solvedAt ?? elapsed })
            }}
          />
        </>
      )}
    </div>
  )

  return reveal?.lecture ? (
    <LectureStage slug={toItemSlug(item.id)} meta={reveal.lecture}>
      {body}
    </LectureStage>
  ) : (
    body
  )
}

/** ② 이해 — 밑줄 친 지문 + 설명 + 강의 */
function Understand({ reveal, paper, picked }: { reveal: RevealPayload; paper: ReflowItem; picked: number | null }) {
  const model = useMemo(() => buildPassageModel(paper.passage, reveal.skeleton), [paper.passage, reveal.skeleton])
  const { notes, extra, trap } = useMemo(() => buildNotes(model, reveal, picked), [model, reveal, picked])
  const [open, setOpen] = useState<number | null>(null)
  const [flash, setFlash] = useState<number | null>(null)
  const focus = useLectureFocus()

  // 강의가 말한 골격 문장 → reflow 문장
  const lit = useMemo(
    () => (focus ? model.sentences.filter((s) => s.skeleton.some((k) => focus.includes(k))).map((s) => s.i) : []),
    [focus, model],
  )

  // 오답 카드가 「관련 문장으로」를 요청하면 여기로 온다
  useEffect(() => {
    const onGo = (e: Event) => {
      const n = (e as CustomEvent<number>).detail
      const at = model.choiceSentence[n] ?? model.symbolSentence[n]
      if (at === undefined) return
      scrollToSentence(at)
      setFlash(at)
      window.setTimeout(() => setFlash((f) => (f === at ? null : f)), 1200)
    }
    window.addEventListener('csat:goto-choice', onGo)
    return () => window.removeEventListener('csat:goto-choice', onGo)
  }, [model])

  const allNotes = trap && !notes.has(trap.sentence) ? new Map([...notes, [trap.sentence, trap.note]]) : notes

  return (
    <div className="flex flex-col gap-3" data-testid="understand">
      <LectureButton />
      <RevealedPassage
        model={model}
        notes={allNotes}
        openSentence={open}
        flashSentence={flash}
        litSentences={lit}
        onToggle={(i) => {
          setOpen((o) => (o === i ? null : i))
          const kind = allNotes.get(i)?.kind
          if (kind && open !== i) track({ name: 'csat_session_explained', props: { kind } })
        }}
      />
      {/* Gate 4 — 「물결 밑줄은 함정 자리예요 — 눌러 보세요」 안내 줄을 뺐다. 마커(물결 밑줄)가 이미
          누를 수 있는 모양이고, 눌렀을 때 제목이 「함정 · …」이라고 말한다. 설명을 설명하는 줄이었다. */}
      {extra.length || model.unplaced.length ? <ExtraNotes notes={extra} /> : null}
    </div>
  )
}

function LectureButton() {
  const lec = useLecture()
  if (!lec) return null
  if (lec.status === 'idle') {
    return (
      <button
        type="button"
        onClick={() => {
          track({ name: 'csat_session_explained', props: { kind: 'lecture' } })
          lec.start(0, 'start')
        }}
        className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 text-[15px] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--t2)] active:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] motion-reduce:transition-none"
        data-testid="lecture-start"
      >
        <Headphones aria-hidden className="h-4 w-4" />
        강의 듣기 <span className="font-mono tabular-nums text-[var(--t3)]">{mmss(lec.meta.sec)}</span>
      </button>
    )
  }
  return <LecturePlayerBar />
}

/** 선지 카드 5장. 기호 선지 유형은 카드에 번호만 — 기호가 지문 안에 있다. */
function Choices({
  paper,
  picked,
  reveal,
  loading,
  onPick,
}: {
  paper: ReflowItem
  picked: number | null
  reveal: RevealPayload | null
  loading: boolean
  onPick: (n: number) => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const texts = paper.choices.length === 5 ? paper.choices : null
  const inline = !texts

  return (
    <ol className={inline ? 'grid grid-cols-5 gap-2' : 'flex flex-col gap-2'} aria-label="선지" data-testid="choices">
      {[1, 2, 3, 4, 5].map((n) => {
        const isAnswer = reveal?.answer === n
        const isPicked = picked === n
        const d = reveal?.distractors.find((x) => x.n === n) ?? null
        const state = !reveal ? 'idle' : isAnswer ? 'answer' : isPicked ? 'wrong' : 'other'
        const tone =
          state === 'answer'
            ? 'border-[var(--success)] bg-[var(--success-light)] text-[var(--t1)]'
            : state === 'wrong'
              ? 'border-[var(--learn-error)] bg-[var(--learn-error-light)] text-[var(--t1)]'
              : state === 'other'
                ? 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)]'
                : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--t2)] active:bg-[var(--bg3)]'
        const label = `${CIRCLED[n]}${texts ? ` ${texts[n - 1]}` : ''}`
        const expandable = Boolean(reveal && (d?.line || (isAnswer && reveal.why_correct.text)))
        return (
          <li key={n} className={inline && open === n ? 'col-span-5' : ''} data-lecture-target={reveal && !isAnswer ? `analysis:reject:${n}` : reveal && isAnswer ? 'analysis:answer' : undefined}>
            <button
              type="button"
              disabled={loading || (Boolean(reveal) && !expandable)}
              aria-pressed={reveal ? undefined : isPicked}
              aria-expanded={reveal && expandable ? open === n : undefined}
              data-choice={n}
              data-state={state}
              onClick={() => {
                if (!reveal) return onPick(n)
                const next = open === n ? null : n
                setOpen(next)
                if (next !== null) {
                  track({ name: 'csat_session_explained', props: { kind: isAnswer ? 'evidence' : 'reject' } })
                  window.dispatchEvent(new CustomEvent('csat:goto-choice', { detail: n }))
                }
              }}
              className={`${reveal && (isAnswer || isPicked) ? styles.verdict : ''} flex min-h-[48px] w-full items-center gap-2 rounded-[var(--r-md)] border px-3 py-2.5 text-left transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] disabled:cursor-default motion-reduce:transition-none ${tone} ${inline ? 'justify-center' : ''}`}
            >
              <span className={`min-w-0 flex-1 break-keep ${texts && /[A-Za-z]{3}/.test(texts[n - 1]) ? 'font-english' : 'font-body'} text-[17px] leading-snug ${inline ? 'text-center' : ''}`}>
                {label}
              </span>
              {state === 'answer' ? (
                <span className="flex shrink-0 items-center gap-1 text-[13px] font-[600] text-[var(--success-ink)]">
                  <Check aria-hidden className="h-4 w-4" />
                  {inline ? <span className="sr-only">정답</span> : '정답'}
                </span>
              ) : state === 'wrong' ? (
                <span className="flex shrink-0 items-center gap-1 text-[13px] font-[600] text-[var(--learn-error-ink)]">
                  <X aria-hidden className="h-4 w-4" />
                  {inline ? <span className="sr-only">고른 답</span> : '고른 답'}
                </span>
              ) : null}
              {expandable && !inline ? (
                <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-[var(--t3)] ${open === n ? 'rotate-180' : ''}`} />
              ) : null}
            </button>
            {reveal && open === n ? (
              <p
                className={`${styles.reveal} mt-1 break-keep border-l-2 border-[var(--bd)] pl-3 font-body text-[16px] leading-[1.65] text-[var(--t1)]`}
                data-testid="choice-note"
              >
                {isAnswer ? reveal.why_correct.text : d?.line}
              </p>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function Verdict({
  correct,
  skipped,
  picked,
  answer,
  sec,
}: {
  correct: boolean | null
  skipped: boolean
  picked: number | null
  answer: number | null
  sec: number
}) {
  if (answer == null) return null
  return (
    <p role="status" className={`${styles.verdict} break-keep font-editorial text-[17px] text-[var(--t1)]`} data-testid="verdict">
      {skipped
        ? `답은 ${CIRCLED[answer]} 이에요. 근거 문장부터 같이 봐요.`
        : correct
          ? `맞았어요 · ${mmss(sec)}`
          : `${CIRCLED[picked ?? 0]} 을 골랐어요. 답은 ${CIRCLED[answer]} — 밑줄 친 문장을 눌러 보세요.`}
    </p>
  )
}

/** 인라인으로 못 붙인 설명(추출 실패 · 골격 없음) — 카드 목록 */
function NoteCards({ reveal }: { reveal: RevealPayload }) {
  const cards: SentenceNote[] = [
    ...(reveal.evidence.text ? [{ kind: 'evidence' as const, title: '근거', body: reveal.evidence.text }] : []),
    ...reveal.distractors
      .filter((d) => d.line)
      .map((d) => ({ kind: 'reject' as const, title: `${CIRCLED[d.n]} 이 아닌 이유`, body: d.line })),
  ].slice(0, NOTE_LIMIT)
  return (
    <ul className="flex flex-col gap-2" data-testid="note-cards">
      {cards.map((c) => (
        <li key={c.title} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
          <p className="text-[14px] font-[600] text-[var(--t2)]">{c.title}</p>
          <p className="mt-1 break-keep text-[16px] leading-[1.65] text-[var(--t1)]">{c.body}</p>
        </li>
      ))}
    </ul>
  )
}

function ExtraNotes({ notes }: { notes: SentenceNote[] }) {
  if (!notes.length) return null
  return (
    <details className="group rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-3 text-[15px] text-[var(--t2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] [&::-webkit-details-marker]:hidden">
        설명 {notes.length}개 더
        <ChevronDown aria-hidden className="h-4 w-4 group-open:rotate-180" />
      </summary>
      <ul className="flex flex-col gap-2 px-3 pb-3">
        {notes.map((n) => (
          <li key={n.title}>
            <p className="text-[14px] font-[600] text-[var(--t2)]">{n.title}</p>
            <p className="break-keep text-[16px] leading-[1.65] text-[var(--t1)]">{n.body}</p>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** [더 보기] — 재는 힘 · 출제 의도 · 절차 · 어휘. 강의가 가리키면 무대가 연다. */
function More({ reveal }: { reveal: RevealPayload }) {
  const { ability, intent, procedure, vocab } = reveal.more
  if (!ability && !intent && !procedure.length && !vocab.length) return null
  return (
    <details
      className="group rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) track({ name: 'csat_session_explained', props: { kind: 'more' } })
      }}
      data-testid="more"
    >
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-3 text-[15px] text-[var(--t2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] [&::-webkit-details-marker]:hidden">
        더 보기
        <ChevronDown aria-hidden className="h-4 w-4 group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3 text-[16px] leading-[1.65] text-[var(--t1)]">
        {ability ? (
          <p className="break-keep" data-lecture-target="analysis:ability">
            <span className="block text-[14px] font-[600] text-[var(--t2)]">이 문항이 재는 힘</span>
            {ability}
          </p>
        ) : null}
        {intent ? (
          <p className="break-keep" data-lecture-target="analysis:intent">
            <span className="block text-[14px] font-[600] text-[var(--t2)]">출제 의도</span>
            {intent}
          </p>
        ) : null}
        {procedure.length ? (
          <div data-lecture-target="analysis:procedure">
            <p className="text-[14px] font-[600] text-[var(--t2)]">다시 풀 때의 순서</p>
            <ol className="mt-1 list-decimal pl-5">
              {procedure.map((p, i) => (
                <li key={i} className="break-keep">
                  {p}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {vocab.length ? (
          <div data-lecture-target="analysis:vocab">
            <p className="text-[14px] font-[600] text-[var(--t2)]">이 문항이 요구한 낱말</p>
            <p className="mt-1 font-english">{vocab.join(' · ')}</p>
          </div>
        ) : null}
      </div>
    </details>
  )
}

/** ③ 한 줄 + [알겠어요] [헷갈려요] */
function OneLine({ text, onMark }: { text: string | null; onMark: (confused: boolean) => void }) {
  return (
    <section aria-labelledby="oneline-h" className="mt-2 border-t border-[var(--bd)] pt-4" data-testid="one-line">
      <h3 id="oneline-h" className="text-[14px] font-[500] text-[var(--t3)]">
        다음에 이 유형을 만나면
      </h3>
      <p className="mt-1 break-keep font-editorial text-[18px] leading-relaxed text-[var(--t1)]">
        {text ?? '근거 문장을 먼저 찾고, 선지를 그 문장에 대 본다'}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" className={PRIMARY} onClick={() => onMark(false)} data-testid="mark-ok">
          알겠어요
        </button>
        <button type="button" className={SECONDARY} onClick={() => onMark(true)} data-testid="mark-confused">
          헷갈려요
        </button>
      </div>
    </section>
  )
}
