// apps/web/src/components/csat/judgment/IrrelevantTool.tsx
// 무관한 문장 판단 도구 — 학습자가 중심 화제를 고정하고, ①~⑤ 각 문장의 앞 이음매·뒤 이음매를 근거 종류와 함께 표시하고,
// 문장을 빼고 앞뒤를 이어 읽어 다리가 이어지는지 대조한다. 해설은 학습자가 요청할 때만 받는다.
// U02-COMPARE-01 — 성공한 해설 요청을 보낸 그 순간의 표시를 이 화면 안에만 보존해, 해설 뒤에 고친 지금 표시와 같은 선지 · 이음매로 나란히 본다.
// 다른 경로의 사전 노출은 모르므로 「정답 보기 전」 · 「독립 수행」이라 부르지 않는다. 저장 · 채점 · 기록 없음.
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
  type SeamMark,
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
  // 해설을 요청한 순간의 표시. 로딩 중 중복 누름은 useReveal 이 버리므로 여기서도 덮지 않는다.
  // 문항 · 판본이 바뀌면 바깥 key 로 재마운트되어 같이 사라진다. 공개 성공(shown)일 때만 비교에 쓴다.
  const [asked, setAsked] = useState<ToolState | null>(null)
  const ask = () => {
    setAsked((prev) => snapshotOnRequest(prev, state, rv.status))
    void request()
  }

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
                <button type="button" className={`${js.button} ${js.primary}`} onClick={ask} aria-disabled={rv.status === 'loading'} data-reveal-btn>
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
                asked={asked}
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
  asked: ToolState | null
  slot: Slot
  units: EvidenceUnit[]
  active: string[]
  onRef: (id: string) => void
  onFocusIndex: (ids: string[]) => void
}) {
  const { data, state, asked, slot, units, active, onRef, onFocusIndex } = props
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
        {asked ? (
          <CompareTable asked={asked} now={state} slot={slot} units={units} onPoint={onRef} />
        ) : (
          <p className={js.note}>내 표시: 앞 {mine(m.back.verdict)}{slot.nextId ? ` · 뒤 ${mine(m.forward.verdict)} · 빼고 읽기 ${m.bridge.verdict === 'holds' ? '○ 이어짐' : m.bridge.verdict === 'breaks' ? '✕ 빈다' : '표시 없음'}` : ''}</p>
        )}
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

/** 해설 요청 순간의 스냅샷 — 이미 요청이 진행 중(loading)이면 그 요청의 스냅샷을 지킨다(중복 누름은 새 요청이 아니다). */
export function snapshotOnRequest(prev: ToolState | null, current: ToolState, status: 'hidden' | 'loading' | 'shown' | 'error'): ToolState | null {
  if (status === 'loading' || status === 'shown') return prev
  return current
}

export type CompareRow = { key: 'topic' | 'suspect' | Seam; label: string; asked: string; now: string; changed: boolean }

const markText = (seam: Seam, m: SeamMark): string => {
  const v = m.verdict === 'holds' ? '○ 이어짐' : m.verdict === 'breaks' ? (seam === 'bridge' ? '✕ 빈다' : '✕ 끊김') : '표시 없음'
  return m.cues.length ? `${v} · ${CUES.filter((c) => m.cues.includes(c)).map((c) => CUE_LABEL[c]).join('·')}` : v
}

/** 같은 선지의 같은 이음매끼리 「해설 요청 당시」 와 「지금」 을 맞댄다. 문구가 같으면 바뀌지 않은 것이다(꾸미지 않는다). */
export function compareRows(asked: ToolState, now: ToolState, slot: Pick<Slot, 'n' | 'nextId'>, units: readonly Pick<EvidenceUnit, 'id' | 'n'>[] = []): CompareRow[] {
  // 중심 화제 고정 — 문장 번호 순으로(고정 순서만 다른 것은 바꾼 것이 아니다). 번호를 모르는 단위는 id 로 둔다.
  const no = new Map(units.map((u) => [u.id, u.n]))
  const topic = (st: ToolState) => {
    const ns = [...st.topic].sort((a, b) => (no.get(a) ?? Infinity) - (no.get(b) ?? Infinity) || a.localeCompare(b)).map((id) => (no.has(id) ? `${no.get(id)}번` : id))
    return ns.length ? ns.join('·') : '고정 없음'
  }
  const sus = (st: ToolState) => (st.suspect ? CIRCLED[st.suspect - 1] : '고르지 않음')
  const rows: CompareRow[] = [{ key: 'topic', label: '중심 화제 문장', asked: topic(asked), now: topic(now), changed: false }, { key: 'suspect', label: '무관 후보', asked: sus(asked), now: sus(now), changed: false }]
  const seams: Seam[] = slot.nextId ? ['back', 'forward', 'bridge'] : ['back']
  const label: Record<Seam, string> = { back: `${CIRCLED[slot.n - 1]} 앞 이음매`, forward: `${CIRCLED[slot.n - 1]} 뒤 이음매`, bridge: `${CIRCLED[slot.n - 1]} 빼고 읽기` }
  for (const seam of seams) rows.push({ key: seam, label: label[seam], asked: markText(seam, marksOf(asked, slot.n)[seam]), now: markText(seam, marksOf(now, slot.n)[seam]), changed: false })
  for (const r of rows) r.changed = r.asked !== r.now
  return rows
}

/**
 * T-0270 — 비교표 「중심 화제 문장」 칸의 실제 unit id 를 원문 문장으로 푼다(표시 문자열에서 id 를 역추정하지 않는다).
 * 문장 번호 순 · 지금 원문에 있으면 가리키기 가능(unit), 없으면 unknown. 고정 없음이면 빈 배열.
 */
export type TopicTarget = { kind: 'unit'; id: string; n: number } | { kind: 'unknown'; id: string }
export function topicTargets(ids: readonly string[], units: readonly Pick<EvidenceUnit, 'id' | 'n'>[]): TopicTarget[] {
  const no = new Map(units.map((u) => [u.id, u.n]))
  return [...ids]
    .sort((a, b) => (no.get(a) ?? Infinity) - (no.get(b) ?? Infinity) || a.localeCompare(b))
    .map((id) => (no.has(id) ? { kind: 'unit' as const, id, n: no.get(id)! } : { kind: 'unknown' as const, id }))
}

function CompareTable({ asked, now, slot, units, onPoint }: { asked: ToolState; now: ToolState; slot: Slot; units: EvidenceUnit[]; onPoint: (id: string) => void }) {
  const rows = compareRows(asked, now, slot, units)
  // 화제 칸만 「N번」 단추 — 기존 onRef(원문 초점 · 화면 밖이면 위치 칩)만 쓴다. 화제 고정 · 스냅샷 · 해설 요청은 건드리지 않는다
  const topicCell = (st: ToolState, when: '해설 요청 당시' | '지금') => {
    const ts = topicTargets(st.topic, units)
    if (ts.length === 0) return '고정 없음'
    return ts.map((t, i) => (
      <span key={t.id}>
        {i > 0 ? '·' : null}
        {t.kind === 'unit' ? (
          <button type="button" className={js.button} data-topic-point={t.id} aria-label={`${when} 화제 ${t.n}번 문장 원문에서 보기`} onClick={() => onPoint(t.id)}>
            {t.n}번
          </button>
        ) : (
          <span data-topic-unknown>원문에서 찾을 수 없는 문장</span>
        )}
      </span>
    ))
  }
  const changed = rows.filter((r) => r.changed).length
  const cell = { padding: '6px 8px', borderTop: '1px solid var(--bd)', textAlign: 'left' as const, verticalAlign: 'top' as const, overflowWrap: 'anywhere' as const }
  return (
    <div data-irr-compare>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, tableLayout: 'fixed' }}>
        <caption className={js.note} style={{ textAlign: 'left', captionSide: 'top' }}>
          해설을 요청할 때의 표시와 지금 표시 — {changed === 0 ? '바꾼 것 없음' : `${changed}곳 바뀜`}
        </caption>
        <thead>
          <tr>
            <th scope="col" style={cell}>자리</th>
            <th scope="col" style={cell}>해설 요청 당시</th>
            <th scope="col" style={cell}>지금</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} data-compare-row={r.key} data-changed={r.changed || undefined}>
              <th scope="row" style={{ ...cell, fontWeight: 600 }}>{r.label}</th>
              <td style={cell}>{r.key === 'topic' ? topicCell(asked, '해설 요청 당시') : r.asked}</td>
              <td style={{ ...cell, fontWeight: r.changed ? 700 : 400 }}>{r.key === 'topic' ? topicCell(now, '지금') : r.now}{r.changed ? <span data-changed-tag> · 바뀜</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 문항(id · 판본)이 바뀌면 학습자 조작 상태까지 새로 시작한다 — 이전 문항의 선택 · 공개 상태가 새 원문에 이월되지 않는다 */
export function IrrelevantTool(props: JudgmentToolProps) {
  return <IrrelevantToolBody key={revealBinding(props.item)} {...props} />
}
