// apps/web/src/components/csat/judgment/InfoMatchTool.tsx
// R-NOTICE · R-FACT 정보 일치 판단 도구 — 선지를 성분으로 쪼개 성분마다 원문 문장을 잇고 「일치 / 어긋남 / 언급 없음」을 표시한다.
// 선지 전체를 한 번에 O/X 하지 않는다. 해설은 학습자가 요청할 때만 받고, 받은 뒤 해설 [uN] 과 내 연결을 나란히 본다.
'use client'

import { useMemo, useState } from 'react'
import {
  MARK_LABEL,
  MARK_SIGN,
  RULE_LABEL,
  askPolarity,
  canMark,
  compareWithReveal,
  groupPending,
  initialState,
  linkedMarkers,
  setMark,
  tally,
  tallySentence,
  toggleLink,
  togglePending,
  tokenize,
  ungroup,
  type Mark,
} from '@/lib/csat/judgment/info-match'
import type { JudgmentToolProps } from '@/lib/csat/judgment/types'
import { EvidencePassage } from './EvidencePassage'
import { JudgmentShell, judgmentStyles as js } from './JudgmentShell'
import { RefText } from './RefText'
import { REVEAL_ERROR_TEXT, revealBinding, useReveal } from './useReveal'
import s from './InfoMatchTool.module.css'

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧']
const MARKS: Mark[] = ['match', 'conflict', 'absent']

export function InfoMatchEmpty() {
  return (
    <p className={js.empty} data-judgment-empty>
      이 유형의 문항 자료가 없어 정보 대조를 시작할 수 없다.
    </p>
  )
}

function InfoMatchToolBody({ item, reveal }: JudgmentToolProps) {
  const [state, setState] = useState(() => initialState(item))
  const [choice, setChoice] = useState(1)
  const [active, setActive] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [refFocus, setRefFocus] = useState<string[]>([])
  const { state: rv, request } = useReveal(item, reveal)

  const units = item.units
  const title = item.typeId === 'R-NOTICE' ? '안내문 정보 대조' : '글 정보 대조'
  const pol = askPolarity(item.stem)
  const w = state.choices[choice] ?? { components: [], pending: [] }
  const choiceText = item.choices[choice - 1] ?? ''
  const tokens = useMemo(() => tokenize(choiceText), [choiceText])
  const activeComp = w.components.find((c) => c.id === active) ?? null
  const unitN = (id: string) => units.find((u) => u.id === id)?.n

  if (units.length === 0 || item.choices.length === 0) {
    return <JudgmentShell title={title} stem={item.stem} evidence={<EvidencePassage units={units} />} judgment={<p className={js.empty}>선지나 원문 단위가 없어 성분 대조를 할 수 없다.</p>} />
  }

  const pickChoice = (n: number) => { setChoice(n); setActive(null); setMsg('') }
  const pickUnit = (unitId: string) => {
    if (!activeComp) { setMsg('먼저 오른쪽에서 성분 하나를 고른 뒤 원문 문장을 누른다.'); return }
    const had = activeComp.links.includes(unitId)
    setState((st) => toggleLink(st, choice, activeComp.id, unitId))
    setMsg(`「${activeComp.text}」 ${had ? '연결 풀림' : '근거 연결'} · ${unitN(unitId)}번 문장`)
  }
  const mark = (compId: string, m: Mark) => {
    const c = w.components.find((x) => x.id === compId)
    if (!c) return
    const chk = canMark(c, m)
    if (c.mark !== m && !chk.ok) { setMsg(chk.reason); return }
    setState((st) => setMark(st, choice, compId, m))
    setMsg(`「${c.text}」 ${c.mark === m ? '표시 지움' : MARK_LABEL[m]}`)
  }

  const marks: Record<string, string> = {}
  for (const c of w.components) for (const u of c.links) marks[u] = `${marks[u] ? marks[u] + ' ' : ''}${CIRCLED[choice - 1]}${c.mark ? MARK_SIGN[c.mark] : ''}`

  const t = tally(w, choiceText, units)
  const shown = rv.status === 'shown' ? rv.data : null
  const cmp = shown ? compareWithReveal(item, shown, choice, w) : null

  const judgment = (
    <div className={s.root}>
      <p className={js.note}>
        {pol === 'find-mismatch' ? '발문은 원문과 일치하지 않는 선지를 묻는다.' : pol === 'find-match' ? '발문은 원문과 일치하는 선지를 묻는다.' : '발문의 방향을 원문에서 확인한다.'}{' '}
        선지를 한 번에 맞다/틀리다로 보지 말고, 성분마다 원문 문장을 연결해 표시한다.
      </p>

      <div className={s.choiceBar} role="group" aria-label="선지 고르기">
        {item.choices.map((c, i) => {
          const cw = state.choices[i + 1]
          const ct = cw ? tally(cw, c, units) : null
          const sum = ct && ct.marked ? ` · ${ct.conflict ? `≠${ct.conflict} ` : ''}${ct.absent ? `∅${ct.absent} ` : ''}${ct.match ? `=${ct.match}` : ''}`.trimEnd() : ''
          return (
            <button key={i} type="button" className={`${js.button} ${s.choiceBtn}`} data-choice={i + 1} aria-pressed={choice === i + 1} onClick={() => pickChoice(i + 1)} aria-label={`${i + 1}번 선지 ${c}${sum ? ` 내 표시 ${sum}` : ''}`}>
              <span className={s.choiceNo}>{CIRCLED[i]}</span>
              <span className={s.choiceText}>{c}</span>
              {sum && <span className={s.choiceSum} aria-hidden>{sum.replace(/^ · /, '')}</span>}
            </button>
          )
        })}
      </div>

      <section className={js.section} aria-label="선지 성분">
        <h3>{CIRCLED[choice - 1]} 성분 나누기</h3>
        <p className={js.note}>밑줄 친 말은 규칙(숫자·시점·범위·허용/금지 표현)이 찾은 확인 표지다. 대상·행위처럼 규칙이 못 잡은 말은 직접 골라 성분으로 묶는다.</p>
        <div className={s.tokens} data-choice-tokens>
          {tokens.map((tk) => {
            const comp = w.components.find((c) => c.tokens.includes(tk.i))
            if (comp) {
              return (
                <button key={tk.i} type="button" className={s.token} data-token={tk.i} data-comp={comp.id} data-origin={comp.origin} aria-pressed={active === comp.id} aria-label={`${tk.text} · 성분 「${comp.text}」 고르기`} onClick={() => setActive(active === comp.id ? null : comp.id)}>
                  {tk.text}
                </button>
              )
            }
            const sel = w.pending.includes(tk.i)
            return (
              <button key={tk.i} type="button" className={s.token} data-token={tk.i} data-free aria-pressed={sel} aria-label={`${tk.text} · 성분으로 묶을 말${sel ? ' · 고름' : ''}`} onClick={() => setState((st) => togglePending(st, choice, tk.i))}>
                {tk.text}
              </button>
            )
          })}
        </div>
        <button type="button" className={js.button} data-action="group" disabled={w.pending.length === 0} onClick={() => { setState((st) => groupPending(st, choice, choiceText)); setActive(`l${w.pending[0]}`); setMsg('고른 말을 성분으로 묶었다. 이제 원문 문장을 눌러 근거를 연결한다.') }}>
          고른 말 {w.pending.length ? `${w.pending.length}개 ` : ''}성분으로 묶기
        </button>

        <ol className={s.comps}>
          {w.components.map((c) => {
            const lm = linkedMarkers(c, units).filter((x) => x.markers.length)
            return (
              <li key={c.id} className={s.comp} data-comp-row={c.id} data-active={active === c.id || undefined}>
                <div className={s.compHead}>
                  <button type="button" className={`${js.button} ${s.compName}`} data-comp-select={c.id} aria-pressed={active === c.id} onClick={() => setActive(active === c.id ? null : c.id)}>
                    {c.text}
                  </button>
                  <span className={s.origin}>{c.origin === 'rule' ? `규칙: ${c.kinds.map((k) => RULE_LABEL[k]).join('·')}` : '내가 고른 성분'}</span>
                  {c.origin === 'learner' && (
                    <button type="button" className={js.button} aria-label={`성분 「${c.text}」 풀기`} onClick={() => { setState((st) => ungroup(st, choice, c.id)); if (active === c.id) setActive(null) }}>풀기</button>
                  )}
                </div>
                <div className={s.links}>
                  {c.links.length === 0 ? (
                    <span className={js.status}>{active === c.id ? '왼쪽 원문 문장을 눌러 근거를 연결한다.' : '연결한 원문 없음'}</span>
                  ) : (
                    c.links.map((u) => (
                      <button key={u} type="button" className={js.button} data-unlink={u} aria-label={`${unitN(u)}번 문장 연결 풀기`} onClick={() => setState((st) => toggleLink(st, choice, c.id, u))}>
                        {unitN(u)}번 문장 ×
                      </button>
                    ))
                  )}
                </div>
                <div className={s.markRow} role="group" aria-label={`「${c.text}」 판단`}>
                  {MARKS.map((m) => (
                    <button key={m} type="button" className={`${js.button} ${s.markBtn}`} data-mark={m} data-comp-mark={c.id} aria-pressed={c.mark === m} aria-disabled={c.mark !== m && !canMark(c, m).ok} onClick={() => mark(c.id, m)}>
                      <span aria-hidden>{MARK_SIGN[m]}</span> {MARK_LABEL[m]}
                    </button>
                  ))}
                </div>
                {lm.length > 0 && (
                  <p className={s.markers}>
                    근거의 범위·조건 표지:{' '}
                    {lm.map((x) => `${unitN(x.unitId)}번 — ${x.markers.map((m) => `${m.text}(${m.label})`).join(', ')}`).join(' / ')}
                    {c.mark === 'match' && ' · 일치로 표시했다면 이 조건까지 선지와 같은지 확인한다.'}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
        <p className={js.status} data-tally>{tallySentence(t)}</p>
        {t.uncovered.length > 0 && <p className={js.note}>성분에 넣지 않은 말: {t.uncovered.join(' ')}</p>}
        <p className={js.srOnly} aria-live="polite">{msg}</p>
        {msg && <p className={js.status} data-msg aria-hidden>{msg}</p>}
      </section>

      <section className={js.section} aria-label="판단 조건">
        <h3>이 대조가 통하는 조건</h3>
        <ul className={s.rules}>
          <li><b>성립</b> 성분 하나하나가 원문의 같은 대상·수치·조건과 짝지어질 때만 일치다. 숫자가 같아도 단위·범위(이상/미만, each day, per)가 다르면 어긋남이다.</li>
          <li><b>실패</b> 일부 성분만 맞춰 선지 전체를 일치로 일반화하거나, 괄호 속 예외·but 뒤 결과를 건너뛰면 틀린다.</li>
          <li><b>한계</b> 원문이 반대로 말하면 어긋남, 아예 말하지 않으면 언급 없음이다. 상식으로 빈칸을 채워 추론하지 않는다.</li>
        </ul>
      </section>

      <section className={js.section} aria-label="해설">
        <h3>해설</h3>
        {rv.status === 'hidden' && (
          <>
            <p className={js.note}>먼저 풀지 않아도 해설을 볼 수 있다. 본 뒤에는 해설 근거와 내 연결을 나란히 비교한다.</p>
            <button type="button" className={`${js.button} ${js.primary}`} data-action="reveal" onClick={request}>해설 보기</button>
          </>
        )}
        {rv.status === 'loading' && <p className={js.status} aria-live="polite">해설을 불러오는 중</p>}
        {rv.status === 'error' && (
          <div aria-live="polite">
            <p className={js.error} data-reveal-error={rv.reason}>{REVEAL_ERROR_TEXT[rv.reason]}</p>
            {rv.reason === 'fetch' && <button type="button" className={js.button} data-action="reveal" onClick={request}>다시 시도</button>}
          </div>
        )}
        {shown && (
          <div data-revealed>
            <p className={js.status}>정답 {CIRCLED[shown.answer - 1]}</p>
            {shown.designIntent && <p className={js.hypothesis}><RefText text={shown.designIntent} units={units} active={refFocus} onRef={(u) => setRefFocus([u])} /></p>}
            {shown.answerLocus?.reasoning && <p className={js.note}><RefText text={shown.answerLocus.reasoning} units={units} active={refFocus} onRef={(u) => setRefFocus([u])} /></p>}
            {cmp && (
              <div className={s.cmp} data-compare={choice}>
                <h4>{CIRCLED[choice - 1]} 해설 판정: {cmp.textMatches === null ? (cmp.verdict === 'correct' ? '정답 선지' : '오답 선지') : cmp.textMatches ? '원문과 일치' : '원문과 어긋남'}{cmp.trap ? ` · 함정: ${cmp.trap}` : ''}</h4>
                <p className={s.explain}><RefText text={cmp.explain} units={units} active={refFocus} onRef={(u) => setRefFocus([u])} /></p>
                <dl className={s.cmpList}>
                  <dt>해설 근거 중 내가 연결한 문장</dt>
                  <dd>{cmp.shared.length ? cmp.shared.map((u) => <RefLink key={u} id={u} n={unitN(u)} active={refFocus} onRef={setRefFocus} />) : '없음'}</dd>
                  <dt>해설 근거인데 연결하지 않은 문장</dt>
                  <dd>{cmp.missed.length ? cmp.missed.map((u) => <RefLink key={u} id={u} n={unitN(u)} active={refFocus} onRef={setRefFocus} />) : '없음'}</dd>
                  <dt>해설에 없는 내 연결</dt>
                  <dd>{cmp.extra.length ? cmp.extra.map((u) => <RefLink key={u} id={u} n={unitN(u)} active={refFocus} onRef={setRefFocus} />) : '없음'}</dd>
                </dl>
                {cmp.disagreement && <p className={js.note} data-disagree>{cmp.disagreement}</p>}
              </div>
            )}
            <p className={js.note}>다른 선지를 고르면 그 선지의 해설과 내 연결을 비교한다.</p>
          </div>
        )}
      </section>
    </div>
  )

  return (
    <JudgmentShell
      title={title}
      stem={item.stem}
      evidence={<EvidencePassage units={units} focus={refFocus} pinned={activeComp?.links ?? []} onPick={pickUnit} marks={marks} label="원문 — 성분을 고른 뒤 문장을 눌러 근거로 연결" />}
      judgment={judgment}
    />
  )
}

function RefLink({ id, n, active, onRef }: { id: string; n?: number; active: string[]; onRef: (ids: string[]) => void }) {
  return (
    <button type="button" className={js.ref} data-ref={id} aria-pressed={active.includes(id)} onClick={() => onRef([id])}>
      {n ? `${n}번 문장` : id}
    </button>
  )
}

/** 문항(id · 판본)이 바뀌면 학습자 조작 상태까지 새로 시작한다 — 이전 문항의 선택 · 공개 상태가 새 원문에 이월되지 않는다 */
export function InfoMatchTool(props: JudgmentToolProps) {
  return <InfoMatchToolBody key={revealBinding(props.item)} {...props} />
}
