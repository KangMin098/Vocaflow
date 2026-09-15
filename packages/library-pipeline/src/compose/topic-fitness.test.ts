// packages/library-pipeline/src/compose/topic-fitness.test.ts
//
// 제목 기반 학습 적합성 — 굴절형과 우선순위를 못 박는다.

import { describe, expect, it } from 'vitest'

import {
  KOREAN_PUBLISHERS,
  classifyTopic,
  fitnessRatio,
  hasKoreaContext,
  isKoreaRelevant,
  koreanOutlets,
  learnerPriority,
} from './topic-fitness'
import { FACT_SOURCES } from './sources'

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

describe('한국 관련성 — 목표의 축인데 재지 않고 있었다', () => {
  it('한국 소재를 알아본다', () => {
    for (const t of [
      'Heavy rainfall hits southeastern Korea',
      'Seoul students win robotics contest',
      'Yonhap reports record heat in Busan',
      'Samsung unveils a new display',
    ]) {
      expect(hasKoreaContext(t), t).toBe(true)
    }
    expect(hasKoreaContext('Colombia begins recovery after earthquake')).toBe(false)
  })

  it('적합성과 한국 관련성은 다른 축이다', () => {
    // 실측 2026-08-19: 적합률만 보고 연합뉴스를 껐는데, 기여도 1위 소스였다.
    expect(learnerPriority('Seoul students test a robot they built at school')).toBe(3)
    expect(learnerPriority('Students test a robot they built at school')).toBe(2)
    expect(learnerPriority('Korean court hears the case on Tuesday')).toBe(0)
  })

  it('부적합은 한국 관련이어도 쓰지 않는다 — 친숙해도 학습 지문이 아니다', () => {
    expect(learnerPriority('Two killed in Seoul bus crash')).toBe(0)
    expect(classifyTopic('Two killed in Seoul bus crash')).toBe('unfit')
  })

  it('중립 + 한국 관련은 무관 중립보다 앞선다', () => {
    expect(learnerPriority('Korea reports quarterly figures')).toBe(1)
    expect(learnerPriority('Company reports quarterly figures')).toBe(0)
  })
})

describe('사건 단위 한국 관련성 — 발행사가 키워드보다 확실하다', () => {
  it('한국 매체 2곳이 다루면 제목에 키워드가 없어도 한국 관련이다', () => {
    // 실측 2026-08-19: 이 두 건은 명백한 국내 사건인데 키워드로는 안 잡혔다.
    for (const t of [
      'Nvidia executive to visit LG Electronics robotics hub on Tuesday',
      'Heavy rainfall offers drought relief, causes damage in southern regions',
    ]) {
      expect(isKoreaRelevant(t, ['en.yna.co.kr', 'koreatimes.co.kr']), t).toBe(true)
    }
  })

  it('한국 매체 한 곳만이면 근거로 삼지 않는다 — 국제 뉴스를 그대로 싣는다', () => {
    expect(isKoreaRelevant('Bus crash in Hungary kills 12 people', ['en.yna.co.kr', 'dw.com'])).toBe(
      false,
    )
  })

  it('제목에 키워드가 있으면 발행사와 무관하게 한국 관련이다', () => {
    expect(isKoreaRelevant('BTS lands 2 MTV VMA nominations', ['bbc.co.uk'])).toBe(true)
    expect(isKoreaRelevant('Seoul subway extends late-night service', [])).toBe(true)
  })

  it('발행사 대소문자를 가리지 않고, 같은 곳을 두 번 세지 않는다', () => {
    expect(koreanOutlets(['EN.YNA.CO.KR', 'en.yna.co.kr'])).toBe(1)
    expect(koreanOutlets(['en.yna.co.kr', 'koreaherald.com', 'bbc.co.uk'])).toBe(2)
  })

  it('예전에 놓치던 기업 이름을 이제 잡는다', () => {
    for (const t of ['LG unveils new display', 'SK Hynix expands plant', 'Kia opens design center']) {
      expect(hasKoreaContext(t), t).toBe(true)
    }
  })

  it('한국 매체 2곳이어도 부적합이면 우선순위 0 — 친숙해도 사건사고는 쓰지 않는다', () => {
    expect(
      learnerPriority('Man arrested over assault in Seoul', ['en.yna.co.kr', 'koreatimes.co.kr']),
    ).toBe(0)
  })

  it('적합 + 한국 매체 2곳이면 최우선(3)', () => {
    expect(
      learnerPriority('Heavy rainfall offers drought relief', [
        'en.yna.co.kr',
        'koreatimes.co.kr',
      ]),
    ).toBe(3)
  })

  it('발행사를 안 넘기면 예전 그대로 동작한다 — 기존 호출부가 조용히 바뀌지 않는다', () => {
    expect(learnerPriority('Scientists discover new coral species')).toBe(2)
    // 한국 관련이지만 적합 신호가 없어 중립(1). 'MTV'·'VMA' 는 적합 패턴이 아니다 —
    //   친숙하다고 학습 지문이 되지는 않는다는 규칙이 여기서도 그대로 적용된다.
    expect(learnerPriority('BTS lands 2 MTV VMA nominations')).toBe(1)
  })
})

describe('KOREAN_PUBLISHERS 는 소스 레지스트리와 어긋나면 안 된다', () => {
  it('적힌 발행사가 실제로 레지스트리에 있다', () => {
    const known = new Set(Object.values(FACT_SOURCES).map((s) => s.publisher.toLowerCase()))
    for (const p of KOREAN_PUBLISHERS) expect(known.has(p), p).toBe(true)
  })
})

describe('군사 훈련이 운동으로 새지 않는다', () => {
  it('exercise 가 있어도 군사 기사면 부적합', () => {
    // 실측 2026-08-19: FIT 의 `exercise`(운동)에 걸려 국방부 훈련 기사가 적합으로 올라왔다.
    expect(
      classifyTopic("(URGENT) Pentagon: S. Korea-U.S. exercise adjustments preserve 'essential' readiness"),
    ).toBe('unfit')
    expect(classifyTopic('Military drills begin near the border')).toBe('unfit')
    expect(classifyTopic('Navy launches new vessel')).toBe('unfit')
  })

  it('평범한 운동·건강 기사는 그대로 적합이다 — 축을 통째로 깎지 않았는지 본다', () => {
    expect(classifyTopic('Daily exercise improves memory in older adults')).toBe('fit')
    expect(classifyTopic('How sleep and nutrition shape the brain')).toBe('fit')
    expect(classifyTopic('Marathon runners gather for the annual race')).toBe('fit')
  })
})
