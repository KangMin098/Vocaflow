// apps/web/src/lib/knowledge/__tests__/authored-items.test.ts
// FINAL §4.1·§4.3 — R5 창작 세트 규칙 · 채점 · 맹검 2인 대조(채점이 합리적 해석을 오답 처리하지 않는가)
import { describe, expect, it } from 'vitest'

import blindA from '../../../../../../docs/final/review/r5-authored-blind-A.json'
import blindB from '../../../../../../docs/final/review/r5-authored-blind-B.json'
import {
  R5_AUTHORED_SET, annotationRefOf, authoredItemsFor, findAuthored, gradeAuthored, isAssessmentRole, learnerView,
  AUTHORED_SETS, registrationArgs, validateAuthoredSet, type AuthoredGold, type AuthoredSet,
} from '../authored/authored-items'
import { AUTHORED_TASKS, AUTHORED_TASK_KEYS, AUTHORED_TASK_LABEL } from '../authored/tasks'
import { tasks } from '@/lib/csat/map/v4/definition'

const S = R5_AUTHORED_SET
const G = (i: { gold: unknown }) => i.gold as AuthoredGold
const item = (id: string) => S.items.find((x) => x.id === id)!
type Review = { claim: number; answer: number }
const norm = (r: unknown): Record<string, Review> =>
  Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, (Array.isArray(v) ? v[0] : v) as Review]))

describe('세트 규칙', () => {
  it('R5 세트는 규칙 위반이 없다', () => {
    expect(validateAuthoredSet(S)).toEqual([])
  })

  it('역할 5종 모두 있고 · 독립 확인은 서로 다른 지문 2개 이상(TASK 기준) · 모든 문항이 다른 지문 묶음', () => {
    const roles = new Set(S.items.map((i) => i.role))
    expect([...roles].sort()).toEqual(['delayed_check', 'guided_practice', 'independent_check', 'model_explanation', 'transfer'])
    expect(new Set(authoredItemsFor('r.central_meaning', 'independent_check').map((x) => x.item.passageGroup)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(S.items.map((i) => i.passageGroup)).size).toBe(S.items.length)
  })

  it('평가 지문 문장이 교수 · 연습 지문에 나오지 않는다(미리보기 · 해설로 새지 않는다)', () => {
    const instruction = S.items.filter((i) => !isAssessmentRole(i.role)).flatMap((i) => [...i.body.sentences, ...(i.body.teach ?? []).map((t) => t.text), ...(i.body.hints ?? [])]).join('\n')
    for (const a of S.items.filter((i) => isAssessmentRole(i.role))) for (const s of a.body.sentences) expect(instruction).not.toContain(s)
  })

  it('클라이언트용 TASK 표 = 창작 세트(TASK · 과제 키 · 라벨) — 세트 JSON 을 클라이언트에 넣지 않는다', () => {
    expect([...AUTHORED_TASKS].sort()).toEqual(AUTHORED_SETS.map((x) => x.taskId).sort())
    for (const set of AUTHORED_SETS) {
      expect(AUTHORED_TASK_KEYS[set.taskId], set.set).toBe(set.taskKey)
      expect(AUTHORED_TASK_LABEL[set.taskId], set.set).toBeTruthy()
    }
  })

  it('정답 위치가 한쪽으로 몰리지 않는다(같은 번호 ≤ 4)', () => {
    const counts = S.items.reduce<Record<number, number>>((m, i) => ({ ...m, [G(i).answer]: (m[G(i).answer] ?? 0) + 1 }), {})
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(4)
  })

  it('반례: 교수·평가 혼합 묶음 · 평가 문항의 단서 · 원천 파생은 거절', () => {
    const bad: AuthoredSet = JSON.parse(JSON.stringify(S))
    bad.items[3].passageGroup = bad.items[0].passageGroup
    bad.items[4].body.hints = ['정답은 ②']
    bad.provenance.derivedFrom = ['2020#24']
    const errs = validateAuthoredSet(bad).join('\n')
    expect(errs).toMatch(/교수·평가가 섞였다/)
    expect(errs).toMatch(/평가 문항에 해설 · 단서/)
    expect(errs).toMatch(/파생되지 않아야/)
  })
})

describe('학습자 보기 · 등록 인자', () => {
  it('학습자 보기에는 Gold 가 없다 · 교수 단계는 교수 역할만 · 단서는 안내 연습만', () => {
    for (const i of S.items) {
      const v = JSON.stringify(learnerView(S, i))
      expect(v).not.toContain(G(i).gist)
      expect(v).not.toMatch(/"answer"|"support"|"distractors"/)
      const lv = learnerView(S, i)
      expect(lv.teach !== null).toBe(i.role === 'model_explanation')
      expect(lv.hints !== null).toBe(i.role === 'guided_practice')
    }
  })

  it('등록 인자: 주석 ref 는 과제 키로 시작 · 평가 역할 = assessment', () => {
    for (const i of S.items) {
      const a = registrationArgs(S, i)
      expect(a.p_annotation_ref.startsWith(`${S.taskKey}-`)).toBe(true)
      expect(a.p_annotation_ref).toBe(annotationRefOf(S, i))
      expect(a.p_role_class).toBe(isAssessmentRole(i.role) ? 'assessment' : 'instruction')
      expect(a.p_ref).toMatch(/^authored:[a-z0-9][a-z0-9.-]{2,80}$/)
      expect(findAuthored(a.p_ref)?.item.id).toBe(i.id)
    }
  })
})

describe('채점', () => {
  const ind = item('r5-cm-ind-1')
  const right = { claim: 5, support: [2, 3, 4], relation: 'example', choice: 2 }

  it('정답: 요지 선택 + 주장 문장', () => {
    expect(gradeAuthored(S, ind, right)?.grade).toMatchObject({ isCorrect: true, choiceOk: true, claimOk: true, supportOk: true })
  })

  it('요지가 맞아도 중심 문장이 틀리면 오답 · 오답 선택지는 설계 유형을 돌려준다', () => {
    expect(gradeAuthored(S, ind, { ...right, claim: 2 })?.grade.isCorrect).toBe(false)
    expect(gradeAuthored(S, ind, { ...right, choice: 0 })?.grade).toMatchObject({ isCorrect: false, choiceDesign: 'opposed_view' })
  })

  it('다시 말하기 문장을 중심 문장으로 골라도 정답(합리적 해석) — 뒷받침 감점도 없다', () => {
    const t = item('r5-cm-teach-1')
    const g = gradeAuthored(S, t, { claim: 6, support: [3, 4, 5], relation: 'example', choice: 0 })!.grade
    expect(g).toMatchObject({ isCorrect: true, claimOk: false, claimRestated: true, supportOk: true })
  })

  it('형식이 틀리면 null(범위 밖 · 빈 뒷받침 · 선택지 없음)', () => {
    expect(gradeAuthored(S, ind, { ...right, claim: 99 })).toBeNull()
    expect(gradeAuthored(S, ind, { ...right, support: [] })).toBeNull()
    expect(gradeAuthored(S, ind, { claim: 5, support: [2], relation: 'example' })).toBeNull()
  })
})

describe('맹검 2인 대조(FINAL §4.3 — docs/final/review)', () => {
  for (const [name, raw] of [['A', blindA], ['B', blindB]] as const) {
    it(`검토자 ${name}: 9문항 정답이 Gold 와 같고, 고른 중심 문장은 채점이 정답으로 받는다`, () => {
      const r = norm(raw)
      S.items.forEach((it, k) => {
        const v = r[`item-${k + 1}`]
        expect(v, `${name} item-${k + 1}`).toBeDefined()
        expect(v.answer, `${name} ${it.id} answer`).toBe(G(it).answer)
        expect([G(it).claim, ...G(it).claimRestated], `${name} ${it.id} claim`).toContain(v.claim)
      })
    })
  }
})

describe('모든 창작 세트(FINAL §5 확장)', () => {
  for (const set of AUTHORED_SETS) {
    describe(set.set, () => {
      it('규칙 위반 없음 · 정본 비보류 TASK · 역할 5종 · 문항마다 다른 지문 묶음', () => {
        expect(validateAuthoredSet(set)).toEqual([])
        const def = tasks().find((t) => t.id === set.taskId)
        expect(def?.status, '정본에서 보류(hold) TASK 에는 창작 세트를 두지 않는다').not.toBe('hold')
        expect(new Set(set.items.map((i) => i.role)).size).toBe(5)
        expect(new Set(set.items.map((i) => i.passageGroup)).size).toBe(set.items.length)
        expect(set.items.filter((i) => i.role === 'independent_check').length).toBeGreaterThanOrEqual(2)
      })
      it('평가 지문 문장이 교수 · 단서 글에 나오지 않는다', () => {
        const instruction = set.items.filter((i) => !isAssessmentRole(i.role)).flatMap((i) => [...i.body.sentences, ...(i.body.teach ?? []).map((t) => t.text), ...(i.body.hints ?? [])]).join(String.fromCharCode(10))
        for (const a of set.items.filter((i) => isAssessmentRole(i.role))) for (const x of a.body.sentences) expect(instruction).not.toContain(x)
      })
      it('학습자 보기에 Gold 칸이 없다', () => {
        for (const i of set.items) expect(Object.keys(learnerView(set, i).extra).sort()).toEqual(Object.keys(learnerView(set, i).extra).filter((k) => ['target', 'pairs', 'marks', 'focus', 'segments', 'ask', 'pair', 'taskStem'].includes(k)).sort())
      })
    })
  }
})
