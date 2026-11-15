// packages/library-pipeline/src/story/canonical.ts
//
// LCP Story 결속 해시의 정본 직렬화 — 계약: docs/LCP_STORY.md §8.
//
// textbook/review-digest.ts 의 canonicalJson 을 쓰지 않는 이유:
//   그 함수는 JSON.stringify 에 기대므로 undefined 키를 조용히 빼고 NaN·Infinity 를 null 로,
//   -0 을 0 으로 바꾼다. 서로 다른 입력이 같은 해시가 되면 「검수한 그 판」이라는 결속이 깨진다.
//   여기서는 지원하지 않는 값을 만나면 경로와 함께 거부한다(조용히 바꾸지 않는다).
//
// 지원 범위:
//   null · boolean · string · 유한 number(-0 제외) · 배열(구멍 없음) · 평범한 객체(프로토타입이
//   Object.prototype 또는 null). 객체 키는 UTF-16 코드 단위 순으로 정렬하고 배열 순서는 보존한다.
//   같은 객체를 두 곳에서 참조하는 것은 허용하고, 자기 자신으로 돌아오는 순환은 거부한다.
// 거부: undefined · NaN · ±Infinity · -0 · bigint · symbol · function · Date · Map · Set ·
//   클래스 인스턴스 · 희소 배열 · 순환 참조 · 잘못된 UTF-16 문자열(짝 없는 서로게이트, 값과 키 모두).
//
// 잘못된 UTF-16 을 거부하는 이유: Node 의 UTF-8 인코더는 짝 없는 서로게이트를 U+FFFD 로 바꾼다.
//   그대로 해시하면 '\uD800' 과 '�' 가 같은 해시가 된다 — 다른 본문이 같은 결속을 얻는다.

import { createHash } from 'node:crypto'

export class CanonicalError extends Error {
  readonly path: string

  constructor(path: string, reason: string) {
    super(`canonical: ${reason} at ${path}`)
    this.name = 'CanonicalError'
    this.path = path
  }
}

/** 짝 없는 높은/낮은 서로게이트. 정상 서로게이트 쌍(이모지 등)은 걸리지 않는다. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

export class IllFormedUnicodeError extends Error {
  readonly path: string
  readonly index: number

  constructor(path: string, index: number) {
    super(`ill-formed UTF-16 (lone surrogate) at ${path} index ${index} — 고치지 않고 거부한다`)
    this.name = 'IllFormedUnicodeError'
    this.path = path
    this.index = index
  }
}

/** 문자열이 올바른 UTF-16 인가(짝 없는 서로게이트가 없는가). */
export function isWellFormedUnicode(s: string): boolean {
  return !LONE_SURROGATE.test(s)
}

export function assertWellFormed(s: string, path: string): void {
  const m = LONE_SURROGATE.exec(s)
  if (m) throw new IllFormedUnicodeError(path, m.index)
}

function isPlainObject(v: object): boolean {
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function serialize(value: unknown, path: string, stack: Set<object>): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false'
    case 'string':
      if (!isWellFormedUnicode(value)) throw new CanonicalError(path, 'ill-formed UTF-16 string')
      return JSON.stringify(value)
    case 'number':
      if (!Number.isFinite(value)) throw new CanonicalError(path, `non-finite number ${String(value)}`)
      if (Object.is(value, -0)) throw new CanonicalError(path, 'negative zero')
      return JSON.stringify(value)
    case 'undefined':
      throw new CanonicalError(path, 'undefined value')
    case 'bigint':
    case 'symbol':
    case 'function':
      throw new CanonicalError(path, `unsupported type ${typeof value}`)
    default:
      break
  }
  const obj = value as object
  if (stack.has(obj)) throw new CanonicalError(path, 'cycle')
  stack.add(obj)
  try {
    if (Array.isArray(obj)) {
      const parts: string[] = []
      for (let i = 0; i < obj.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(obj, i)) {
          throw new CanonicalError(`${path}[${i}]`, 'sparse array hole')
        }
        parts.push(serialize(obj[i], `${path}[${i}]`, stack))
      }
      return `[${parts.join(',')}]`
    }
    if (!isPlainObject(obj)) {
      const name = (obj as { constructor?: { name?: string } }).constructor?.name ?? 'unknown'
      throw new CanonicalError(path, `non-plain object ${name}`)
    }
    if (Object.getOwnPropertySymbols(obj).length > 0) {
      throw new CanonicalError(path, 'symbol keys')
    }
    const record = obj as Record<string, unknown>
    const keys = Object.keys(record).sort()
    for (const k of keys) {
      if (!isWellFormedUnicode(k)) throw new CanonicalError(`${path}.${k}`, 'ill-formed UTF-16 key')
    }
    const parts = keys.map((k) => `${JSON.stringify(k)}:${serialize(record[k], `${path}.${k}`, stack)}`)
    return `{${parts.join(',')}}`
  } finally {
    stack.delete(obj)
  }
}

/** 키 순서에 흔들리지 않는 직렬화. 지원하지 않는 값은 CanonicalError 로 거부한다. */
export function canonicalJson(value: unknown): string {
  return serialize(value, '$', new Set())
}

/**
 * UTF-8 바이트 기준 sha256 hex. 본문 해시는 이것으로 「실제 텍스트에서」 계산한다.
 * 잘못된 UTF-16 은 IllFormedUnicodeError — 인코더의 U+FFFD 치환으로 해시가 겹치지 않게.
 */
export function sha256Hex(text: string): string {
  assertWellFormed(text, 'text')
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** 객체 결속 해시 = sha256(canonicalJson(value)). */
export function sha256Canonical(value: unknown): string {
  return sha256Hex(canonicalJson(value))
}

/** 파일로 남기는 JSON 의 정본 형태 — 키 정렬 + 2칸 들여쓰기 + 끝 줄바꿈. 재실행 바이트 비교에 쓴다. */
export function canonicalPrettyJson(value: unknown): string {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`
}
