// apps/web/src/components/knowledge/ClaimPractice.tsx
//
// 주장과 근거 과제 — 학습자는 자기 문제지를 보며 ① 주장 문장 ② 근거 문장(0~3) ③ 선지 ④ 확신을 고른다.
// 화면에는 문장 길이 막대와 번호만 있다(지문 글자 없음 — 저작권 경계). 정답 근거 문장은 제출이 기록된 뒤에 표시된다.
// 표시 문법: 정답 근거 = 실선 + 「근거」 글자 · 오답이 기대는 문장 = 점선 + 「함정」 글자 · 내가 고른 문장 = 「내 선택」 글자(색만으로 전하지 않는다).
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@/lib/analytics/client'
import { toItemSlug } from '@/lib/csat/item-slug'
import { pickNext, type ClaimFeedback } from '@/lib/knowledge/practice'
import type { CapabilityJudgement, ProcedureStep } from '@/lib/knowledge/vnext'
import styles from './practice.module.css'

interface PoolView {
  itemId: string
  no: number
  examLabel: string
  typeId: string
  phase: 'train' | 'transfer'
  done: boolean
}

const STATE_LABEL: Record<CapabilityJudgement['state'], string> = {
  unconfirmed: '아직 판단하지 않음',
  confirmed: '확인됨',
  needs_practice: '연습 중',
}

const TYPE_LABEL: Record<string, string> = {
  'R-CLAIM': '필자 주장',
  'R-GIST': '요지',
  'R-TOPIC': '주제',
  'R-TITLE': '제목',
}

export function ClaimPractice(props: {
  design: { slug: string; title: string; learnerSummary: string; procedure: ProcedureStep[]; status: string }
  preview: boolean
  judgement: CapabilityJudgement
  pool: PoolView[]
  bars: Record<string, number[]>
  initialItemId: string | null
  recommendedItemId: string | null
  history: { phase: 'train' | 'transfer'; claimHit: boolean | null }[]
}) {
  const { design, preview, judgement, pool, bars, recommendedItemId } = props
  const router = useRouter()
  const [itemId, setItemId] = useState<string | null>(props.initialItemId)
  const [claim, setClaim] = useState<number | null>(null)
  const [evidence, setEvidence] = useState<number[]>([])
  const [option, setOption] = useState<number | null | 'unknown'>(null)
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null)
  const [feedback, setFeedback] = useState<(ClaimFeedback & { phase: 'train' | 'transfer' }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const started = useRef<number>(Date.now())
  // 이 화면에서 새로 끝낸 문항·훈련 수 — 서버 기록과 합쳐 다음 추천(전이 포함)을 고른다
  const [doneHere, setDoneHere] = useState<string[]>([])

  const entry = pool.find((p) => p.itemId === itemId) ?? null
  const sentenceBars = useMemo(() => (itemId ? (bars[itemId] ?? []) : []), [bars, itemId])
  const maxChars = Math.max(1, ...sentenceBars)

  useEffect(() => {
    track({ name: 'knowledge_task_viewed', props: { preview, state: judgement.state } })
  }, [preview, judgement.state])

  function choose(id: string) {
    if (busy) return
    setItemId(id)
    setClaim(null)
    setEvidence([])
    setOption(null)
    setConfidence(null)
    setFeedback(null)
    setError(null)
    started.current = Date.now()
  }

  function tapSentence(i: number) {
    if (feedback) return
    if (claim === null) return setClaim(i)
    if (i === claim) {
      setClaim(null)
      return
    }
    setEvidence((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : xs.length >= 3 ? xs : [...xs, i].sort((a, b) => a - b)))
  }

  async function submit() {
    if (!entry || claim === null || option === null || confidence === null) return
    const asked = entry.itemId
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/knowledge/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          designSlug: design.slug,
          itemId: entry.itemId,
          preview,
          response: {
            claimSentence: claim,
            evidenceSentences: evidence,
            option: option === 'unknown' ? null : option,
            confidence,
            sec: (Date.now() - started.current) / 1000,
          },
        }),
      })
      const j = (await res.json()) as { ok: boolean; error?: string; phase?: 'train' | 'transfer'; feedback?: ClaimFeedback }
      if (!j.ok || !j.feedback || !j.phase) throw new Error(j.error ?? '기록하지 못했어요')
      // 제출 중 문항 전환은 막혀 있지만, 응답이 요청한 문항의 것일 때만 보인다
      if (asked !== itemId) return
      setFeedback({ ...j.feedback, phase: j.phase })
      setDoneHere((d) => (d.includes(asked) ? d : [...d, asked]))
      track({ name: 'knowledge_task_submitted', props: { preview, phase: j.phase, claim_hit: j.feedback.claimHit } })
    } catch (e) {
      setError(e instanceof Error ? e.message : '기록하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  function goNext() {
    router.refresh()
    const done = new Set([...pool.filter((p) => p.done).map((p) => p.itemId), ...doneHere])
    // 새로고침된 서버 기록(pool.done)과 이 화면 기록이 겹치므로 수를 더하지 않고 문항 id 합집합으로 센다
    const trainDone = pool.filter((p) => p.phase === 'train' && done.has(p.itemId)).length
    const next = pickNext(
      { train: pool.filter((p) => p.phase === 'train').map((p) => p.itemId), transfer: pool.filter((p) => p.phase === 'transfer').map((p) => p.itemId) },
      done,
      trainDone,
    )
    if (next) choose(next.itemId)
  }

  const step = feedback ? 4 : claim === null ? 1 : option === null || confidence === null ? 3 : 4
  const train = pool.filter((p) => p.phase === 'train')
  const transfer = pool.filter((p) => p.phase === 'transfer')

  return (
    <div className={styles.page} data-knowledge-practice>
      {preview && (
        <p className={styles.preview} role="status">
          관리자 미리보기 — 설계 상태 「{design.status}」. 이 기록은 미리보기로만 남고 효과 계산에 들어가지 않아요.
        </p>
      )}

      <header className={styles.head}>
        <p className={styles.eyebrow}>주장과 근거</p>
        <h1>{design.title}</h1>
        <p className={styles.why}>{design.learnerSummary}</p>
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
                {h.phase === 'transfer' ? '·다른 유형' : ''}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="how">
        <h2 id="how">이렇게 해요</h2>
        <ol className={styles.steps}>
          {design.procedure.map((s, i) => (
            <li key={i} aria-current={i + 1 === step ? 'step' : undefined}>
              <span className={styles.stepNo}>{i + 1}</span>
              <span>
                <b>{s.title}</b>
                {s.detail && <span className={styles.detail}>{s.detail}</span>}
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
            <optgroup label="연습(주장·요지)">
              {train.map((p) => (
                <option key={p.itemId} value={p.itemId}>
                  {p.examLabel} {p.no}번 · {TYPE_LABEL[p.typeId] ?? p.typeId}
                  {p.done ? ' · 해 봄' : ''}
                  {p.itemId === recommendedItemId ? ' · 추천' : ''}
                </option>
              ))}
            </optgroup>
            <optgroup label="다른 유형에 옮겨 보기(주제·제목)">
              {transfer.map((p) => (
                <option key={p.itemId} value={p.itemId}>
                  {p.examLabel} {p.no}번 · {TYPE_LABEL[p.typeId] ?? p.typeId}
                  {p.done ? ' · 해 봄' : ''}
                  {p.itemId === recommendedItemId ? ' · 추천' : ''}
                </option>
              ))}
            </optgroup>
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
          <ol className={styles.bars}>
            {sentenceBars.map((c, i) => {
              const isClaim = claim === i
              const isEv = evidence.includes(i)
              const isKey = feedback?.keySentences.includes(i) ?? false
              const isTrap = feedback?.trapSentences.includes(i) ?? false
              const tags = [isClaim ? '내가 고른 주장' : null, isEv ? '내가 고른 근거' : null, isKey ? '정답 근거' : null, isTrap ? '함정' : null].filter(Boolean)
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={styles.bar}
                    style={{ ['--w' as string]: `${Math.max(28, Math.round((c / maxChars) * 100))}%` }}
                    data-claim={isClaim || undefined}
                    data-evidence={isEv || undefined}
                    data-key={isKey || undefined}
                    data-trap={isTrap || undefined}
                    aria-pressed={isClaim || isEv}
                    disabled={!!feedback}
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
              <fieldset>
                <legend>문제지에서 고른 답</legend>
                <div className={styles.chips}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-pressed={option === n} onClick={() => setOption(n)}>
                      {n}번
                    </button>
                  ))}
                  <button type="button" aria-pressed={option === 'unknown'} onClick={() => setOption('unknown')}>
                    아직 안 골랐어요
                  </button>
                </div>
              </fieldset>
              <fieldset>
                <legend>주장 문장, 얼마나 확신해요?</legend>
                <div className={styles.chips}>
                  {([1, 2, 3] as const).map((n) => (
                    <button key={n} type="button" aria-pressed={confidence === n} onClick={() => setConfidence(n)}>
                      {n === 1 ? '잘 모르겠어요' : n === 2 ? '아마도' : '확실해요'}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button type="button" className={styles.primary} disabled={busy || option === null || confidence === null} onClick={submit}>
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
              <h3>{feedback.claimHit ? '주장 문장을 찾았어요' : '정답 근거는 다른 문장이에요'}</h3>
              <p>
                정답 근거: 문장 {feedback.keySentences.map((i) => i + 1).join(', ')}
                {feedback.trapSentences.length > 0 && ` · 오답이 기대는 문장: ${feedback.trapSentences.map((i) => i + 1).join(', ')}`}
                {feedback.optionCorrect !== null && ` · 고른 답 ${feedback.optionCorrect ? '맞음' : '틀림'}`}
              </p>
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
