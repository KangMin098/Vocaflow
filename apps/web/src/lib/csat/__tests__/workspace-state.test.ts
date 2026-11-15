// apps/web/src/lib/csat/__tests__/workspace-state.test.ts
//
// 기출 탐구 작업공간 — 도크 매핑 · 초안 저장 규칙 · 원문 폭(선호 ≠ 표시)을 고정한다.
import { describe, expect, it } from 'vitest'

import { DOCK_GROUPS, groupOf, rememberScene, titleScene } from '../inquiry/dock'
import { SCENE_IDS, parseScene } from '../inquiry/scenes'
import { EMPTY_EXPLAIN, EMPTY_NOTE, clearExplain, edited, linkableEvidence, sending, settled } from '../explain-draft'
import { MAIN_MIN, PAPER_MIN, defaultPaperWidth, maxPaperWidth, shownPaperWidth } from '../paper-width'

describe('도크 — 네 요소 ↔ 일곱 장면', () => {
  it('일곱 장면이 빠짐 · 중복 없이 네 요소에 하나씩 속한다', () => {
    const all = DOCK_GROUPS.flatMap((g) => g.scenes)
    expect([...all].sort()).toEqual([...SCENE_IDS].sort())
    expect(new Set(all).size).toBe(SCENE_IDS.length)
  })
  it('대표 장면 — 원문 이해=meaning · 문항 설계=judgment · 비교와 원리=compare · 학습 정리=explain', () => {
    expect(DOCK_GROUPS.map((g) => [g.label, g.lead])).toEqual([['원문 이해', 'meaning'], ['문항 설계', 'judgment'], ['비교와 원리', 'compare'], ['학습 정리', 'explain']])
  })
  it('제목 = 그 요소의 마지막 장면, 기억이 없으면 대표 장면', () => {
    const g = groupOf('task')
    expect(titleScene(g, {})).toBe('meaning')
    expect(titleScene(g, rememberScene({}, 'task'))).toBe('task')
    // 다른 요소의 기억은 이 요소에 영향이 없다
    expect(titleScene(groupOf('design'), rememberScene({}, 'task'))).toBe('judgment')
  })
  it('직접 주소의 장면이 첫 기억 — 기본 장면 task 는 장면 정본 그대로', () => {
    expect(parseScene(null).scene).toBe('task')
    const last = rememberScene({}, parseScene('principle').scene)
    expect(titleScene(groupOf('compare'), last)).toBe('principle')
  })
  it('같은 장면을 다시 기억하면 같은 객체(불필요한 렌더 없음)', () => {
    const a = rememberScene({}, 'design')
    expect(rememberScene(a, 'design')).toBe(a)
  })
})

describe('초안 저장 — 실제 결과로만 끝난다', () => {
  const fresh = () => 'id-1'
  it('실패하면 입력 · 같은 id · 처음 시각을 지키고 다시 저장은 같은 id', () => {
    let d = edited(EMPTY_EXPLAIN, { choice: 2, tempting: '쓴 글' })
    const s1 = sending(d, fresh, 100)
    d = settled(s1.draft, false, s1.id, clearExplain)
    expect(d).toMatchObject({ status: 'failed', tempting: '쓴 글', choice: 2, pendingId: 'id-1', pendingAt: 100 })
    const s2 = sending(d, () => 'id-2', 200)
    expect(s2.id).toBe('id-1')
    expect(s2.at).toBe(100)
  })
  it('성공하면 보낸 판만 비운다 — 보낸 뒤 새로 쓴 글은 지키지 않고 버리지 않는다', () => {
    const s = sending(edited(EMPTY_EXPLAIN, { choice: 1, tempting: 'a' }), fresh, 1)
    expect(settled(s.draft, true, s.id, clearExplain)).toMatchObject({ status: 'saved', tempting: '', choice: null, pendingId: null, shownId: 'id-1' })
    const typedAfter = edited(s.draft, { tempting: 'a 그리고 더' })
    expect(settled(typedAfter, true, s.id, clearExplain)).toMatchObject({ status: 'saved', tempting: 'a 그리고 더', pendingId: null })
  })
  it('다른 저장이 이어받은 초안에는 옛 결과를 적용하지 않는다', () => {
    const s = sending(edited(EMPTY_EXPLAIN, { choice: 1, tempting: 'a' }), fresh, 1)
    const other = { ...s.draft, pendingId: 'id-9' }
    expect(settled(other, false, s.id, clearExplain)).toBe(other)
  })
  it('편집하면 「저장됨」 표시를 지운다', () => {
    const saved = { ...EMPTY_NOTE, status: 'saved' as const }
    expect(edited(saved, { evidence: [3] }).status).toBe('idle')
  })
})

describe('노트 근거 연결 — 지도 범위 안의 실제 문장 번호만', () => {
  it('범위 밖 · 중복 · 비정수는 버리고 정렬 · 최대 20', () => {
    expect(linkableEvidence([7, 3, 3, 0, 12, 2.5], 7)).toEqual([3, 7])
    expect(linkableEvidence(Array.from({ length: 30 }, (_, i) => i + 1), 40)).toHaveLength(20)
  })
  it('지도가 없거나(결속 확인 불가 · 문장 단위 아님) 고른 근거가 없으면 연결하지 않는다', () => {
    expect(linkableEvidence([1, 2], null)).toEqual([])
    expect(linkableEvidence(null, 7)).toEqual([])
  })
})

describe('원문 열 폭 — 선호 ≠ 표시', () => {
  it('기본 폭은 1280 약 304~320 · 1440 약 344~360', () => {
    expect(defaultPaperWidth(1280)).toBeGreaterThanOrEqual(304)
    expect(defaultPaperWidth(1280)).toBeLessThanOrEqual(320)
    expect(defaultPaperWidth(1440)).toBeGreaterThanOrEqual(344)
    expect(defaultPaperWidth(1440)).toBeLessThanOrEqual(360)
  })
  it('최대 폭은 메인 프레임 최소 폭(도크)을 남긴다', () => {
    expect(maxPaperWidth(1216)).toBe(1216 - MAIN_MIN)
    expect(maxPaperWidth(800)).toBe(PAPER_MIN)
  })
  it('좁아지면 표시만 줄고, 넓어지면 선호로 돌아간다(선호는 그대로)', () => {
    const pref = 480
    expect(shownPaperWidth(pref, 1060)).toBe(1060 - MAIN_MIN)
    expect(shownPaperWidth(pref, 1376)).toBe(480)
  })
  it('오래된 큰 저장 값도 같은 제한으로 안전하게', () => {
    expect(shownPaperWidth(5000, 1216)).toBe(1216 - MAIN_MIN)
    expect(shownPaperWidth(10, 1216)).toBe(PAPER_MIN)
  })
})
