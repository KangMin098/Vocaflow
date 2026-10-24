// apps/web/src/components/csat/judgment/MoodTool.tsx
// R-MOOD 판단 도구 — 학습자가 원문 위에 전환점을 지정해 글을 앞 칸/뒤 칸으로 가르고, 칸마다 심경 신호(신체 반응·행동·감정어)의
// 극성·강도를 표시한 뒤, 선지 'A → B' 의 두 칸을 자기 신호와 나란히 대 본다. 공개 전에는 채점하지 않고, 해설은 요청 뒤에만 받는다.
'use client'

import { useMemo, useState } from 'react'
import type { JudgmentToolProps } from '@/lib/csat/judgment/types'
import { unitsAtIndex } from '@/lib/csat/judgment/evidence'
import {
  KIND_LABEL,
  compareChoices,
  contrastTurn,
  initialMood,
  segment,
  summarize,
  warningsOf,
  type ColumnSummary,
  type HalfVerdict,
  type MoodState,
  type Polarity,
  type Side,
  type SignalKind,
  type Strength,
  type Warning,
} from '@/lib/csat/judgment/r-mood'
import { EvidencePassage } from './EvidencePassage'
import { JudgmentShell, judgmentStyles as s } from './JudgmentShell'
import { RefText } from './RefText'
import { REVEAL_ERROR_TEXT, useReveal } from './useReveal'
import m from './MoodTool.module.css'

const SIDE_LABEL: Record<Side, string> = { before: '앞 칸', after: '뒤 칸' }
const pol = (p: Polarity) => (p === '+' ? '+' : '−')

const VERDICT_TEXT: Record<HalfVerdict, string> = {
  consistent: '내 신호와 같은 방향',
  conflict: '✕ 내 신호와 어긋남',
  'no-signal': '이 칸에 고른 신호 없음',
  unlabelled: '낱말 극성 미표시',
  'no-turn': '전환점 먼저',
  mixed: '칸 안 신호가 +·− 반반',
}

function warningText(w: Warning, nOf: (id: string) => number | undefined): string {
  switch (w.code) {
    case 'no-turn': return '전환점을 정하지 않으면 앞 칸·뒤 칸을 나눌 수 없다. 원문에서 심경이 바뀌는 문장을 고르고 「전환점으로 지정」.'
    case 'turn-signal': return `${nOf(w.unitId)}번 문장은 전환점이라 어느 칸에도 들어가지 않는다 — 이 문장의 신호는 비교에 쓰이지 않는다.`
    case 'empty': return `${SIDE_LABEL[w.side]}에 신호가 없다. 한 칸만 보고 선지를 고르면 「한 칸만 맞는 선지」 에 걸린다.`
    case 'single-word': return `${SIDE_LABEL[w.side]}을 감정어 하나로만 받치고 있다. 신체 반응·행동 신호로 같은 방향인지 확인해야 낱말 하나에 끌려가지 않는다.`
    case 'mixed': return `${SIDE_LABEL[w.side]}에 +와 − 신호가 섞였다. 전환점 앞 신호가 뒤 칸에(또는 반대로) 섞였는지 전환점 위치를 다시 보라. 전환이 점진적이면 이 칸 나누기 자체가 맞지 않을 수 있다.`
  }
}

export function MoodTool({ item, reveal }: JudgmentToolProps) {
  const [state, setState] = useState<MoodState>(initialMood)
  const [active, setActive] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Partial<{ kind: SignalKind; polarity: Polarity; strength: Strength }>>>({})
  const [refFocus, setRefFocus] = useState<string[] | null>(null)
  const { state: rv, request } = useReveal(item, reveal)
  const units = item.units
  const nOf = (id: string) => units.find((u) => u.id === id)?.n

  const seg = useMemo(() => segment(units, state.turn), [units, state.turn])
  const cols = useMemo(() => ({ before: summarize(state, seg.before), after: summarize(state, seg.after) }), [state, seg])
  const warnings = useMemo(() => warningsOf(units, state), [units, state])
  const comparisons = useMemo(() => compareChoices(units, item.choices, state), [units, item.choices, state])

  const pick = (id: string) => { setActive(id); setRefFocus(null) }
  const setSignal = (patch: Partial<{ kind: SignalKind; polarity: Polarity; strength: Strength }>) => {
    if (!active) return
    // 종류와 극성을 둘 다 고르기 전에는 신호로 세지 않는다 — 기본 극성을 몰래 넣으면 칸 합계가 학습자 판단이 아니게 된다
    const merged = { ...drafts[active], ...state.signals[active], ...patch }
    setDrafts((d) => ({ ...d, [active]: merged }))
    if (merged.kind && merged.polarity) {
      const sig = { kind: merged.kind, polarity: merged.polarity, strength: merged.strength ?? (1 as Strength) }
      setState((st) => ({ ...st, signals: { ...st.signals, [active]: sig } }))
    }
  }
  const clearSignal = () => {
    if (!active) return
    setState((st) => { const next = { ...st.signals }; delete next[active]; return { ...st, signals: next } })
    setDrafts((d) => { const next = { ...d }; delete next[active]; return next })
  }
  const setTurn = () => { if (active) setState((st) => ({ ...st, turn: st.turn === active ? null : active })) }
  const setWord = (key: string, p: Polarity) => setState((st) => {
    const next = { ...st.wordPolarity }
    if (next[key] === p) delete next[key]
    else next[key] = p
    return { ...st, wordPolarity: next }
  })

  const marks = Object.fromEntries(
    units.flatMap((u) => {
      const sig = state.signals[u.id]
      const parts = [state.turn === u.id ? '◆ 전환점' : '', sig ? `${pol(sig.polarity)}${sig.strength} ${KIND_LABEL[sig.kind]}` : ''].filter(Boolean)
      return parts.length ? [[u.id, parts.join(' · ')]] : []
    }),
  )
  const pinned = [...Object.keys(state.signals), ...(state.turn ? [state.turn] : [])]
  const focus = refFocus ?? (active ? [active] : [])
  const onRef = (id: string) => setRefFocus([id])
  const activeSig = active ? { ...drafts[active], ...state.signals[active] } : undefined
  const activeCounted = Boolean(active && state.signals[active])
  const activeUnit = units.find((u) => u.id === active)

  const column = (side: Side, c: ColumnSummary) => (
    <div className={m.col} key={side}>
      <h4>{SIDE_LABEL[side]}{seg.turnN !== null ? (side === 'before' ? ` (1~${seg.turnN - 1}번)` : ` (${seg.turnN + 1}~${units.length}번)`) : ''}</h4>
      <p className={m.sum}>
        {c.tone === 'none' ? '신호 없음' : `+${c.plus} / −${c.minus} → ${c.tone === 'mixed' ? (c.net === 0 ? '섞임(반반)' : `섞임, ${c.net > 0 ? '+' : '−'} 우세`) : c.tone === '+' ? '긍정(+)' : '부정(−)'}`}
      </p>
      <ul className={m.sigList}>
        {c.ids.map((id) => {
          const sg = state.signals[id]
          return (
            <li key={id}>
              <button type="button" className={`${s.button} ${m.sig}`} aria-pressed={active === id} onClick={() => pick(id)} aria-label={`${nOf(id)}번 문장 ${KIND_LABEL[sg.kind]} ${sg.polarity === '+' ? '긍정' : '부정'} 강도 ${sg.strength} — 원문에서 가리키기`}>
                {nOf(id)}번 · {KIND_LABEL[sg.kind]} · {pol(sg.polarity)}{sg.strength}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )

  const half = (key: string, word: string, v: HalfVerdict | undefined, label: string) => (
    <div className={m.half}>
      <span className={m.word} lang="en">{word}</span>
      <div className={m.pol} role="group" aria-label={`${label} ${word} 극성`}>
        {(['+', '-'] as const).map((p) => (
          <button key={p} type="button" className={s.button} aria-pressed={state.wordPolarity[key] === p} aria-label={`${word} 을(를) ${p === '+' ? '긍정' : '부정'}으로`} onClick={() => setWord(key, p)}>
            {pol(p)}
          </button>
        ))}
      </div>
      <span className={m.verdict} data-v={v}>{v ? VERDICT_TEXT[v] : ''}</span>
    </div>
  )

  const shown = rv.status === 'shown' ? rv.data : null
  const contrast = shown ? contrastTurn(units, state, shown) : null

  const judgment = (
    <div>
      <p className={m.lead}>원문 문장을 눌러 고른 뒤, 심경이 바뀌는 문장은 「전환점」 으로, 심경을 드러내는 문장은 신호(종류·극성·강도)로 표시한다. 순서는 자유다.</p>

      <div className={`${s.section} ${m.editor}`} aria-live="polite">
        <h3>고른 문장</h3>
        {!activeUnit ? (
          <p className={s.note}>원문에서 문장을 하나 고르면 여기서 표시한다(Tab 으로 이동, Enter/Space 로 고르기).</p>
        ) : (
          <>
            <p className={m.quote} lang="en"><strong>{activeUnit.n}번</strong> {activeUnit.text}</p>
            <div className={m.row}>
              <button type="button" className={s.button} aria-pressed={state.turn === activeUnit.id} onClick={setTurn} data-act="turn">
                {state.turn === activeUnit.id ? '◆ 전환점 해제' : '◆ 전환점으로 지정'}
              </button>
            </div>
            <p className={s.note}>{activeCounted ? '이 문장은 신호로 세어진다.' : '종류와 극성을 둘 다 고르면 신호로 세어진다.'}</p>
            <div className={m.row} role="group" aria-label="신호 종류">
              <span className={m.rowLabel}>종류</span>
              {(Object.keys(KIND_LABEL) as SignalKind[]).map((k) => (
                <button key={k} type="button" className={s.button} aria-pressed={activeSig?.kind === k} onClick={() => setSignal({ kind: k })} data-kind={k}>{KIND_LABEL[k]}</button>
              ))}
            </div>
            <div className={m.row} role="group" aria-label="극성">
              <span className={m.rowLabel}>극성</span>
              <button type="button" className={s.button} aria-pressed={activeSig?.polarity === '+'} onClick={() => setSignal({ polarity: '+' })} data-pol="+">+ 긍정</button>
              <button type="button" className={s.button} aria-pressed={activeSig?.polarity === '-'} onClick={() => setSignal({ polarity: '-' })} data-pol="-">− 부정</button>
            </div>
            <div className={m.row} role="group" aria-label="강도">
              <span className={m.rowLabel}>강도</span>
              <button type="button" className={s.button} aria-pressed={activeSig?.strength === 1} onClick={() => setSignal({ strength: 1 })}>약 1</button>
              <button type="button" className={s.button} aria-pressed={activeSig?.strength === 2} onClick={() => setSignal({ strength: 2 })}>강 2</button>
              {activeCounted && <button type="button" className={s.button} onClick={clearSignal}>신호 지우기</button>}
            </div>
          </>
        )}
      </div>

      <div className={s.section}>
        <h3>두 칸 — {seg.turnN === null ? '전환점 미지정' : `${seg.turnN}번 문장에서 나눔`}</h3>
        {seg.turnN !== null && <div className={m.cols}>{column('before', cols.before)}{column('after', cols.after)}</div>}
        <ul className={m.warn} aria-live="polite" data-warnings>
          {warnings.map((w, i) => <li key={i} data-warn={w.code}>{warningText(w, nOf)}</li>)}
        </ul>
      </div>

      <div className={s.section}>
        <h3>선지 두 칸 비교</h3>
        <p className={s.note}>선지 낱말마다 극성(+/−)을 매기면, 그 칸이 내가 표시한 신호와 같은 방향인지 나란히 보인다. 이것은 채점이 아니라 내 근거와의 일관성이다.</p>
        <div className={m.choices}>
          {comparisons.map(({ choice: c, before, after, single }) => (
            <div key={c.n} className={m.choice} data-choice={c.n}>
              <span className={m.choiceN}>{'①②③④⑤⑥'[c.n - 1] ?? c.n}</span>
              {c.shape === 'change' ? (
                <>
                  {half(`${c.n}:before`, c.before, before, `${c.n}번 앞 칸`)}
                  <span className={m.arrow} aria-hidden>→</span>
                  {half(`${c.n}:after`, c.after, after, `${c.n}번 뒤 칸`)}
                </>
              ) : (
                <>
                  {half(`${c.n}:single`, c.word, single, `${c.n}번`)}
                  <span />
                  <span className={s.note}>변화(→)가 없는 선지 — 글 전체 신호와 비교</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={s.section}>
        <h3>이 판단의 한계</h3>
        <p className={s.note}>감정이 한 문장에서 꺾이지 않고 서서히 바뀌거나, 겉말과 속뜻이 반대인 아이러니(예: 담담한 말투로 나쁜 소식을 전하는 장면)에서는 신호의 극성을 낱말 그대로 매기면 틀린다. 그럴 땐 전환점을 한 문장으로 못 박지 말고, 인물의 행동이 무엇에 대한 반응인지 본다.</p>
      </div>

      <div className={s.section}>
        <h3>해설</h3>
        {rv.status === 'hidden' && <button type="button" className={`${s.button} ${s.primary}`} onClick={request} data-act="reveal">해설 보기</button>}
        {rv.status === 'loading' && <p className={s.status} aria-live="polite">해설을 불러오는 중…</p>}
        {rv.status === 'error' && (
          <div aria-live="polite">
            <p className={s.error} data-reveal-error={rv.reason}>{REVEAL_ERROR_TEXT[rv.reason]}</p>
            {rv.reason === 'fetch' && <button type="button" className={s.button} onClick={request}>다시 시도</button>}
          </div>
        )}
        {shown && contrast && (
          <div aria-live="polite" data-revealed>
            <h4>내 전환점 ↔ 해설</h4>
            <p className={s.note}>
              {contrast.learnerN === null ? '전환점을 정하지 않았다. 아래 해설 근거 문장으로 칸을 나눠 볼 수 있다.' : `내 전환점: ${contrast.learnerN}번 문장.`}{' '}
              {contrast.revealTurnN.length ? `해설이 전환으로 짚은 문장: ${contrast.revealTurnN.map((n) => `${n}번`).join('·')}.` : '해설이 전환점 문장을 따로 짚지 않았다.'}{' '}
              {contrast.agree === true && '내 전환점이 해설의 전환 표지와 겹친다.'}
              {contrast.agree === false && '내 전환점이 해설의 전환 표지와 다르다 — 칸 나누기가 달라 신호가 다른 칸에 섞였을 수 있다.'}
            </p>
            {contrast.learnerN !== null && (
              <p className={s.note}>해설 근거 문장이 내 칸에 떨어지는 곳 — 앞 칸 {contrast.evidenceBefore.join('·') || '없음'} / 전환점 {contrast.evidenceAtTurn.join('·') || '없음'} / 뒤 칸 {contrast.evidenceAfter.join('·') || '없음'}</p>
            )}
            <div className={m.row}>
              <button type="button" className={s.button} onClick={() => setRefFocus(unitsAtIndex(shown.answerLocus?.sentence_index, units))}>해설 근거 문장 모두 원문에서 보기</button>
            </div>
            {shown.answerLocus?.reasoning && <p className={s.note}><RefText text={shown.answerLocus.reasoning} units={units} active={refFocus ?? []} onRef={onRef} /></p>}
            {shown.designIntent && <p className={s.hypothesis}><RefText text={shown.designIntent} units={units} active={refFocus ?? []} onRef={onRef} /></p>}
            <h4>선지별 — 내 비교와 나란히</h4>
            {shown.choices.map((c) => {
              const mine = comparisons.find((x) => x.choice.n === c.n)
              const mineText = mine?.conflicts.length ? `내 비교: ${mine.conflicts.map((x) => SIDE_LABEL[x]).join('·')} 어긋남` : '내 비교: 어긋난 칸 없음(또는 미표시)'
              return (
                <div key={c.n} className={m.revealChoice} data-reveal-choice={c.n}>
                  <strong>{'①②③④⑤⑥'[c.n - 1] ?? c.n} {c.verdict === 'correct' ? '정답' : `오답${c.trap ? ` · ${c.trap}` : ''}`}</strong>
                  <span className={s.note}>{mineText}</span>
                  <div>
                    {c.verdict === 'correct' ? (
                      <RefText text={c.why_correct} units={units} active={refFocus ?? []} onRef={onRef} />
                    ) : (
                      <>
                        {c.why_tempting && <div>끌리는 이유: <RefText text={c.why_tempting} units={units} active={refFocus ?? []} onRef={onRef} /></div>}
                        {c.how_to_reject && <div>걸러내는 근거: <RefText text={c.how_to_reject} units={units} active={refFocus ?? []} onRef={onRef} /></div>}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <JudgmentShell
      title={`${item.examId} ${item.no}번 · 심경·분위기`}
      stem={item.stem}
      evidence={<EvidencePassage units={units} focus={focus} pinned={pinned} onPick={pick} marks={marks} label="원문 — 문장을 골라 전환점·신호 표시" />}
      judgment={judgment}
    />
  )
}
