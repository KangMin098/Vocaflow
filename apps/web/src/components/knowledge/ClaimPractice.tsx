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
  // 이 세션에서 판단을 한 번이라도 보냈나(성공 · 실패 무관). 보낸 뒤에는 도움 수준을 바꾸지 않는다
  const submitted = useRef(false)
  // 판단을 보낸 뒤 해설을 연 시각 — 도움 수준이 아니라 별도 행동으로 기록한다
  const [explanationViewedAt, setExplanationViewedAt] = useState<string | null>(null)
  const [claim, setClaim] = useState<number | null>(null)
  const [support, setSupport] = useState<number[]>([])
  const [relation, setRelation] = useState<Relation | null>(null)
  const [option, setOption] = useState<number | null | 'unknown'>(null)
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null)
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  // E11 복습 예약 — 이 세션(문항)에 잡은 다시 보기 날짜(YYYY-MM-DD). 학습 지도가 날짜가 되면 「다시 보기」를 띄운다
  const [reviewAt, setReviewAt] = useState<string | null>(null)
  const [reviewBusy, setReviewBusy] = useState(false)
  // 예약 요청의 마친 시각 — 첫 시도에 정하고 재시도에 그대로(서버 멱등 비교가 같은 payload 를 요구)
  const reviewFinishedAt = useRef<string | null>(null)
  // 지금 보고 있는 세션 — 늦게 온 예약 응답이 다른 문항에 붙지 않게(Codex P1)
  const currentSession = useRef(sessionId)
  currentSession.current = sessionId
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const started = useRef<number>(Date.now())
  // 같은 답의 재시도만 같은 제출 id · 판단 시각을 쓴다(G2 요청 멱등). 답이 바뀌면 새 id
  // 판단 소요(sec)도 첫 전송 값으로 고정한다 — 재전송에서 sec 가 바뀌면 서버가 같은 id 의 다른 요청(conflict)으로 거부한다(Codex P1)
  const pending = useRef<{ sig: string; id: string; at: string; sec: number } | null>(null)
  // 마지막으로 보낸 판단 본문(해설 열람 시각 제외) — 해설 열람은 이 본문 그대로 + 열람 시각을 따로 보낸다
  const lastBody = useRef<Record<string, unknown> | null>(null)
  // 판단 전 해설 열람(최초 시각 고정 · 저장 여부)
  const preView = useRef<{ body: Record<string, unknown>; saved: boolean } | null>(null)
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
    submitted.current = false
    setExplanationViewedAt(null)
    setClaim(null)
    setSupport([])
    setRelation(null)
    setOption(null)
    setConfidence(null)
    setFeedback(null)
    setReviewAt(null)
    reviewFinishedAt.current = null
    setError(null)
    pending.current = null
    lastBody.current = null
    preView.current = null
    started.current = Date.now()
  }

  // 판단을 보낸 뒤 해설을 열었으면 답을 잠근다 — 같은 답의 재전송만 남는다. 해설을 보고 바꾼 답이
  // 독립 수행(이 세션의 independent)으로 저장되는 길을 막는다(Codex P1). 바꾸려면 다른 문항 · 새 세션으로 간다
  const frozen = explanationViewedAt !== null

  function tapSentence(i: number) {
    if (feedback || lock.current || frozen) return
    if (claim === null) return setClaim(i)
    if (i === claim) {
      setClaim(null)
      return
    }
    setSupport((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : xs.length >= 3 ? xs : [...xs, i].sort((a, b) => a - b)))
  }

  function openExplanation() {
    // 시도가 아니다. 판단을 내기 전이면 이 세션의 도움 수준이 viewed_first 가 된다(되돌리지 않는다).
    // 판단을 이미 보낸 세션은 도움 수준을 바꾸지 않는다 — 공개는 이미 independent 로 적용됐을 수 있다(G2 세션 단조 규칙).
    // 그때의 열람은 별도 행동(explanationViewedAt)으로 남긴다. 해설은 새 탭에서 연다
    if (submitted.current) return noteView()
    setHelpLevel('viewed_first')
    if (!entry) return
    // 판단 전 열람도 그 순간 서버에 남긴다(별도 요청 · 시도 아님). 최초 열람 시각은 한 번 정하고 저장될 때까지 같은 본문으로 다시 보낸다
    if (!preView.current) preView.current = { body: { itemId: entry.itemId, clientSessionId: sessionId, viewedAt: new Date().toISOString(), preview }, saved: false }
    if (!preView.current.saved) void sendPreView()
  }

  // 판단 전 열람 저장 — 성공 여부를 돌려준다. 실패하면 판단 제출이 먼저 이것을 다시 보내고, 그래도 실패하면 제출하지 않는다
  // (열람 기록 없이 판단만 남으면 서버에서 독립 판단처럼 보일 수 있다 — 조용히 넘기지 않는다)
  async function sendPreView(): Promise<boolean> {
    const v = preView.current
    if (!v || v.saved) return true
    try {
      const res = await fetch('/api/csat/practice/view', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v.body), keepalive: true })
      v.saved = res.ok
    } catch {
      v.saved = false
    }
    if (!v.saved) setError('해설 열람을 기록하지 못했어요 — 맞춰 보기를 누르면 다시 보내요')
    return v.saved
  }

  // 판단 뒤 해설 열람 — 열람하는 그 순간 따로 보낸다(별도 mutation · 서버가 판단과 다른 id 로 learning_session_apply).
  // 본문은 마지막 판단 그대로(재전송 = duplicate) + 열람 시각. 판단 저장이 실패했었다면 이 요청이 그 판단도 함께 남긴다
  function noteView() {
    const t = explanationViewedAt ?? new Date().toISOString()
    setExplanationViewedAt(t)
    const body = lastBody.current
    if (!body) return
    void fetch('/api/csat/practice/attempt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, explanationViewedAt: t }),
      keepalive: true,
    })
      .then(async (res) => {
        const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!j?.ok) setError(j?.error ?? '해설 열람을 기록하지 못했어요')
      })
      .catch(() => setError('해설 열람을 기록하지 못했어요'))
  }

  async function submit() {
    if (!entry || claim === null || option === null || confidence === null || (needsRelation && relation === null) || lock.current) return
    lock.current = true
    if (!(await sendPreView())) {
      lock.current = false
      return
    }
    submitted.current = true
    const asked = entry.itemId
    const answer = { claim, support, relation: needsRelation ? relation : null, option: option === 'unknown' ? null : option, confidence }
    const sig = JSON.stringify([asked, sessionId, helpLevel, answer])
    if (!pending.current || pending.current.sig !== sig) pending.current = { sig, id: uuid(), at: new Date().toISOString(), sec: (Date.now() - started.current) / 1000 }
    const body = {
      itemId: asked,
      ...answer,
      sec: pending.current.sec,
      clientMutationId: pending.current.id,
      clientSessionId: sessionId,
      answeredAt: pending.current.at,
      helpLevel,
      preview,
    }
    lastBody.current = body
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/csat/practice/attempt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, explanationViewedAt }),
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

  async function scheduleReview(days: 1 | 3 | 7) {
    if (!entry || reviewBusy) return
    const askedSession = sessionId
    const stillHere = () => currentSession.current === askedSession
    setReviewBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/csat/practice/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: entry.itemId, clientSessionId: sessionId, days, finishedAt: (reviewFinishedAt.current ??= new Date().toISOString()), preview }),
      })
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; reviewAt?: string } | null
      if (!stillHere()) return
      if (!j?.ok || !j.reviewAt) throw new Error(j?.error ?? '예약하지 못했어요')
      setReviewAt(j.reviewAt.slice(0, 10))
    } catch (e) {
      if (stillHere()) setError(e instanceof Error ? e.message : '예약하지 못했어요')
    } finally {
      setReviewBusy(false)
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
              ) : submitted.current ? (
                <a className={styles.link} href={`/csat/item/${toItemSlug(entry.itemId)}`} target="_blank" rel="noreferrer" onClick={openExplanation}>
                  해설 보기
                </a>
              ) : (
                <a className={styles.link} href={`/csat/item/${toItemSlug(entry.itemId)}`} target="_blank" rel="noreferrer" onClick={openExplanation}>
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
                    disabled={!!feedback || busy || frozen}
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
                      <button key={r} type="button" aria-pressed={relation === r} disabled={busy || frozen} onClick={() => setRelation(r)}>
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
                    <button key={n} type="button" aria-pressed={option === n} disabled={busy || frozen} onClick={() => setOption(n)}>
                      {n}번
                    </button>
                  ))}
                  <button type="button" aria-pressed={option === 'unknown'} disabled={busy || frozen} onClick={() => setOption('unknown')}>
                    아직 안 골랐어요
                  </button>
                </div>
              </fieldset>
              <fieldset>
                <legend>주장 문장, 얼마나 확신해요?</legend>
                <div className={styles.chips}>
                  {([1, 2, 3] as const).map((n) => (
                    <button key={n} type="button" aria-pressed={confidence === n} disabled={busy || frozen} onClick={() => setConfidence(n)}>
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

          {frozen && !feedback && (
            <p className={styles.note} role="status">
              해설을 열어서 답을 고칠 수 없어요 — 보낸 답 그대로 다시 맞춰 볼 수 있어요.
            </p>
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
                <a className={styles.link} href={`/csat/item/${toItemSlug(entry.itemId)}`} onClick={noteView}>
                  이 문항 해설 보기
                </a>
              </div>
              {/* E11 복습 예약 → 학습 지도 「다시 보기」 → 문항 확인 과제로 재평가 */}
              <div className={styles.chips} role="group" aria-label="다시 보기 예약">
                {reviewAt ? (
                  <p className={styles.note} role="status">{reviewAt} 에 다시 보기로 예약했어요 — 학습 지도에서 날짜가 되면 알려 드려요.</p>
                ) : (
                  ([1, 3, 7] as const).map((d) => (
                    <button key={d} type="button" className={styles.link} disabled={reviewBusy} onClick={() => scheduleReview(d)}>
                      {d}일 뒤 다시 보기
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
