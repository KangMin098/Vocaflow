// apps/web/src/components/csat/judgment/GrammarTool.tsx
// R-GRAMMAR 판단 도구 — 밑줄 지점마다 학습자가 문장 성분을 직접 표시하고(주어·정동사·수식 묶음),
// 그 자리에 필요한 것을 고르고, 대안 형태로 바꿔 성립/실패를 비교한다. 공개 전에는 채점하지 않는다.
'use client'

import { useMemo, useState } from 'react'
import type { JudgmentToolProps } from '@/lib/csat/judgment/types'
import { refsOf, unitsAtIndex } from '@/lib/csat/judgment/evidence'
import {
  JUDG_LABEL, LIMITS, NEEDS, ROLE_LABEL, alternativesOf, analysisFor, choiceDefects, clampLen, clean, learnerRecord,
  markState, parseMarks, patchMark, setRole, spanText, warningsOf, CIRCLED, type GrammarState, type Judg, type Role,
} from '@/lib/csat/judgment/r-grammar'
import { EvidencePassage } from './EvidencePassage'
import { JudgmentShell, judgmentStyles as js } from './JudgmentShell'
import { RefText } from './RefText'
import { REVEAL_ERROR_TEXT, revealBinding, useReveal } from './useReveal'
import s from './GrammarTool.module.css'

const ROLES: (Role | 'erase')[] = ['S', 'V', 'M', 'erase']
const ROLE_SIGN: Record<Role, string> = { S: 'S', V: 'V', M: '( )' }

function GrammarToolBody({ item, reveal }: JudgmentToolProps) {
  const marks = useMemo(() => parseMarks(item.units), [item.units])
  const defects = useMemo(() => choiceDefects(item, marks), [item, marks])
  const { state: rv, request } = useReveal(item, reveal)
  const [sel, setSel] = useState<number>(marks[0]?.n ?? 1)
  const [brush, setBrush] = useState<Role | 'erase'>('S')
  const [st, setSt] = useState<GrammarState>({})
  const [refFocus, setRefFocus] = useState<string[] | null>(null)

  const mark = marks.find((m) => m.n === sel)
  const ms = markState(st, sel)
  const len = mark ? clampLen(mark, ms.len ?? mark.defaultLen) : 1
  const shown = rv.status === 'shown' ? rv.data : null

  const pickUnit = (unitId: string) => {
    setRefFocus(null)
    const inUnit = marks.filter((m) => m.unitId === unitId)
    if (inUnit.length && !inUnit.some((m) => m.n === sel)) setSel(inUnit[0].n)
  }
  const focus = refFocus ?? (mark ? [mark.unitId] : [])
  const unitMarks = Object.fromEntries(
    [...new Set(marks.map((m) => m.unitId))].map((u) => [u, marks.filter((m) => m.unitId === u).map((m) => CIRCLED[m.n - 1]).join(' ')]),
  )

  const evidence = <EvidencePassage units={item.units} focus={focus} onPick={pickUnit} marks={unitMarks} label="원문 — 문장을 고르면 그 문장의 밑줄 지점으로 간다" />

  if (!mark) {
    return <JudgmentShell title="어법 · 구문" stem={item.stem} evidence={evidence} judgment={<p className={js.empty}>원문에서 ①~⑤ 밑줄 기호를 찾지 못해 구조 판단 자리를 만들 수 없다.</p>} />
  }

  const alts = alternativesOf(mark, len)
  const warns = warningsOf(mark, ms)
  const analysis = shown ? analysisFor(shown, sel) : undefined

  const judgment = (
    <div className={s.tool}>
      <div role="group" aria-label="밑줄 지점 고르기" className={s.marks}>
        {marks.map((m) => (
          <button key={m.n} type="button" className={`${js.button} ${s.markBtn}`} aria-pressed={m.n === sel} data-mark={m.n} onClick={() => { setSel(m.n); setRefFocus(null) }}>
            <span className={s.sym}>{CIRCLED[m.n - 1]}</span> {spanText(m, markState(st, m.n).len ?? m.defaultLen)}
          </button>
        ))}
      </div>

      <section className={js.section} aria-labelledby="g-structure">
        <h3 id="g-structure">{CIRCLED[sel - 1]} 문장 구조 표시</h3>
        <p className={js.note}>붓을 고르고 낱말을 누른다. 같은 붓으로 다시 누르면 지운다. 밑줄 후보 범위는 기호 뒤 낱말에서 추정한 것이라 직접 넓히고 좁힐 수 있다.</p>
        <div role="group" aria-label="표시 붓" className={s.brushes}>
          {ROLES.map((r) => (
            <button key={r} type="button" className={js.button} aria-pressed={brush === r} data-brush={r} onClick={() => setBrush(r)}>
              {r === 'erase' ? '지우기' : `${ROLE_SIGN[r]} ${ROLE_LABEL[r]}`}
            </button>
          ))}
        </div>
        <div className={s.sentence} data-sentence>
          {mark.tokens.map((t, i) => {
            const role = ms.roles[i]
            const inSpan = i >= mark.at && i < mark.at + len
            return (
              <span key={i} className={s.tokWrap}>
                {i === mark.at && <span className={s.sym} aria-hidden>{CIRCLED[sel - 1]}</span>}
                <button
                  type="button"
                  className={s.tok}
                  data-tok={i}
                  data-role={role}
                  data-span={inSpan || undefined}
                  aria-pressed={Boolean(role)}
                  aria-label={`${clean(t) || t}${role ? ` · ${ROLE_LABEL[role]}` : ''}${inSpan ? ' · 밑줄 후보' : ''}`}
                  onClick={() => setSt((x) => setRole(x, sel, i, brush === 'erase' ? null : brush))}
                >
                  {t}
                  {role && <sup className={s.roleTag} aria-hidden>{ROLE_SIGN[role]}</sup>}
                </button>
              </span>
            )
          })}
        </div>
        <div className={s.row}>
          <span className={js.status}>밑줄 후보: <strong>{spanText(mark, len)}</strong> (후보 · {len}낱말)</span>
          <button type="button" className={js.button} data-span-dec aria-label="밑줄 후보 한 낱말 좁히기" disabled={len <= 1} onClick={() => setSt((x) => patchMark(x, sel, { len: len - 1 }))}>범위 −</button>
          <button type="button" className={js.button} data-span-inc aria-label="밑줄 후보 한 낱말 넓히기" disabled={clampLen(mark, len + 1) === len} onClick={() => setSt((x) => patchMark(x, sel, { len: len + 1 }))}>범위 +</button>
        </div>
      </section>

      <section className={js.section} aria-labelledby="g-need">
        <h3 id="g-need">이 자리에 무엇이 필요한가</h3>
        <div role="group" aria-label="자리 판단" className={s.needs}>
          {NEEDS.map((n) => (
            <button key={n.id} type="button" className={js.button} data-need={n.id} aria-pressed={ms.need === n.id} onClick={() => setSt((x) => patchMark(x, sel, { need: ms.need === n.id ? undefined : n.id }))}>
              {n.label}
            </button>
          ))}
        </div>
        {ms.need && (
          <>
            <p className={s.ask}>확인할 질문 — {NEEDS.find((n) => n.id === ms.need)?.ask}</p>
            <p className={js.note} data-limit><strong>적용 한계</strong> · {LIMITS[ms.need]}</p>
          </>
        )}
      </section>

      <section className={js.section} aria-labelledby="g-alt">
        <h3 id="g-alt">형태 바꿔 보기 — 이 자리에서 성립하는가</h3>
        <p className={js.note}>방금 표시한 구조에 각 형태를 넣어 본다. 판정은 기록만 되고 공개 전에는 채점하지 않는다.</p>
        <table className={s.alts}>
          <tbody>
            {alts.map((a) => (
              <tr key={a.id} data-alt={a.id}>
                <th scope="row">{a.label}</th>
                <td>
                  <div role="group" aria-label={`${a.label} 판정`} className={s.judgs}>
                    {(['holds', 'fails', 'unsure'] as Judg[]).map((j) => (
                      <button key={j} type="button" className={js.button} data-judg={j} aria-pressed={ms.alt[a.id] === j} onClick={() => setSt((x) => patchMark(x, sel, { alt: { ...ms.alt, [a.id]: j } }))}>
                        {j === 'holds' ? '○ ' : j === 'fails' ? '× ' : '? '}{JUDG_LABEL[j]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div aria-live="polite" data-warnings>
        {warns.map((w) => (
          <p key={w.id} className={s.warn} data-warn={w.id}><strong>반례 확인</strong> · {w.text}</p>
        ))}
      </div>

      <section className={js.section} aria-labelledby="g-reveal">
        <h3 id="g-reveal">해설</h3>
        {rv.status !== 'shown' && (
          <button type="button" className={`${js.button} ${js.primary}`} data-reveal onClick={() => { void request() }} aria-disabled={rv.status === 'loading'}>
            {rv.status === 'error' && rv.reason === 'fetch' ? '해설 다시 불러오기' : '해설 보기'}
          </button>
        )}
        <div aria-live="polite">
          {rv.status === 'loading' && <p className={js.status} data-reveal-loading>해설을 불러오는 중</p>}
          {rv.status === 'error' && <p className={js.error} data-reveal-error={rv.reason}>{REVEAL_ERROR_TEXT[rv.reason]}</p>}
        </div>
        {shown && (
          <div data-revealed>
            {shown.designIntent && <p className={js.hypothesis}>{shown.designIntent}</p>}
            {shown.answerLocus?.reasoning && (
              <p className={js.note}>
                틀린 곳은 {CIRCLED[shown.answer - 1]} — {shown.answerLocus.reasoning}{' '}
                {unitsAtIndex(shown.answerLocus.sentence_index, item.units).map((u) => (
                  <RefText key={u} text={`[${u}]`} units={item.units} active={refFocus ?? []} onRef={(id) => setRefFocus([id])} />
                ))}
              </p>
            )}
            <Compare sel={sel} analysis={analysis} record={learnerRecord(mark, ms)} units={item.units} refFocus={refFocus} onRef={(id) => setRefFocus([id])} />
          </div>
        )}
      </section>

      {defects.some((d) => d.kind !== 'choice-overlong') && (
        <p className={js.note} data-defects>원문 기호와 선지 수가 맞지 않아 일부 지점은 비교할 수 없다.</p>
      )}
    </div>
  )

  return <JudgmentShell title="어법 · 구문" stem={item.stem} evidence={evidence} judgment={judgment} />
}

function Compare({ sel, analysis, record, units, refFocus, onRef }: {
  sel: number
  analysis: ReturnType<typeof analysisFor>
  record: ReturnType<typeof learnerRecord>
  units: JudgmentToolProps['item']['units']
  refFocus: string[] | null
  onRef: (id: string) => void
}) {
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : '표시 안 함')
  return (
    <div className={s.compare} data-compare={sel}>
      <div>
        <h4>내가 표시한 구조 · {CIRCLED[sel - 1]}</h4>
        <dl className={s.dl}>
          <dt>밑줄 후보</dt><dd>{record.span}</dd>
          <dt>주어</dt><dd>{list(record.subjects)}</dd>
          <dt>정동사</dt><dd>{list(record.verbs)}</dd>
          <dt>수식 묶음</dt><dd>{list(record.groups)}</dd>
          <dt>자리 판단</dt><dd>{record.need ?? '고르지 않음'}</dd>
          <dt>형태 비교</dt><dd>{record.alt.length ? record.alt.map((a) => `${a.label} → ${JUDG_LABEL[a.judg]}`).join(' · ') : '판정 안 함'}</dd>
        </dl>
      </div>
      <div>
        <h4>해설 근거 · {CIRCLED[sel - 1]} {analysis ? (analysis.verdict === 'correct' ? '(틀린 곳 — 고쳐야 한다)' : '(어법상 맞다)') : ''}</h4>
        {!analysis && <p className={js.note}>이 지점의 해설 자료가 없다.</p>}
        {analysis?.verdict === 'correct' && (
          <p className={js.note}><RefText text={analysis.why_correct} units={units} active={refFocus ?? []} onRef={onRef} />{' '}
            {analysis.confirmed_at?.note && <RefText text={analysis.confirmed_at.note} units={units} active={refFocus ?? []} onRef={onRef} />}
            {refsOf(analysis.why_correct + (analysis.confirmed_at?.note ?? ''), units).length === 0 &&
              unitsAtIndex(analysis.confirmed_at?.sentence_index, units).map((u) => <RefText key={u} text={`[${u}]`} units={units} active={refFocus ?? []} onRef={onRef} />)}
          </p>
        )}
        {analysis?.verdict === 'distractor' && (
          <dl className={s.dl}>
            {analysis.trap && (<><dt>함정</dt><dd>{analysis.trap}</dd></>)}
            {analysis.why_tempting && (<><dt>끌리는 이유</dt><dd>{analysis.why_tempting}</dd></>)}
            {analysis.how_to_reject && (<><dt>거르는 법</dt><dd><RefText text={analysis.how_to_reject} units={units} active={refFocus ?? []} onRef={onRef} /></dd></>)}
          </dl>
        )}
      </div>
    </div>
  )
}

/** 문항(id · 판본)이 바뀌면 학습자 조작 상태까지 새로 시작한다 — 이전 문항의 선택 · 공개 상태가 새 원문에 이월되지 않는다 */
export function GrammarTool(props: JudgmentToolProps) {
  return <GrammarToolBody key={revealBinding(props.item)} {...props} />
}
