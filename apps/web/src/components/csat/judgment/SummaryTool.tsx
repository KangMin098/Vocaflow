// apps/web/src/components/csat/judgment/SummaryTool.tsx
// R-SUMMARY 판단 도구 — (A)·(B) 칸 후보어를 따로 고르고, 후보어마다 지지/반박 문장을 이어
// 극성 반전 · 범위 과대 · 낱말 재사용을 대조한다. 공개 전 채점 없음, 해설은 학습자가 요청할 때만.
'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { JudgmentToolProps, RevealData } from '@/lib/csat/judgment/types'
import {
  candidatesOf, choiceOfCombo, compareWithReveal, flagsOf, initialState, keyOf, link, linksOf, parseChoices, pick, setPolarity,
  summaryParts, summarySource, type Flag, type Polarity, type Relation, type Slot,
} from '@/lib/csat/judgment/r-summary'
import { EvidencePassage } from './EvidencePassage'
import { JudgmentShell, judgmentStyles as js } from './JudgmentShell'
import { RefText } from './RefText'
import { REVEAL_ERROR_TEXT, revealBinding, useReveal } from './useReveal'
import s from './SummaryTool.module.css'

const SLOTS: Slot[] = ['A', 'B']
const POL: { v: Polarity; label: string; sym: string }[] = [
  { v: 'pos', label: '긍정', sym: '+' },
  { v: 'neg', label: '부정', sym: '−' },
  { v: 'neutral', label: '중립', sym: '○' },
]
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥']

const FLAG_TEXT: Record<Flag['kind'], { title: string; why: string; limit: string }> = {
  polarity: {
    title: '극성 반전 확인',
    why: '반대 극성의 두 후보가 같은 문장을 근거로 쓴다. 그 문장의 결과(did better / did worse 같은)가 요약문 주어의 결과인지, 비교 대상의 결과인지 갈라 보라.',
    limit: '극성이 같아도 비교 방향(more … than)이 뒤집히면 틀린다 — 극성만으로 결론 내리지 않는다.',
  },
  scope: {
    title: '범위 과대 확인',
    why: '지지 근거가 한 문장뿐이다. 일부 실험 결과·한 사례를 요약문 전체 주장으로 넓히고 있지 않은지, 다른 문장도 같은 쪽을 가리키는지 더 이어 보라.',
    limit: '핵심 결론 문장 하나가 실제로 글 전체를 묶는 글도 있다 — 개수가 아니라 그 문장이 무엇을 대표하는지 본다.',
  },
  reuse: {
    title: '원문 낱말 재사용',
    why: '이 후보어(또는 같은 어간)가 원문에 그대로 나온다. 같은 낱말이라는 사실은 근거가 아니다 — 그 문장에서 그 낱말이 누구에 대해, 어떤 방향으로 쓰였는지 확인하라.',
    limit: '요약문은 보통 원문을 바꿔 말한다. 그렇다고 그대로 나온 낱말이 늘 함정인 것도 아니다.',
  },
  split: {
    title: '지지와 반박이 함께 있다',
    why: '같은 후보어에 지지·반박 문장이 모두 이어졌다. 어느 문장이 요약문 주어(이 글의 비교 대상 중 어느 쪽)에 대한 말인지 정리하라.',
    limit: '반박 문장이 비교 대상(반대쪽 집단)에 대한 말이면 오히려 지지가 된다.',
  },
}

function SummaryToolBody({ item, reveal }: JudgmentToolProps) {
  const src = useMemo(() => summarySource(item.units), [item.units])
  const cands = useMemo(() => candidatesOf(item.choices), [item.choices])
  const parsedOk = useMemo(() => parseChoices(item.choices) !== null, [item.choices])
  const [st, setSt] = useState(initialState)
  const [active, setActive] = useState<{ slot: Slot; word: string } | null>(null)
  const [rel, setRel] = useState<Relation>('support')
  const [focus, setFocus] = useState<string[]>([])
  const { state: rv, request } = useReveal(item, reveal)

  const activeKey = active ? keyOf(active.slot, active.word) : null
  const sup = activeKey ? linksOf(st, activeKey, 'support') : []
  const ref = activeKey ? linksOf(st, activeKey, 'refute') : []
  const marks: Record<string, ReactNode> = {}
  for (const id of sup) marks[id] = '＋지지'
  for (const id of ref) marks[id] = '－반박'

  const nOf = (id: string) => item.units.find((u) => u.id === id)?.n
  const point = (ids: string[]) => setFocus(ids)
  const onPick = (unitId: string) => {
    if (!activeKey) return
    setSt((x) => link(x, activeKey, unitId, rel))
  }
  const choose = (slot: Slot, word: string) => {
    setSt((x) => pick(x, slot, word))
    setActive({ slot, word })
  }
  const combo = choiceOfCombo(item.choices, st.pick.A, st.pick.B)

  const evidence = (
    <>
      <EvidencePassage units={src.evidence} focus={focus} pinned={[...sup, ...ref]} marks={marks} onPick={activeKey ? onPick : undefined} label="원문 — 근거 문장" />
      {src.shells.length > 0 && <p className={js.note}>{src.shells.map((id) => `${nOf(id)}번`).join('·')} 단위는 표의 「(A) (B)」 머리만 남은 추출 조각이라 근거에서 뺐다.</p>}
    </>
  )

  const judgment = (
    <div className={s.root}>
      <section aria-label="요약문">
        <h3 className={s.h}>요약문</h3>
        {src.summary ? (
          <>
            <p className={s.summary} data-summary>
              {summaryParts(src.summary.text).map((p, i) =>
                p.kind === 'text' ? <span key={i}>{p.text}</span> : (
                  <span key={i} className={s.slot} data-slot={p.slot} data-filled={st.pick[p.slot] ? 'yes' : 'no'}>
                    ({p.slot}) {st.pick[p.slot] ?? '_____'}
                  </span>
                ),
              )}
            </p>
            <p className={js.note}>요약문은 추출 자료에서 {nOf(src.summary.fromUnit)}번 단위 뒤에 붙어 있던 문장을 떼어 냈다. 원문 그대로이고 고쳐 쓰지 않았다.</p>
          </>
        ) : (
          <p className={js.empty} data-summary-gap>
            이 문항은 요약문 문장 전문이 자료에 없다(원문 단위에 「(A) (B)」 껍데기만 남음). 요약문을 지어내지 않고, 칸별 후보어와 원문 근거의 의미 대응으로만 판단한다.
          </p>
        )}
      </section>

      {!parsedOk ? (
        <p className={js.error}>선지를 (A)·(B) 칸으로 나눌 수 없어(구분자 결함) 후보어 비교를 보여 주지 않는다.</p>
      ) : (
        <section className={js.section} aria-label="칸별 후보어">
          <h3>칸별 후보어 — 칸마다 따로 고른다</h3>
          <p className={js.note}>후보를 누르면 그 칸에 들어가고, 그 후보에 근거를 잇는 대상이 된다. 다섯 조합을 통째로 고를 필요는 없다.</p>
          <div className={s.cols}>
            {SLOTS.map((slot) => (
              <div key={slot} role="group" aria-label={`(${slot}) 칸 후보`}>
                <div className={s.colHead}>({slot})</div>
                {cands[slot].map((w) => {
                  const k = keyOf(slot, w)
                  const nS = linksOf(st, k, 'support').length, nR = linksOf(st, k, 'refute').length
                  const pol = st.notes[k]?.polarity
                  return (
                    <button
                      key={w}
                      type="button"
                      className={`${js.button} ${s.cand}`}
                      data-cand={k}
                      aria-pressed={st.pick[slot] === w}
                      data-active={activeKey === k ? 'yes' : undefined}
                      aria-label={`(${slot}) ${w}${st.pick[slot] === w ? ' · 칸에 넣음' : ''} · 지지 ${nS} · 반박 ${nR}${pol ? ` · ${POL.find((p) => p.v === pol)?.label}` : ''}`}
                      onClick={() => choose(slot, w)}
                    >
                      <span className={s.word}>{w}</span>
                      <span className={s.counts} aria-hidden>
                        {pol ? POL.find((p) => p.v === pol)?.sym + ' ' : ''}＋{nS} －{nR}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {active && activeKey && (
        <section className={js.section} aria-label="후보어 근거 잇기" data-workbench>
          <h3>({active.slot}) {active.word} — 근거 잇기</h3>
          <div className={s.row} role="group" aria-label="잇는 관계">
            <button type="button" className={js.button} aria-pressed={rel === 'support'} data-rel="support" onClick={() => setRel('support')}>＋ 지지로 잇기</button>
            <button type="button" className={js.button} aria-pressed={rel === 'refute'} data-rel="refute" onClick={() => setRel('refute')}>－ 반박으로 잇기</button>
          </div>
          <p className={js.note}>원문 문장을 누르거나(Enter/Space) 고른 관계로 이어진다. 다시 누르면 떼어진다.</p>
          <div className={s.row} role="group" aria-label="이 후보어의 극성">
            <span className={s.label}>극성</span>
            {POL.map((p) => (
              <button key={p.v} type="button" className={js.button} data-pol={p.v} aria-pressed={st.notes[activeKey]?.polarity === p.v} onClick={() => setSt((x) => setPolarity(x, activeKey, p.v))}>
                {p.sym} {p.label}
              </button>
            ))}
          </div>
          <LinkList title="지지" ids={sup} nOf={nOf} focus={focus} onPoint={point} />
          <LinkList title="반박" ids={ref} nOf={nOf} focus={focus} onPoint={point} />
          <Flags flags={flagsOf(st, active.slot, active.word, cands[active.slot], src.evidence)} nOf={nOf} focus={focus} onPoint={point} />
        </section>
      )}

      {parsedOk && (
        <section className={js.section} aria-label="조합 위치">
          <h3>내 조합이 선지 어디에 있나</h3>
          <p className={js.status} aria-live="polite" data-combo={combo ?? ''}>
            {st.pick.A && st.pick.B ? (combo ? `(A) ${st.pick.A} · (B) ${st.pick.B} = ${CIRCLED[combo - 1]}번 선지` : `(A) ${st.pick.A} · (B) ${st.pick.B} — 선지에 없는 조합이다`) : '두 칸을 모두 고르면 해당 선지를 표시한다(맞고 틀림은 아니다).'}
          </p>
          <ol className={s.choices}>
            {item.choices.map((c, i) => (
              <li key={i} data-choice={i + 1} aria-current={combo === i + 1 ? 'true' : undefined}>{CIRCLED[i]} {c}{combo === i + 1 ? ' ← 내 조합' : ''}</li>
            ))}
          </ol>
        </section>
      )}

      <section className={js.section} aria-label="해설">
        <h3>해설</h3>
        {rv.status !== 'shown' && (
          <button type="button" className={`${js.button} ${js.primary}`} data-reveal onClick={() => void request()} disabled={rv.status === 'loading'}>
            {rv.status === 'error' ? '해설 다시 불러오기' : '해설 보기'}
          </button>
        )}
        <p aria-live="polite" className={rv.status === 'error' ? js.error : js.status} data-reveal-status={rv.status}>
          {rv.status === 'loading' ? '해설을 불러오는 중' : rv.status === 'error' ? REVEAL_ERROR_TEXT[rv.reason] : rv.status === 'hidden' ? '풀지 않아도 바로 볼 수 있다.' : ''}
        </p>
        {rv.status === 'shown' && <RevealView data={rv.data} item={item} st={st} focus={focus} onPoint={point} />}
      </section>
    </div>
  )

  return <JudgmentShell title={`${item.examId} ${item.no}번 · 요약문 완성`} stem={item.stem} evidence={evidence} judgment={judgment} />
}

function LinkList({ title, ids, nOf, focus, onPoint }: { title: string; ids: string[]; nOf: (id: string) => number | undefined; focus: string[]; onPoint: (ids: string[]) => void }) {
  return (
    <div className={s.row} data-links={title}>
      <span className={s.label}>{title}</span>
      {ids.length === 0 ? <span className={js.note}>아직 없음</span> : ids.map((id) => (
        <button key={id} type="button" className={js.button} aria-pressed={focus.includes(id)} onClick={() => onPoint([id])}>{nOf(id)}번 문장</button>
      ))}
    </div>
  )
}

function Flags({ flags, nOf, focus, onPoint }: { flags: Flag[]; nOf: (id: string) => number | undefined; focus: string[]; onPoint: (ids: string[]) => void }) {
  if (flags.length === 0) return <p className={js.note}>대조 표지 없음 — 근거를 이을수록 극성·범위·낱말 재사용 대조가 나타난다.</p>
  return (
    <ul className={s.flags} aria-label="대조 표지">
      {flags.map((f, i) => (
        <li key={i} data-flag={f.kind}>
          <strong>{FLAG_TEXT[f.kind].title}{f.kind === 'polarity' ? ` — ${f.other} 와 같은 근거` : ''}</strong>
          <p className={js.note}>{FLAG_TEXT[f.kind].why}</p>
          <p className={js.note}><span className={s.label}>적용 한계</span> {FLAG_TEXT[f.kind].limit}</p>
          <button type="button" className={js.button} aria-pressed={f.unitIds.every((id) => focus.includes(id))} onClick={() => onPoint(f.unitIds)}>
            {f.unitIds.map((id) => `${nOf(id)}번`).join('·')} 문장 가리키기
          </button>
        </li>
      ))}
    </ul>
  )
}

function RevealView({ data, item, st, focus, onPoint }: { data: RevealData; item: JudgmentToolProps['item']; st: ReturnType<typeof initialState>; focus: string[]; onPoint: (ids: string[]) => void }) {
  const cmp = compareWithReveal(item, st, data)
  const nOf = (id: string) => item.units.find((u) => u.id === id)?.n
  const one = (id: string) => onPoint([id])
  return (
    <div data-reveal-body>
      <p className={s.answer}>정답 {CIRCLED[data.answer - 1]} {item.choices[data.answer - 1]}</p>
      <table className={s.cmp}>
        <thead><tr><th scope="col">칸</th><th scope="col">내 선택</th><th scope="col">해설</th><th scope="col">대조</th></tr></thead>
        <tbody>
          {SLOTS.map((slot) => (
            <tr key={slot}>
              <th scope="row">({slot})</th>
              <td>{st.pick[slot] ?? '고르지 않음'}</td>
              <td>{cmp.answerWords ? (slot === 'A' ? cmp.answerWords.a : cmp.answerWords.b) : '—'}</td>
              <td>{st.pick[slot] ? (cmp.slotMatch[slot] ? '= 같음' : '≠ 다름') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={js.note}>
        해설 근거 문장: {cmp.locus.map((id) => `${nOf(id)}번`).join('·') || '없음'}
        {' · '}내가 정답 후보어에 지지로 이은 것 중 겹침 {cmp.shared.length} · 해설엔 있으나 내가 잇지 않은 것 {cmp.missed.length}
      </p>
      {data.answerLocus?.reasoning && <p className={s.para}><RefText text={data.answerLocus.reasoning} units={item.units} active={focus} onRef={one} /></p>}
      {data.designIntent && <p className={js.hypothesis}>{data.designIntent}</p>}
      <ul className={s.revealChoices}>
        {data.choices.map((c) => (
          <li key={c.n} data-reveal-choice={c.n}>
            <strong>{CIRCLED[c.n - 1]} {item.choices[c.n - 1]} — {c.verdict === 'correct' ? '정답' : `오답${c.trap ? ` · ${c.trap}` : ''}`}</strong>
            {c.verdict === 'correct' ? (
              <p className={s.para}><RefText text={c.why_correct} units={item.units} active={focus} onRef={one} /></p>
            ) : (
              <>
                {c.why_tempting && <p className={s.para}><span className={s.label}>끌리는 이유</span> <RefText text={c.why_tempting} units={item.units} active={focus} onRef={one} /></p>}
                {c.how_to_reject && <p className={s.para}><span className={s.label}>버리는 근거</span> <RefText text={c.how_to_reject} units={item.units} active={focus} onRef={one} /></p>}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 문항(id · 판본)이 바뀌면 학습자 조작 상태까지 새로 시작한다 — 이전 문항의 선택 · 공개 상태가 새 원문에 이월되지 않는다 */
export function SummaryTool(props: JudgmentToolProps) {
  return <SummaryToolBody key={revealBinding(props.item)} {...props} />
}
