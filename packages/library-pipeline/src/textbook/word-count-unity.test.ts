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
