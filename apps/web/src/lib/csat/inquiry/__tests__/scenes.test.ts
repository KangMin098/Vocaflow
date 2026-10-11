// apps/web/src/lib/csat/inquiry/__tests__/scenes.test.ts
//
// 여섯 장면 배정 — 모르는 장면은 본질로 · 블록 하나는 한 장면에만 · 순서는 추천일 뿐
import { describe, expect, it } from 'vitest'

import type { TheaterBlockKind } from '../../theater'
import { SCENE_IDS, SCENES, nextScene, normalizeScene, sceneOfBlock, sceneOfCheck } from '../scenes'

describe('여섯 장면', () => {
  it('지시문 순서 그대로 여섯 개다', () => {
    expect(SCENE_IDS).toEqual(['essence', 'structure', 'answer', 'distractor', 'principle', 'compare'])
    expect(SCENES.map((s) => s.id)).toEqual([...SCENE_IDS])
  })

  it('URL 값이 없거나 모르는 값이면 본질로 정규화한다', () => {
    expect(normalizeScene(undefined)).toBe('essence')
    expect(normalizeScene('')).toBe('essence')
    expect(normalizeScene('hack')).toBe('essence')
    expect(normalizeScene('distractor')).toBe('distractor')
  })

  it('다음 장면은 추천일 뿐이고 비교 뒤에는 없다', () => {
    expect(nextScene('essence')).toBe('structure')
    expect(nextScene('compare')).toBeNull()
  })

  it('모든 블록 종류가 정확히 한 장면에 배정된다', () => {
    const kinds: TheaterBlockKind[] = ['head', 'ability', 'intent', 'answer', 'reject', 'procedure', 'vocab']
    for (const k of kinds) expect(SCENE_IDS).toContain(sceneOfBlock(k))
    expect(sceneOfBlock('answer')).toBe('answer')
    expect(sceneOfBlock('reject')).toBe('distractor')
  })

  it('근거 찾기 확인은 정답 설계, 바뀐 성분 확인은 오답 설계에 있다', () => {
    expect(sceneOfCheck('evidence')).toBe('answer')
    expect(sceneOfCheck('lure')).toBe('distractor')
  })
})
