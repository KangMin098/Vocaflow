// apps/web/src/lib/design/__tests__/token-parity.test.ts
//
// **디자인 토큰의 두 출처가 갈라지지 않게 한다.**
//
// ── 왜 (실측 2026-08-22) ────────────────────────────────────────────────
// `packages/design-tokens/CLAUDE.md` 가 절대 금지로 적어 둔 것이 있다 —
// "웹/앱 한쪽만 수정 — 두 출처가 불일치하면 디자인이 깨짐".
// 웹은 `tokens.css` 를, 모바일(RN)은 `colors.ts` 를 읽는다.
//
// 그런데 그 규칙은 **사람이 기억해야만 지켜지는 규칙**이었고, 실제로 안 지켜졌다.
// 대비 사이클에서 `--t2` 0.62→0.74 · `--t3` 0.38→0.62 를 `tokens.css` 에서만 고쳤다.
// 웹은 AA 로 올라갔고 **모바일은 그대로 흐린 채 남았다.** 아무 오류도 안 났다.
// 같이 발견된 오래된 드리프트 2건(`--info` 라이트 · `--error` 다크)도 마찬가지로
// 조용히 있었다 — 언제부터인지 아무도 모른다.
//
// 문서가 지키던 것을 기계가 지키게 한다. 규칙을 적는 것과 강제하는 것은 다르다.
//
// ⚠️ `colors.ts` 는 `tokens.css` 의 **부분집합**이다(모든 토큰이 앱에 필요하진 않다).
//    그래서 "양쪽에 다 있는 것" 만 대조한다 — 없는 것을 없다고 실패시키면
//    토큰을 하나 더할 때마다 이 테스트가 울어서, 결국 꺼진다.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const PKG = path.resolve(__dirname, '../../../../../../packages/design-tokens/src')

/** `{ ... }` 한 블록 안의 `--x: v;` 를 모은다. 중괄호 깊이로 끝을 찾는다. */
function cssBlock(src: string, startRe: RegExp): Record<string, string> {
  const i = src.search(startRe)
  if (i < 0) return {}
  let depth = 0
  let j = i
  let started = false
  for (; j < src.length; j++) {
    if (src[j] === '{') {
      depth++
      started = true
    } else if (src[j] === '}') {
      depth--
      if (started && depth === 0) break
    }
  }
  const out: Record<string, string> = {}
  for (const m of src.slice(i, j).matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim()
  }
  return out
}

function tsObject(src: string, name: string): Record<string, string> {
  const i = src.indexOf(`export const ${name}`)
  if (i < 0) return {}
  const body = src.slice(i, src.indexOf('\n}', i))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/^\s*([A-Za-z0-9_]+):\s*'([^']+)'/gm)) out[m[1]] = m[2].trim()
  return out
}

const camel = (k: string) => k.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim()

const css = readFileSync(path.join(PKG, 'tokens.css'), 'utf8')
const ts = readFileSync(path.join(PKG, 'colors.ts'), 'utf8')

const LIGHT_CSS = cssBlock(css, /^:root\s*\{/m)
const DARK_CSS = cssBlock(css, /\[data-theme=["']dark["']\]\s*\{/)
const LIGHT_TS = tsObject(ts, 'colors')
const DARK_TS = tsObject(ts, 'colorsDark')

describe('디자인 토큰 — tokens.css 와 colors.ts 가 같은 말을 한다', () => {
  it('두 출처를 실제로 읽었다', () => {
    // 파싱이 조용히 빈 객체를 돌려주면 아래 대조는 **0건 비교로 통과**한다.
    // 0 은 성공이 아니라 측정 실패일 수 있다 — 분모부터 확인한다(CONVENTIONS).
    expect(Object.keys(LIGHT_CSS).length).toBeGreaterThan(50)
    expect(Object.keys(DARK_CSS).length).toBeGreaterThan(20)
    expect(Object.keys(LIGHT_TS).length).toBeGreaterThan(20)
    expect(Object.keys(DARK_TS).length).toBeGreaterThan(20)
  })

  for (const [label, cssMap, tsMap] of [
    ['라이트', LIGHT_CSS, LIGHT_TS],
    ['다크', DARK_CSS, DARK_TS],
  ] as const) {
    it(`${label} — 양쪽에 다 있는 토큰의 값이 일치한다`, () => {
      const shared = Object.keys(cssMap).filter((k) => camel(k) in tsMap)
      // 겹치는 게 없으면 이 테스트는 아무것도 안 지킨다.
      expect(shared.length, '대조할 토큰이 없다 — 파서가 낡았다').toBeGreaterThan(15)

      const drift = shared
        .filter((k) => norm(cssMap[k]) !== norm(tsMap[camel(k)]))
        .map((k) => `--${k}: tokens.css="${cssMap[k]}" ≠ colors.ts.${camel(k)}="${tsMap[camel(k)]}"`)

      expect(
        drift,
        `웹과 앱의 색이 갈라졌다 — tokens.css 를 고쳤으면 colors.ts 도 같은 커밋에서 고친다\n${drift.join('\n')}`,
      ).toEqual([])
    })
  }
})
