// apps/web/src/app/__tests__/css-selector-escape.test.ts
//
// **손으로 쓴 CSS 선택자에 이스케이프 안 된 `/` 가 없다.**
//
// 실측 2026-09-24: `globals.css` 의 `:is(.bg-black/40, …)` 두 줄 때문에 **배포 빌드 전체가 멈췄다**
// (CSS 압축기 「Unexpected '/'. Escaping special characters with \ may help.」). 개발 서버는 이 선택자를
// 그대로 넘기므로 화면에서는 아무 이상이 없었고, 빌드를 돌리기 전까지 아무도 몰랐다.
// Tailwind 클래스 이름(`bg-black/40` · `w-1/2`)을 선택자로 쓸 때는 `\/` 로 적어야 한다.
//
// 의존성을 늘리지 않으려고 파서 대신 규칙 하나로 잰다 — 주석을 걷고, 선언 블록 밖(선택자 자리)에서
// 클래스 선택자 안의 맨 `/` 를 찾는다. 속성값(`aspect-ratio: 16 / 9`)은 선언 블록 안이라 안 걸린다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '..', '..')
const TOKENS = resolve(SRC, '..', '..', '..', 'packages', 'design-tokens', 'src')

function cssFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...cssFiles(p))
    else if (name.endsWith('.css')) out.push(p)
  }
  return out
}

/** 선언 블록 바깥 글자만 — 규칙의 선택자 자리. 중첩(@media 등)은 여는 괄호 앞 글자로 같이 잡힌다. */
function selectorChunks(css: string): string[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const out: string[] = []
  let buf = ''
  for (const ch of noComments) {
    if (ch === '{') {
      out.push(buf.trim())
      buf = ''
    } else if (ch === '}' || ch === ';') {
      buf = ''
    } else {
      buf += ch
    }
  }
  return out
}

/** 클래스 선택자 안의 이스케이프 안 된 `/` — `.bg-black/40` 은 걸리고 `.bg-black\/40` 은 안 걸린다. */
const UNESCAPED_SLASH_IN_CLASS = /\.(?:[\w-]|\\.)*[\w-](?<!\\)\/[\w.]/

describe('CSS 선택자 — 이스케이프 안 된 / 가 없다', () => {
  const files = [...cssFiles(SRC), ...cssFiles(TOKENS)]

  it('검사할 파일을 실제로 찾았다', () => {
    expect(files.length).toBeGreaterThan(3)
    expect(files.some((f) => f.endsWith('globals.css'))).toBe(true)
  })

  it('규칙이 옛 결함을 잡는다 · 올바른 이스케이프는 통과시킨다', () => {
    expect(UNESCAPED_SLASH_IN_CLASS.test(':is(.bg-black/40, .x)')).toBe(true)
    expect(UNESCAPED_SLASH_IN_CLASS.test(':is(.bg-black\\/40, .x)')).toBe(false)
    expect(UNESCAPED_SLASH_IN_CLASS.test('.a > .b')).toBe(false)
  })

  it('모든 CSS 파일의 선택자에 맨 / 가 없다 — 있으면 배포 빌드가 멈춘다', () => {
    const bad: string[] = []
    for (const f of files) {
      for (const sel of selectorChunks(readFileSync(f, 'utf8'))) {
        if (UNESCAPED_SLASH_IN_CLASS.test(sel)) bad.push(`${relative(SRC, f)}: ${sel.slice(0, 120)}`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
