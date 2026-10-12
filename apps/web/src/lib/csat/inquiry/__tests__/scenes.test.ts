// apps/web/src/lib/csat/inquiry/__tests__/scenes.test.ts
//
// 일곱 장면(v3) — 옛 장면 값은 별칭 · 무효값은 평가 과제 · 블록 하나는 한 장면에만 · 순서는 추천일 뿐
import { describe, expect, it } from 'vitest'

import type { TheaterBlockKind } from '../../theater'
import { SCENE_IDS, SCENES, nextScene, normalizeScene, parseScene, sceneOfBlock, sceneOfCheck } from '../scenes'

describe('일곱 장면', () => {
  it('v3 순서 그대로 일곱 개다', () => {
    expect(SCENE_IDS).toEqual(['task', 'meaning', 'judgment', 'design', 'compare', 'principle', 'explain'])
    expect(SCENES.map((s) => s.id)).toEqual([...SCENE_IDS])
  })

  it('없음 · 무효값은 평가 과제 — 무효값만 정규화 표시', () => {
    expect(parseScene(undefined)).toEqual({ scene: 'task', judgmentView: 'answer', normalized: false })
    expect(parseScene('')).toMatchObject({ scene: 'task', normalized: false })
    expect(parseScene('hack')).toMatchObject({ scene: 'task', normalized: true })
    expect(parseScene('compare')).toMatchObject({ scene: 'compare', normalized: false })
  })

  it('vNext2 장면 값은 별칭으로 받고 옛 answer/distractor 의 뜻을 judgmentView 로 구별한다', () => {
    expect(parseScene('essence')).toMatchObject({ scene: 'task', normalized: true })
    expect(parseScene('structure')).toMatchObject({ scene: 'meaning', normalized: true })
    expect(parseScene('answer')).toMatchObject({ scene: 'judgment', judgmentView: 'answer', normalized: true })
    expect(parseScene('distractor')).toMatchObject({ scene: 'judgment', judgmentView: 'options', normalized: true })
    expect(parseScene('principle')).toMatchObject({ scene: 'principle', normalized: false })
    expect(normalizeScene('distractor')).toBe('judgment')
  })

  it('judgmentView 는 닫힌 값만 — 자유 문자열은 answer', () => {
    expect(parseScene('judgment', 'options').judgmentView).toBe('options')
    expect(parseScene('judgment', '<script>').judgmentView).toBe('answer')
  })

  it('다음 장면은 추천일 뿐이고 내 설명 뒤에는 없다', () => {
    expect(nextScene('task')).toBe('meaning')
    expect(nextScene('design')).toBe('compare')
    expect(nextScene('explain')).toBeNull()
  })

  it('모든 블록 종류가 정확히 한 장면에 배정된다 — 정답 · 오답은 문항 성립, 출제 의도는 설계 재구성', () => {
    const kinds: TheaterBlockKind[] = ['head', 'ability', 'intent', 'answer', 'reject', 'procedure', 'vocab']
    for (const k of kinds) expect(SCENE_IDS).toContain(sceneOfBlock(k))
    expect(sceneOfBlock('answer')).toBe('judgment')
    expect(sceneOfBlock('reject')).toBe('judgment')
    expect(sceneOfBlock('intent')).toBe('design')
    expect(sceneOfBlock('vocab')).toBe('meaning')
  })

  it('이해 확인 과제는 문항 성립 판단이다', () => {
    expect(sceneOfCheck('evidence')).toBe('judgment')
    expect(sceneOfCheck('lure')).toBe('judgment')
  })
})
