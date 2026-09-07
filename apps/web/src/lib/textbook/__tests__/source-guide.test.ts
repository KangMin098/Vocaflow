// apps/web/src/lib/textbook/__tests__/source-guide.test.ts
//
// 지문 출처 표기 — **DB 키가 학습자에게 새지 않는다.**
//
// ── 왜 이 파일이 생겼나 ────────────────────────────────────────────
// `source-guide.ts` 는 처음부터 "표에 없는 갈래가 들어오면 키가 그대로 보이므로
// 테스트가 막는다" 고 적어 두었는데, **그 테스트가 없었다.**
// 2026-08-30 에 futurity 가 수집 출처로 열리고(마이그레이션 `20260830020000`)
// 다음 날 `/library/textbooks` 의 지문 출처 칩 줄에 한글 칩들 사이로
// `futurity` 가 그대로 나갔다 — 아무것도 빨간불이 되지 않았다.
//
// 여기서 지키는 것: **파이프라인이 출처를 하나 더 열면 학습자 표기도 같은 PR 에서 는다.**
// 목록을 손으로 옮겨 적지 않고 파이프라인에서 직접 읽는다 — 옮겨 적으면 그 사본이 또 갈린다.

import { SOURCE_SPECS } from '@vocaflow/library-pipeline'
import { describe, expect, it } from 'vitest'

import { SOURCE_GUIDE, sourceLabel } from '../source-guide'

describe('수집 출처는 빠짐없이 학습자 이름을 갖는다', () => {
  const KEYS = Object.keys(SOURCE_SPECS)

  it('파이프라인의 모든 SourceKey 가 표에 있다', () => {
    const missing = KEYS.filter((k) => !SOURCE_GUIDE[k])
    // 실패 메시지에 빠진 키가 그대로 찍혀야 고칠 자리를 바로 안다.
    expect(missing).toEqual([])
  })

  it('어떤 출처도 키를 그대로 팔지 않는다', () => {
    for (const k of KEYS) {
      expect(sourceLabel(k), `${k} 가 키 그대로 나온다`).not.toBe(k)
    }
  })

  it('라벨은 한국어다 — 영문 키가 라벨로 둔갑하지 않는다', () => {
    // `futurity` 사고의 형태: 라벨 자리에 영문 소문자 슬러그가 앉아 있는 것.
    for (const [k, g] of Object.entries(SOURCE_GUIDE)) {
      expect(/[가-힣]/.test(g.label), `${k} 라벨에 한글이 없다: ${g.label}`).toBe(true)
    }
  })

  it('수집이 아닌 방식으로 생기는 갈래도 덮는다', () => {
    // 조합기·개작·도서 발췌·출처 유실 — RPC 가 실제로 돌려주는 값들이다.
    for (const k of ['book', 'compose', 'adapt', 'original', 'unknown']) {
      expect(SOURCE_GUIDE[k], `${k} 표기 없음`).toBeDefined()
    }
  })

  it('says 는 라벨이 말하지 않는 것을 말한다 (라벨 반복 금지)', () => {
    for (const [k, g] of Object.entries(SOURCE_GUIDE)) {
      expect(g.says.length, `${k} says 가 비었다`).toBeGreaterThan(10)
      expect(g.says, `${k} says 가 라벨과 같다`).not.toBe(g.label)
    }
  })
})

describe('모르는 갈래', () => {
  it('키를 그대로 돌려준다 — 화면이 비지 않게', () => {
    // 이 동작 자체는 유지한다(빈 칩보다는 키가 낫다). 다만 위 테스트가
    // "그 상황이 실제로 오지 않게" 막는 것이 이 파일의 요지다.
    expect(sourceLabel('아직-없는-갈래')).toBe('아직-없는-갈래')
  })
})
