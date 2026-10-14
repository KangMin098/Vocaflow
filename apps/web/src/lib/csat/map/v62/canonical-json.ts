// apps/web/src/lib/csat/map/v62/canonical-json.ts
//
// v6.2 Factory Integration v1.1(Codex I08 · I09) — 표준 JSON 정규 직렬화(순수). 수요 서명 · 공장 요청 id 가 함께 쓴다.
// 규칙: 객체 키는 코드 포인트 순 정렬(중첩 포함) · 배열 순서는 의미(바꾸지 않는다 — 순서가 무의미한 배열은 호출부가 먼저 정렬)
//       · undefined 값을 가진 키는 **생략**(JSON.stringify 와 같은 규칙) · 배열 안 undefined · NaN · ±Infinity · 함수 · bigint · symbol 은 **거절**.
// 결과는 항상 `JSON.parse` 가능하다 — 외부 공장 · 소비자가 그대로 읽는다.

export class CanonicalJsonError extends Error {}

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value)
    case 'number':
      if (!Number.isFinite(value)) throw new CanonicalJsonError(`non-finite number: ${value}`)
      return JSON.stringify(value)
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((v, i) => {
          if (v === undefined) throw new CanonicalJsonError(`undefined at array index ${i}`)
          return canonicalJson(v)
        }).join(',')}]`
      }
      const proto = Object.getPrototypeOf(value)
      if (proto !== Object.prototype && proto !== null) throw new CanonicalJsonError('only plain objects')
      const o = value as Record<string, unknown>
      const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort()
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`
    }
    default:
      throw new CanonicalJsonError(`unsupported value type: ${typeof value}`)
  }
}
