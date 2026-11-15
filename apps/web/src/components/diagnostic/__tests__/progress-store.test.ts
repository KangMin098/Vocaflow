// apps/web/src/components/diagnostic/__tests__/progress-store.test.ts
//
// 진단 진행 보관 결속(DIAG-RESUME-BIND-01) — 본인 · 같은 진단 · 같은 문항판일 때만, 끊김 없는 접두만 이어 간다.
// 시각은 주입한다(Date.now 를 읽지 않는다). 저장소는 대역 — 던지는 저장소도 시험한다.
import { describe, expect, it } from 'vitest'

import {
  LEGACY_PROGRESS_KEY,
  PROGRESS_TTL_MS,
  clearProgress,
  completeFor,
  hasLegacyProgress,
  ownerTag,
  planResume,
  questionSig,
  readProgress,
  writeProgress,
  type DiagQuestion,
  type KV,
  type ProgressRecord,
} from '../progress-store'

const T0 = Date.UTC(2026, 9, 29, 3, 0, 0)
const Q = (id: string, i: number, over: Partial<DiagQuestion> = {}): DiagQuestion => ({ id, word: `w-${id}`, target_v_level: 3, target_track_level: null, display_order: i, ...over })
const QS = [Q('q1', 1), Q('q2', 2), Q('q3', 3), Q('q4', 4)]
const A = ownerTag('user-a'), B = ownerTag('user-b')

function memKV(init: Record<string, string> = {}): KV & { dump: () => Record<string, string> } {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}
const throwing: KV = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } }
const R = (...ids: string[]) => ids.map((id, i) => ({ question_id: id, knew: i % 2 === 0 }))
const rec = (over: Partial<ProgressRecord> = {}): ProgressRecord => ({ v: 2, owner: A, testId: 't1', sig: questionSig(QS), responses: R('q1', 'q2'), savedAt: T0, ...over })

describe('ownerTag · questionSig', () => {
  it('owner 꼬리표는 uid 원문을 담지 않고 사람마다 다르다', () => {
    expect(A).not.toContain('user-a')
    expect(A).not.toBe(B)
    expect(ownerTag('user-a')).toBe(A)
  })
  it('문항판 서명은 id · word · 두 난도 · display_order · 순서 중 하나만 바뀌어도 다르다', () => {
    const base = questionSig(QS)
    const variants = [
      [Q('q0', 0), ...QS],                                  // 앞에 추가
      [QS[0], Q('qx', 2), ...QS.slice(1)],                  // 중간 추가
      QS.slice(1),                                          // 앞 삭제
      [QS[0], QS[2], QS[3]],                                // 중간 삭제
      [QS[1], QS[0], QS[2], QS[3]],                         // 재정렬
      [Q('q1', 1, { word: 'other' }), ...QS.slice(1)],      // 같은 id 본문 변경
      [Q('q1', 1, { target_v_level: 4 }), ...QS.slice(1)],  // 같은 id 난도 변경
      [Q('q1', 1, { target_track_level: 2 }), ...QS.slice(1)],
      [Q('q1', 9), ...QS.slice(1)],                         // display_order 변경
    ]
    const sigs = variants.map(questionSig)
    for (const s of sigs) expect(s).not.toBe(base)
    expect(new Set(sigs).size).toBe(sigs.length)
    expect(questionSig(QS.map((q) => ({ ...q })))).toBe(base)
  })
})

describe('read · write · clear — 본인 키 분리 · TTL · 형식 · throw', () => {
  it('A 가 쓴 것을 A 는 읽고 B 는 읽지 못한다(A→A · A→B)', () => {
    const kv = memKV()
    expect(writeProgress(kv, { owner: A, testId: 't1', sig: questionSig(QS), responses: R('q1') }, T0)).toBe(true)
    const a = readProgress(kv, A, T0 + 1000)
    expect(a.kind).toBe('ok')
    expect(readProgress(kv, B, T0 + 1000)).toEqual({ kind: 'none' })
  })
  it('B 가 써도 A 의 보관분을 덮지 않는다 · 옛 키를 덮지 않는다', () => {
    const kv = memKV({ [LEGACY_PROGRESS_KEY]: JSON.stringify({ testId: 't1', responses: R('q1'), savedAt: T0 }) })
    writeProgress(kv, { owner: A, testId: 't1', sig: 's', responses: R('q1') }, T0)
    writeProgress(kv, { owner: B, testId: 't1', sig: 's', responses: R('q1', 'q2') }, T0)
    const r = readProgress(kv, A, T0)
    expect(r.kind === 'ok' && r.rec.responses.length).toBe(1)
    expect(kv.dump()[LEGACY_PROGRESS_KEY]).toContain('"savedAt"')
  })
  it('TTL 24시간 — 경계 안은 ok, 넘으면 expired, 미래 시각도 거부(주입 시각)', () => {
    const kv = memKV()
    writeProgress(kv, { owner: A, testId: 't1', sig: 's', responses: R('q1') }, T0)
    expect(readProgress(kv, A, T0 + PROGRESS_TTL_MS).kind).toBe('ok')
    expect(readProgress(kv, A, T0 + PROGRESS_TTL_MS + 1).kind).toBe('expired')
    expect(readProgress(kv, A, T0 - 10 * 60_000).kind).toBe('expired')
  })
  it('형식 오류 · 다른 owner 가 적힌 기록 · 깨진 JSON 은 invalid', () => {
    const key = (o: string) => `vocaflow-diagnostic-progress.v2.${o}`
    for (const bad of ['{x', JSON.stringify({ ...rec(), v: 1 }), JSON.stringify({ ...rec(), owner: B }), JSON.stringify({ ...rec(), responses: [{ question_id: 1, knew: true }] }), JSON.stringify({ ...rec(), savedAt: 'x' })]) {
      expect(readProgress(memKV({ [key(A)]: bad }), A, T0).kind).toBe('invalid')
    }
  })
  it('저장소가 던지면 unavailable · 쓰기 false · 지우기는 조용히', () => {
    expect(readProgress(throwing, A, T0)).toEqual({ kind: 'unavailable' })
    expect(readProgress(null, A, T0)).toEqual({ kind: 'unavailable' })
    expect(writeProgress(throwing, { owner: A, testId: 't', sig: 's', responses: [] }, T0)).toBe(false)
    expect(() => clearProgress(throwing, A)).not.toThrow()
    expect(hasLegacyProgress(throwing, T0)).toBe(false)
  })
  it('clearProgress 는 본인 v2 만 지운다 — 옛 키 · 다른 사람은 그대로', () => {
    const kv = memKV({ [LEGACY_PROGRESS_KEY]: JSON.stringify({ testId: 't1', responses: R('q1'), savedAt: T0 }) })
    writeProgress(kv, { owner: A, testId: 't1', sig: 's', responses: R('q1') }, T0)
    writeProgress(kv, { owner: B, testId: 't1', sig: 's', responses: R('q1') }, T0)
    clearProgress(kv, A)
    expect(readProgress(kv, A, T0).kind).toBe('none')
    expect(readProgress(kv, B, T0).kind).toBe('ok')
    expect(kv.dump()[LEGACY_PROGRESS_KEY]).toBeDefined()
  })
})

describe('legacy — 알리기만, 자동 인수 · 삭제 0', () => {
  it('유효한 옛 보관분이 있으면 true, 읽기만 하고 지우지 않는다', () => {
    const raw = JSON.stringify({ testId: 't1', responses: R('q1'), savedAt: T0 })
    const kv = memKV({ [LEGACY_PROGRESS_KEY]: raw })
    expect(hasLegacyProgress(kv, T0 + 1000)).toBe(true)
    expect(kv.dump()[LEGACY_PROGRESS_KEY]).toBe(raw)
    // 옛 보관분은 v2 읽기에 잡히지 않는다(자동 인수 0)
    expect(readProgress(kv, A, T0)).toEqual({ kind: 'none' })
  })
  it('TTL 지난 옛 보관분 · 빈 응답은 알리지 않는다', () => {
    expect(hasLegacyProgress(memKV({ [LEGACY_PROGRESS_KEY]: JSON.stringify({ testId: 't1', responses: R('q1'), savedAt: T0 }) }), T0 + PROGRESS_TTL_MS + 1)).toBe(false)
    expect(hasLegacyProgress(memKV({ [LEGACY_PROGRESS_KEY]: JSON.stringify({ testId: 't1', responses: [], savedAt: T0 }) }), T0)).toBe(false)
  })
})

describe('planResume — 끊김 없는 유일한 접두만', () => {
  it('같은 판 · 접두 q1,q2 → 다음 index 2', () => {
    expect(planResume(rec(), 't1', QS)).toEqual({ ok: true, nextIdx: 2, responses: R('q1', 'q2'), complete: false })
  })
  it('앞 · 중간 추가 · 삭제 · 재정렬 · 같은 id 본문/난도 변경 → changed(일부를 걸러 섞지 않는다)', () => {
    const r0 = rec()
    for (const qs of [[Q('q0', 0), ...QS], [QS[0], Q('qx', 2), ...QS.slice(1)], QS.slice(1), [QS[0], QS[2], QS[3]], [QS[1], QS[0], QS[2], QS[3]], [Q('q1', 1, { word: 'x' }), ...QS.slice(1)], [Q('q1', 1, { target_v_level: 9 }), ...QS.slice(1)]]) {
      expect(planResume(r0, 't1', qs)).toEqual({ ok: false, reason: 'changed' })
    }
  })
  it('다른 시험 → test', () => {
    expect(planResume(rec(), 't2', QS)).toEqual({ ok: false, reason: 'test' })
  })
  it('같은 판이어도 응답 중복 · 깨진 순서 · 건너뜀 · 초과 → 거부', () => {
    expect(planResume(rec({ responses: R('q1', 'q1') }), 't1', QS)).toEqual({ ok: false, reason: 'duplicate' })
    expect(planResume(rec({ responses: R('q2', 'q1') }), 't1', QS)).toEqual({ ok: false, reason: 'order' })
    expect(planResume(rec({ responses: R('q1', 'q3') }), 't1', QS)).toEqual({ ok: false, reason: 'order' })
    expect(planResume(rec({ responses: R('q1', 'q2', 'q3', 'q4', 'q5') }), 't1', QS)).toEqual({ ok: false, reason: 'too_many' })
  })
  it('완답 보관분은 complete:true — 이어서 하기만으로 제출하지 않는다(화면이 확인 단계로)', () => {
    const p = planResume(rec({ responses: R('q1', 'q2', 'q3', 'q4') }), 't1', QS)
    expect(p).toMatchObject({ ok: true, complete: true, nextIdx: 4 })
  })
  it('돌려준 응답은 복사본이다', () => {
    const r0 = rec()
    const p = planResume(r0, 't1', QS)
    if (!p.ok) throw new Error('x')
    p.responses[0].knew = !p.responses[0].knew
    expect(r0.responses[0].knew).toBe(true)
  })
})

describe('completeFor — 제출 직전 확인', () => {
  it('문항판 전체에 순서대로 한 번씩일 때만 참', () => {
    expect(completeFor(R('q1', 'q2', 'q3', 'q4'), QS)).toBe(true)
    expect(completeFor(R('q1', 'q2', 'q3'), QS)).toBe(false)
    expect(completeFor(R('q1', 'q3', 'q2', 'q4'), QS)).toBe(false)
    expect(completeFor([], [])).toBe(false)
  })
})
