// apps/web/src/components/csat/judgment/IrrelevantTool.tsx
// 무관한 문장 판단 도구 — 학습자가 중심 화제를 고정하고, ①~⑤ 각 문장의 앞 이음매·뒤 이음매를 근거 종류와 함께 표시하고,
// 문장을 빼고 앞뒤를 이어 읽어 다리가 이어지는지 대조한다. 해설은 학습자가 요청할 때만 받는다.
'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import { unitsAtIndex } from '@/lib/csat/judgment/evidence'
import {
  CUES,
  CUE_LABEL,
  PROFILE_TEXT,
  compareWithAnswer,
  initialState,
  marksOf,
  parseStructure,
  profileOf,
  setVerdict,
  toggleCue,
  toggleRemoved,
  toggleSuspect,
  toggleTopic,
  warningsOf,
  type Seam,
  type Slot,
  type ToolState,
} from '@/lib/csat/judgment/r-irrelevant'
import type { EvidenceUnit, JudgmentToolProps, RevealData } from '@/lib/csat/judgment/types'
import { EvidencePassage } from './EvidencePassage'
import { JudgmentShell, judgmentStyles as js } from './JudgmentShell'
import { RefText } from './RefText'
import { REVEAL_ERROR_TEXT, revealBinding, useReveal } from './useReveal'
import s from './IrrelevantTool.module.css'

const CIRCLED = ['①', '②', '③', '④', '⑤']
const SEAM_TITLE: Record<Seam, string> = { back: '앞 문장 → 이 문장', forward: '이 문장 → 뒤 문장', bridge: '빼고 읽기: 앞 문장 → 뒤 문장' }
const VERDICT_TEXT = { holds: { back: '○ 이어진다', forward: '○ 이어진다', bridge: '○ 빼도 이어진다' }, breaks: { back: '✕ 끊긴다', forward: '✕ 끊긴다', bridge: '✕ 빼면 빈다' } } as const

function IrrelevantToolBody({ item, reveal }: JudgmentToolProps) {
  const structure = useMemo(() => parseStructure(item), [item])
  const { lead, slots } = structure
  const [state, setState] = useState<ToolState>(initialState)
  const [active, setActive] = useState<number>(slots[0]?.n ?? 1)
  const [seamFocus, setSeamFocus] = useState<Seam | null>(null)
  const [refFocus, setRefFocus] = useState<string[] | null>(null)
  const { state: rv, request } = useReveal(item, reveal)

  const byId = useMemo(() => new Map(item.units.map((u) => [u.id, u])), [item.units])
  const slot = slots.find((x) => x.n === active) ?? slots[0]

  if (!slot) {
    return (
      <JudgmentShell
        title="무관한 문장 · 원문"
        stem={item.stem}
        evidence={<EvidencePassage units={item.units} />}
        judgment={<p className={js.empty} data-irr-empty>원문에서 ①~⑤ 선지 문장 위치를 찾지 못해 이음매를 세울 수 없다. 선지 문자열만으로 대신 판단하지 않는다.</p>}
      />
    )
  }

  const seamUnits = (sl: Slot, seam: Seam): (string | null)[] =>
    seam === 'back' ? [sl.prevId, sl.unitId] : seam === 'forward' ? [sl.unitId, sl.nextId] : [sl.prevId, sl.nextId]
  const focus = refFocus ?? (seamFocus ? seamUnits(slot, seamFocus) : [slot.unitId]).filter((x): x is string => Boolean(x))
  const removedId = state.removed ? slots.find((x) => x.n === state.removed)?.unitId : undefined

  const marks: Record<string, string> = {}
  for (const sl of slots) {
    const tags: string[] = []
    if (state.removed === sl.n) tags.push('뺌')
    if (state.suspect === sl.n) tags.push('무관 후보')
    if (tags.length) marks[sl.unitId] = tags.join(' · ')
  }
  for (const id of state.topic) marks[id] = marks[id] ? `${marks[id]} · 화제` : '화제'

  const pick = (n: number) => { setActive(n); setSeamFocus(null); setRefFocus(null) }
  const onTabsKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = slots.findIndex((x) => x.n === active)
    let j = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % slots.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + slots.length) % slots.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = slots.length - 1
    if (j < 0) return
    e.preventDefault()
    pick(slots[j].n)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-slot="${slots[j].n}"]`)?.focus()
  }

  const warns = warningsOf(state, slot)
  const profile = profileOf(state, slot)
  const shown = rv.status === 'shown' ? rv.data : null

  return (
    <JudgmentShell
      title="무관한 문장 · 원문"
      stem={item.stem}
      evidence={
        <EvidencePassage
          units={item.units}
          focus={focus}
          pinned={state.topic}
          dimmed={removedId ? [removedId] : []}
          onPick={(id) => setState((st) => toggleTopic(st, id))}
          marks={marks}
          label="원문 — 문장을 눌러 중심 화제 근거로 고정"
        />
      }
      judgment={
        <div className={s.root}>
          <section aria-labelledby="irr-topic">
            <h3 id="irr-topic" className={s.h}>1. 중심 화제를 세운다</h3>
            <p className={js.note}>원문에서 글의 화제·주장을 세우는 문장을 눌러 고정한다. 이음매를 볼 때 이 화제와 방향이 기준이 된다.</p>
            {state.topic.length === 0 ? (
              <p className={js.status}>고정한 화제 문장 없음{lead.length ? ` — 도입 ${lead.map((u) => `${u.n}번`).join('·')} 문장부터 보라.` : ''}</p>
            ) : (
              <ul className={s.topicList}>
                {state.topic.map((id) => {
                  const u = byId.get(id)
                  return u ? (
                    <li key={id}>
                      <button type="button" className={`${js.button} ${s.topicBtn}`} aria-label={`${u.n}번 문장 화제 고정 해제`} onClick={() => setState((st) => toggleTopic(st, id))}>
                        <span className={s.topicN}>{u.n}번</span> <span className={s.clip}>{u.text}</span> <span aria-hidden>✕</span>
                      </button>
                    </li>
                  ) : null
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="irr-chain" className={js.section}>
            <h3 id="irr-chain" className={s.h}>2. 문장마다 이음매를 표시한다</h3>
            <div role="tablist" aria-label="선지 문장" className={s.tabs} onKeyDown={onTabsKey}>
              {slots.map((sl) => {
                const p = profileOf(state, sl)
                return (
                  <button
                    key={sl.n}
                    type="button"
                    role="tab"
                    data-slot={sl.n}
                    aria-selected={sl.n === active}
                    tabIndex={sl.n === active ? 0 : -1}
                    aria-label={`${sl.n}번 선지 · ${PROFILE_TEXT[p]}${state.suspect === sl.n ? ' · 무관 후보' : ''}`}
                    className={s.tab}
                    onClick={() => pick(sl.n)}
                  >
                    <span className={s.tabN}>{CIRCLED[sl.n - 1]}</span>
                    <span className={s.tabSum} aria-hidden>{summaryGlyph(state, sl)}</span>
                  </button>
                )
              })}
            </div>

            <div role="tabpanel" aria-label={`${slot.n}번 선지 이음매`} className={s.panel}>
              <p className={s.slotText}><span className={s.tabN}>{CIRCLED[slot.n - 1]}</span> {slot.text}</p>
              {(slot.opener || slot.reference) && (
                <p className={js.note}>
                  첫머리 표지: {[slot.opener && `연결사 ${slot.opener}`, slot.reference && `지시 ${slot.reference}`].filter(Boolean).join(' · ')} — 확인할 곳일 뿐, 이것만으로 판단하지 않는다.
                </p>
              )}
              <SeamRow seam="back" slot={slot} state={state} units={byId} setState={setState} onFocus={setSeamFocus} setRefFocus={setRefFocus} />
              {slot.nextId ? (
                <>
                  <SeamRow seam="forward" slot={slot} state={state} units={byId} setState={setState} onFocus={setSeamFocus} setRefFocus={setRefFocus} />
                  <div className={s.removeBar}>
                    <button
                      type="button"
                      className={js.button}
                      data-remove
                      aria-pressed={state.removed === slot.n}
                      onClick={() => { setState((st) => toggleRemoved(st, slot.n)); setSeamFocus('bridge'); setRefFocus(null) }}
                    >
                      {state.removed === slot.n ? `✓ ${CIRCLED[slot.n - 1]} 빼고 읽는 중 — 되돌리기` : `${CIRCLED[slot.n - 1]} 빼고 앞뒤 이어 읽기`}
                    </button>
                  </div>
                  {state.removed === slot.n && (
                    <SeamRow seam="bridge" slot={slot} state={state} units={byId} setState={setState} onFocus={setSeamFocus} setRefFocus={setRefFocus} />
                  )}
                </>
              ) : (
                <p className={js.note}>마지막 문장이라 뒤 이음매와 빼고 읽기 다리가 없다. 앞 이음매 하나로 결론 내리지 말고 앞 문장들의 흐름과 함께 본다.</p>
              )}
              <p className={s.profile} aria-live="polite">판단 모양: {PROFILE_TEXT[profile]}</p>
              {warns.length > 0 && (
                <ul className={s.warns} aria-live="polite">
                  {warns.map((w, i) => <li key={i} data-warn={w.code}><span aria-hidden>! </span>{w.text}</li>)}
                </ul>
              )}
              <button type="button" className={js.button} aria-pressed={state.suspect === slot.n} onClick={() => setState((st) => toggleSuspect(st, slot.n))}>
                {state.suspect === slot.n ? `✓ ${CIRCLED[slot.n - 1]} 을 무관 후보로 둠` : `${CIRCLED[slot.n - 1]} 을 무관 후보로 두기`}
              </button>
            </div>
          </section>

          <section aria-labelledby="irr-reveal" className={js.section}>
            <h3 id="irr-reveal" className={s.h}>3. 해설과 대조한다</h3>
            {rv.status !== 'shown' && (
              <>
                <p className={js.note}>먼저 풀지 않아도 볼 수 있다. 해설을 열면 지금 표시와 해설 근거를 문장별로 나란히 본다.</p>
                <button type="button" className={`${js.button} ${js.primary}`} onClick={() => void request()} aria-disabled={rv.status === 'loading'} data-reveal-btn>
                  {rv.status === 'error' ? '해설 다시 불러오기' : '해설 보기'}
                </button>
              </>
            )}
            <div aria-live="polite">
              {rv.status === 'loading' && <p className={js.status} data-reveal-loading>해설을 불러오는 중…</p>}
              {rv.status === 'error' && <p className={js.error} data-reveal-error={rv.reason}>{REVEAL_ERROR_TEXT[rv.reason]}</p>}
            </div>
            {shown && (
              <RevealView
                data={shown}
                state={state}
                slot={slot}
                units={item.units}
                active={refFocus ?? []}
                onRef={(id) => setRefFocus([id])}
                onFocusIndex={(ids) => setRefFocus(ids)}
              />
            )}
          </section>
        </div>
      }
    />
  )
}

function summaryGlyph(state: ToolState, sl: Slot): string {
  const m = marksOf(state, sl.n)
  const g = (v: 'holds' | 'breaks' | null) => (v === 'holds' ? '○' : v === 'breaks' ? '✕' : '·')
  return sl.nextId ? `앞${g(m.back.verdict)} 뒤${g(m.forward.verdict)} 뺌${g(m.bridge.verdict)}` : `앞${g(m.back.verdict)}`
}

function SeamRow(props: {
  seam: Seam
  slot: Slot
  state: ToolState
  units: Map<string, EvidenceUnit>
  setState: (f: (st: ToolState) => ToolState) => void
  onFocus: (seam: Seam) => void
  setRefFocus: (v: string[] | null) => void
}) {
  const { seam, slot, state, units, setState, onFocus, setRefFocus } = props
  const m = marksOf(state, slot.n)[seam]
  const fromId = seam === 'forward' ? slot.unitId : slot.prevId
  const toId = seam === 'back' ? slot.unitId : slot.nextId
  const from = fromId ? units.get(fromId) : undefined
  const to = toId ? units.get(toId) : undefined
  const touch = () => { onFocus(seam); setRefFocus(null) }
  return (
    <fieldset className={s.seam} data-seam={seam}>
      <legend className={s.seamTitle}>{SEAM_TITLE[seam]}</legend>
      <div className={s.pair}>
        <p className={s.end}><span className={s.topicN}>{from ? `${from.n}번` : '—'}</span> {from ? tail(from.text) : '앞 문장 없음'}</p>
        <span className={s.arrow} aria-hidden>→</span>
        <p className={s.end}><span className={s.topicN}>{to ? `${to.n}번` : '—'}</span> {to ? head(to.text) : '뒤 문장 없음'}</p>
      </div>
      <div className={s.row} role="group" aria-label={`${SEAM_TITLE[seam]} 판단`}>
        {(['holds', 'breaks'] as const).map((v) => (
          <button key={v} type="button" className={js.button} aria-pressed={m.verdict === v} data-verdict={v} onClick={() => { setState((st) => setVerdict(st, slot.n, seam, v)); touch() }}>
            {VERDICT_TEXT[v][seam]}
          </button>
        ))}
      </div>
      <div className={s.row} role="group" aria-label={`${SEAM_TITLE[seam]} 근거 종류`}>
        <span className={s.cueLabel}>무엇으로:</span>
        {CUES.map((c) => (
          <button key={c} type="button" className={`${js.button} ${s.cue}`} aria-pressed={m.cues.includes(c)} data-cue={c} onClick={() => { setState((st) => toggleCue(st, slot.n, seam, c)); touch() }}>
            {m.cues.includes(c) ? '✓ ' : ''}{CUE_LABEL[c]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

const stripMark = (t: string) => t.replace(/^[①②③④⑤]\s*/, '')
function head(t: string): string {
  const w = stripMark(t).split(' ')
  return w.length > 12 ? w.slice(0, 12).join(' ') + ' …' : w.join(' ')
}
function tail(t: string): string {
  const w = stripMark(t).split(' ')
  return w.length > 12 ? '… ' + w.slice(-12).join(' ') : w.join(' ')
}

function RevealView(props: {
  data: RevealData
  state: ToolState
  slot: Slot
  units: EvidenceUnit[]
  active: string[]
  onRef: (id: string) => void
  onFocusIndex: (ids: string[]) => void
}) {
  const { data, state, slot, units, active, onRef, onFocusIndex } = props
  const cmp = compareWithAnswer(state, data.answer)
  const c = data.choices.find((x) => x.n === slot.n)
  const m = marksOf(state, slot.n)
  const mine = (v: 'holds' | 'breaks' | null) => (v === 'holds' ? '○ 이어짐' : v === 'breaks' ? '✕ 끊김' : '표시 없음')
  const locusIds = unitsAtIndex(data.answerLocus?.sentence_index, units)
  return (
    <div className={s.reveal} data-revealed>
      <p className={s.compare}>
        내 무관 후보: <strong>{cmp.suspect ? CIRCLED[cmp.suspect - 1] : '고르지 않음'}</strong> · 해설 정답: <strong>{CIRCLED[cmp.answer - 1]}</strong>
        {cmp.same === null ? '' : cmp.same ? ' — 같다' : ' — 다르다. 아래에서 어느 이음매 판단이 갈렸는지 본다.'}
      </p>
      {data.answerLocus?.reasoning && (
        <div>
          <h4 className={s.h4}>끊긴 자리 근거</h4>
          <p className={s.body}><RefText text={data.answerLocus.reasoning} units={units} active={active} onRef={onRef} /></p>
          {locusIds.length > 0 && (
            <button type="button" className={js.button} onClick={() => onFocusIndex(locusIds)}>원문에서 근거 문장 {locusIds.length}개 가리키기</button>
          )}
        </div>
      )}
      <div>
        <h4 className={s.h4}>{CIRCLED[slot.n - 1]} 문장 — 내 표시와 해설</h4>
        <p className={js.note}>내 표시: 앞 {mine(m.back.verdict)}{slot.nextId ? ` · 뒤 ${mine(m.forward.verdict)} · 빼고 읽기 ${m.bridge.verdict === 'holds' ? '○ 이어짐' : m.bridge.verdict === 'breaks' ? '✕ 빈다' : '표시 없음'}` : ''}</p>
        {c && c.verdict === 'correct' && (
          <p className={s.body}><strong>왜 무관한가: </strong><RefText text={c.why_correct} units={units} active={active} onRef={onRef} /></p>
        )}
        {c && c.verdict === 'correct' && c.confirmed_at?.note && (
          <p className={s.body}><strong>빼면 이어지는 다리: </strong><RefText text={c.confirmed_at.note} units={units} active={active} onRef={onRef} /></p>
        )}
        {c && c.verdict === 'distractor' && (
          <>
            {c.trap && <p className={s.body}><strong>함정: </strong>{c.trap}</p>}
            {c.why_tempting && <p className={s.body}><strong>무관해 보이는 이유: </strong><RefText text={c.why_tempting} units={units} active={active} onRef={onRef} /></p>}
            {c.how_to_reject && <p className={s.body}><strong>흐름에 속하는 근거: </strong><RefText text={c.how_to_reject} units={units} active={active} onRef={onRef} /></p>}
          </>
        )}
        <p className={js.note}>다른 선지는 위 탭에서 바꿔 보면 여기 해설도 바뀐다.</p>
      </div>
      {data.designIntent && (
        <p className={js.hypothesis}><RefText text={data.designIntent} units={units} active={active} onRef={onRef} /></p>
      )}
    </div>
  )
}

/** 문항(id · 판본)이 바뀌면 학습자 조작 상태까지 새로 시작한다 — 이전 문항의 선택 · 공개 상태가 새 원문에 이월되지 않는다 */
export function IrrelevantTool(props: JudgmentToolProps) {
  return <IrrelevantToolBody key={revealBinding(props.item)} {...props} />
}
