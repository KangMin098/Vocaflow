// apps/web/src/lib/design/__tests__/skin-parity.test.ts
//
// **Tines 스킨의 웹(CSS)과 앱(TS) 값이 같다**(DD-68). 토큰 패키지 규칙 「웹/앱 한쪽만 수정 금지」를
// 스킨에도 건다 — 한쪽만 고치면 모바일과 웹이 다른 색으로 갈린다.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

import { describe, expect, it } from 'vitest'

import { tinesSkin } from '@vocaflow/design-tokens'

const CSS = readFileSync(
  path.resolve(__dirname, '../../../../../../packages/design-tokens/src/skins/tines.css'),
  'utf8',
)

/** 선택자 블록 하나의 `--이름: 값` 을 읽는다. 서체·그림자는 웹 전용이라 뺀다. */
function block(selector: string, source = CSS): Record<string, string> {
  const out: Record<string, string> = {}
  let found = false
  postcss.parse(source).walkRules(rule => {
    // PC 치수는 @media 안에 있고 앱 색 정본은 최상위다. 첫 문자열 일치로 섞지 않는다.
    if (rule.selector !== selector || rule.parent?.type !== 'root') return
    found = true
    rule.walkDecls(decl => {
      if (!decl.prop.startsWith('--') || /^--(?:font|sh)-/.test(decl.prop)) return
      out[decl.prop.slice(2)] = decl.value.trim()
    })
  })
  expect(found, `${selector} 최상위 블록을 못 찾았다`).toBe(true)
  return out
}

function appComparable(css: Record<string, string>, app: Record<string, string>) {
  return Object.fromEntries(Object.entries(css).filter(([name, value]) => {
    if (name in app) return true
    // CSS 전용 의미색 alias는 RN의 색 정본을 늘리지 않는다. 가리키는 토큰이 양쪽에 있어야 한다.
    const target = /^var\(--([a-z0-9-]+)\)$/.exec(value)?.[1]
    return !target || !(target in css && target in app)
  }))
}

describe('Tines 스킨 — 웹 CSS ↔ 앱 TS', () => {
  it('PC 전용 치수가 앱 색 정본보다 먼저 나와도 비교에 섞이지 않는다', () => {
    expect(block(':root[data-skin="tines"]', '@media (min-width:768px) { :root[data-skin="tines"] { --pc-inset:40px; } } :root[data-skin="tines"] { --t1:#5e35b1; }')).toEqual({ t1: '#5e35b1' })
  })
  it('웹 alias는 실제 공통 토큰을 가리킬 때만 제외하고 미정의 alias는 남긴다', () => {
    expect(appComparable({p:'#542f9c',combo:'var(--p)',unknown:'var(--absent)'},{p:'#542f9c'})).toEqual({p:'#542f9c',unknown:'var(--absent)'})
  })
  it('라이트: 이름과 값이 모두 같다', () => {
    const css = block(':root[data-skin="tines"]')
    expect(Object.keys(css).length).toBeGreaterThan(40)
    expect(tinesSkin.light).toEqual(appComparable(css,tinesSkin.light))
  })

  it('다크: 이름과 값이 모두 같다', () => {
    const css = block(':root[data-skin="tines"][data-theme="dark"]')
    expect(Object.keys(css).length).toBeGreaterThan(40)
    expect(tinesSkin.dark).toEqual(appComparable(css,tinesSkin.dark))
  })
})
