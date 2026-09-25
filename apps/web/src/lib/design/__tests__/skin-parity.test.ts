// apps/web/src/lib/design/__tests__/skin-parity.test.ts
//
// **Tines 스킨의 웹(CSS)과 앱(TS) 값이 같다**(DD-68). 토큰 패키지 규칙 「웹/앱 한쪽만 수정 금지」를
// 스킨에도 건다 — 한쪽만 고치면 모바일과 웹이 다른 색으로 갈린다.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { tinesSkin } from '@vocaflow/design-tokens'

const CSS = readFileSync(
  path.resolve(__dirname, '../../../../../../packages/design-tokens/src/skins/tines.css'),
  'utf8',
)

/** 선택자 블록 하나의 `--이름: 값` 을 읽는다. 서체·그림자는 웹 전용이라 뺀다. */
function block(selector: string): Record<string, string> {
  const at = CSS.indexOf(`${selector} {`)
  expect(at, `${selector} 블록을 못 찾았다`).toBeGreaterThanOrEqual(0)
  const body = CSS.slice(at, CSS.indexOf('}', at))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    if (m[1].startsWith('font-') || m[1].startsWith('sh-')) continue
    out[m[1]] = m[2].trim()
  }
  return out
}

describe('Tines 스킨 — 웹 CSS ↔ 앱 TS', () => {
  it('라이트: 이름과 값이 모두 같다', () => {
    const css = block(':root[data-skin="tines"]')
    expect(Object.keys(css).length).toBeGreaterThan(40)
    expect(tinesSkin.light).toEqual(css)
  })

  it('다크: 이름과 값이 모두 같다', () => {
    const css = block(':root[data-skin="tines"][data-theme="dark"]')
    expect(Object.keys(css).length).toBeGreaterThan(40)
    expect(tinesSkin.dark).toEqual(css)
  })
})
