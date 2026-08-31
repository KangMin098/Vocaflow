// packages/library-pipeline/src/textbook/colophon-spec.test.ts
//
// **판권장에 찍는 규격이 하드코딩으로 되돌아가지 않게 지킨다.**
//
// `render-volume.mjs` 의 규격 칩이 오래 `지문 90~200어` 로 박혀 있었다. 학년별 창이
// 도입돼 중등이 90~152, 고2 가 90~188 이 된 뒤에도 **전 밴드가 90~200 을 인쇄**했다
// (실측 2026-08-31: V3·V4·V6·V7 전부 오기). 조판물만 보는 사람에게 그 줄은 검수의
// 근거로 읽히므로, 틀린 규격을 적는 것은 내용이 틀린 것과 같다.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (f: string) =>
  fs.readFileSync(path.resolve(process.cwd(), '../../scripts/textbook', f), 'utf8')

describe('판권장 규격 칩', () => {
  const src = read('render-volume.mjs')

  it('길이를 하드코딩하지 않는다', () => {
    // ⚠️ 파일 어디에도 없어야 한다고 검사하면 **이 결함을 설명하는 주석까지** 걸린다
    //   (처음에 그렇게 썼다가 걸렸다). 인쇄되는 자리, 즉 칩 템플릿만 본다.
    expect(src).not.toContain('class="chip">지문 90~200어')
    expect(src).toContain('class="chip">지문 ${PASSAGE_CHIP}')
  })

  it('실제로 인쇄한 유형에서 창을 유도한다', () => {
    expect(src).toContain('passageSpecChip(Object.keys(actualMix))')
    // 학년을 넘겨야 중등·고2 의 좁은 창이 반영된다.
    expect(src).toContain('itemWordSpec(t, BAND)')
  })

  it('지문이 없는 유형은 규격에서 뺀다', () => {
    // 초등 3종은 사전에서 나와 창이 무한대이고(0~MAX_SAFE_INTEGER),
    // 문장 단위 유형의 6~40어는 지문 길이가 아니다. 둘 다 그대로 인쇄된 적이 있다.
    expect(src).toContain('!ELEMENTARY_TYPES.has(t) && !SCHOOL_SENTENCE_TYPES.has(t)')
    expect(src).toContain('s.max < 10_000')
  })

  it('지문을 싣지 않는 권은 그렇다고 적는다', () => {
    expect(src).toContain("'없음 — 낱말 중심'")
  })
})
