// packages/library-pipeline/src/compose/topic-fitness.test.ts
//
// 제목 기반 학습 적합성 — 굴절형과 우선순위를 못 박는다.

import { describe, expect, it } from 'vitest'

import { classifyTopic, fitnessRatio } from './topic-fitness'

describe('학습 적합성 분류', () => {
  it('굴절형을 잡는다 — \\bshoot\\b 는 "shooting" 을 못 잡았다', () => {
    // 실측 2026-08-19: 이 결함 때문에 학교 총격 사건이 **적합** 으로 분류돼
    // 천장 측정을 부풀렸다.
    expect(classifyTopic('At least 2 hit in a shooting at a school in the Philippines')).toBe('unfit')
    expect(classifyTopic('Two killed as bus crashes on mountain road')).toBe('unfit')
    expect(classifyTopic('Protesters march for a third day')).toBe('unfit')
  })

  it('부적합을 먼저 본다 — 사망이 들어간 과학 기사는 사건 기사다', () => {
    expect(classifyTopic('Scientist dies during volcano research expedition')).toBe('unfit')
    expect(classifyTopic('Ukraine research team publishes climate study')).toBe('unfit')
  })

  it('경이·자연·과학·배움·운동을 적합으로 본다', () => {
    for (const t of [
      'Hubble sees a swarm of galaxies',
      'How ants changed a Kenyan landscape',
      'Students test a robot they built at school',
      'Total solar eclipse darkens northern Europe',
    ]) {
      expect(classifyTopic(t), t).toBe('fit')
    }
  })

  it('판단할 신호가 없으면 중립 — 억지로 가르지 않는다', () => {
    expect(classifyTopic('Company reports quarterly figures')).toBe('neutral')
    expect(classifyTopic('')).toBe('neutral')
    // 사전에 없는 소재는 중립으로 남는다. 이 분류기는 **순위를 매기는 도구**이지
    // 게재 여부를 판정하는 장치가 아니므로, 'sauna' 같은 단어를 하나씩 채워 넣지 않는다.
    expect(classifyTopic('What a sauna does to your body')).not.toBe('unfit')
    expect(classifyTopic('Finnish families pick blueberries every summer')).not.toBe('unfit')
  })

  it('빈 입력의 적합률은 0%가 아니라 null — 없는 것을 0으로 보고하지 않는다', () => {
    expect(fitnessRatio([])).toBeNull()
    expect(fitnessRatio(['Hubble sees a swarm of galaxies', 'Two killed in crash'])).toBe(0.5)
  })
})
