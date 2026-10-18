// apps/web/src/components/csat/authored/AuthoredRunner.tsx
//
// 납품받은 창작 자료(authored_item) 실행 화면 — FINAL §4 · §5 · §8.
// 창작 지문은 Vocaflow 저작물이라 문장 원문을 그대로 보여 준다(기출은 문장 번호만). 무엇을 고르는지는 **과제 형식**마다 다르다:
//   central_meaning   ① 중심 문장 ② 떠받치는 문장 ③ 표시된 문장의 관계 ④ 한 줄 요지
//   choice_evidence   ① 답 ② 그 답을 정하는 근거 문장
//   option_correspondence  선지마다 본문과 일치 · 왜곡 · 없음 · 반대 · 좁음 + 대응 문장 → 답
//   contextual_sense  밑줄 낱말의 이 문장 속 뜻 + 근거 문장
//   sentence_relation 표시된 문장 쌍마다 관계
//   form_scope        어법상 틀린 밑줄 + 틀린 이유
// 채점 · 해설은 서버가 기록을 저장한 뒤에만 돌려준다. 역할별: 교수 = 출제 원리 단계 · 안내 연습 = 단서(열면 viewed_first) ·
//   독립 · 전이 · 지연 확인 = 단서 · 해설 없음. 표시 문법: 색만이 아니라 「중심」 「근거」 「반박」 「정답」 글자를 함께 쓴다.
'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'

import { RELATIONS, RELATION_LABEL, type Relation } from '@/lib/knowledge/claim-support-labels'
import type { FormatId } from '@/lib/knowledge/authored/formats'
import type { TeachStep } from '@/lib/knowledge/authored/authored-items'

import styles from '@/components/knowledge/practice.module.css'

type Role = 'model_explanation' | 'guided_practice' | 'independent_check' | 'transfer' | 'delayed_check'
type Reveal = Record<string, unknown>

export interface AuthoredRunnerProps {
  id: string
  /** 출처 — 이 화면을 연 납품 id(제출 · 결속이 이 납품에만 묶인다 · FI-001) */
  deliveryId: string
  role: Role
  format: FormatId
  sentences: string[]
  stem: string
  choices: string[]
  teach: TeachStep[] | null
  hints: string[] | null
  extra: Record<string, unknown>
  probe: number | null
  done: null | { isCorrect: boolean; reveal: Reveal }
  returnHref: string
  /** TASK 이름(머리말) */
  taskLabel?: string
}

interface Binding { status: string; evidence?: boolean; reason?: string | null }

export const ROLE_LABEL: Record<Role, string> = {
  model_explanation: '출제 원리 배우기',
  guided_practice: '안내 연습',
  independent_check: '혼자 확인',
  transfer: '다른 글에 적용',
  delayed_check: '다른 날 다시 확인',
}

const ROLE_NOTE: Record<Role, string> = {
  model_explanation: '출제자가 이 문항을 어떻게 설계했는지 단계별로 읽은 뒤, 같은 글로 직접 풀어 봐요. 이 풀이는 연습으로 남아요.',
  guided_practice: '막히면 단서를 열어도 돼요. 단서를 연 풀이는 「도움 받은 연습」으로 남고, 혼자 확인으로 세지 않아요.',
  independent_check: '처음 보는 글이에요. 단서 · 해설 없이 혼자 풀어요. 이 첫 풀이가 지도에 「혼자 확인」 근거로 돌아가요.',
  transfer: '앞에서 배운 방법을 다른 종류의 질문에 적용해요. 단서 · 해설 없이 혼자 풀어요.',
  delayed_check: '며칠 지난 뒤 새 글로 다시 확인해요. 단서 · 해설 없이 혼자 풀어요.',
}

export const DESIGN_LABEL: Record<string, string> = {
  opposed_view: '필자가 반박하는 생각을 옮긴 선택지',
  too_narrow: '예시 · 세부 하나만 담은 좁은 선택지',
  off_text: '글에 없는 내용이지만 그럴듯한 선택지',
  distorted: '본문 내용을 바꾸거나 과장한 선택지',
  reversed: '본문과 반대로 말하는 선택지',
  basic_meaning: '이 문맥이 아닌 기본 뜻',
  nearby_word: '주변 낱말에 끌린 뜻',
  wrong_part_of_speech: '품사가 다른 뜻',
  collocation_mismatch: '함께 쓰인 말과 맞지 않는 뜻',
  opposite_sense: '반대 방향의 뜻',
}
const VERDICT_LABEL: Record<string, string> = { matches: '일치', distorted: '바꿈 · 과장', not_in_text: '본문에 없음', reversed: '반대', too_narrow: '일부만' }
const PAIR_LABEL: Record<string, string> = { cause_effect: '원인 → 결과', contrast: '대조 · 반전', example: '예시', restatement: '다시 말하기', addition: '덧붙임', sequence: '순서 · 시간' }
const REASON_LABEL: Record<string, string> = {
  agreement: '수 일치', tense_aspect: '시제 · 상', voice: '능동 · 수동', relative_clause: '관계사', participle: '분사',
  parallelism: '병렬 구조', comparison_scope: '비교 범위', negation_scope: '부정 범위', infinitive_gerund: 'to부정사 · 동명사', pronoun_reference: '대명사 지칭',
}
const CIRCLED = '①②③④⑤'
const uuid = () => crypto.randomUUID()

export function AuthoredRunner(p: AuthoredRunnerProps) {
  const [sessionId] = useState<string>(uuid)
  const [help, setHelp] = useState<'independent' | 'viewed_first'>('independent')
  const [hintsOpen, setHintsOpen] = useState(0)
  // 형식 공통 응답 상태 — 형식마다 쓰는 칸이 다르다
  const [claim, setClaim] = useState<number | null>(null)
  const [picked, setPicked] = useState<number[]>([])
  const [relation, setRelation] = useState<Relation | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [verdicts, setVerdicts] = useState<{ verdict: string | null; sentence: number | null }[]>(() => p.choices.map(() => ({ verdict: null, sentence: null })))
  const [pairs, setPairs] = useState<(string | null)[]>(() => ((p.extra.pairs as unknown[]) ?? []).map(() => null))
  const [reason, setReason] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [graded, setGraded] = useState<Record<string, unknown> | null>(null)
  const [reveal, setReveal] = useState<Reveal | null>(p.done?.reveal ?? null)
  const [binding, setBinding] = useState<Binding | null>(null)
  const [rebinding, setRebinding] = useState(false)
  const mutation = useRef<{ key: string; id: string } | null>(null)
  const finished = !!reveal
  const lock = finished || busy

  // 문장 누르기 — central_meaning: 첫 누름 = 중심, 이후 = 근거 · 그 밖의 형식: 근거 문장 토글
  const pick = (k: number) => {
    if (lock) return
    if (p.format === 'central_meaning' && (claim === null || claim === k)) { setClaim(claim === k ? null : k); setPicked((s) => s.filter((x) => x !== k)); return }
    setPicked((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k].sort((a, b) => a - b)))
  }

  const response = (): Record<string, unknown> | null => {
    switch (p.format) {
      case 'central_meaning':
        return claim !== null && picked.length > 0 && (p.probe === null || relation) && choice !== null ? { claim, support: picked, relation: relation ?? 'reason', choice } : null
      case 'choice_evidence':
        return choice !== null && picked.length > 0 ? { choice, evidence: picked } : null
      case 'contextual_sense':
        return choice !== null && picked.length > 0 ? { choice, cue: picked } : null
      case 'option_correspondence':
        return choice !== null && verdicts.every((v) => v.verdict && (v.verdict === 'not_in_text' || v.sentence !== null))
          ? { choice, options: verdicts.map((v) => ({ verdict: v.verdict, sentence: v.verdict === 'not_in_text' ? null : v.sentence })) } : null
      case 'sentence_relation':
        return pairs.every(Boolean) ? { pairs } : null
      case 'form_scope':
        return choice !== null && reason ? { choice, reason } : null
    }
  }
  const ready = response() !== null

  async function submit() {
    const r = response()
    if (!r || busy) return
    setBusy(true); setError(null)
    const key = JSON.stringify(r)
    // 같은 답의 재시도만 같은 제출 id — 답이 바뀌면 새 id
    if (!mutation.current || mutation.current.key !== key) mutation.current = { key, id: uuid() }
    try {
      const res = await fetch(`/api/csat/authored/${p.id}/attempt`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deliveryId: p.deliveryId, response: r, clientSessionId: sessionId, clientMutationId: mutation.current.id, answeredAt: new Date().toISOString(), helpLevel: help }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof j.error === 'string' ? j.error : '저장하지 못했어요 — 잠시 뒤 다시 눌러 주세요'); return }
      setGraded(j.grade as Record<string, unknown>); setReveal(j.reveal as Reveal)
      setBinding(j.binding && typeof j.binding === 'object' ? j.binding as Binding : null)
    } catch {
      setError('연결이 끊겼어요 — 같은 답으로 다시 누르면 한 번만 저장돼요')
    } finally {
      setBusy(false)
    }
  }

  // 복구 — 같은 제출 id 를 이 화면의 납품에 다시 결속(이미 결속돼 있으면 그 결과가 온다)
  async function rebind() {
    if (!mutation.current || rebinding) return
    setRebinding(true)
    try {
      const r = await fetch('/api/csat/delivery/bind', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'authored_item', itemRef: `authored:${p.id}`, clientMutationId: mutation.current.id, deliveryId: p.deliveryId }) })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.binding) setBinding(j.binding as Binding)
    } finally { setRebinding(false) }
  }

  const tagsOf = (k: number): string[] => {
    const t: string[] = []
    const rv = reveal ?? {}
    if (reveal && p.format === 'central_meaning') {
      if (rv.claim === k) t.push('중심')
      else if ((rv.claimRestated as number[] | undefined)?.includes(k)) t.push('중심 다시 말하기')
      else if ((rv.support as number[] | undefined)?.includes(k)) t.push('근거')
      else if ((rv.opposed as number[] | undefined)?.includes(k)) t.push('반박')
    }
    if (reveal && p.format === 'choice_evidence') { if (rv.decisive === k) t.push('결정 근거'); else if ((rv.evidence as number[] | undefined)?.includes(k)) t.push('근거') }
    if (reveal && p.format === 'contextual_sense' && (rv.cue as number[] | undefined)?.includes(k)) t.push('근거')
    if (p.format === 'central_meaning' && claim === k) t.push('내가 고른 중심')
    else if (picked.includes(k)) t.push(p.format === 'central_meaning' ? '내 근거' : '내가 고른 근거')
    if (p.probe === k) t.push('관계 질문')
    const target = p.extra.target as { sentence: number; word: string } | undefined
    if (target?.sentence === k) t.push(`밑줄: ${target.word}`)
    const marks = (p.extra.marks as { sentence: number; text: string }[] | undefined) ?? []
    marks.forEach((m, i) => { if (m.sentence === k) t.push(`${CIRCLED[i]} ${m.text}`) })
    return t
  }
  const selectsSentences = p.format === 'central_meaning' || p.format === 'choice_evidence' || p.format === 'contextual_sense'
  const passageTitle: Record<FormatId, string> = {
    central_meaning: '① 중심 문장(글쓴이가 끝내 말하려는 문장 — 같은 뜻을 다시 말한 문장도 돼요)을 먼저 누르고, ② 그 문장을 떠받치는 문장을 모두 눌러요',
    choice_evidence: '답을 고른 뒤, 그 답을 정하게 만든 문장을 눌러요(꼭 필요한 문장만)',
    contextual_sense: '밑줄 낱말의 뜻을 고른 뒤, 그 뜻을 알려 주는 문장을 눌러요',
    option_correspondence: '글을 읽고 아래에서 선택지마다 본문과 어떻게 맞는지 정해요',
    sentence_relation: '글을 읽고 아래에서 표시된 두 문장 사이의 관계를 골라요',
    form_scope: '밑줄 친 다섯 곳 가운데 어법상 틀린 곳과 그 이유를 골라요',
  }

  return (
    <div className={styles.page} data-testid="authored-runner" data-format={p.format}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>{p.taskLabel ?? '학습'} · {ROLE_LABEL[p.role]}</span>
        <h1>{p.stem}</h1>
        <p className={styles.why}>{ROLE_NOTE[p.role]}</p>
      </header>

      {p.teach && (
        <section className={styles.state} aria-labelledby="teach-h">
          <h2 id="teach-h">출제자는 이렇게 설계했어요</h2>
          <ol className={styles.steps}>
            {p.teach.map((s, i) => (
              <li key={i}>
                <span className={styles.stepNo}>{i + 1}</span>
                <span><b>{s.step}</b><span className={styles.detail}>{s.text}{s.sentences.length > 0 && ` (문장 ${s.sentences.map((x) => x + 1).join(' · ')})`}</span></span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className={styles.task} aria-labelledby="passage-h">
        <h2 id="passage-h">{passageTitle[p.format]}</h2>
        <ol className={styles.bars}>
          {p.sentences.map((s, k) => {
            const tags = tagsOf(k)
            const pressed = selectsSentences ? (claim === k || picked.includes(k)) : undefined
            return (
              <li key={k}>
                <button
                  type="button" className={styles.bar} disabled={lock || !selectsSentences} onClick={() => pick(k)}
                  aria-pressed={pressed}
                  data-claim={(p.format === 'central_meaning' && (reveal ? reveal.claim === k : claim === k)) || undefined}
                  data-evidence={(selectsSentences && picked.includes(k)) || undefined}
                  style={{ minHeight: 'auto', padding: '10px 12px', alignItems: 'flex-start' }}
                >
                  <span style={{ display: 'flex', gap: 10 }}>
                    <span className={styles.barNo}>{k + 1}</span>
                    <span lang="en" style={{ lineHeight: 1.6, fontSize: 15 }}>{s}</span>
                  </span>
                  {tags.length > 0 && <span className={styles.barTags}>{tags.join(' · ')}</span>}
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      {p.format === 'central_meaning' && p.probe !== null && (
        <fieldset className={styles.answer} disabled={lock}>
          <legend>③ 문장 {p.probe + 1}은 중심 문장과 어떤 관계인가요?</legend>
          <div className={styles.chips}>
            {RELATIONS.map((r) => <button key={r} type="button" aria-pressed={relation === r} onClick={() => setRelation(r)}>{RELATION_LABEL[r]}</button>)}
          </div>
        </fieldset>
      )}

      {p.format === 'option_correspondence' && (
        <fieldset className={styles.answer} disabled={lock} data-testid="authored-verdicts">
          <legend>선택지마다 본문과 어떻게 맞나요? (본문에 있으면 그 문장도 골라요)</legend>
          {p.choices.map((c, i) => (
            <div key={i} style={{ display: 'grid', gap: 6 }}>
              <span><span className={styles.barNo}>{CIRCLED[i]}</span> {c}</span>
              <div className={styles.chips}>
                {Object.entries(VERDICT_LABEL).map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={verdicts[i]?.verdict === v} onClick={() => setVerdicts((s) => s.map((x, j) => (j === i ? { ...x, verdict: v } : x)))}>{label}</button>
                ))}
                {verdicts[i]?.verdict && verdicts[i]?.verdict !== 'not_in_text' && (
                  <label className={styles.selectLabel} style={{ display: 'inline-grid' }}>
                    <span className="sr-only">대응 문장</span>
                    <select value={verdicts[i]?.sentence ?? ''} onChange={(e) => setVerdicts((s) => s.map((x, j) => (j === i ? { ...x, sentence: e.target.value === '' ? null : Number(e.target.value) } : x)))}>
                      <option value="">대응 문장</option>
                      {p.sentences.map((_, k) => <option key={k} value={k}>문장 {k + 1}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </div>
          ))}
        </fieldset>
      )}

      {p.format === 'sentence_relation' && (
        <fieldset className={styles.answer} disabled={lock} data-testid="authored-pairs">
          <legend>표시된 두 문장은 어떤 관계인가요?</legend>
          {((p.extra.pairs as [number, number][]) ?? []).map(([a, b], i) => (
            <div key={i} style={{ display: 'grid', gap: 6 }}>
              <span>문장 {a + 1} → 문장 {b + 1}</span>
              <div className={styles.chips}>
                {Object.entries(PAIR_LABEL).map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={pairs[i] === v} onClick={() => setPairs((s) => s.map((x, j) => (j === i ? v : x)))}>{label}</button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      )}

      {p.format === 'form_scope' && (
        <fieldset className={styles.answer} disabled={lock}>
          <legend>어법상 틀린 곳은 어디인가요?</legend>
          <div className={styles.chips}>
            {((p.extra.marks as { text: string }[]) ?? []).map((m, i) => (
              <button key={i} type="button" aria-pressed={choice === i} onClick={() => setChoice(i)}>{CIRCLED[i]} {m.text}</button>
            ))}
          </div>
          <legend>왜 틀렸나요?</legend>
          <div className={styles.chips}>
            {Object.entries(REASON_LABEL).map(([v, label]) => <button key={v} type="button" aria-pressed={reason === v} onClick={() => setReason(v)}>{label}</button>)}
          </div>
        </fieldset>
      )}

      {p.choices.length > 0 && p.format !== 'form_scope' && (
        <fieldset className={styles.answer} disabled={lock}>
          <legend>{p.format === 'central_meaning' ? `④ ${p.stem}` : '답'}</legend>
          <div style={{ display: 'grid', gap: 8 }}>
            {p.choices.map((c, k) => (
              <button key={k} type="button" className={styles.bar} aria-pressed={choice === k} onClick={() => setChoice(k)}
                data-claim={choice === k || undefined} data-key={(reveal && reveal.answer === k) || undefined}
                style={{ minHeight: 44, padding: '10px 12px' }}>
                <span><span className={styles.barNo}>{CIRCLED[k]}</span> {c}</span>
                {reveal && reveal.answer === k && <span className={styles.barTags}>정답</span>}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {p.hints && !finished && (
        <section className={styles.state} aria-live="polite">
          {p.hints.slice(0, hintsOpen).map((h, i) => <p key={i}>단서 {i + 1}. {h}</p>)}
          {hintsOpen < p.hints.length && (
            <button type="button" className={styles.link} onClick={() => { setHelp('viewed_first'); setHintsOpen((x) => x + 1) }}>
              단서 {hintsOpen + 1} 열기{help === 'independent' ? ' (열면 도움 받은 연습으로 남아요)' : ''}
            </button>
          )}
        </section>
      )}

      {!finished && (
        <button type="button" className={styles.primary} disabled={!ready || busy} onClick={submit}>
          {busy ? '저장하는 중…' : '맞춰 보기'}
        </button>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}

      {reveal && (
        <section className={styles.result} aria-live="polite" data-testid="authored-result">
          <h2>{graded ? (graded.isCorrect ? '정확히 해냈어요' : '이번에는 어긋났어요') : (p.done?.isCorrect ? '지난번에 정확히 해냈어요' : '지난번 풀이 결과예요')}</h2>
          <RevealBody format={p.format} reveal={reveal} graded={graded} probe={p.probe} choices={p.choices} />
          {binding?.status === 'bound' && (
            <p className={styles.note} data-testid="authored-binding" data-evidence={String(binding.evidence ?? '')}>
              {binding.evidence ? '이 풀이는 받은 자료에 연결돼 학습 지도에 「혼자 해낸 근거」로 반영돼요.' : '이 풀이는 받은 자료에 연결돼 기록으로 남아요. 연습 · 도움 받은 풀이라 혼자 해낸 근거로는 세지 않아요.'}
            </p>
          )}
          {binding && binding.status !== 'bound' && mutation.current && (
            <p className={styles.note} role="status" data-testid="authored-binding" data-status={binding.status}>
              풀이는 저장됐지만 받은 자료와 연결하지 못했어요.{' '}
              <button type="button" className={styles.link} disabled={rebinding} onClick={rebind}>{rebinding ? '다시 연결하는 중…' : '다시 연결하기'}</button>
            </p>
          )}
          <Link className={styles.link} href={p.returnHref}>학습 지도로 돌아가 변화 보기</Link>
        </section>
      )}
    </div>
  )
}

function RevealBody({ format, reveal: rv, graded: g, probe, choices }: { format: FormatId; reveal: Reveal; graded: Record<string, unknown> | null; probe: number | null; choices: string[] }) {
  const num = (k: unknown) => (typeof k === 'number' ? k + 1 : '?')
  const list = (a: unknown) => ((a as number[] | undefined) ?? []).map((x) => x + 1).join(' · ')
  const distractors = (rv.distractors as { choice: number; design: string; why: string }[] | undefined) ?? []
  const designs = distractors.length > 0 && (
    <>
      <h3>오답은 이렇게 만들어졌어요</h3>
      <ul className={styles.note}>{distractors.map((d) => <li key={d.choice}>{CIRCLED[d.choice]} {DESIGN_LABEL[d.design] ?? d.design} — {d.why}</li>)}</ul>
    </>
  )
  const picked = g && typeof g.choiceDesign === 'string' ? <li>고른 선택지는 {DESIGN_LABEL[g.choiceDesign] ?? g.choiceDesign}예요</li> : null
  switch (format) {
    case 'central_meaning':
      return (
        <>
          <p><b>한 줄 요지</b> — {String(rv.gist ?? '')}</p>
          {g && (
            <ul className={styles.note}>
              <li>중심 문장: {g.claimOk ? '맞음' : g.claimRestated ? '중심을 다시 말한 문장을 골랐어요 — 같은 뜻이라 맞음으로 봐요' : `문장 ${num(rv.claim)}이 중심이에요`}</li>
              <li>떠받치는 문장: {g.supportOk ? '맞음' : (g.supportMissed as number[] | undefined)?.length ? `문장 ${list(g.supportMissed)}도 중심을 떠받쳐요` : '중심과 관계없는 문장을 함께 골랐어요'}</li>
              {probe !== null && <li>관계: {g.relationOk ? '맞음' : '다시 볼 곳 — 표시된 문장이 중심을 어떻게 돕는지 보세요'}</li>}
              <li>요지 선택: {g.choiceOk ? '맞음' : '다시 볼 곳'}</li>
              {picked}
            </ul>
          )}
          {designs}
        </>
      )
    case 'choice_evidence':
      return (
        <>
          <p><b>결정 근거</b> — 문장 {num(rv.decisive)}. {String(rv.rationale ?? '')}</p>
          {g && <ul className={styles.note}><li>답: {g.choiceOk ? '맞음' : `정답은 ${CIRCLED[rv.answer as number]}`}</li><li>근거: {g.decisiveOk ? '결정 근거를 찾았어요' : `결정 근거는 문장 ${num(rv.decisive)}이에요`}{(g.evidenceExtra as number[] | undefined)?.length ? ` · 문장 ${list(g.evidenceExtra)}은 답을 정하지 않아요` : ''}</li>{picked}</ul>}
          {designs}
        </>
      )
    case 'contextual_sense':
      return (
        <>
          <p><b>이 문장에서의 뜻</b> — {String(rv.senseGloss ?? '')} (근거 문장 {list(rv.cue)})</p>
          {g && <ul className={styles.note}><li>뜻: {g.choiceOk ? '맞음' : `정답은 ${CIRCLED[rv.answer as number]}`}</li><li>근거 문장: {g.cueOk ? '맞음' : `뜻을 알려 주는 문장은 ${list(rv.cue)}이에요`}</li>{picked}</ul>}
          {designs}
        </>
      )
    case 'option_correspondence':
      return (
        <ul className={styles.note}>
          {((rv.options as { verdict: string; sentence: number | null; why: string }[]) ?? []).map((o, i) => (
            <li key={i}>{CIRCLED[i]} {choices[i]} — <b>{VERDICT_LABEL[o.verdict]}</b>{o.sentence !== null ? ` (문장 ${o.sentence + 1})` : ''}: {o.why}{g && Array.isArray(g.verdictOk) ? ((g.verdictOk as boolean[])[i] ? ' · 내 판정 맞음' : ' · 내 판정 다름') : ''}</li>
          ))}
        </ul>
      )
    case 'sentence_relation':
      return (
        <ul className={styles.note}>
          {((rv.pairs as { relation: string; alt?: string[]; cue: string }[]) ?? []).map((x, i) => (
            <li key={i}>쌍 {i + 1}: <b>{PAIR_LABEL[x.relation]}</b>{x.alt?.length ? `(또는 ${x.alt.map((a) => PAIR_LABEL[a]).join(' · ')})` : ''} — 단서 「{x.cue}」{g && Array.isArray(g.pairOk) ? ((g.pairOk as boolean[])[i] ? ' · 맞음' : ' · 다름') : ''}</li>
          ))}
        </ul>
      )
    case 'form_scope':
      return (
        <>
          <p><b>틀린 곳</b> — {CIRCLED[rv.answer as number]} · {REASON_LABEL[rv.reason as string]} → 바르게: {String(rv.correction ?? '')}</p>
          {g && <ul className={styles.note}><li>틀린 곳: {g.choiceOk ? '맞음' : '다름'}</li><li>이유: {g.reasonOk ? '맞음' : '다름 — 우연히 맞힌 것과 구별하려고 이유까지 봐요'}</li></ul>}
          <ul className={styles.note}>{((rv.marks as { reason: string; why: string }[]) ?? []).map((m, i) => <li key={i}>{CIRCLED[i]} {REASON_LABEL[m.reason]} — {m.why}</li>)}</ul>
        </>
      )
  }
}
