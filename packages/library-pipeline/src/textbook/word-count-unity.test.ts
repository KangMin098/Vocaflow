// packages/library-pipeline/src/textbook/word-count-unity.test.ts
//
// **창을 그은 자와 창으로 거르는 자가 같아야 한다.**
//
// 시장 창(`market-spec.json` 의 `passageWords` p10~p90)은 코퍼스에서 **알파벳 토큰**으로
// 세어 만들었다. 그런데 조합기(`volume-pool.mjs`)는 공백 토큰으로 세고 있었다.
// 두 값은 양방향으로 어긋난다:
//
//     "U.S. Supreme"   공백 2 · 낱말 3   (마침표가 낱말을 가른다)
//     "125 tons"       공백 2 · 낱말 1   (숫자는 낱말이 아니다)
//
// 그래서 조합기가 "188어라 창(90~188) 안" 으로 통과시킨 지문이 시장 자로는 194어였고,
// A6 미달 6건이 전부 그렇게 1~6어씩 넘긴 것들이었다 —
// 규격을 어긴 것이 아니라 **다른 자로 잰 것**이다.
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { countPassageWords } from './csat-format'
import { isPrintableUnderlineWord } from './vocab-choice'

/**
 * 저장소 뿌리 — **이 파일 위치 기준**으로 잡는다.
 *
 * 전에는 `process.cwd()` 에서 '../..' 를 올라갔다. 그러면 패키지 디렉터리에서 돌릴 때만
 * 맞고, vitest 를 저장소 뿌리에서 돌리면 저장소 밖을 읽으려다 ENOENT 로
 * **네 파일이 통째로 실패**한다(실측 2026-09-05). 조용히 안 도는 테스트는 없는 테스트다.
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')


const read = (rel: string) => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8')

describe('낱말 세는 자는 한 벌뿐이다', () => {
  it('코퍼스가 창을 그을 때 쓴 정의와 같다', () => {
    // `scripts/textbook-corpus/market-spec.mjs` 의 `extractPassageSpec` 이 쓰는 정규식.
    // 그 파일이 창(p10~p90)을 만들므로, 그 정의가 정본이다.
    expect(read('scripts/textbook-corpus/market-spec.mjs')).toContain("[A-Za-z][A-Za-z'-]*")
  })

  it('마침표는 낱말을 가르고 숫자는 낱말이 아니다', () => {
    expect(countPassageWords('U.S. Supreme Court')).toBe(4)
    expect(countPassageWords('125 tons of carbon')).toBe(3)
    expect(countPassageWords("don't well-known")).toBe(2)
    expect(countPassageWords('')).toBe(0)
  })

  it('조합기가 자기 정의로 되돌아가지 않는다', () => {
    const pool = read('scripts/textbook/volume-pool.mjs')
    const own = pool.match(/passage_words: [A-Za-z]+\.split/g) ?? []
    expect(own, '조합기가 자체 낱말 세기로 되돌아갔다').toEqual([])
    const shared = pool.match(/passage_words: countPassageWords\(/g) ?? []
    expect(shared.length).toBeGreaterThanOrEqual(4)
  })
})

/**
 * **밑줄로 인쇄해도 되는 낱말인가** 를 재는 자도 한 벌이어야 한다.
 *
 * 2026-09-13 에 같은 사고가 이 축에서 되풀이됐다. 생성기(`vocab-choice`)의 규칙을 고치고
 * 재생성기(`regen-underlines.mjs`)에는 그 규칙을 **베껴 적었는데**, 뒤에 생성기 쪽만
 * 넓혔다. 그러자 「고쳤다」고 적힌 문항이 대상 목록에는 안 잡혀, V5 를 전수로 세기
 * 전까지 **4,920문항**이 조용히 남았다.
 *
 * 두 유형(어휘·어법)도 각자의 자를 갖고 있었고, 어법 쪽만 고쳐지지 않아
 * 「만들었는데 자에 또 걸림 7건」으로 드러난 적이 있다. 그래서 셋 다 같은 함수를 본다.
 */
describe('밑줄 낱말을 재는 자도 한 벌뿐이다', () => {
  it('인쇄 가능한 낱말의 정의는 글자와 아포스트로피뿐이다', () => {
    expect(isPrintableUnderlineWord('breath')).toBe(true)
    expect(isPrintableUnderlineWord("don't")).toBe(true)
    expect(isPrintableUnderlineWord('breath.')).toBe(false)
    expect(isPrintableUnderlineWord('Analogously,')).toBe(false)
    expect(isPrintableUnderlineWord('Happen?')).toBe(false)
    expect(isPrintableUnderlineWord('[Sidenote:')).toBe(false)
    expect(isPrintableUnderlineWord('well-known')).toBe(false)
    expect(isPrintableUnderlineWord('')).toBe(false)
  })

  it('재생성기가 자기 정의로 되돌아가지 않는다', () => {
    const src = read('scripts/textbook/regen-underlines.mjs')
    // 공유 함수를 들여오고, 그것으로 판정한다.
    expect(src).toContain('isPrintableUnderlineWord')
    // 베낀 자가 다시 생기면 잡는다 — 이번 결함이 정확히 그 꼴이었다.
    expect(src, '재생성기가 밑줄 판정 정규식을 자체로 갖고 있다').not.toMatch(
      /isBadWord\s*=\s*\(\w+\)\s*=>\s*\//,
    )
  })

  it('어법 쪽도 같은 함수를 본다 — 유형마다 자가 갈리지 않게', () => {
    const src = read('packages/library-pipeline/src/textbook/grammar-choice.ts')
    expect(src).toContain('isPrintableUnderlineWord')
    // 예전의 두 갈래 비교(구두점을 양쪽이 똑같이 떼어 내 통과시키던 것)가 되살아나면 잡는다.
    expect(src, '어법이 옛 두 갈래 비교로 되돌아갔다').not.toContain("replace(/[.,;:!?]+$/, '')")
  })
})

/**
 * **통째로 덮지 않으려면 실제로 읽어야 한다.**
 *
 * 루트 CLAUDE.md 가 못 박은 규칙이다 — "jsonb 컬럼에 키를 더하면 마이그레이션이 필요 없다.
 * 통째로 덮지 말고 기존 값을 읽어 키 하나만 더한다 — **덮으면 정답 키가 날아간다**."
 *
 * 2026-09-13 에 `regen-underlines.mjs` 가 그 규칙을 어겼다. 주석에는 「기존 키를 읽어 필요한
 * 것만 바꾼다」고 적혀 있었는데 **조회에 `answer_key` 가 없었다** — `{...undefined ?? {}}` 가
 * 빈 객체가 되어 통째 덮기가 됐고, 어법 **91문항의 `original`·`rule` 이 날아갔다**
 * (어휘는 생성기가 둘 다 다시 넣어 무사했다. 그래서 어휘만 보면 멀쩡해 보였다).
 *
 * 사고가 눈에 띈 경로도 적어 둔다: 해설 재충전이 `쓸 수 있음 0 · 못 씀 91` 을 찍었다.
 * **해설 작성기가 정답 키의 온전함을 검사하는 유일한 자였다.**
 */
describe('jsonb 를 덮어쓰지 않는다 — 주석이 아니라 코드로', () => {
  const src = read('scripts/textbook/regen-underlines.mjs')

  it('쓰기 전에 기존 정답 키를 **조회한다**', () => {
    expect(src).toContain("select('id, answer_key')")
    // 읽은 것을 펼쳐 써야 의미가 있다 — 읽고도 안 쓰면 같은 사고다.
    expect(src).toContain('keyById.get(item.id)')
  })

  it('키를 못 받은 문항은 **쓰지 않고 멈춘다** — 빈 객체로 덮는 것이 이번 사고였다', () => {
    expect(src).toMatch(/keyById\.size !== work\.length/)
    expect(src).toContain('중단한다')
  })

  it('두 유형 다 `original` 을 다시 채운다 — 어법만 빠뜨린 것이 사고의 절반이었다', () => {
    expect(src).toContain('nextKey.original = built.original')
    expect(src).toContain('nextKey.rule = built.rule')
    // 어휘에만 채우던 옛 줄이 되살아나면 잡는다.
    expect(src).not.toMatch(/if \(item\.type === 'vocab_choice'\) nextKey\.original/)
  })

  it('반쪽 키도 대상으로 잡는다 — 밑줄이 깨끗해지면 밑줄 자로는 다시 안 잡힌다', () => {
    expect(src).toContain('hasHalfKey')
    expect(src).toContain("original:answer_key->original")
  })
})
