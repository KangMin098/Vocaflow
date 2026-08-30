// apps/web/src/lib/dict/__tests__/word-web.test.ts
//
// 낱말 그물의 정제 규칙 — **틀린 것을 가르치지 않는지**.
//
// 사전의 `synonyms` 에는 WordNet 계열 자료가 섞여 있어 유의어가 아닌 것이 들어 있다.
// 실측 2026-08-30(카탈로그 표제어 기준, 유의어 항목 17,544):
//   · 여러 낱말      1,668 (9.5%)
//   · 표제어를 품음    886 (5.1%)  ← 유의어가 아니라 **그 낱말의 다른 뜻**
//   · 유의어가 전부 그런 낱말 553
//
// "비슷한 말: jail cell" 을 읽은 학습자는 cell 을 jail cell 과 바꿔 쓸 수 있다고 배운다.
// 틀린 것을 가르치는 것은 아무것도 안 보여 주는 것보다 나쁘다.

import { describe, expect, it } from 'vitest'

import { cleanWordWebRow } from '../word-web'

describe('낱말 그물 정제', () => {
  it('표제어를 낱말로 품은 것은 버린다 — 유의어가 아니라 다른 뜻이다', () => {
    // 실제 사전 값: cell → jail cell · prison cell · cellular telephone
    expect(cleanWordWebRow(['jail cell', 'prison cell', 'cellphone'], 'cell'))
      .toEqual(['cellphone'])
  })

  it('하위어도 같은 규칙으로 걸린다 — bank → bank building 은 유의어가 아니다', () => {
    expect(cleanWordWebRow(['bank building', 'savings bank'], 'bank')).toBeNull()
  })

  it('여러 낱말이라고 다 버리지는 않는다 — give up 은 정당한 유의어다', () => {
    expect(cleanWordWebRow(['give up', 'forsake'], 'abandon'))
      .toEqual(['give up', 'forsake'])
  })

  it('부분 문자열로 걸지 않는다 — accordance 는 accord 를 낱말로 품지 않았다', () => {
    expect(cleanWordWebRow(['accordance', 'accordant'], 'accord'))
      .toEqual(['accordance', 'accordant'])
  })

  it('표제어 자신은 버린다 — 자기를 파생어로 보여 주면 오해다', () => {
    expect(cleanWordWebRow(['Develop', 'developer'], 'develop')).toEqual(['developer'])
  })

  it('중복과 빈 값을 정리한다', () => {
    expect(cleanWordWebRow(['grow', ' grow ', '', '  '], 'develop')).toEqual(['grow'])
  })

  it('남는 것이 없으면 null — 호출부가 그 줄을 통째로 뺀다', () => {
    expect(cleanWordWebRow(['bank building'], 'bank')).toBeNull()
    expect(cleanWordWebRow([], 'bank')).toBeNull()
    expect(cleanWordWebRow(null, 'bank')).toBeNull()
  })

  it('대소문자를 가리지 않는다', () => {
    expect(cleanWordWebRow(['Jail Cell', 'CELL'], 'cell')).toBeNull()
  })

  it('하이픈·아포스트로피가 낱말 경계를 깨지 않는다', () => {
    // `kupffer's cell` 은 cell 을 낱말로 품는다 → 버린다
    expect(cleanWordWebRow(["kupffer's cell"], 'cell')).toBeNull()
  })
})
