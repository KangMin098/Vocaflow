// apps/web/src/lib/csat/map/v62/factory-bridge/source-lesson.ts
//
// 단계 2B — 한 원문(003946dd…)의 요지 → 제목 → 주제 안내 연습에 붙는 교수 자료(source-lesson v3)와 자기 설명 저장.
//   · 교수 자료는 runtime 의 정확한 바이트 복사본(SHA 0b653454…c7f0 — 시험이 파일 바이트로 대조). 원천 파생 자료라 authored 가 아니다.
//   · 답변 전: 요지는 내용 중립 전략만, 제목은 cue 만, 주제는 아무것도 없음. 시범(model)은 DB 가 「이 납품에 저장된 풀이가 있다」고
//     답한 뒤에만 내려 준다(lessonAfterAttempt). 화면이 먼저 받지 않는다.
//   · 형성 피드백은 단계별 충분 근거 집합(내부 0-based)과 주장 6/7 만 본다. 목록 밖 근거는 「함께 살펴볼 근거」(보류)이지 오답이 아니다.
//     자유 설명(관계 · 비교 · 절차)은 어휘로 채점하지 않는다 — 저장 여부(recorded)만 말한다. 선택 정오와 섞지 않는다.
//   · 저장: 같은 mutation 키 재전송 = 같은 결과, 다른 본문 = conflict. 모양이 다른 200 은 저장으로 보지 않는다. evidence 는 언제나 false.

import lesson from '@/lib/knowledge/authored/source-lesson-title-route.v3.json'

import { isUuid } from './dcp-learning'
import type { SupplyClient } from './dcp-supply'

export const LESSON_SHA256 = '0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0'
export const LESSON_SOURCE_ID = '003946dd-f5e6-4efe-9254-b7a69ca39e61'
export const LESSON_SOURCE_CONTENT_SHA256 = lesson.source.content_sha256
export const LESSON_STEPS = ['main_point', 'title', 'topic'] as const
export type LessonStep = (typeof LESSON_STEPS)[number]
const isStep = (x: unknown): x is LessonStep => (LESSON_STEPS as readonly unknown[]).includes(x)
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

type LessonJson = typeof lesson
const stepOf = (t: LessonStep) => (lesson as LessonJson).steps.find((s) => s.type === t)!

/** 문장 목록(표시는 1-based) — 근거 선택용. 원문 문장 그대로 */
export const LESSON_SENTENCES: readonly string[] = lesson.source.sentences

/** 답변 전 화면에 실어도 되는 것만 — 요지는 내용 중립 전략, 제목은 cue, 주제는 없음. 시범은 절대 없음 */
export function beforeAnswerSupport(step: LessonStep): { kind: 'strategy' | 'cue' | 'none'; text: string | null; prompt: string } {
  const s = stepOf(step)
  if (step === 'main_point') return { kind: 'strategy', text: lesson.beforeFirstAttempt, prompt: s.prompt }
  if (step === 'title') return { kind: 'cue', text: (s as { cue?: string }).cue ?? null, prompt: s.prompt }
  return { kind: 'none', text: null, prompt: s.prompt }
}

export interface ModelPart { title: string; text: string; sentences: number[] }
/** 저장된 첫 풀이 뒤 요지 단계에서만 쓰는 시범 — 서버가 DB 진행 상태를 확인한 뒤 부른다 */
export const lessonModel = (): ModelPart[] => lesson.model.map((m) => ({ title: m.title, text: m.text, sentences: [...m.sentences] }))

export type SupportVerdict = 'sufficient' | 'discussable'
export interface Formative { support: SupportVerdict; claim: 'accepted' | 'discussable' | 'not_asked'; note: string }

/** 형성 피드백 — 근거는 단계별 수락 집합 중 하나를 온전히 포함하면 충분. 그 밖은 오답이 아니라 함께 살펴볼 근거 */
export function formativeFeedback(step: LessonStep, claim: number | null, support: number[]): Formative {
  const sets = stepOf(step).acceptedEvidenceSets
  const has = new Set(support)
  const sup: SupportVerdict = sets.some((set) => set.every((i) => has.has(i))) ? 'sufficient' : 'discussable'
  // 주장 6/7 동등 수락은 요지 단계에만(정본 feedbackPolicy). 제목 · 주제는 주장 판정을 하지 않는다
  const cl = step !== 'main_point' || claim === null ? 'not_asked' : claim === lesson.annotation.claim || lesson.annotation.claimRestated.includes(claim) ? 'accepted' : 'discussable'
  const note = sup === 'sufficient'
    ? '고른 근거만으로 판단을 받칠 수 있어요. 다른 근거도 함께 써도 돼요.'
    : '이 근거가 판단과 어떻게 이어지는지 한 번 더 살펴봐요 — 틀렸다는 뜻이 아니라 함께 검토할 근거예요.'
  return { support: sup, claim: cl, note }
}

export interface ReflectionBody { step: LessonStep; claim: number | null; support: number[]; relation: string; comparison: string | null; procedure: string | null }
const text = (x: unknown) => typeof x === 'string' && x.trim().length >= 2 && x.length <= 600

/** 클라이언트 본문 — 닫힌 키 { attemptId(1D 풀이 영수증), body, mutationId }. 단계별 필수 칸을 DB 와 같은 규칙으로 먼저 거른다(DB 가 다시 검사한다) */
export function parseReflectionRequest(raw: unknown): { attemptId: string; body: ReflectionBody; mutationId: string } | null {
  if (!isObj(raw) || Object.keys(raw).sort().join() !== 'attemptId,body,mutationId' || !isUuid(raw.attemptId) || !isUuid(raw.mutationId) || !isObj(raw.body)) return null
  const b = raw.body
  if (Object.keys(b).sort().join() !== 'claim,comparison,procedure,relation,step,support' || !isStep(b.step)) return null
  const okIdx = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 8
  if (b.claim === null ? b.step !== 'title' : !okIdx(b.claim)) return null
  if (!Array.isArray(b.support) || b.support.length < 1 || b.support.length > 4 || !b.support.every(okIdx) || new Set(b.support).size !== b.support.length) return null
  if (!text(b.relation)) return null
  if (b.step === 'main_point' ? !text(b.comparison) : b.comparison !== null) return null
  if (b.step === 'topic' ? !text(b.procedure) : b.procedure !== null) return null
  return {
    attemptId: raw.attemptId, mutationId: raw.mutationId,
    body: { step: b.step, claim: b.claim as number | null, support: b.support as number[], relation: b.relation as string, comparison: b.comparison as string | null, procedure: b.procedure as string | null },
  }
}

export type LessonFail = { ok: false; code: 'not_installed' | 'query_failed' | 'bad_shape' | 'invalid_input' | 'conflict' | 'out_of_order' | 'not_found' | string }

function classify(error: { message: string; code?: string }): LessonFail {
  if (error.code === 'PGRST202' || error.code === '42883' || /function .* does not exist|Could not find the function/i.test(error.message)) return { ok: false, code: 'not_installed' }
  if (/step out_of_order/.test(error.message)) return { ok: false, code: 'out_of_order' }
  const m = /reflect: (?:delivery|attempt|lesson) ([a-z_]+)/.exec(error.message)
  if (m) return { ok: false, code: m[1]! }
  if (error.code === '23505') return { ok: false, code: 'conflict' }
  if (error.code === '22023') return { ok: false, code: 'invalid_input' }
  return { ok: false, code: 'query_failed' }
}

export interface ProgressStep { type: LessonStep; deliveryId: string; state: string; attempted: boolean; reflected: boolean }
export interface LessonProgress { deliveryId: string; workspaceId: string; steps: ProgressStep[] }

/** 같은 Workspace · 같은 개인 주문의 세 단계 진행. 모르는 모양은 bad_shape(완료로 올리지 않는다) */
export async function lessonProgress(c: SupplyClient, deliveryId: string): Promise<{ ok: true; progress: LessonProgress } | LessonFail> {
  if (!isUuid(deliveryId)) return { ok: false, code: 'invalid_input' }
  const { data, error } = await c.rpc<unknown>('source_lesson_progress', { p_delivery: deliveryId, p_lesson_sha: LESSON_SHA256 })
  if (error) return classify(error)
  if (!isObj(data) || typeof data.state !== 'string') return { ok: false, code: 'bad_shape' }
  if (data.state !== 'ok') return { ok: false, code: data.state }
  if (data.delivery_id !== deliveryId || !isUuid(data.workspace_id) || !Array.isArray(data.steps)) return { ok: false, code: 'bad_shape' }
  const steps: ProgressStep[] = []
  for (const s of data.steps) {
    if (!isObj(s) || !isStep(s.type) || !isUuid(s.delivery_id) || typeof s.state !== 'string' || typeof s.attempted !== 'boolean' || typeof s.reflected !== 'boolean') return { ok: false, code: 'bad_shape' }
    steps.push({ type: s.type, deliveryId: s.delivery_id, state: s.state, attempted: s.attempted, reflected: s.reflected })
  }
  if (new Set(steps.map((s) => s.type)).size !== steps.length || !steps.some((s) => s.deliveryId === deliveryId)) return { ok: false, code: 'bad_shape' }
  return { ok: true, progress: { deliveryId, workspaceId: data.workspace_id, steps } }
}

/** 시범 — 요지 단계에서 DB 가 이 납품의 저장된 풀이를 확인했을 때만. 아니면 null(화면은 시범을 그리지 않는다) */
export function modelAfterAttempt(p: LessonProgress): ModelPart[] | null {
  const me = p.steps.find((s) => s.deliveryId === p.deliveryId)
  return me && me.type === 'main_point' && me.attempted && me.state === 'ok' ? lessonModel() : null
}

/** 2C — 다시 열었을 때 복원하는 본인 설명(닫힌 모양). 본인 본문 · 형성 피드백 · 다음 단계뿐 — 시범 · 정답 키는 없다 */
export interface SavedReflection { reflectionId: string; attemptId: string; step: LessonStep; body: ReflectionBody; feedback: Formative; next: ProgressStep | null }
type Row = Record<string, unknown>
interface Filter { eq(col: string, v: unknown): Filter; limit(n: number): PromiseLike<{ data: Row[] | null; error: { message: string; code?: string } | null }> }
export interface ReflectionReader extends SupplyClient { from(table: 'source_lesson_reflection'): { select(cols: string): Filter } }

/**
 * 2C — 저장된 설명 읽기(새 채점 · INSERT 없음). DB 진행(source_lesson_progress)이 현재(ok)이고 이 납품 단계가 reflected 일 때만 읽는다 —
 * 철회 · 닫힌 Workspace · 구계획 · 타인은 진행 단계에서 실패 코드로 끝난다(현재 학습 가능으로 보이지 않음).
 * 행은 본인(user_id) · 이 납품 · 진행이 확인한 Workspace · 교수 자료 SHA 로 좁힌다(RLS 본인 SELECT 와 이중). 모르는 모양은 bad_shape.
 */
export async function savedReflection(c: ReflectionReader, userId: string, deliveryId: string): Promise<{ ok: true; saved: SavedReflection | null } | LessonFail> {
  if (!isUuid(userId)) return { ok: false, code: 'invalid_input' }
  const p = await lessonProgress(c, deliveryId)
  if (!p.ok) return p
  const me = p.progress.steps.find((s) => s.deliveryId === deliveryId)!
  if (!me.reflected) return { ok: true, saved: null }
  const { data, error } = await c.from('source_lesson_reflection').select('id, attempt_id, mutation_id, step, body')
    .eq('user_id', userId).eq('delivery_id', deliveryId).eq('workspace_id', p.progress.workspaceId).eq('lesson_sha256', LESSON_SHA256).limit(2)
  if (error) return classify(error)
  if (!data || data.length !== 1) return { ok: false, code: 'bad_shape' }
  const r = data[0]!
  const parsed = parseReflectionRequest({ attemptId: r.attempt_id, body: r.body, mutationId: r.mutation_id })
  if (!isUuid(r.id) || !parsed || r.step !== me.type || parsed.body.step !== me.type) return { ok: false, code: 'bad_shape' }
  const want = LESSON_STEPS[LESSON_STEPS.indexOf(me.type) + 1]
  const next = want ? p.progress.steps.find((s) => s.type === want && s.state === 'ok') ?? null : null
  return { ok: true, saved: { reflectionId: r.id, attemptId: parsed.attemptId, step: me.type, body: parsed.body, feedback: formativeFeedback(me.type, parsed.body.claim, parsed.body.support), next } }
}

export interface ReflectionResult { reflectionId: string; attemptId: string; deliveryId: string; step: LessonStep; recorded: true; evidence: false; replayed: boolean }

export async function submitReflection(c: SupplyClient, attemptId: string, req: { body: ReflectionBody; mutationId: string; deliveryId?: string }): Promise<{ ok: true; result: ReflectionResult } | LessonFail> {
  if (!isUuid(attemptId) || (req.deliveryId !== undefined && !isUuid(req.deliveryId))) return { ok: false, code: 'invalid_input' }
  const { data, error } = await c.rpc<unknown>('source_lesson_reflect', { p_attempt: attemptId, p_lesson_sha: LESSON_SHA256, p_body: req.body, p_mutation: req.mutationId, p_delivery: req.deliveryId ?? null })
  if (error) return classify(error)
  if (!isObj(data) || !isUuid(data.reflection_id) || data.attempt_id !== attemptId || !isUuid(data.delivery_id) || (req.deliveryId !== undefined && data.delivery_id !== req.deliveryId) || data.step !== req.body.step
      || data.recorded !== true || data.evidence !== false || data.non_evidence_reason !== 'guided_reflection' || typeof data.replayed !== 'boolean') return { ok: false, code: 'bad_shape' }
  return { ok: true, result: { reflectionId: data.reflection_id, attemptId, deliveryId: data.delivery_id, step: req.body.step, recorded: true, evidence: false, replayed: data.replayed } }
}
