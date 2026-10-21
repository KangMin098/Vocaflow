// apps/web/src/lib/design/__tests__/skin-always-on.test.ts
//
// **Tines 스킨은 끌 수 없다**(DESIGN.md · DD-83). 루트 레이아웃에 스킨을 해제하는 길
// (환경변수 · `?skin=off` · localStorage 저장값)이 다시 생기면 검증한 화면과 실제 화면이 갈린다.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const LAYOUT = readFileSync(path.resolve(__dirname, '../../../app/layout.tsx'), 'utf8')

describe('루트 레이아웃 스킨', () => {
  it('html 에 data-skin 을 고정값으로 단다', () => {
    expect(LAYOUT).toMatch(/const SKIN = "tines"/)
    expect(LAYOUT).toMatch(/data-skin=\{SKIN\}/)
  })

  it('환경변수로 끄지 않는다', () => {
    expect(LAYOUT).not.toMatch(/NEXT_PUBLIC_SKIN/)
  })

  it('쿼리·저장값으로 data-skin 을 지우거나 바꾸지 않는다', () => {
    expect(LAYOUT).not.toMatch(/removeAttribute\(\s*['"]data-skin['"]/)
    expect(LAYOUT).not.toMatch(/setAttribute\(\s*['"]data-skin['"]/)
    expect(LAYOUT).not.toMatch(/getItem\(\s*['"]vocaflow-skin['"]/)
    expect(LAYOUT).not.toMatch(/get\(\s*['"]skin['"]\s*\)/)
  })
})
