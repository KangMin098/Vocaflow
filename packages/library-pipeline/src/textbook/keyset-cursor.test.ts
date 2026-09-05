// packages/library-pipeline/src/textbook/keyset-cursor.test.ts
//
// 커서 페이징 회귀. 지키려는 것은 **페이지 경계에서 행이 새지 않는가** 다.
//
// ── 무엇이 있었나 (실측 2026-09-06) ─────────────────────────────────
// `fetchAllIn` 은 정렬 열이 하나면 커서(`gt`)로 넘긴다. 그런데 `csat_dcp_items` 를
// **`ref_id`** 로 넘기고 있었다 — 한 글에 문항이 여럿이라 고유하지 않다. 페이지 끝
// 값이 X 면 다음 페이지를 `ref_id > X` 로 받으므로 **X 의 남은 문항이 통째로 사라진다.**
//
//   ref_id 커서 11,442행 · id 커서 11,559행 — **117행이 샜다**
//
// 새는 행이 무작위라 더 나빴다. 그 탓에 `--avoid title` 이 title 을 가진 글을 못 걸러
// 겸용 글이 또 생겼고, "이미 이 유형이 붙은 글은 건너뛴다" 는 재실행 안전도 함께 깨져
// 있었다. 조용히 새느니 시끄럽게 멈춘다 — 이 조회의 결과는 게이트의 근거가 된다.

import { describe, expect, it } from 'vitest'
// 정본은 스크립트 쪽에 있다 — 사본을 두면 둘이 갈린다.
import { boundaryLeak } from '../../../../scripts/textbook/volume-pool.mjs'

const rows = (...vals: string[]) => vals.map((v, i) => ({ id: `i${i}`, ref_id: v }))

describe('커서 열이 고유한가', () => {
  it('마지막 값이 하나뿐이면 샐 것이 없다', () => {
    expect(boundaryLeak(rows('a', 'b', 'c'), 'ref_id')).toBe(0)
  })

  it('마지막 값이 되풀이되면 그 개수를 알린다 — 다음 페이지가 나머지를 건너뛴다', () => {
    expect(boundaryLeak(rows('a', 'b', 'b'), 'ref_id')).toBe(2)
    expect(boundaryLeak(rows('b', 'b', 'b'), 'ref_id')).toBe(3)
  })

  it('되풀이가 페이지 가운데면 경계가 아니라 안전하다', () => {
    expect(boundaryLeak(rows('a', 'a', 'b'), 'ref_id')).toBe(0)
  })

  it('고유 열(pk)로 넘기면 언제나 안전하다', () => {
    expect(boundaryLeak(rows('a', 'a', 'a'), 'id')).toBe(0)
  })

  it('빈 페이지는 셀 것이 없다', () => {
    expect(boundaryLeak([], 'ref_id')).toBe(0)
  })

  it('커서 열이 결과에 없으면 조용히 넘어가지 않는다', () => {
    // select 에 안 넣고 order 만 걸면 값이 undefined 가 되어 커서가 멈추거나 헛돈다.
    expect(() => boundaryLeak(rows('a'), 'missing_col')).toThrow(/커서 열/)
  })
})
