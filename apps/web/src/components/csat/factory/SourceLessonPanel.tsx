// apps/web/src/components/csat/factory/SourceLessonPanel.tsx
//
// 단계 2B — 한 원문 요지 → 제목 → 주제 안내 연습의 자기 설명 칸. FactoryDcpRunner 가 풀이가 **실제로 저장된 뒤**(영수증 id 가 있을 때)만 연다.
//   · 요지: 저장된 풀이 뒤 GET 으로 시범을 받아 보여 주고(답변 전에는 받지 않는다), 주장 · 근거 · 관계와 「내 첫 답과 시범의 차이」를 쓴다.
//   · 제목: 시범 없이 cue(답변 전부터 보인 것)만 · 주제: 새 단서 없이 자기 절차까지 쓴다.
//   · 저장: 같은 본문 재시도 = 같은 키, 내용을 고치면 새 키. 실패해도 쓴 글은 그대로다. 저장 확인(200 + 닫힌 모양) 전에는 다음 단계 링크가 없다.
//   · 피드백은 형성 피드백 — 근거 충분/함께 검토 · 주장만. 자유 설명은 채점하지 않고 「저장됨」만 말한다. 선택 정오와 섞지 않는다.
'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { isUuid } from '@/lib/csat/map/v62/factory-bridge/dcp-learning'
import type { Formative, LessonStep, ModelPart, ProgressStep } from '@/lib/csat/map/v62/factory-bridge/source-lesson'

import { newMutationKey } from './FactoryDcpRunner'

const STEP_LABEL: Record<LessonStep, string> = { main_point: '요지', title: '제목', topic: '주제' }
const FAIL: Record<string, string> = {
  conflict: '이 단계 설명은 이미 다른 내용으로 저장됐어요 — 화면을 새로 고쳐 확인해 주세요.',
  out_of_order: '앞 단계 설명을 먼저 저장해야 해요.',
  not_installed: '설명 기록을 아직 준비하고 있어요.',
  not_current: '승인이 철회되었거나 원문이 바뀌어 지금은 저장할 수 없어요.',
  lineage_not_current: '학습계획이 바뀌어 이 자료는 지금 계획에 속하지 않아요.',
}

type Saved = { feedback: Formative; replayed: boolean }

/** A successful HTTP status alone cannot confirm a saved reflection. */
export function readReflectionResponse(value: unknown, deliveryId: string, attemptId: string, step: LessonStep): Saved | null {
  if (!value || typeof value !== 'object') return null
  const j = value as { result?: Record<string, unknown>; feedback?: Formative }
  const r = j.result, f = j.feedback
  if (!r || !isUuid(r.reflectionId) || r.deliveryId !== deliveryId || r.attemptId !== attemptId || r.step !== step
      || r.recorded !== true || r.evidence !== false || typeof r.replayed !== 'boolean'
      || !f || !['sufficient', 'discussable'].includes(f.support) || !['accepted', 'discussable', 'not_asked'].includes(f.claim)
      || typeof f.note !== 'string' || !f.note.trim()) return null
  return { feedback: f, replayed: r.replayed }
}

export function SourceLessonPanel({ deliveryId, step, attemptId, sentences, returnHref, returnQuery }: {
  deliveryId: string; step: LessonStep; attemptId: string; sentences: readonly string[]; returnHref: string; returnQuery: string
}) {
  const [model, setModel] = useState<ModelPart[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [modelRetry, setModelRetry] = useState(0)
  const [claim, setClaim] = useState<number | null>(null)
  const [support, setSupport] = useState<number[]>([])
  const [relation, setRelation] = useState('')
  const [comparison, setComparison] = useState('')
  const [procedure, setProcedure] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [next, setNext] = useState<ProgressStep | null | undefined>(undefined)
  const keys = useRef(new Map<string, string>())

  // 시범은 저장된 풀이 뒤에만 — 서버가 DB 진행(attempted)을 보고 내려 준다
  useEffect(() => {
    if (step !== 'main_point') return
    let live = true
    fetch(`/api/csat/factory/${deliveryId}/lesson`, { cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, j: (await r.json().catch(() => null)) as { model?: unknown } | null }))
      .then(({ ok, j }) => {
        if (!live) return
        if (ok && Array.isArray(j?.model) && j.model.length === 3 && j.model.every((m: unknown) => {
          if (!m || typeof m !== 'object') return false
          const p = m as ModelPart
          return typeof p.title === 'string' && !!p.title.trim() && typeof p.text === 'string' && !!p.text.trim()
            && Array.isArray(p.sentences) && p.sentences.every((i) => Number.isInteger(i) && i >= 0 && i < sentences.length)
        })) setModel(j.model as ModelPart[])
        else setLoadErr('시범을 불러오지 못했어요. 다시 불러와도 쓴 설명은 유지돼요.')
      })
      .catch(() => live && setLoadErr('연결이 끊겨 시범을 불러오지 못했어요.'))
    return () => { live = false }
  }, [deliveryId, step, modelRetry, sentences.length])

  const needClaim = step !== 'title'
  const ready = (!needClaim || claim !== null) && support.length >= 1 && relation.trim().length >= 2
    && (step !== 'main_point' || comparison.trim().length >= 2) && (step !== 'topic' || procedure.trim().length >= 2)
    && (step !== 'main_point' || model !== null)

  async function save() {
    if (!ready || busy || saved) return
    const body = {
      step, claim: needClaim ? claim : null, support: [...support].sort((a, b) => a - b), relation: relation.trim(),
      comparison: step === 'main_point' ? comparison.trim() : null, procedure: step === 'topic' ? procedure.trim() : null,
    }
    const sig = JSON.stringify(body)
    let mutationId = keys.current.get(sig)
    if (!mutationId) {
      const k = newMutationKey(typeof crypto === 'undefined' ? null : crypto)
      if (!k) { setErr('이 브라우저에서 저장 키를 만들지 못했어요.'); return }
      mutationId = k
      keys.current.set(sig, k)
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/csat/factory/${deliveryId}/lesson`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ attemptId, body, mutationId }),
      })
      const j = (await res.json().catch(() => null)) as { code?: unknown; result?: Record<string, unknown>; feedback?: Formative } | null
      const confirmed = res.ok ? readReflectionResponse(j, deliveryId, attemptId, step) : null
      if (!confirmed) {
        setErr(FAIL[typeof j?.code === 'string' ? j.code : ''] ?? '저장하지 못했어요 — 쓴 설명은 그대로예요. 다시 눌러도 두 번 저장되지 않아요.')
        return
      }
      setSaved(confirmed)
      track({ name: 'csat_source_lesson_reflected', props: { step, support: confirmed.feedback.support, replayed: confirmed.replayed } })
      // 저장 확인 뒤에야 다음 단계를 찾는다
      const pr = await fetch(`/api/csat/factory/${deliveryId}/lesson`, { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).catch(() => null) as { progress?: { steps?: ProgressStep[] } } | null
      const order: LessonStep[] = ['main_point', 'title', 'topic']
      const want = order[order.indexOf(step) + 1]
      setNext(want ? pr?.progress?.steps?.find((s) => s.type === want && s.state === 'ok') ?? null : null)
    } catch {
      setErr('연결이 끊겼어요 — 쓴 설명은 그대로예요. 다시 눌러도 두 번 저장되지 않아요.')
    } finally {
      setBusy(false)
    }
  }

  const box = 'rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4'
  const label = 'font-display text-[13px] font-[700] text-[var(--t1)]'
  const area = 'mt-1 w-full rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] p-2 font-body text-[13.5px] leading-relaxed text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)]'
  const locked = !!saved

  return (
    <section className="flex flex-col gap-3" aria-label={`${STEP_LABEL[step]} 자기 설명`} data-testid="source-lesson-panel" data-step={step}>
      {step === 'main_point' && (
        <div className={box} data-testid="source-lesson-model">
          <h2 className={label}>시범 — 내 첫 답과 비교해 보세요</h2>
          {model ? (
            <ol className="mt-2 flex flex-col gap-2">
              {model.map((m) => (
                <li key={m.title} className="break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
                  <b className="text-[var(--t1)]">{m.title}</b> <span className="text-[var(--t3)]">(문장 {m.sentences.map((i) => i + 1).join('·')})</span>
                  <br />{m.text}
                </li>
              ))}
            </ol>
          ) : <>
            <p className="mt-2 break-keep font-body text-[13px] text-[var(--t2)]">{loadErr ?? '시범을 불러오는 중이에요…'}</p>
            {loadErr && <button type="button" className="mt-2 min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] px-3 focus-visible:ring-2 focus-visible:ring-[var(--p)]" onClick={() => { setLoadErr(null); setModelRetry((n) => n + 1) }}>시범 다시 불러오기</button>}
          </>}
        </div>
      )}

      <div className={box}>
        {/* 채점 뒤에는 플레이어가 지문을 접는다 — 번호로 고를 문장을 여기서 다시 보여 준다 */}
        <ol className="mb-3 flex flex-col gap-1 rounded-[var(--r-sm)] bg-[var(--bg2)] p-3 font-body text-[13px] leading-relaxed text-[var(--t2)]" data-testid="lesson-sentences">
          {sentences.map((s, i) => <li key={i}><b className="mr-1 text-[var(--t1)]">{i + 1}</b>{s}</li>)}
        </ol>
        <fieldset disabled={locked} className="flex flex-col gap-3">
          {needClaim && (
            <div>
              <legend className={label}>필자의 중심 판단이 담긴 문장</legend>
              <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="중심 판단 문장">
                {sentences.map((_, i) => (
                  <label key={i} className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] px-2 font-body text-[13px] focus-within:ring-2 focus-within:ring-[var(--ju)]">
                    <input type="radio" name={`claim-${step}`} checked={claim === i} onChange={() => setClaim(i)} data-testid={`claim-${i}`} />{i + 1}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <span className={label}>{step === 'title' ? '제목을 받치는 문장' : '판단을 받치는 근거 문장'}(1~4개)</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {sentences.map((s, i) => (
                <label key={i} title={s} className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-1 rounded-[var(--r-sm)] border border-[var(--bd)] px-2 font-body text-[13px] focus-within:ring-2 focus-within:ring-[var(--ju)]">
                  <input type="checkbox" checked={support.includes(i)} data-testid={`support-${i}`}
                    onChange={(e) => setSupport((cur) => (e.target.checked ? (cur.length < 4 ? [...cur, i] : cur) : cur.filter((x) => x !== i)))} />{i + 1}
                </label>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={label}>{step === 'title' ? '그 문장이 글 전체를 묶는 비유와 어떻게 이어지나요?' : '근거가 판단을 어떻게 받치나요(관계)?'}</span>
            <textarea className={area} rows={2} maxLength={600} value={relation} onChange={(e) => setRelation(e.target.value)} data-testid="reflect-relation" />
          </label>
          {step === 'main_point' && (
            <label className="block">
              <span className={label}>내 첫 답과 시범은 무엇이 같고 무엇이 달랐나요?</span>
              <textarea className={area} rows={3} maxLength={600} value={comparison} onChange={(e) => setComparison(e.target.value)} data-testid="reflect-comparison" />
            </label>
          )}
          {step === 'topic' && (
            <label className="block">
              <span className={label}>다른 글에서도 쓸 내 절차를 한 문장으로</span>
              <textarea className={area} rows={2} maxLength={600} value={procedure} onChange={(e) => setProcedure(e.target.value)} data-testid="reflect-procedure" />
            </label>
          )}
        </fieldset>
        {!saved && (
          <button type="button" onClick={save} disabled={!ready || busy} data-testid="reflect-save"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)]">
            {busy ? '저장 중…' : '설명 저장'}
          </button>
        )}
        {err && <p role="alert" className="mt-2 break-keep font-body text-[13px] text-[var(--risk,#9C3A30)]" data-testid="reflect-error">{err}</p>}
      </div>

      {saved && (
        <div className={box} data-testid="reflect-saved" data-support={saved.feedback.support}>
          <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
            설명을 저장했어요. {saved.feedback.note}
            {saved.feedback.claim === 'discussable' && ' 고른 중심 문장도 다른 후보와 함께 다시 견주어 볼 만해요.'}
            {' '}이 설명은 연습 기록이라 실력 향상의 근거로 세지 않아요.
          </p>
          {next ? (
            <Link href={`/csat/factory/${next.deliveryId}${returnQuery}`} data-testid="lesson-next"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)]">
              다음: 같은 글의 {STEP_LABEL[next.type]}
            </Link>
          ) : next === null || step === 'topic' ? (
            <Link href={returnHref} data-testid="lesson-return"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-5 font-display text-[14px] font-[700] text-[var(--t1)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)]">
              Workspace 로 — 새 글로 혼자 확인 이어가기
            </Link>
          ) : null}
        </div>
      )}
    </section>
  )
}
