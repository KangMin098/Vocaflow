// packages/library-pipeline/src/story/canonical.test.ts
//
// 결속 해시의 바닥 — 키 순서에는 흔들리지 않고, 내용 · 배열 순서에는 반드시 흔들려야 한다.
// 지원하지 않는 값은 조용히 바뀌는 대신 거부돼야 한다(다른 입력이 같은 해시가 되면 결속이 깨진다).

import { describe, expect, it } from 'vitest'

import {
  CanonicalError,
  IllFormedUnicodeError,
  canonicalJson,
  canonicalPrettyJson,
  isWellFormedUnicode,
  sha256Canonical,
  sha256Hex,
} from './canonical'
import {
  checkEditionSpan,
  checkSourceAnchor,
  isNormalizedText,
  normalizeSourceText,
  paragraphSpans,
  sourceTextSha256,
  splitsSurrogatePair,
  surfaceMetrics,
} from './text'

const HIGH = String.fromCharCode(0xd800)
const LOW = String.fromCharCode(0xdc00)
const PAIR = '\u{1F600}' // 올바른 서로게이트 쌍(이모지 한 글자)

describe('잘못된 UTF-16 — 고치지 않고 거부한다(F3)', () => {
  it('짝 없는 높은 · 낮은 서로게이트는 정본 본문이 아니고, 올바른 쌍은 정본이다', () => {
    for (const bad of [HIGH, LOW, `a${HIGH}b`, `a${LOW}b`, `${LOW}${HIGH}`]) {
      expect(isWellFormedUnicode(bad), JSON.stringify(bad)).toBe(false)
      expect(isNormalizedText(bad), JSON.stringify(bad)).toBe(false)
    }
    expect(isWellFormedUnicode(PAIR)).toBe(true)
    expect(isNormalizedText(`Mara ${PAIR} ran.`)).toBe(true)
  })

  it('짝 없는 서로게이트와 U+FFFD 는 더 이상 같은 해시가 되지 않는다 — 해시 자체를 거부한다', () => {
    expect(() => sourceTextSha256(HIGH)).toThrow(IllFormedUnicodeError)
    expect(() => sha256Hex(LOW)).toThrow(IllFormedUnicodeError)
    expect(sourceTextSha256('�')).toMatch(/^[0-9a-f]{64}$/)
    expect(sha256Hex(PAIR)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('정본 직렬화는 잘못된 문자열 값 · 키를 거부한다', () => {
    expect(() => canonicalJson({ quote: `x${HIGH}` })).toThrow(/ill-formed UTF-16 string/)
    expect(() => canonicalJson({ [`k${LOW}`]: 1 })).toThrow(/ill-formed UTF-16 key/)
    expect(canonicalJson({ quote: PAIR })).toBe(`{"quote":"${PAIR}"}`)
  })

  it('정규화 도우미는 잘못된 입력을 U+FFFD 로 바꾸지 않고 던진다', () => {
    expect(() => normalizeSourceText(`Gull ${HIGH} Rock`)).toThrow(IllFormedUnicodeError)
  })

  it('앵커 · 판본 구간의 경계는 서로게이트 쌍을 가를 수 없다', () => {
    const text = `Mara saw ${PAIR} there.`
    const sha = sourceTextSha256(text)
    const paras = paragraphSpans(text)
    const at = text.indexOf(PAIR)
    expect(splitsSurrogatePair(text, at)).toBe(false)
    expect(splitsSurrogatePair(text, at + 1)).toBe(true)
    expect(splitsSurrogatePair(text, at + 2)).toBe(false)
    const whole = { source_sha256: sha, paragraph: 0, start: at, end: at + 2, quote: PAIR }
    expect(checkSourceAnchor(whole, text, sha, paras)).toEqual([])
    const splitStart = { source_sha256: sha, paragraph: 0, start: at + 1, end: at + 8, quote: text.slice(at + 1, at + 8) }
    expect(checkSourceAnchor(splitStart, text, sha, paras).map((i) => i.code)).toEqual(['anchor_splits_surrogate'])
    const splitEnd = { source_sha256: sha, paragraph: 0, start: 5, end: at + 1, quote: text.slice(5, at + 1) }
    expect(checkSourceAnchor(splitEnd, text, sha, paras).map((i) => i.code)).toEqual(['anchor_splits_surrogate'])
    expect(checkEditionSpan({ unit_id: 'u1', start: at + 1, end: at + 2, quote: text.slice(at + 1, at + 2) }, text)[0]?.code).toBe('span_splits_surrogate')
    expect(checkEditionSpan({ unit_id: 'u1', start: at, end: at + 2, quote: PAIR }, text)).toEqual([])
  })
})

describe('canonicalJson — 키 순서 무관 · 배열 순서 보존', () => {
  it('중첩 객체의 키 순서가 달라도 같은 문자열 · 같은 해시', () => {
    const a = { b: 1, a: { y: [1, 2], x: 'q' }, c: null }
    const b = { c: null, a: { x: 'q', y: [1, 2] }, b: 1 }
    expect(canonicalJson(a)).toBe(canonicalJson(b))
    expect(sha256Canonical(a)).toBe(sha256Canonical(b))
    expect(canonicalJson(a)).toBe('{"a":{"x":"q","y":[1,2]},"b":1,"c":null}')
  })

  it('배열 순서 · 값 하나 · 타입이 바뀌면 해시가 바뀐다', () => {
    const base = sha256Canonical({ order: ['o1', 'o2'], n: 1 })
    expect(sha256Canonical({ order: ['o2', 'o1'], n: 1 })).not.toBe(base)
    expect(sha256Canonical({ order: ['o1', 'o2'], n: 2 })).not.toBe(base)
    expect(sha256Canonical({ order: ['o1', 'o2'], n: '1' })).not.toBe(base)
  })

  it('같은 객체를 두 곳에서 참조하는 것은 허용한다(순환이 아니다)', () => {
    const shared = { k: 'v' }
    expect(canonicalJson({ a: shared, b: [shared] })).toBe('{"a":{"k":"v"},"b":[{"k":"v"}]}')
  })

  it.each([
    ['undefined 값', { a: undefined }],
    ['배열 안 undefined', [1, undefined]],
    ['NaN', { a: Number.NaN }],
    ['Infinity', { a: Number.POSITIVE_INFINITY }],
    ['-0', { a: -0 }],
    ['bigint', { a: 1n }],
    ['function', { a: () => 1 }],
    ['symbol 값', { a: Symbol('s') }],
    ['Date', { a: new Date(0) }],
    ['Map', { a: new Map() }],
    ['클래스 인스턴스', { a: new (class Box {})() }],
    // eslint-disable-next-line no-sparse-arrays
    ['희소 배열', [1, , 3]],
  ])('%s 를 거부한다', (_label, value) => {
    expect(() => canonicalJson(value)).toThrow(CanonicalError)
  })

  it('순환 참조를 경로와 함께 거부한다', () => {
    const a: Record<string, unknown> = { x: 1 }
    a.self = { back: a }
    expect(() => canonicalJson(a)).toThrow(/cycle at \$\.self\.back/)
  })

  it('symbol 키를 거부한다', () => {
    expect(() => canonicalJson({ [Symbol('k')]: 1 })).toThrow(/symbol keys/)
  })

  it('JSON.stringify 와 달리 undefined 키를 조용히 빼지 않는다', () => {
    expect(JSON.stringify({ a: 1, b: undefined })).toBe(JSON.stringify({ a: 1 }))
    expect(() => canonicalJson({ a: 1, b: undefined })).toThrow(CanonicalError)
  })

  it('정본 pretty JSON 은 키 순서와 무관하게 같은 바이트다', () => {
    expect(canonicalPrettyJson({ b: 2, a: [1] })).toBe(canonicalPrettyJson({ a: [1], b: 2 }))
    expect(canonicalPrettyJson({ a: 1 }).endsWith('\n')).toBe(true)
  })

  it('sha256Hex 는 UTF-8 바이트 해시다', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex('é')).toBe(sha256Hex('é'))
    expect(sha256Hex('é')).not.toBe(sha256Hex('é'))
  })
})

describe('story-text-v1 정규화 · 문단', () => {
  it('BOM · CRLF · NFD · 줄 끝 공백 · 빈 줄 여러 개를 정본 형태로 바꾸고 멱등이다', () => {
    const raw = '﻿  Café one.  \r\n\r\n\r\n\r\nTwo  \r\nlines.\t\r\n'
    const norm = normalizeSourceText(raw)
    expect(norm).toBe('Café one.\n\nTwo\nlines.')
    expect(normalizeSourceText(norm)).toBe(norm)
    expect(isNormalizedText(norm)).toBe(true)
    expect(isNormalizedText(raw)).toBe(false)
    expect(isNormalizedText('a\u0000b')).toBe(false)
  })

  it('문단 구간은 구분자("\\n\\n")를 포함하지 않는 반열린 범위다', () => {
    const text = 'Alpha one.\n\nBeta\ntwo.\n\nGamma.'
    expect(paragraphSpans(text)).toEqual([
      { index: 0, start: 0, end: 10 },
      { index: 1, start: 12, end: 21 },
      { index: 2, start: 23, end: 29 },
    ])
    expect(text.slice(12, 21)).toBe('Beta\ntwo.')
  })
})

describe('원문 앵커 — 해시 · 문단 · [start,end) · 정확 인용', () => {
  const text = 'Gull Rock stood.\n\nShe said \u{1F600} hi.'
  const sha = sourceTextSha256(text)
  const paras = paragraphSpans(text)

  it('UTF-16 코드 단위로 센다 — 이모지는 두 단위다', () => {
    const start = text.indexOf('hi')
    expect(start).toBe(30)
    const anchor = { source_sha256: sha, paragraph: 1, start, end: start + 2, quote: 'hi' }
    expect(checkSourceAnchor(anchor, text, sha, paras)).toEqual([])
    const emoji = text.indexOf('\u{1F600}')
    expect(checkSourceAnchor({ source_sha256: sha, paragraph: 1, start: emoji, end: emoji + 2, quote: '\u{1F600}' }, text, sha, paras)).toEqual([])
  })

  it.each([
    ['다른 원문 해시', { source_sha256: 'f'.repeat(64), paragraph: 0, start: 0, end: 4, quote: 'Gull' }, 'anchor_source_hash_mismatch'],
    ['빈 구간', { source_sha256: sha, paragraph: 0, start: 4, end: 4, quote: 'x' }, 'anchor_range_invalid'],
    ['원문 밖', { source_sha256: sha, paragraph: 1, start: 30, end: 999, quote: 'hi.' }, 'anchor_range_invalid'],
    ['없는 문단', { source_sha256: sha, paragraph: 5, start: 0, end: 4, quote: 'Gull' }, 'anchor_paragraph_missing'],
    ['문단 경계를 넘는다', { source_sha256: sha, paragraph: 0, start: 10, end: 21, quote: text.slice(10, 21) }, 'anchor_outside_paragraph'],
    ['허위 인용', { source_sha256: sha, paragraph: 0, start: 0, end: 4, quote: 'Gulf' }, 'anchor_quote_mismatch'],
    ['한 칸 밀린 구간', { source_sha256: sha, paragraph: 0, start: 1, end: 5, quote: 'Gull' }, 'anchor_quote_mismatch'],
    ['앞뒤 공백', { source_sha256: sha, paragraph: 0, start: 4, end: 10, quote: ' Rock ' }, 'anchor_untrimmed'],
  ])('%s → %s', (_label, anchor, code) => {
    const codes = checkSourceAnchor(anchor, text, sha, paras).map((i) => i.code)
    expect(codes).toContain(code)
  })

  it('판본 단위 구간도 정확 인용으로 검증한다', () => {
    expect(checkEditionSpan({ unit_id: 'u1', start: 0, end: 4, quote: 'Mara' }, 'Mara ran.')).toEqual([])
    expect(checkEditionSpan({ unit_id: 'u1', start: 0, end: 4, quote: 'Maya' }, 'Mara ran.')[0]?.code).toBe('span_quote_mismatch')
    expect(checkEditionSpan({ unit_id: 'u9', start: 0, end: 4, quote: 'Mara' }, undefined)[0]?.code).toBe('span_unit_missing')
  })
})

describe('표면 계측 — 단어 · 문장 수만 센다', () => {
  it('CEFR · V-Level 이 아니라 단순 계수다', () => {
    expect(surfaceMetrics(['Mara ran. She lit the lamp!', '"Go," he said.'])).toEqual({ words: 9, sentences: 3, mean_sentence_words: 3 })
    expect(surfaceMetrics([])).toEqual({ words: 0, sentences: 0, mean_sentence_words: 0 })
  })
})
