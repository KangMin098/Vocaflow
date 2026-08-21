// packages/library-pipeline/src/textbook/compose-extra.test.ts
//
// **생성형 문항이 실제로 단원에 실리는지** 못 박는다.
//
// ── 왜 이 회귀가 있나 ────────────────────────────────────────────────
// 생성형 유형 64문항을 만들어 DB 에 넣었는데 **권은 하나도 안 달라졌다.** 조합기가
// `order`·`insert` 만 보고 있었기 때문이다. 재료·조합·조판 셋이 다 열려야 학습자에게 닿는데
// 조합이 막혀 있었고, "문항 수가 늘었다" 는 리포트만 보고 있으면 그 사실을 모른다.
//
// **만든 것과 작동하는 것은 다르다.**
//
// 동시에 지켜야 할 것이 하나 더 있다 — 덧붙임이 **이미 완성된 권을 후퇴시키지 않을 것.**
// 생성형은 지금 V3 에만 있고, 뼈대를 바꾸면 나머지 밴드의 권이 통째로 줄어든다.

import { describe, expect, it } from 'vitest'

import { composeUnits, DEFAULT_EXTRA_PER_UNIT, EXTRA_ITEM_TYPES } from './compose-unit'

/** 규격을 통과하는 최소한의 풀 항목. */
function item(id: string, type: string, ref: string) {
  // ⚠️ 지문은 **90~200어**(`CSAT_ITEM_WORDS`) 안이어야 조합기가 받는다.
  //   짧게 잡았다가 전량 걸려 단원이 0개가 됐다 — 픽스처가 규격을 어기면 회귀가 엉뚱한
  //   이유로 실패한다. 16어 × 6문장 = 96어로 맞춘다.
  const sentence = 'A small group of workers moved the heavy load along the road before the rain came.'
  const passage = Array.from({ length: 6 }, () => sentence).join(' ')
  return {
    id,
    type,
    ref_id: ref,
    ref_title: `글 ${ref}`,
    v_level: 3,
    passage_text: passage,
    passage_words: passage.split(/\s+/).length,
    body_sentences: 6,
    payload: { presented: Array.from({ length: 5 }, () => sentence), remaining: Array.from({ length: 6 }, () => sentence), insert_sentence: sentence, passage, choices: ['a', 'b', 'c', 'd', 'e'] },
    answer_key: { source_order: [0, 1, 2, 3, 4], position: 3, answer: 1 },
  }
}

/** 뼈대만 있는 풀 — 원글 N편에서 순서·삽입을 하나씩. */
function corePool(refs: number) {
  const out = []
  for (let i = 0; i < refs; i++) {
    out.push(item(`o${i}`, 'order', `r${i}`), item(`i${i}`, 'insert', `r${i}`))
  }
  return out
}

describe('생성형 문항 덧붙임', () => {
  it('생성형이 없으면 예전과 똑같다 — **이미 완성된 권이 후퇴하지 않는다**', () => {
    const { units } = composeUnits(corePool(40), new Map(), { band: 3, unitCount: 5 })
    expect(units).toHaveLength(5)
    for (const u of units) expect(u.items).toHaveLength(4) // 순서 2 + 삽입 2
  })

  it('생성형이 있으면 단원에 덧붙는다 — 없으면 안 실린다', () => {
    const pool = [...corePool(40)]
    // 뼈대에 안 쓰인 글에서 생성형을 낸다.
    for (let i = 0; i < 20; i++) pool.push(item(`t${i}`, 'topic', `x${i}`), item(`g${i}`, 'main_point', `x${i}`))
    const { units } = composeUnits(pool, new Map(), { band: 3, unitCount: 5 })
    expect(units).toHaveLength(5)
    for (const u of units) {
      const extras = u.items.filter((x) => EXTRA_ITEM_TYPES.has(x.type))
      expect(extras.length).toBe(DEFAULT_EXTRA_PER_UNIT)
      // 같은 유형이 한 단원에 두 번 나오지 않는다.
      expect(new Set(extras.map((x) => x.type)).size).toBe(extras.length)
    }
  })

  it('덧붙임도 **한 단원 안에서 같은 글 금지**를 지킨다', () => {
    // 생성형을 뼈대와 **같은 글**에서만 낸다 — 규칙이 없으면 여기서 겹친다.
    const pool = [...corePool(40)]
    for (let i = 0; i < 40; i++) pool.push(item(`t${i}`, 'topic', `r${i}`))
    const { units } = composeUnits(pool, new Map(), { band: 3, unitCount: 5 })
    for (const u of units) {
      const refs = u.items.map((x) => x.ref_id)
      expect(new Set(refs).size, `단원 ${u.no} 에서 같은 글이 두 번 쓰였다`).toBe(refs.length)
    }
  })

  it('`extraPerUnit: 0` 이면 덧붙이지 않는다 — 되돌릴 수 있는 스위치다', () => {
    const pool = [...corePool(40)]
    for (let i = 0; i < 20; i++) pool.push(item(`t${i}`, 'topic', `x${i}`))
    const { units } = composeUnits(pool, new Map(), { band: 3, unitCount: 5, extraPerUnit: 0 })
    for (const u of units) expect(u.items).toHaveLength(4)
  })

  it('생성형 문항 수가 모자라도 **뼈대는 무너지지 않는다**', () => {
    const pool = [...corePool(40), item('t0', 'topic', 'x0')]
    const { units } = composeUnits(pool, new Map(), { band: 3, unitCount: 5 })
    expect(units).toHaveLength(5)
    // 첫 단원만 덧붙고 나머지는 뼈대 4개 그대로.
    expect(units[0]!.items.length).toBe(5)
    for (const u of units.slice(1)) expect(u.items).toHaveLength(4)
  })
})
