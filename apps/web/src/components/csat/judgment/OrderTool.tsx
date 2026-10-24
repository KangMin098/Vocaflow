// apps/web/src/components/csat/judgment/OrderTool.tsx
// R-ORDER 판단 도구 — 학습자가 (A)(B)(C) 를 직접 배열하고, 단락 첫머리 단서가 「무엇을 전제하는가」를 원문에서 골라 잇는다.
// 공개 전에는 정답을 모른다: 배열·선지 대조는 학습자가 만든 연결 기준의 「끊긴 연결」만 보여 준다.
'use client'

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { refsOf } from '@/lib/csat/judgment/evidence'
import {
  CUE_INFO, PARA_LABEL, cautions, compareChoices, cueCandidates, fullOrder, junctions, linkStatus, makeLink, moveIn, parseOrder, revealNotes,
  type Arrangement, type Cue, type Link, type LinkStatus, type Movable,
} from '@/lib/csat/judgment/r-order'
import type { JudgmentToolProps } from '@/lib/csat/judgment/types'
import { EvidencePassage } from './EvidencePassage'
import { JudgmentShell, judgmentStyles as js } from './JudgmentShell'
import { RefText } from './RefText'
import { REVEAL_ERROR_TEXT, revealBinding, useReveal } from './useReveal'
import s from './OrderTool.module.css'

const STATUS_TEXT: Record<LinkStatus, { sym: string; text: string }> = {
  closed: { sym: '✓', text: '이음매에서 닫힘' },
  distant: { sym: '…', text: '앞에 있으나 맞닿지 않음' },
  broken: { sym: '✗', text: '끊김 — 전제 대상이 뒤에 옴' },
}

const clip = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t)

function OrderToolBody({ item, reveal }: JudgmentToolProps) {
  const model = useMemo(() => parseOrder(item.units), [item.units])
  const cues = useMemo(() => (model ? cueCandidates(item, model) : []), [item, model])
  const [arr, setArr] = useState<Arrangement>(['A', 'B', 'C'])
  const [links, setLinks] = useState<Link[]>([])
  const [active, setActive] = useState<Cue | null>(null)
  const [focus, setFocus] = useState<string[]>([])
  const [say, setSay] = useState('')
  const { state, request } = useReveal(item, reveal)
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const unitText = (id: string) => item.units.find((u) => u.id === id)?.text ?? ''
  const unitN = (id: string) => item.units.find((u) => u.id === id)?.n

  if (!model) {
    return (
      <JudgmentShell
        title="글의 순서"
        stem={item.stem}
        evidence={<EvidencePassage units={item.units} />}
        judgment={<p className={js.empty} data-order-empty>이 문항 원문에서 주어진 글과 (A)(B)(C) 단락 표지를 찾지 못해 배열 도구를 열 수 없다. 원문만 읽을 수 있다.</p>}
      />
    )
  }

  const move = (k: Movable, dir: -1 | 1) => {
    const next = moveIn(arr, k, dir)
    if (next === arr) return setSay(`${PARA_LABEL[k]} 은 더 ${dir < 0 ? '앞' : '뒤'}으로 갈 수 없다`)
    setArr(next)
    setSay(`배열: 주어진 글 – ${next.map((x) => PARA_LABEL[x]).join(' – ')}`)
  }
  const rowKey = (k: Movable) => (e: KeyboardEvent) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    move(k, e.key === 'ArrowUp' ? -1 : 1)
    requestAnimationFrame(() => rowRefs.current[k]?.focus())
  }

  const pickCue = (c: Cue) => {
    if (active?.id === c.id) { setActive(null); setSay('단서 선택을 풀었다'); return }
    setActive(c)
    setFocus([c.unitId])
    setSay(`단서 '${c.text}' — ${CUE_INFO[c.kind].presupposes}. 원문에서 전제 대상 문장을 고른다`)
  }
  const pickUnit = (unitId: string) => {
    if (!active) { setFocus([unitId]); setSay(`${unitN(unitId)}번 문장을 가리킴. 연결하려면 먼저 단서를 고른다`); return }
    const l = makeLink(active, unitId, model)
    if ('error' in l) { setSay(l.error); return }
    if ('inside' in l) { setSay(l.message); setActive(null); return }
    setLinks((ls) => [...ls.filter((x) => x.cueId !== l.cueId), l])
    setActive(null)
    setFocus([unitId])
    setSay(`연결: ${PARA_LABEL[l.para]} '${l.cueText}' → ${unitN(unitId)}번 문장(${PARA_LABEL[l.antecedentPara]})`)
  }
  const removeLink = (l: Link) => { setLinks((ls) => ls.filter((x) => x !== l)); setSay(`'${l.cueText}' 연결을 지웠다`) }

  const order = fullOrder(arr)
  const js3 = junctions(model, arr, links)
  const compare = compareChoices(item, arr, links)
  const warns = cautions(links)
  const pinned = links.map((l) => l.antecedent)
  const marks: Record<string, string> = {}
  const addMark = (id: string, t: string) => { marks[id] = marks[id] ? `${marks[id]} · ${t}` : t }
  for (const l of links) addMark(l.antecedent, `← ${PARA_LABEL[l.para]} ${l.cueText}`)
  if (active) addMark(active.unitId, `단서: ${active.text}`)
  const shown = state.status === 'shown' ? state.data : null
  const notes = shown ? revealNotes(item, shown) : null
  const paraText = (k: Movable | 'G') => (k === 'G' ? model.given : model.paras[k]).unitIds

  const judgment = (
    <div className={s.tool} data-order-tool>
      <p className={js.srOnly} aria-live="polite" data-live>{say}</p>

      <section aria-labelledby="ord-arr">
        <h3 id="ord-arr" className={s.h}>배열 — 이음매마다 내가 표시한 연결</h3>
        <p className={js.note}>단락을 옮기면(버튼 또는 Alt+↑↓) 각 이음매에서 앞 단락 끝과 뒤 단락 첫머리가 맞닿는다.</p>
        <ol className={s.chain}>
          <li className={s.para} data-para="G">
            <span className={s.paraLabel}>주어진 글</span>
            <span className={s.paraEdge}>끝: {clip(unitText(paraText('G').at(-1)!), 90)}</span>
          </li>
          {arr.map((k, i) => {
            const j = js3[i]
            return (
              <li key={k} className={s.slot}>
                <div className={s.junction} data-junction={`${j.front}>${j.back}`}>
                  <span className={s.jTitle}>이음매 {PARA_LABEL[j.front]} → {PARA_LABEL[j.back]}</span>
                  {j.links.length === 0 ? (
                    <span className={s.jNone}>○ 표시한 연결 없음</span>
                  ) : (
                    <ul className={s.jList}>
                      {j.links.map(({ link, status }) => (
                        <li key={link.cueId} data-status={status} className={s.jItem}>
                          <span aria-hidden>{STATUS_TEXT[status].sym}</span> &lsquo;{link.cueText}&rsquo; → {unitN(link.antecedent)}번 문장({PARA_LABEL[link.antecedentPara]}) · {STATUS_TEXT[status].text}
                          {CUE_INFO[link.kind].weak && <em className={s.weak}> · 약한 단서</em>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {j.weakOnly && <span className={s.weak}>△ 이 이음매는 약한 단서로만 닫혔다 — 아래 「성립하지 않는 조건」 참고</span>}
                </div>
                <div className={s.para} data-para={k} onKeyDown={rowKey(k)}>
                  <span className={s.paraLabel}>{PARA_LABEL[k]}</span>
                  <span className={s.paraEdge}>첫머리: {clip(unitText(paraText(k)[0]).replace(/^\s*\([ABC]\)\s*/, ''))}</span>
                  <span className={s.moves}>
                    <button ref={(el) => { rowRefs.current[k] = el }} type="button" className={js.button} data-move={`${k}-up`} aria-disabled={i === 0} aria-label={`${PARA_LABEL[k]} 앞으로`} onClick={() => move(k, -1)}>↑ 앞으로</button>
                    <button type="button" className={js.button} data-move={`${k}-down`} aria-disabled={i === 2} aria-label={`${PARA_LABEL[k]} 뒤로`} onClick={() => move(k, 1)}>↓ 뒤로</button>
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section aria-labelledby="ord-cue" className={js.section}>
        <h3 id="ord-cue">단서 고르기 → 전제 대상 잇기</h3>
        <p className={js.note}>단락 첫머리에서 단서를 고른 뒤, 그 단서가 전제하는 문장을 왼쪽 원문에서 고른다. 단서 후보는 자동으로 뽑은 표현일 뿐 정답 단서가 아니다.</p>
        {(['A', 'B', 'C'] as Movable[]).map((k) => {
          const mine = cues.filter((c) => c.para === k)
          const strong = mine.filter((c) => !CUE_INFO[c.kind].weak)
          const weak = mine.filter((c) => CUE_INFO[c.kind].weak)
          const btn = (c: Cue) => {
            const linked = links.find((l) => l.cueId === c.id)
            return (
              <button key={c.id} type="button" className={`${js.button} ${s.cue}`} data-cue={c.id} data-kind={c.kind} aria-pressed={active?.id === c.id}
                aria-label={`${PARA_LABEL[k]} 단서 ${c.text} · ${CUE_INFO[c.kind].name}${linked ? ` · ${unitN(linked.antecedent)}번 문장과 연결됨` : ''}`} onClick={() => pickCue(c)}>
                <span className={s.cueKind}>{CUE_INFO[c.kind].name}</span> {c.text}{linked && <span className={s.cueLinked}> → {unitN(linked.antecedent)}</span>}
              </button>
            )
          }
          return (
            <div key={k} className={s.cueGroup} data-cue-para={k}>
              <span className={s.paraLabel}>{PARA_LABEL[k]}</span>
              {mine.length === 0 ? <span className={js.note}>첫머리에서 찾은 단서 후보가 없다. 내용 흐름으로 판단한다.</span> : (
                <>
                  <div className={s.cueRow}>{strong.map(btn)}</div>
                  {weak.length > 0 && <div className={s.cueRow}><span className={s.cueRowLabel}>약한 단서</span>{weak.map(btn)}</div>}
                </>
              )}
            </div>
          )
        })}
        {active && <p className={js.status} data-active-cue>지금 단서 &lsquo;{active.text}&rsquo;({CUE_INFO[active.kind].name}) — 전제: {CUE_INFO[active.kind].presupposes}. 원문에서 문장을 고른다.</p>}
        {links.length > 0 && (
          <ul className={s.links}>
            {links.map((l) => (
              <li key={l.cueId} data-link={l.cueId}>
                <button type="button" className={`${js.button} ${s.linkGo}`} aria-label={`${unitN(l.antecedent)}번 문장 원문에서 보기`} onClick={() => setFocus([l.antecedent])}>
                  {PARA_LABEL[l.para]} &lsquo;{l.cueText}&rsquo; → {unitN(l.antecedent)}번 문장
                </button>
                <span className={js.note}>{CUE_INFO[l.kind].presupposes}</span>
                <button type="button" className={js.button} aria-label={`'${l.cueText}' 연결 지우기`} onClick={() => removeLink(l)}>지우기</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ord-cmp" className={js.section}>
        <h3 id="ord-cmp">선지 순서와 대조 — 이 배열에서 끊긴 연결</h3>
        <p className={js.note}>내가 표시한 연결 기준이다. 정답 판정이 아니며, 연결을 하나도 표시하지 않았으면 아무것도 끊기지 않는다.</p>
        <table className={s.table}>
          <thead><tr><th scope="col">선지</th><th scope="col">끊긴 내 연결</th></tr></thead>
          <tbody>
            {compare.map((c) => (
              <tr key={c.n} data-choice={c.n} data-broken={c.broken.length}>
                <th scope="row">{c.n}. {c.order ? c.order.map((x) => PARA_LABEL[x]).join(' – ') : '선지 형식을 읽지 못함'}{c.sameAsMine && <span className={s.mine}> · 내 배열</span>}</th>
                <td>{!c.order ? '—' : c.broken.length === 0 ? (links.length ? '끊긴 연결 없음' : '표시한 연결 없음') : c.broken.map((l) => `✗ '${l.cueText}' → ${unitN(l.antecedent)}번`).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="ord-lim" className={js.section}>
        <h3 id="ord-lim">성립 · 실패 조건 · 한계</h3>
        <ul className={s.conds}>
          <li><b>성립</b> 지시어·시간·예시·대비 단서가 앞 내용을 전제하고, 그 전제 대상이 바로 앞 단락 끝에 있으며 <em>의미가 실제로 맞을 때</em>(가리키는 대상·시점·주장이 일치) 이음매가 닫힌다. 표지가 있다는 것만으로는 닫히지 않는다.</li>
          <li><b>실패 조건</b> 같은 낱말 반복만으로 잇기 · 정관사 하나로 단정하기 · 같은 문장 안에서 이미 해소되는 대명사를 앞 단락에 억지로 잇기 — 방향을 정하지 않는다.</li>
          <li><b>한계</b> 단서가 양방향으로 읽히면(두 단락이 서로를 전제하는 듯하면) 이 원리만으로 순서가 정해지지 않는다.</li>
        </ul>
        {warns.length > 0 && (
          <ul className={s.warns} data-cautions>
            {warns.map((w, i) => <li key={i} data-caution={w.kind}><b>{w.kind === 'failure' ? '△ 내 연결의 실패 조건' : '↔ 내 연결의 한계'}</b> {w.text}</li>)}
          </ul>
        )}
      </section>

      <section aria-labelledby="ord-rev" className={js.section}>
        <h3 id="ord-rev">해설</h3>
        {state.status === 'hidden' && <button type="button" className={`${js.button} ${js.primary}`} data-reveal onClick={request}>해설 보기</button>}
        {state.status === 'loading' && <p className={js.status}>해설을 불러오는 중…</p>}
        {state.status === 'error' && (
          <div>
            <p className={js.error} role="alert" data-reveal-error>{REVEAL_ERROR_TEXT[state.reason]}</p>
            {state.reason === 'fetch' && <button type="button" className={js.button} onClick={request}>다시 시도</button>}
          </div>
        )}
        {shown && notes && (
          <div data-revealed>
            <p>해설의 순서: 주어진 글 – {notes.answerOrder ? notes.answerOrder.map((x) => PARA_LABEL[x]).join(' – ') : '형식을 읽지 못함'}
              {notes.answerOrder && <> · 내 배열 {notes.answerOrder.join() === arr.join() ? '과 같다' : `(${arr.map((x) => PARA_LABEL[x]).join(' – ')})과 다르다`}</>}
            </p>
            {notes.answerOrder && links.length > 0 && (
              <ul className={s.jList}>
                {links.map((l) => {
                  const st = linkStatus(fullOrder(notes.answerOrder!), l)
                  return <li key={l.cueId} data-status={st} className={s.jItem}><span aria-hidden>{STATUS_TEXT[st].sym}</span> 해설 순서에서 내 연결 &lsquo;{l.cueText}&rsquo; → {unitN(l.antecedent)}번: {STATUS_TEXT[st].text}</li>
                })}
              </ul>
            )}
            {shown.designIntent && <p className={js.hypothesis}>{shown.designIntent}</p>}
            {shown.answerLocus?.reasoning && <p className={s.reason}><RefText text={shown.answerLocus.reasoning} units={item.units} active={focus} onRef={(u) => setFocus([u])} /></p>}
            <ol className={s.choices}>
              {notes.notes.map((n) => (
                <li key={n.n} data-reveal-choice={n.n}>
                  <div className={s.choiceHead}>
                    {n.n}. {n.label}
                    {n.analysis.verdict === 'correct' ? ' — 해설의 정답' : n.analysis.trap ? ` — 함정: ${n.analysis.trap}` : ''}
                  </div>
                  {n.extra.length > 0 && <div className={js.note}>이 선지에만 있는 이음매: {n.extra.map(([a, b]) => `${PARA_LABEL[a]} → ${PARA_LABEL[b]}`).join(', ')}</div>}
                  {n.analysis.verdict === 'correct' ? (
                    <p><RefText text={n.analysis.why_correct} units={item.units} active={focus} onRef={(u) => setFocus([u])} /></p>
                  ) : (
                    <>
                      {n.analysis.why_tempting && <p className={js.note}>끌리는 이유: <RefText text={n.analysis.why_tempting} units={item.units} active={focus} onRef={(u) => setFocus([u])} /></p>}
                      {n.analysis.how_to_reject && (
                        <p>
                          버리는 근거: <RefText text={n.analysis.how_to_reject} units={item.units} active={focus} onRef={(u) => setFocus([u])} />
                          {(() => {
                            const refs = refsOf(n.analysis.how_to_reject, item.units)
                            const mineHit = links.filter((l) => refs.includes(l.antecedent) || refs.includes(cues.find((c) => c.id === l.cueId)?.unitId ?? ''))
                            return mineHit.length ? <span className={s.mine}> · 내 연결과 겹침: {mineHit.map((l) => `'${l.cueText}'`).join(', ')}</span> : null
                          })()}
                        </p>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
      <span hidden data-order={order.join('')} />
    </div>
  )

  return (
    <JudgmentShell
      title="글의 순서 · 이음매 단서"
      stem={item.stem}
      evidence={<EvidencePassage units={item.units} focus={focus} pinned={pinned} onPick={pickUnit} marks={marks} label="원문 — 단서의 전제 대상을 고른다" />}
      judgment={judgment}
    />
  )
}

/** 문항(id · 판본)이 바뀌면 학습자 조작 상태까지 새로 시작한다 — 이전 문항의 선택 · 공개 상태가 새 원문에 이월되지 않는다 */
export function OrderTool(props: JudgmentToolProps) {
  return <OrderToolBody key={revealBinding(props.item)} {...props} />
}
