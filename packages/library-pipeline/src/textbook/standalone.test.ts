// packages/library-pipeline/src/textbook/standalone.test.ts
//
// 세 축(어수·FK·어휘)을 다 통과하고도 **지문이 아닌 글**이 있다.
// 실측 2026-09-04: 그렇게 통과한 PD 발췌 906편 중 **69%(629편)** 가 이 자에서 떨어졌다.

import { describe, expect, it } from 'vitest'

import {
  STANDALONE_GATE,
  STANDALONE_SPEC,
  standaloneFit,
  standaloneSignals,
} from './standalone'

/** 시중 교재 지문의 결 — 설명문. 대화 0% · 문두가 스스로 선다. */
const expository =
  'Sea turtles travel thousands of kilometers every year. They swim from feeding grounds ' +
  'to the beaches where they were born. Scientists track them with small tags. ' +
  'The data shows that some turtles cross an entire ocean to lay their eggs.'

/** 실제로 적재됐던 꼴 — 소설 대화 장면. 세 축은 통과했다. */
const sceneFragment =
  '"Play something, Amy. Let them hear how much you have improved," said Laurie, ' +
  'with pardonable pride in his promising pupil. "I did fail, say what you will, ' +
  'for Jo wouldn\'t love me," began Laurie, leaning his head on his hand.'

/**
 * 대화가 조금 있는 이야기 지문 — **막으면 안 된다.** 시중에도 p95 8.5% 까지 있다.
 *
 * ⚠️ 픽스처 길이를 **시중 규격(100~200어)에 맞춰야 한다.** 처음엔 84어로 썼는데 짧은 인용
 *   하나가 10.2% 가 되어 문턱을 넘었다 — 같은 인용이 130어 지문에서는 4.6% 다.
 *   짧은 픽스처로 재고 문턱을 올렸다면 **픽스처의 결함을 자에 새기는 것**이었다.
 */
const narrativeWithSomeDialogue =
  'The old baker opened his shop before sunrise every morning. Neighbors said his bread ' +
  'tasted like the bread their grandmothers had made. He ground his own flour in a small ' +
  'mill behind the shop, and he never wrote the recipe down. In winter the village woke ' +
  'to the smell of it long before the sun reached the rooftops. One cold morning a child ' +
  'stopped at the door and asked him, "Why do you wake so early?" The baker smiled and ' +
  'went on kneading the dough with his heavy hands. He had asked himself the same question ' +
  'for forty years and had never found a short answer. The bread, he thought, was the answer.'

describe('자립성 신호', () => {
  it('대화 비중을 낱말로 센다', () => {
    expect(standaloneSignals(expository)!.quotedPct).toBe(0)
    expect(standaloneSignals(sceneFragment)!.quotedPct).toBeGreaterThan(50)
  })

  it('곧은 따옴표와 굽은 따옴표를 함께 본다 — 구텐베르크 평문은 섞여 있다', () => {
    const curly = 'She waited by the gate. “Do you play croquet with the Queen today?” said the Cat.'
    expect(standaloneSignals(curly)!.quotedPct).toBeGreaterThan(30)
  })

  it('앞을 가리키는 문두를 잡는다', () => {
    expect(standaloneSignals('So she disturbed you, and you also looked. He nodded.')!.opensAnaphoric).toBe(true)
    expect(standaloneSignals('"How otherwise?" he asked. The room was cold.')!.opensAnaphoric).toBe(true)
    expect(standaloneSignals(expository)!.opensAnaphoric).toBe(false)
  })

  it('낱말이 없으면 null 이다 — 0 을 돌려주지 않는다', () => {
    expect(standaloneSignals('')).toBeNull()
    expect(standaloneSignals('123 456')).toBeNull()
  })
})

describe('자립성 게이트', () => {
  it('설명문은 통과한다', () => {
    expect(standaloneFit(expository).pass).toBe(true)
  })

  it('장면 조각은 막고 **왜인지 숫자로 말한다**', () => {
    const r = standaloneFit(sceneFragment)
    expect(r.pass).toBe(false)
    expect(r.reason).toMatch(/%/)
  })

  it('대화가 조금 있는 이야기는 **막지 않는다** — 시중에도 있다', () => {
    const s = standaloneSignals(narrativeWithSomeDialogue)!
    expect(s.quotedPct).toBeLessThanOrEqual(STANDALONE_GATE.maxQuotedPct)
    expect(standaloneFit(narrativeWithSomeDialogue).pass).toBe(true)
  })

  it('문턱이 시중 p95 다 — 어휘 자(p90)와 백분위가 다른 것은 분포가 달라서다', () => {
    // 시중 대화 비중은 0 에 몰려 있어 p90(4.5)으로 조이면 정상 이야기 지문이 무더기로 막힌다.
    expect(STANDALONE_GATE.maxQuotedPct).toBeGreaterThan(STANDALONE_SPEC.market.elementary.quotedP95)
    expect(STANDALONE_GATE.maxQuotedPct).toBeGreaterThan(STANDALONE_SPEC.market.middle.quotedP95)
    expect(STANDALONE_SPEC.market.elementary.quotedP50).toBe(0)
  })

  it('표본 수와 오탐률을 들고 다닌다 — 규칙의 한계를 숨기지 않는다', () => {
    // 시중 지문 3%가 문두 규칙에 걸린다. 그 사실을 값으로 갖고 있어야 인용할 때 함께 말한다.
    expect(STANDALONE_SPEC.market.elementary.anaphoricPct).toBe(3)
    expect(STANDALONE_SPEC.market.elementary.sample).toBeGreaterThan(100)
  })

  it('요일로 시작하는 일지를 막는다 — 연도가 없어도 일지다', () => {
    // Audubon 항해일지 발췌가 그대로 통과했다(실측 2026-09-05). 달력 날짜 규칙은
    // `November 10, 1851.` 만 잡는데, 일지는 해가 바뀌지 않는 한 연도를 적지 않는다.
    const journal =
      'Wednesday, 4th. Cloudy and coldish. Left early and could not find my pocket knife. ' +
      'We were stopped by the wind at the bluffs, about twenty miles above the fort. ' +
      'We all hunted, with only fair results. Saw some hazel bushes, and some black walnuts.'
    expect(standaloneFit(journal).pass).toBe(false)
    expect(standaloneFit(journal.replace('Wednesday, 4th.', 'Thursday, 5th—')).pass).toBe(false)
  })

  it('이야기 속 요일 문장은 치지 않는다 — 세 조건을 모두 요구하는 이유', () => {
    // '요일 + 숫자 + 끝맺음' 중 하나라도 빠지면 일지가 아니다. 시중 지문 오탐 0.5%(1/207)이고
    // 그 1건도 쪽 경계에서 잘린 조각이지 이 규칙이 친 것이 아니다.
    const story =
      'Wednesday was the day of the fair. The whole village walked to the field before sunrise. ' +
      'Farmers brought their best animals and the children carried baskets of apples. ' +
      'A judge gave a blue ribbon to the finest cow. Everyone stayed until the lamps were lit.'
    expect(standaloneFit(story).pass).toBe(true)
  })

  it('없는 그림을 가리키는 조각을 막는다', () => {
    // 실측 2026-09-05: 초3~4 표본 12편 중 하나가 [Illustration: …] 캡션으로 시작해
    // 네 축을 모두 통과했다. 그림이 있어야만 읽히는 글은 지문이 될 수 없다.
    const withFigure =
      '[Illustration: A. Outer wing of locust. B. Inner wing of locust.] ' +
      'Every minute the air was growing cooler. The children could smell the pine woods. ' +
      'Once in a while the train flashed by a great big sawmill. ' +
      'The hills were rolling nearer and nearer in great shadows.'
    expect(standaloneFit(withFigure).pass).toBe(false)
    // 시중 지문 오탐 0/207 — 표식이 없으면 그대로 통과한다.
    expect(standaloneFit(withFigure.replace(/^\[[^\]]*\]\s*/, '')).pass).toBe(true)
  })

  it('숫자가 많다고 막지는 않는다 — 재고 물러선 규칙', () => {
    // 조리법 재료란 13.8% vs 시중 지문 최대 13.5%. 문턱을 어디 두어도 하나는 틀린다.
    // 신호는 내되 게이트로 쓰지 않는다는 사실을 값으로 고정한다.
    const numericProse =
      'The Moon travels around the Earth once every 27 days. ' +
      'It is about 384,400 kilometres away from us. ' +
      'Astronauts landed there in 1969 and brought back rock. ' +
      'Scientists still study those rocks today.'
    const f = standaloneFit(numericProse)
    expect(f.pass).toBe(true)
    expect(f.signals?.numericPct).toBeGreaterThan(5)
  })

  it('못 재면 통과시키지 않는다', () => {
    expect(standaloneFit('').pass).toBe(false)
  })
})
