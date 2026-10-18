// apps/web/src/components/csat/authored/AuthoredRunner.tsx
//
// 납품받은 창작 자료(authored_item) 실행 화면 — FINAL §4 · §8.
// 창작 지문은 Vocaflow 저작물이라 문장 원문을 그대로 보여 준다(기출은 문장 번호만). 학습자는 ① 중심 문장 ② 떠받치는 문장
// ③ 표시된 문장의 관계 ④ 한 줄 요지(선택지)를 고른다. 채점 · 해설은 서버가 기록을 저장한 뒤에만 돌려준다.
// 역할별: 교수(model_explanation) = 출제 원리 단계를 먼저 읽고 연습 · 안내 연습 = 단서를 열 수 있다(열면 「도움 받음」으로 기록) ·
//   독립 · 전이 · 지연 확인 = 단서 · 해설 없음, 한 번 풀면 결과만.
// 표시 문법은 ClaimPractice 와 같다: 주장 = 굵은 테 + 「중심」 · 근거 = 실선 + 「근거」 · 반박 견해 = 점선 + 「반박」(색만으로 전하지 않는다).
'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'

import { RELATIONS, RELATION_LABEL, type Relation } from '@/lib/knowledge/claim-support-labels'
import type { DistractorDesign, TeachStep } from '@/lib/knowledge/authored/authored-items'

import styles from '@/components/knowledge/practice.module.css'

export interface AuthoredRunnerProps {
  id: string
  role: 'model_explanation' | 'guided_practice' | 'independent_check' | 'transfer' | 'delayed_check'
  sentences: string[]
  stem: string
  choices: string[]
  teach: TeachStep[] | null
  hints: string[] | null
  probe: number | null
  done: null | { isCorrect: boolean; reveal: Reveal }
  returnHref: string
}

interface Reveal {
  gist: string
  answer: number
  claim: number
  claimRestated: number[]
  support: number[]
  opposed: number[]
  distractors: { choice: number; design: DistractorDesign; why: string }[]
}

interface Graded {
  isCorrect: boolean
  claimOk: boolean
  claimRestated: boolean
  supportOk: boolean
  supportMissed: number[]
  relationOk: boolean
  choiceOk: boolean
  choiceDesign: DistractorDesign | null
}

export const ROLE_LABEL: Record<AuthoredRunnerProps['role'], string> = {
  model_explanation: '출제 원리 배우기',
  guided_practice: '안내 연습',
  independent_check: '혼자 확인',
  transfer: '다른 글에 적용',
  delayed_check: '다른 날 다시 확인',
}

const ROLE_NOTE: Record<AuthoredRunnerProps['role'], string> = {
  model_explanation: '출제자가 이 글의 중심을 어떻게 숨겨 두었는지 단계별로 읽은 뒤, 같은 글로 직접 골라 봐요. 이 풀이는 연습으로 남아요.',
  guided_practice: '막히면 단서를 열어도 돼요. 단서를 연 풀이는 「도움 받은 연습」으로 남고, 혼자 확인으로 세지 않아요.',
  independent_check: '처음 보는 글이에요. 단서 · 해설 없이 혼자 풀어요. 이 첫 풀이가 지도에 「혼자 확인」 근거로 돌아가요.',
  transfer: '앞에서 배운 방법을 다른 종류의 질문(제목 · 주제)에 적용해요. 단서 · 해설 없이 혼자 풀어요.',
  delayed_check: '며칠 지난 뒤 새 글로 다시 확인해요. 단서 · 해설 없이 혼자 풀어요.',
}

export const DESIGN_LABEL: Record<DistractorDesign, string> = {
  opposed_view: '필자가 반박하는 생각을 옮긴 선택지',
  too_narrow: '예시 · 세부 하나만 담은 좁은 선택지',
  off_text: '글에 없는 내용이지만 그럴듯한 선택지',
  distorted: '본문 내용을 바꾸거나 과장한 선택지',
  reversed: '본문과 반대로 말하는 선택지',
}

const uuid = () => crypto.randomUUID()

export function AuthoredRunner(p: AuthoredRunnerProps) {
  const [sessionId] = useState<string>(uuid)
  const [help, setHelp] = useState<'independent' | 'viewed_first'>('independent')
  const [hintsOpen, setHintsOpen] = useState(0)
  const [claim, setClaim] = useState<number | null>(null)
  const [support, setSupport] = useState<number[]>([])
  const [relation, setRelation] = useState<Relation | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [graded, setGraded] = useState<Graded | null>(null)
  const [reveal, setReveal] = useState<Reveal | null>(p.done?.reveal ?? null)
  const [binding, setBinding] = useState<string | null>(null)
  // 같은 답의 재시도만 같은 제출 id — 답이 바뀌면 새 id
  const mutation = useRef<{ key: string; id: string } | null>(null)
  const finished = !!reveal

  const pick = (k: number) => {
    if (finished || busy) return
    if (claim === null || claim === k) { setClaim(claim === k ? null : k); setSupport((s) => s.filter((x) => x !== k)); return }
    setSupport((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k].sort((a, b) => a - b)))
  }

  const ready = claim !== null && support.length > 0 && (p.probe === null || relation !== null) && choice !== null

  async function submit() {
    if (!ready || busy) return
    setBusy(true); setError(null)
    const response = { claim, support, relation: relation ?? 'reason', choice }
    const key = JSON.stringify(response)
    if (!mutation.current || mutation.current.key !== key) mutation.current = { key, id: uuid() }
    try {
      const r = await fetch(`/api/csat/authored/${p.id}/attempt`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response, clientSessionId: sessionId, clientMutationId: mutation.current.id, answeredAt: new Date().toISOString(), helpLevel: help }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(typeof j.error === 'string' ? j.error : '저장하지 못했어요 — 잠시 뒤 다시 눌러 주세요'); return }
      setGraded(j.grade as Graded); setReveal(j.reveal as Reveal); setBinding(typeof j.binding === 'string' ? j.binding : null)
    } catch {
      setError('연결이 끊겼어요 — 같은 답으로 다시 누르면 한 번만 저장돼요')
    } finally {
      setBusy(false)
    }
  }

  const tagsOf = (k: number): string[] => {
    const t: string[] = []
    if (reveal) {
      if (reveal.claim === k || reveal.claimRestated.includes(k)) t.push(reveal.claim === k ? '중심' : '중심 다시 말하기')
      else if (reveal.support.includes(k)) t.push('근거')
      else if (reveal.opposed.includes(k)) t.push('반박')
    }
    if (claim === k) t.push('내가 고른 중심')
    else if (support.includes(k)) t.push('내 근거')
    if (p.probe === k) t.push('관계 질문')
    return t
  }

  return (
    <div className={styles.page} data-testid="authored-runner">
      <header className={styles.head}>
        <span className={styles.eyebrow}>R5 중심 의미 · {ROLE_LABEL[p.role]}</span>
        <h1>글의 중심 잡기</h1>
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
        <h2 id="passage-h">① 중심 문장을 먼저 누르고, ② 그 문장을 떠받치는 문장을 모두 눌러요</h2>
        <ol className={styles.bars}>
          {p.sentences.map((s, k) => {
            const tags = tagsOf(k)
            return (
              <li key={k}>
                <button
                  type="button" className={styles.bar} disabled={finished || busy} onClick={() => pick(k)}
                  aria-pressed={claim === k || support.includes(k)}
                  data-claim={(reveal ? reveal.claim === k : claim === k) || undefined}
                  data-evidence={(reveal ? reveal.support.includes(k) : support.includes(k)) || undefined}
                  data-trap={(reveal && reveal.opposed.includes(k)) || undefined}
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

      {p.probe !== null && (
        <fieldset className={styles.answer} disabled={finished || busy}>
          <legend>③ 문장 {p.probe + 1}은 중심 문장과 어떤 관계인가요?</legend>
          <div className={styles.chips}>
            {RELATIONS.map((r) => (
              <button key={r} type="button" aria-pressed={relation === r} onClick={() => setRelation(r)}>{RELATION_LABEL[r]}</button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className={styles.answer} disabled={finished || busy}>
        <legend>④ {p.stem}</legend>
        <div style={{ display: 'grid', gap: 8 }}>
          {p.choices.map((c, k) => (
            <button key={k} type="button" className={styles.bar} aria-pressed={choice === k} onClick={() => setChoice(k)}
              data-claim={choice === k || undefined} data-key={(reveal && reveal.answer === k) || undefined}
              style={{ minHeight: 44, padding: '10px 12px' }}>
              <span><span className={styles.barNo}>{'①②③④⑤'[k]}</span> {c}</span>
              {reveal && reveal.answer === k && <span className={styles.barTags}>정답</span>}
            </button>
          ))}
        </div>
      </fieldset>

      {p.hints && !finished && (
        <section className={styles.state} aria-live="polite">
          {p.hints.slice(0, hintsOpen).map((h, i) => <p key={i}>단서 {i + 1}. {h}</p>)}
          {hintsOpen < p.hints.length && (
            <button type="button" className={styles.link} onClick={() => { setHelp('viewed_first'); setHintsOpen((n) => n + 1) }}>
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
          <h2>{graded ? (graded.isCorrect ? '중심을 정확히 잡았어요' : '이번에는 중심이 어긋났어요') : (p.done?.isCorrect ? '지난번에 중심을 정확히 잡았어요' : '지난번 풀이 결과예요')}</h2>
          <p><b>한 줄 요지</b> — {reveal.gist}</p>
          {graded && (
            <ul className={styles.note}>
              <li>중심 문장: {graded.claimOk ? '맞음' : graded.claimRestated ? '중심을 다시 말한 문장을 골랐어요 — 같은 뜻이라 맞음으로 봐요' : `문장 ${reveal.claim + 1}이 중심이에요`}</li>
              <li>떠받치는 문장: {graded.supportOk ? '맞음' : graded.supportMissed.length > 0 ? `문장 ${graded.supportMissed.map((x) => x + 1).join(' · ')}도 중심을 떠받쳐요` : '중심과 관계없는 문장을 함께 골랐어요'}</li>
              {p.probe !== null && <li>관계: {graded.relationOk ? '맞음' : '다시 볼 곳 — 표시된 문장이 중심을 어떻게 돕는지 보세요'}</li>}
              <li>요지 선택: {graded.choiceOk ? '맞음' : graded.choiceDesign ? `고른 선택지는 ${DESIGN_LABEL[graded.choiceDesign]}예요` : '다시 볼 곳'}</li>
            </ul>
          )}
          <h3>오답은 이렇게 만들어졌어요</h3>
          <ul className={styles.note}>
            {reveal.distractors.map((d) => <li key={d.choice}>{'①②③④⑤'[d.choice]} {DESIGN_LABEL[d.design]} — {d.why}</li>)}
          </ul>
          {binding === 'bound' && <p className={styles.note}>이 풀이는 받은 자료에 연결돼 학습 지도에 반영돼요.</p>}
          <Link className={styles.link} href={p.returnHref}>학습 지도로 돌아가 변화 보기</Link>
        </section>
      )}
    </div>
  )
}
