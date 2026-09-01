// packages/library-pipeline/src/textbook/benchmark-scope.test.ts
//
// **벤치마크가 재는 물건이 학습자가 받는 물건이어야 한다.**
//
// 실측 2026-09-01 — `--volume` 모드는 머리말에 "인쇄되는 것만 잰다" 고 적어 두고
// 실제로는 **창고 행(저장된 payload)** 을 골랐다. 그 하나에서 결함 두 개가 나왔다:
//
//   ① 조판은 정제 체인을 거친 사본을 인쇄한다 — V6 60문항 중 **13건의 낱말 수가 다르고**,
//      가장 큰 것은 `blank` 저장 186어 → 인쇄 **124어**(반복 꼬리 62어 절단).
//   ② 초등 3종은 조판 시점에 만들어져 `csat_dcp_items` 에 행이 **없다.** 그래서
//      id 로 추리는 방식에서는 **V1 60문항이 통째로 빠졌다** — 사다리 7권을 잰다면서
//      실은 6권을 재고 있었다. 그 60문항이 들어오자 A3·A7 이 실제로 내려갔다.
//
// 자를 고쳐서 값이 내려가는 것은 나쁜 소식이 아니다. **내려간 값이 맞는 값이다.**
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), '../../scripts/textbook/market-benchmark.mjs'),
  'utf8',
)

describe('벤치마크의 모집단', () => {
  it('`--volume` 은 창고 행이 아니라 **인쇄되는 사본**을 잰다', () => {
    // 창고 행을 id 로 추리던 옛 방식으로 되돌아가지 않는다.
    expect(src).not.toContain('items = all.filter((r) => ids.has(r.id))')
    expect(src).toContain('for (const u of v.units) for (const it of u.items) printed.push(it)')
    expect(src).toContain('items = printed.map(')
  })
})

describe('축마다 잴 수 있는 것만 잰다', () => {
  it('A6 은 장문을 뺀다 — 260~400어가 규격이라 시장 p90 밖이 설계다', () => {
    expect(src).toContain('SCHOOL_SENTENCE_TYPES.has(it.type) || LONG_ITEM_TYPES.has(it.type)')
  })

  it('지문 키에 presented 가 있다 — 없으면 순서 문항이 통째로 사라진다', () => {
    // DCP 순서 문항은 지문을 `presented` 에 담는다. 그 키를 안 읽으면 낱말 수가 0 으로 나오고
    // `w < 10` 관문에 걸려 **빠졌다는 표시조차 없이** 건너뛰어진다(실측 V6: 풀 126어 vs 벤치 0어).
    // 키를 메우자 A6 분모가 274 → 290 이 됐다.
    expect(src).toContain("'presented'")
  })

  it('A3 은 선택지 **개수**로 판정한다 — 빈 배열도 `Array.isArray` 는 참이다', () => {
    // `spell_blank` 이 `choices: []` 를 들고 있어 선택지 없는 20문항이 "오답 배제 실패" 로 세어졌다.
    expect(src).not.toContain('Array.isArray(i.payload?.choices) || Array.isArray(i.payload?.underlines)')
    expect(src).toContain('(i.payload?.choices?.length ?? 0) > 0')
  })

  it('A7 은 초1~2 를 뺀다 — 그 학년 기준선을 잰 적이 없다', () => {
    // 코퍼스의 초등 교재 19건 880쪽이 전부 초3~6 이다(grade_min 초3~초6, 초1~2 는 0건).
    // 없는 자로 재서 4지선다를 미달로 세우면, 근거 없는 임계값을 목표로 삼는 것이 된다.
    expect(src).toContain('a7NoBaseline')
    expect(src).toContain('it.v_level != null && it.v_level <= 1')
  })

  it('뺀 것은 **뺐다고 인쇄한다** — 조용히 빠지면 분모가 거짓말이 된다', () => {
    expect(src).toContain('A7 내역  초1~2 문항')
    expect(src).toContain('미달 유형 —')
    expect(src).toContain('낱낱 —')
  })
})
