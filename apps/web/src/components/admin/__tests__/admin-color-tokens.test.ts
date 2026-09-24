// apps/web/src/components/admin/__tests__/admin-color-tokens.test.ts
//
// **/admin 색 회귀 락**(DD-82). admin 화면은 색을 토큰으로만 칠한다 — 값은 `skins/admin-app.css` 한 곳에 있다.
//
// 막는 것 세 가지. 셋 다 2026-09-24 실측으로 실제 있던 결함이다.
//   ① 하드코딩 색 — 보라(`#8B5CF6` · `rgba(139,92,246,…)` · `#7c4ff0`)가 토큰을 우회해 남아 있었다.
//      허용은 이미지 위에 까는 검정/흰 막과 책 표지를 그리는 `SeedCard` 뿐이다(테마가 아니라 그림).
//   ② `bg-[var(--x)]/10` — Tailwind 3.4 는 **변수 색에 붙은 /N 을 CSS 로 만들지 않는다.** 128곳이 아무것도
//      칠하지 않고 있었다. 투명도는 `bg-[color-mix(in_srgb,var(--x)_10%,transparent)]` 로 쓴다.
//   ③ 템플릿 `${ACCENT}40` — ACCENT 가 `var(--p)` 면 `var(--p)40` 이라는 무효 CSS 다. 21곳의 테두리·배경이
//      그려지지 않았다. `color-mix(in srgb, ${ACCENT} 25%, transparent)` 로 쓴다.
//
// 변환 도구: scripts/design/admin-color-codemod.mjs(재실행 안전).
// ⚠️ 조용히 무력해지는 방식 — 파일을 하나도 못 읽으면 위반 0 으로 통과한다. 그래서 읽은 파일 수의 하한을 단언한다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = fileURLToPath(new URL('.', import.meta.url))
const WEB_SRC = resolve(here, '../../../')
const DIRS = ['app/admin', 'components/admin', 'lib/admin']
const SKIP = [/__tests__/, /SeedCard\.tsx$/]

/** 이미지 위에 까는 막 — 사진·만화 위 글자를 읽히게 하는 검정/흰 반투명. 테마 색이 아니다. */
const IMAGE_SCRIM = /rgba\(\s*(0,\s*0,\s*0|255,\s*255,\s*255)\s*,/

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const files = DIRS.flatMap((d) => walk(join(WEB_SRC, d)))
  .map((abs) => ({ rel: relative(WEB_SRC, abs).replace(/\\/g, '/'), src: readFileSync(abs, 'utf8') }))
  .filter((f) => !SKIP.some((r) => r.test(f.rel)))

function scan(re: RegExp, keep: (hit: string, line: string) => boolean = () => true): string[] {
  const hits: string[] = []
  for (const f of files) {
    f.src.split(/\r?\n/).forEach((line, i) => {
      for (const m of line.matchAll(re)) if (keep(m[0], line)) hits.push(`${f.rel}:${i + 1} ${m[0]}`)
    })
  }
  return hits
}

describe('/admin 색은 토큰으로만', () => {
  it('스캔한 파일이 충분하다(파서가 죽으면 여기서 걸린다)', () => {
    expect(files.length).toBeGreaterThan(200)
  })

  it('① 하드코딩 hex 가 없다', () => {
    expect(scan(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g)).toEqual([])
  })

  it('① 하드코딩 rgb/rgba 는 이미지 막뿐이다', () => {
    expect(scan(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+[^)]*\)/g, (hit) => !IMAGE_SCRIM.test(hit))).toEqual([])
  })

  it('② 변수 색에 /N 투명도를 붙이지 않는다(Tailwind 가 버린다)', () => {
    expect(scan(/-\[var\(--[\w-]+\)\]\/(?:\d+|\[[\d.]+\])/g)).toEqual([])
  })

  it('③ 템플릿 뒤에 hex 투명도를 붙이지 않는다(var() 뒤에 붙으면 무효 CSS)', () => {
    expect(scan(/\$\{[^{}]+\}[0-9a-fA-F]{2}(?=[\s`'",);])/g, (hit) => /accent|color|ring|tone|hue|fill|stroke|ink/i.test(hit))).toEqual([])
  })
})
