#!/usr/bin/env node
// scripts/design/admin-color-codemod.mjs
//
// /admin 이하 코드의 **하드코딩 색을 토큰으로** 옮기고, 소리 없이 무효였던 투명도 표기를 고친다(DD-82 4단계).
//
//   node scripts/design/admin-color-codemod.mjs            # 미리보기 — 파일별 치환 수만 출력
//   node scripts/design/admin-color-codemod.mjs --write    # 적용
//
// 고치는 것 다섯 가지
//   1. Tailwind `…-[#HEX]` → `…-[var(--토큰)]` (HEX 가 아래 표에 있을 때만)
//   2. Tailwind `…-[#HEX]/N` · `…-[var(--x)]/N` → `…-[color-mix(in_srgb,var(--x)_N%,transparent)]`
//      Tailwind 3.4 는 **변수 색에 붙은 /N 을 CSS 로 만들지 않는다** — 그 클래스는 지금 아무것도 칠하지 않는다.
//   3. 문자열 안 `#HEX`(6자리) → `var(--토큰)`, `#HEXAA`(8자리) → color-mix
//   4. 템플릿 `${색}AA` → `color-mix(in srgb, ${색} P%, transparent)` — 색이 `var(--p)` 면 `var(--p)40` 이 되어
//      **무효 CSS** 였다(테두리·배경이 그려지지 않았다). 색 이름처럼 보이는 식에만 건다.
//   5. `rgba(r, g, b, a)` 중 표의 색 → color-mix
//
// 건드리지 않는 것: __tests__ · SeedCard.tsx(책 표지를 그리는 재질 — 테마가 아니라 그림) · 이미지 위 검정/흰 막.
// 재실행 안전: 치환 결과에는 다시 걸리는 패턴이 없다(2회차 = 0건).

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const WRITE = process.argv.includes('--write')
const DIRS = ['apps/web/src/app/admin', 'apps/web/src/components/admin', 'apps/web/src/lib/admin']
const SKIP = [/__tests__/, /SeedCard\.tsx$/]

/** hex(대문자 6자리) → 토큰. 값이 같은 의미색 토큰이 있으면 그것, 없으면 가장 가까운 역할. */
const HEX = {
  '9C3A30': '--memory-risk',
  '2E7D5A': '--memory-stable',
  'B5803A': '--memory-shaky',
  '8A8278': '--memory-new',
  '92400E': '--warning-ink',
  'B45309': '--warning',
  'D97706': '--warning',
  'EAB308': '--warning',
  'B0843A': '--active',
  '22C55E': '--success',
  '16A34A': '--success-ink',
  'EF4444': '--error',
  'B91C1C': '--error-ink',
  '0891B2': '--info-ink',
  '7C4FF0': '--p-hover',
  'F5F3FF': '--bg3',
  '64748B': '--t3',
  '5B6470': '--t2',
  '1A1714': '--t1',
  'FBFAF6': '--bg',
  'F4F0E9': '--bg2',
  'E0DBD0': '--bd',
}
const RGB = {
  '139,92,246': '--p',
  '239,68,68': '--error',
  '46,125,90': '--memory-stable',
  '181,128,58': '--memory-shaky',
}
const pct = (a) => `${+(a * 100).toFixed(1)}%`
const mixTw = (tok, p) => `[color-mix(in_srgb,var(${tok})_${p},transparent)]`
const mixCss = (inner, p) => `color-mix(in srgb, ${inner} ${p}, transparent)`
const opac = (s) => (s.startsWith('[') ? pct(Number(s.slice(1, -1))) : `${s}%`)
const COLORISH = /accent|color|ring|tone|hue|fill|stroke|ink/i

function transform(src) {
  let n = 0
  const hit = (v) => { n++; return v }
  let s = src
  // 2a. Tailwind [#HEX]/N
  s = s.replace(/-\[#([0-9a-fA-F]{6})\]\/(\d+|\[0?\.\d+\])/g, (m, h, o) => { const t = HEX[h.toUpperCase()]; return t ? hit(`-${mixTw(t, opac(o))}`) : m })
  // 2b. Tailwind [var(--x)]/N
  s = s.replace(/-\[var\((--[\w-]+)\)\]\/(\d+|\[0?\.\d+\])/g, (_, t, o) => hit(`-${mixTw(t, opac(o))}`))
  // 1. Tailwind [#HEX]
  s = s.replace(/-\[#([0-9a-fA-F]{6})\]/g, (m, h) => { const t = HEX[h.toUpperCase()]; return t ? hit(`-[var(${t})]`) : m })
  // 5. rgba(r,g,b,a) — a 가 숫자일 때만(식이면 사람이 고친다)
  //    Tailwind 임의값 안(앞 글자가 `_` 나 `[`)이면 공백 대신 `_` 로 쓴다 — 공백은 클래스를 둘로 쪼갠다.
  s = s.replace(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(0?\.\d+|1|0)\s*\)/g, (m, r, g, b, a, at, all) => {
    const t = RGB[`${r},${g},${b}`]
    if (!t) return m
    const tw = /[_[]/.test(all[at - 1] ?? '')
    return hit(tw ? `color-mix(in_srgb,var(${t})_${pct(Number(a))},transparent)` : mixCss(`var(${t})`, pct(Number(a))))
  })
  // 3a. 8자리 #HEXAA
  s = s.replace(/#([0-9a-fA-F]{6})([0-9a-fA-F]{2})\b/g, (m, h, a) => { const t = HEX[h.toUpperCase()]; return t ? hit(mixCss(`var(${t})`, pct(parseInt(a, 16) / 255))) : m })
  // 4. 템플릿 ${색}AA
  s = s.replace(/\$\{([^{}]+)\}([0-9a-fA-F]{2})(?=[\s`'",);])/g, (m, e, a) => (COLORISH.test(e) ? hit(mixCss(`\${${e}}`, pct(parseInt(a, 16) / 255))) : m))
  // 3b. 6자리 #HEX (문자열·주석 어디든 — 주석도 사실과 맞아야 한다)
  s = s.replace(/#([0-9a-fA-F]{6})\b/g, (m, h) => { const t = HEX[h.toUpperCase()]; return t ? hit(`var(${t})`) : m })
  return { s, n }
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (/\.(tsx?|mjs)$/.test(e.name)) yield p
  }
}

let files = 0, total = 0
for (const d of DIRS) {
  for (const f of walk(path.join(ROOT, d))) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/')
    if (SKIP.some((r) => r.test(rel))) continue
    const raw = fs.readFileSync(f, 'utf8')
    const crlf = raw.includes('\r\n')
    const { s, n } = transform(raw.replace(/\r\n/g, '\n'))
    if (!n) continue
    files++; total += n
    console.log(`${String(n).padStart(4)}  ${rel}`)
    if (WRITE) fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s)
  }
}
console.log(`${WRITE ? '적용' : '미리보기'}: 파일 ${files} · 치환 ${total}`)
