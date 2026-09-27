// packages/video-factory/src/requests/facts.ts
//
// **번들 경로 → 값.** 초안은 숫자를 적지 않고 경로를 적는다. 여기가 그 경로를 푼다.
//
// 문법 (의도적으로 좁다):
//   name            객체 키
//   [3]             배열 인덱스
//   [id=reading]    배열에서 field 가 value 인 첫 원소 (숫자면 숫자로 비교)
// 예: `platform.items` · `series[id=reading].rungs[step=4].items` · `typeGuide.blank.items`
//
// 결과가 숫자·문자열이 아니면(객체·배열·null·없음) **값으로 쓰지 않는다** — 못 잰 값을 0 으로
// 만들면 「없다」는 거짓이 된다.

export type FactValue = number | string

export interface FactResolution {
  ok: boolean
  value: FactValue | null
  /** ok=false 일 때 이유 */
  reason?: string
}

const TOKEN = /([^.[\]]+)|\[(\d+)\]|\[([^=\]]+)=([^\]]+)\]/g

export function resolveFact(root: unknown, path: string): FactResolution {
  let cur: unknown = root
  let matched = ''
  for (const m of path.matchAll(TOKEN)) {
    matched += m[0]
    if (cur === null || cur === undefined) {
      return { ok: false, value: null, reason: `${matched} 앞에서 값이 없다` }
    }
    if (m[1] !== undefined) {
      if (typeof cur !== 'object' || Array.isArray(cur)) {
        return { ok: false, value: null, reason: `${m[1]} 을 읽을 수 없는 자리` }
      }
      cur = (cur as Record<string, unknown>)[m[1]]
    } else if (m[2] !== undefined) {
      if (!Array.isArray(cur)) return { ok: false, value: null, reason: `[${m[2]}] 는 배열에만` }
      cur = cur[Number(m[2])]
    } else {
      if (!Array.isArray(cur)) return { ok: false, value: null, reason: `[${m[3]}=…] 는 배열에만` }
      const field = m[3] as string
      const want = m[4] as string
      cur = cur.find((el) => {
        if (el === null || typeof el !== 'object') return false
        const v = (el as Record<string, unknown>)[field]
        return typeof v === 'number' ? v === Number(want) : v === want
      })
    }
  }
  // 경로 전체가 문법으로 소비되지 않았으면(오타·점 두 개) 거절한다
  if (matched.replace(/\./g, '') !== path.replace(/\./g, '')) {
    return { ok: false, value: null, reason: `경로 문법 오류: ${path}` }
  }
  if (typeof cur === 'number' && Number.isFinite(cur)) return { ok: true, value: cur }
  if (typeof cur === 'string' && cur.trim() !== '') return { ok: true, value: cur }
  return { ok: false, value: null, reason: `${path} 는 숫자·문자열이 아니다(없거나 못 잰 값)` }
}

const ko = new Intl.NumberFormat('ko-KR')

/** 화면·소리에 나갈 표기. 0~1 사이 소수는 비율로 본다. */
export function formatFact(v: FactValue): string {
  if (typeof v === 'string') return v
  if (!Number.isInteger(v) && v > 0 && v < 1) return `${Math.round(v * 100)}%`
  return ko.format(v)
}

/** `{{name}}` 자리표시 */
export const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (_, name: string) => values[name] ?? `{{${name}}}`)
}

/**
 * 이름에 붙은 차례 숫자 — 「4단계」「3권」「고2」「2학년」은 수치가 아니라 **이름**이다.
 * 이것까지 막으면 권 이름을 못 쓴다. 양(개·명·%·배)은 여기 없다.
 */
const ORDINAL = /(고|중|초)?\d+\s*(단계|권|단|학년|편|장|과|강|회)/g

/** 자리표시와 차례 이름을 걷어 낸 나머지에 숫자가 있으면 그건 근거 없이 적힌 수치다. */
export function strayDigits(text: string): string[] {
  return text.replace(PLACEHOLDER, '').replace(ORDINAL, '').match(/\d+([.,]\d+)*%?/g) ?? []
}
