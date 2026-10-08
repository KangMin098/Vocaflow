// apps/web/src/components/knowledge/ClaimPractice.tsx
//
// 「주장과 근거」 연습 — 학습자는 자기 문제지를 보며 ① 주장 문장 ② 근거 문장(0~3) ③ (주석 문항) 관계 ④ 선지 · 확신을 고른다.
// 이식 원천: 동결 feat/knowledge-vnext 의 같은 파일. 바뀐 점(docs/csat-learner/PRACTICE_PORT.md):
//   - 채점은 서버의 정본 gradeClaimSupport. 정답 키는 기록이 저장된 뒤 응답으로만 온다.
//   - 문항을 열 때마다 client_session_id, 제출마다 client_mutation_id(같은 답의 재시도만 같은 id), 판단 시각 answered_at 을 보낸다.
//   - 「해설 먼저 보기」는 시도가 아니다 — 그 세션의 도움 수준을 viewed_first 로 바꾸고, 뒤에 낸 판단도 독립 수행으로 세지 않는다.
//   - 분석 이벤트를 보내지 않는다(knowledge_task_* 는 DB 허용 목록 밖 · G2 적용 뒤 한 커밋으로 켠다).
// 유지한 것: 제출 중 문항 전환 잠금 · 응답이 요청한 문항일 때만 표시 · 「다음 문항」은 서버 기록과 이 화면 기록의 문항 id 합집합으로 센다.
// 표시 문법: 주장 = 굵은 테 + 「주장」 · 근거 = 실선 + 「근거」 · 함정 = 점선 + 「함정」 · 내 선택 = 「내 선택」(색만으로 전하지 않는다).
'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { toItemSlug } from '@/lib/csat/item-slug'
import { RELATIONS, RELATION_LABEL, type Relation } from '@/lib/knowledge/claim-support-labels'
import { TYPE_LABEL, pickNext, type HelpLevel, type PoolKind, type PracticeFeedback, type PracticePhase } from '@/lib/knowledge/practice'
import type { CapabilityJudgement } from '@/lib/knowledge/protocol'

import styles from './practice.module.css'

interface PoolView {
  itemId: string
  no: number
  examLabel: string
  typeId: string
  phase: PracticePhase
  kind: PoolKind
  bars: number[]
  relationSentence: number | null
  done: boolean
}

const STATE_LABEL: Record<CapabilityJudgement['state'], string> = {
  unconfirmed: '아직 판단하지 않음',
  confirmed: '확인됨',
  needs_practice: '연습 중',
}

const PROCEDURE = [
  { title: '주장 문장 고르기', detail: '문제지에서 글쓴이가 끝내 말하려는 문장을 찾아 그 번호의 막대를 눌러요.' },
  { title: '근거 문장 고르기', detail: '그 주장을 떠받치는 문장을 0~3개 눌러요. 없다고 생각하면 넘어가도 돼요.' },
  { title: '관계 정하기 · 답 고르기', detail: '표시된 문장이 주장과 어떤 관계인지 고르고, 문제지에서 고른 답과 확신을 남겨요.' },
  { title: '맞춰 보기', detail: '기록이 저장된 뒤에 주장 · 근거 문장이 표시돼요.' },
]

const uuid = () => crypto.randomUUID()

export function ClaimPractice(props: {
  preview: boolean
  judgement: CapabilityJudgement
  pool: PoolView[]
  initialItemId: string | null
  recommendedItemId: string | null
  history: { phase: PracticePhase; claimHit: boolean | null; helpLevel: HelpLevel }[]
}) {
  const { preview, judgement, pool, recommendedItemId } = props
  const router = useRouter()
  const [itemId, setItemId] = useState<string | null>(props.initialItemId)
  const [sessionId, setSessionId] = useState<string>(uuid)
  const [helpLevel, setHelpLevel] = useState<HelpLevel>('independent')
  const [claim, setClaim] = useState<number | null>(null)
  const [support, setSupport] = useState<number[]>([])
  const [relation, setRelation] = useState<Relation | null>(null)
  const [option, setOption] = useState<number | null | 'unknown'>(null)
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null)
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const started = useRef<number>(Date.now())
  // 같은 답의 재시도만 같은 제출 id · 판단 시각을 쓴다(G2 요청 멱등). 답이 바뀌면 새 id
  const pending = useRef<{ sig: string; id: string; at: string } | null>(null)
  const [doneHere, setDoneHere] = useState<string[]>([])

  const entry = pool.find((p) => p.itemId === itemId) ?? null
  const bars = useMemo(() => entry?.bars ?? [], [entry])
  const maxChars = Math.max(1, ...bars)
  const needsRelation = entry?.relationSentence != null

  function choose(id: string) {
    if (lock.current) return
    setItemId(id)
    setSessionId(uuid())
    setHelpLevel('independent')
    setClaim(null)
    setSupport([])
    setRelation(null)
    setOption(null)
    setConfidence(null)
    setFeedback(null)
    setError(null)
    pending.current = null
    started.current = Date.now()
  }

  function tapSentence(i: number) {
    if (feedback || lock.current) return
    if (claim === null) return setClaim(i)
    if (i === claim) {
      setClaim(null)
      return
    }
    setSupport((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : xs.length >= 3 ? xs : [...xs, i].sort((a, b) => a - b)))
  }

  function viewFirst() {
    // 시도가 아니다 — 이 세션의 도움 수준만 바뀐다(되돌리지 않는다). 해설은 새 탭에서 연다
    setHelpLevel('viewed_first')
  }

  async function submit() {
    if (!entry || claim === null || option === null || confidence === null || (needsRelation && relation === null) || lock.current) return
    lock.current = true
    const asked = entry.itemId
    const answer = { claim, support, relation: needsRelation ? relation : null, option: option === 'unknown' ? null : option, confidence }
    const sig = JSON.stringify([asked, sessionId, helpLevel, answer])
    if (!pending.current || pending.current.sig !== sig) pending.current = { sig, id: uuid(), at: new Date().toISOString() }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/csat/practice/attempt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itemId: asked,
          ...answer,
          sec: (Date.now() - started.current) / 1000,
          clientMutationId: pending.current.id,
          clientSessionId: sessionId,
          answeredAt: pending.current.at,
          helpLevel,
          preview,
        }),
      })
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; feedback?: PracticeFeedback } | null
      if (!j?.ok || !j.feedback) throw new Error(j?.error ?? '기록하지 못했어요')
      if (j.feedback && asked !== itemId) return
      setFeedback(j.feedback)
      setDoneHere((d) => (d.includes(asked) ? d : [...d, asked]))
    } catch (e) {
      setError(e instanceof Error ? e.message : '기록하지 못했어요')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  function goNext() {
    router.refresh()
    const done = new Set([...pool.filter((p) => p.done).map((p) => p.itemId), ...doneHere])
    const trainDone = pool.filter((p) => p.phase === 'practice' && done.has(p.itemId)).length
    const next = pickNext(
      { practice: pool.filter((p) => p.phase === 'practice').map((p) => p.itemId), transfer: pool.filter((p) => p.phase === 'transfer').map((p) => p.itemId) },
      done,
      trainDone,
    )
    if (next) choose(next.itemId)
  }

  const step = feedback ? 4 : claim === null ? 1 : option === null || confidence === null || (needsRelation && relation === null) ? 3 : 4
  const groups: { label: string; items: PoolView[] }[] = [
    { label: '연습(주장 · 요지)', items: pool.filter((p) => p.phase === 'practice') },
    { label: '다른 유형에 옮겨 보기(주제 · 제목)', items: pool.filter((p) => p.phase === 'transfer') },
  ]

  return (
    <div className={styles.page} data-knowledge-practice>
      {preview && (
        <p className={styles.preview} role="status">
          관리자 미리보기 — 골격 문항(검증 전 후보)까지 보여요. 이 기록은 합성 기록으로 남고 효과 계산에 들어가지 않아요.
        </p>
      )}

      <header className={styles.head}>
        <p className={styles.eyebrow}>주장과 근거</p>
        <h1>주장 문장 먼저 찾기</h1>
        <p className={styles.why}>
          글 속 문장들이 주장과 어떤 관계인지 — 이유를 대며 떠받치는지, 같은 말을 다시 하는지, 필자가 반박하는 생각인지 — 가려 보면 주장이
          어디 있는지 분명해져요. 문제지를 펴고 문장 번호로 직접 가려 봐요.
        </p>
      </header>

      <section className={styles.state} aria-labelledby="cap-state">
        <h2 id="cap-state">지금 내 상태</h2>
        <p>
          <strong className={styles.badge} data-state={judgement.state}>
            {STATE_LABEL[judgement.state]}
          </strong>{' '}
          {judgement.message}
        </p>
        {props.history.length > 0 && (
          <ol className={styles.history} aria-label="최근 기록">
            {props.history.map((h, i) => (
              <li key={i} data-hit={h.claimHit === true}>
                {h.claimHit ? '찾음' : '놓침'}
                {h.phase === 'transfer' ? ' · 다른 유형' : ''}
                {h.helpLevel === 'viewed_first' ? ' · 해설 먼저' : ''}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="how">
        <h2 id="how">이렇게 해요</h2>
        <ol className={styles.steps}>
          {PROCEDURE.map((s, i) => (
            <li key={i} aria-current={i + 1 === step ? 'step' : undefined}>
              <span className={styles.stepNo}>{i + 1}</span>
              <span>
                <b>{s.title}</b>
                <span className={styles.detail}>{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.picker} aria-labelledby="pick">
        <h2 id="pick">문항 고르기</h2>
        <label className={styles.selectLabel}>
          <span>풀 문항</span>
          <select value={itemId ?? ''} disabled={busy} onChange={(e) => choose(e.target.value)}>
            {groups
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((p) => (
                    <option key={p.itemId} value={p.itemId}>
                      {p.examLabel} {p.no}번 · {TYPE_LABEL[p.typeId] ?? p.typeId}
                      {p.kind === 'skeleton' ? ' · 검증 전' : ''}
                      {p.done ? ' · 해 봄' : ''}
                      {p.itemId === recommendedItemId ? ' · 추천' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </label>
        <p className={styles.note}>추천은 순서일 뿐이에요. 원하는 문항으로 언제든 바꿔도 돼요.</p>
      </section>

      {entry && (
        <section className={styles.task} aria-labelledby="task">
          <h2 id="task">
            문제지에서 <b>{entry.examLabel} {entry.no}번</b>을 펴요
          </h2>
          <p className={styles.note}>
            아래 막대는 지문의 문장을 순서대로 길이만큼 그린 거예요. 문제지의 문장과 하나씩 맞춰 보세요.
            {claim === null ? ' 먼저 글쓴이의 주장이 담긴 문장을 누르세요.' : ' 이제 그 주장을 받치는 근거 문장을 0~3개 누르세요(다시 누르면 취소).'}
          </p>
          {!feedback && (
            <p className={styles.note}>
              {helpLevel === 'viewed_first' ? (
                <span role="status">해설을 먼저 봤어요 — 이번 판단은 스스로 푼 기록과 따로 세요.</span>
              ) : (
                <a className={styles.link} href={`/csat/item/${toItemSlug(entry.itemId)}`} target="_blank" rel="noreferrer" onClick={viewFirst}>
                  모르겠어요 — 해설 먼저 보기
                </a>
              )}
            </p>
          )}
          <ol className={styles.bars}>
            {bars.map((c, i) => {
              const mine = claim === i
              const myEv = support.includes(i)
              const isClaim = feedback?.claimSentences.includes(i) ?? false
              const isSupport = feedback?.supportSentences.includes(i) ?? false
              const isTrap = feedback?.trapSentences.includes(i) ?? false
              const tags = [
                mine ? '내 선택: 주장' : null,
                myEv ? '내 선택: 근거' : null,
                isClaim ? '주장' : null,
                isSupport ? '근거' : null,
                isTrap ? '함정' : null,
                entry.relationSentence === i && !feedback ? '관계 질문' : null,
              ].filter(Boolean)
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={styles.bar}
                    style={{ ['--w' as string]: `${Math.max(28, Math.round((c / maxChars) * 100))}%` }}
                    data-claim={mine || undefined}
                    data-evidence={myEv || undefined}
                    data-key={isClaim || isSupport || undefined}
                    data-trap={isTrap || undefined}
                    aria-pressed={mine || myEv}
                    disabled={!!feedback || busy}
                    onClick={() => tapSentence(i)}
                  >
                    <span className={styles.barNo}>문장 {i + 1}</span>
                    {tags.length > 0 && <span className={styles.barTags}>{tags.join(' · ')}</span>}
                  </button>
                </li>
              )
            })}
          </ol>

          {claim !== null && !feedback && (
            <div className={styles.answer}>
              {needsRelation && entry.relationSentence !== null && (
                <fieldset>
                  <legend>문장 {entry.relationSentence + 1}은 주장과 어떤 관계예요?</legend>
                  <div className={styles.chips}>
                    {RELATIONS.map((r) => (
                      <button key={r} type="button" aria-pressed={relation === r} disabled={busy} onClick={() => setRelation(r)}>
                        {RELATION_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <fieldset>
                <legend>문제지에서 고른 답</legend>
                <div className={styles.chips}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-pressed={option === n} disabled={busy} onClick={() => setOption(n)}>
                      {n}번
                    </button>
                  ))}
                  <button type="button" aria-pressed={option === 'unknown'} disabled={busy} onClick={() => setOption('unknown')}>
                    아직 안 골랐어요
                  </button>
                </div>
              </fieldset>
              <fieldset>
                <legend>주장 문장, 얼마나 확신해요?</legend>
                <div className={styles.chips}>
                  {([1, 2, 3] as const).map((n) => (
                    <button key={n} type="button" aria-pressed={confidence === n} disabled={busy} onClick={() => setConfidence(n)}>
                      {n === 1 ? '잘 모르겠어요' : n === 2 ? '아마도' : '확실해요'}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                className={styles.primary}
                disabled={busy || option === null || confidence === null || (needsRelation && relation === null)}
                onClick={submit}
              >
                {busy ? '기록하는 중…' : '맞춰 보기'}
              </button>
            </div>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {feedback && (
            <div className={styles.result} role="status">
              <h3>{feedback.claimHit ? '주장 문장을 찾았어요' : '주장은 다른 문장이에요'}</h3>
              <p>
                주장: 문장 {feedback.claimSentences.map((i) => i + 1).join(', ')}
                {feedback.supportSentences.length > 0 && ` · 근거: 문장 ${feedback.supportSentences.map((i) => i + 1).join(', ')}${feedback.supportOk ? ' (맞음)' : ' (다름)'}`}
                {feedback.relationProbe && feedback.relationOk !== null && ` · 관계: ${RELATION_LABEL[feedback.relationProbe.relation]}${feedback.relationOk ? ' (맞음)' : ' (다름)'}`}
                {feedback.trapSentences.length > 0 && ` · 함정: 문장 ${feedback.trapSentences.map((i) => i + 1).join(', ')}`}
                {feedback.optionCorrect !== null && ` · 고른 답 ${feedback.optionCorrect ? '맞음' : '틀림'}`}
              </p>
              {feedback.helpLevel === 'viewed_first' && <p className={styles.note}>해설을 먼저 본 기록이라 「지금 내 상태」 판단에는 넣지 않아요.</p>}
              <p className={styles.next}>{feedback.next}</p>
              <div className={styles.chips}>
                <button type="button" className={styles.primary} onClick={goNext}>
                  다음 문항
                </button>
                <a className={styles.link} href={`/csat/item/${toItemSlug(entry.itemId)}`}>
                  이 문항 해설 보기
                </a>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
