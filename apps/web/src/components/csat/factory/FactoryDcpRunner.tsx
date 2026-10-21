// apps/web/src/components/csat/factory/FactoryDcpRunner.tsx
//
// 단계 1D — 납품된 공장 DCP 지도 연습 실행기. 기존 DcpPlayer · DcpItems 를 그대로 쓰고, 채점만 납품에 결속한 서버 제출로 바꾼다
// (POST /api/csat/factory/[deliveryId]/attempt → DB 의 실제 grade_dcp_item + 결속 영수증).
//   · 같은 응답 재시도 = 같은 mutationId(저장 실패 · 응답 유실 뒤 다시 눌러도 기록이 두 번 생기지 않는다). 다른 응답 = 새 키.
//     키는 암호학적 난수(crypto.randomUUID · getRandomValues)만 — 만들지 못하면 제출하지 않는다(시계 기반 대체 없음).
//   · 저장 실패 · 모양이 다른 200(정오만 있고 영수증 · 실제 채점 시도 id 가 없음)은 { ok:false } — 오답 · 완료가 아니다.
//   · 이 풀이는 연습 기록이다 — 완료 화면은 목표 달성 · 실력 향상을 말하지 않고, 다음 할 일은 Workspace 의 기존 다음 행동으로 돌려보낸다.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import { track } from '@/lib/analytics/client'
import type { LessonStep } from '@/lib/csat/map/v62/factory-bridge/source-lesson'
import type { DcpGradeResult, DcpItem } from '@/lib/learner/dcp'

import { SourceLessonPanel } from './SourceLessonPanel'

const FAIL_COPY: Record<string, string> = {
  conflict: '이미 다른 답으로 보낸 제출이에요 — 화면을 새로 고쳐 주세요.',
  not_installed: '연습 기록을 아직 준비하고 있어요.',
  not_current: '승인이 철회되었거나 원문이 바뀌어 지금은 풀 수 없어요.',
  workspace_closed: '닫힌 Workspace 의 자료라 새로 풀 수 없어요.',
  lineage_not_current: '학습계획이 바뀌어 이 자료는 지금 계획에 속하지 않아요.',
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
type FactoryType = 'topic' | 'title' | 'main_point'
const factoryType = (t: string): FactoryType | null => (t === 'topic' || t === 'title' || t === 'main_point' ? t : null)

/** 암호학적 UUID v4 — 없으면 null(제출 실패로 처리한다) */
export function newMutationKey(c: (Pick<Crypto, 'getRandomValues'> & { randomUUID?: () => string }) | null | undefined): string | null {
  try {
    if (!c) return null
    if (typeof c.randomUUID === 'function') {
      const k = c.randomUUID()
      return UUID.test(k) ? k : null
    }
    if (typeof c.getRandomValues !== 'function') return null
    const b = c.getRandomValues(new Uint8Array(16))
    b[6] = (b[6]! & 0x0f) | 0x40
    b[8] = (b[8]! & 0x3f) | 0x80
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  } catch {
    return null
  }
}

/** 200 응답을 완료로 올려도 되는가 — 영수증 · 납품 · 실제 채점 시도 id · 정오 · 근거 아님이 모두 맞을 때만 */
export function readAttemptResponse(j: unknown, deliveryId: string): { correct: boolean; receiptId: string; csatAttemptId: string; answerKey: Record<string, unknown> | null; replayed: boolean } | null {
  if (!j || typeof j !== 'object') return null
  const r = (j as { result?: unknown }).result as Record<string, unknown> | undefined
  if (!r || typeof r !== 'object') return null
  if (typeof r.correct !== 'boolean' || typeof r.receiptId !== 'string' || !UUID.test(r.receiptId) || r.deliveryId !== deliveryId
      || typeof r.csatAttemptId !== 'string' || !UUID.test(r.csatAttemptId) || r.evidence !== false || typeof r.replayed !== 'boolean') return null
  const ak = r.answerKey
  return { correct: r.correct, receiptId: r.receiptId, csatAttemptId: r.csatAttemptId, answerKey: ak && typeof ak === 'object' && !Array.isArray(ak) ? (ak as Record<string, unknown>) : null, replayed: r.replayed }
}

/** 2B 교수 자료가 붙는 납품일 때만 — 답변 전 지원(전략/cue/없음)과 문장 목록. 시범은 여기 없다(저장된 풀이 뒤 서버가 내려 준다) */
export interface LessonProps { step: LessonStep; before: { kind: 'strategy' | 'cue' | 'none'; text: string | null; prompt: string }; sentences: readonly string[]; returnQuery: string }

export function FactoryDcpRunner({ deliveryId, item, returnHref, attempts, lesson }: { deliveryId: string; item: DcpItem; returnHref: string; attempts: number; lesson?: LessonProps }) {
  // 실제로 저장된 풀이 영수증 id — 이것이 있어야 자기 설명 칸이 열린다
  const [receipt, setReceipt] = useState<string | null>(null)
  const [submittedChoice, setSubmittedChoice] = useState<number | null>(null)
  // 응답(선택 번호)마다 키 하나 — 같은 답 재시도는 같은 키, 다른 답은 새 키
  const keys = useRef(new Map<number, string>())
  const finished = useRef(false)
  const type = factoryType(item.type)

  useEffect(() => {
    if (type) track({ name: 'csat_factory_dcp_opened', props: { type, attempts } })
  }, [type, attempts])

  const grade = useCallback(async (_itemId: string, answer: Record<string, unknown>): Promise<DcpGradeResult> => {
    const choice = Number(answer.choice)
    if (!Number.isInteger(choice) || choice < 1 || choice > 5) return { ok: false, error: '답을 고른 뒤 제출해 주세요.' }
    let mutationId = keys.current.get(choice)
    if (!mutationId) {
      const k = newMutationKey(typeof crypto === 'undefined' ? null : crypto)
      if (!k) return { ok: false, error: '이 브라우저에서 제출 키를 만들지 못했어요 — 다른 브라우저로 열어 주세요.' }
      mutationId = k
      keys.current.set(choice, mutationId)
    }
    let res: Response
    try {
      res = await fetch(`/api/csat/factory/${deliveryId}/attempt`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choice, mutationId }), cache: 'no-store',
      })
    } catch {
      return { ok: false, error: '연결이 끊겼어요 — 다시 눌러도 기록이 두 번 생기지 않아요.' }
    }
    const j = (await res.json().catch(() => null)) as { code?: unknown } | null
    const r = res.ok ? readAttemptResponse(j, deliveryId) : null
    if (!r) {
      const code = typeof j?.code === 'string' ? j.code : ''
      return { ok: false, error: FAIL_COPY[code] ?? '저장하지 못했어요 — 고른 답은 그대로예요.' }
    }
    if (type) track({ name: 'csat_factory_dcp_submitted', props: { type, correct: r.correct, replayed: r.replayed } })
    setReceipt(r.receiptId)
    setSubmittedChoice(choice)
    return { ok: true, correct: r.correct, attemptId: r.csatAttemptId, answerKey: r.answerKey }
  }, [deliveryId, type])

  // 다음 할 일은 여기서 새로 정하지 않는다 — Workspace 화면의 기존 다음 행동(계획)으로 돌려보낸다
  const doneCopy = useCallback(({ correct }: { total: number; correct: number }) => {
    finished.current = true
    return {
      title: '안내 연습을 마쳤어요',
      body: `${correct > 0 ? '이번에는 맞혔어요' : '이번에는 정답을 확인했어요'}. 이 결과는 연습 기록이라 목표 달성이나 실력 향상의 근거로 세지 않아요. 혼자 확인은 Workspace 의 다음 할 일에서 이어져요.`,
    }
  }, [])
  const onBack = useCallback(() => track({ name: 'csat_factory_dcp_returned', props: { finished: finished.current } }), [])

  return (
    <div className="flex flex-col gap-4" data-testid="factory-dcp-runner" data-delivery={deliveryId}>
      <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 font-body text-[12.5px] leading-relaxed text-[var(--t2)]" data-testid="factory-dcp-note">
        안내 연습이에요. 여기서 맞힌 결과는 연습 기록으로만 남고, 혼자 확인한 결과(지도 근거)로 세지 않아요.
        {attempts > 0 && ` 이 자료를 ${attempts}번 풀었어요.`}
      </p>
      {lesson && lesson.before.kind !== 'none' && lesson.before.text && (
        <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 font-body text-[13px] leading-relaxed text-[var(--t2)]" data-testid="lesson-before" data-kind={lesson.before.kind}>
          <b className="text-[var(--t1)]">{lesson.before.kind === 'strategy' ? '읽는 방법' : '단서'}</b> · {lesson.before.text}
        </p>
      )}
      {lesson && <p className="break-keep font-body text-[13px] text-[var(--t2)]" data-testid="lesson-prompt">{lesson.before.prompt}</p>}
      <DcpPlayer items={[item]} grade={grade} backHref={returnHref} backCta="Workspace 로 돌아가기" doneCopy={doneCopy} onBack={onBack} />
      {lesson && receipt && (
        <>
          {submittedChoice !== null && <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] p-3 text-[13px]" data-testid="lesson-submitted-answer">방금 제출한 내 답: {submittedChoice}번 · {'choices' in item.payload ? item.payload.choices?.[submittedChoice - 1] : null}</p>}
          <SourceLessonPanel deliveryId={deliveryId} step={lesson.step} attemptId={receipt} sentences={lesson.sentences} returnHref={returnHref} returnQuery={lesson.returnQuery} />
        </>
      )}
    </div>
  )
}
