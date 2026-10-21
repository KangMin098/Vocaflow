// scripts/design/var-opacity-codemod.mjs
//
// Tailwind 3.4 는 `bg-[var(--x)]/55` 처럼 **변수 색에 붙은 /N** 을 CSS 로 만들지 않는다 — 그 클래스는 조용히 아무것도 칠하지 않는다
// (DD-82 에서 admin 128곳을 고친 것과 같은 결함). 같은 뜻의 `color-mix` 로 바꾼다:
//   bg-[var(--bd)]/55  →  bg-[color-mix(in_srgb,var(--bd)_55%,transparent)]
// 변형(hover: · group-hover/x: 등)은 그대로 둔다. 재실행하면 0건이어야 한다(이미 바꾼 것은 패턴에 걸리지 않는다).
//
// 사용: node scripts/design/var-opacity-codemod.mjs <파일 또는 폴더>... [--dry]
// 2026-10-18 learner-tines-audit S3 ④ — 읽기 화면(components/workspace)에서 문장 듣기 점이 투명해 빈 틈으로 보인 원인.

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const targets = args.filter((a) => a !== '--dry')
if (!targets.length) { console.error('사용: var-opacity-codemod.mjs <파일|폴더>... [--dry]'); process.exit(2) }

const RE = /\[var\((--[a-z0-9-]+)\)\]\/(\d{1,3})(?![\d%])/g
const files = []
const walk = (p) => {
  const st = fs.statSync(p)
  if (st.isDirectory()) for (const n of fs.readdirSync(p)) walk(path.join(p, n))
  else if (/\.(tsx?|jsx?)$/.test(p) && !/__tests__/.test(p)) files.push(p)
}
for (const t of targets) walk(t)

let total = 0
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  let n = 0
  const out = src.replace(RE, (_m, v, pct) => { n++; return `[color-mix(in_srgb,var(${v})_${pct}%,transparent)]` })
  if (n) {
    total += n
    console.log(`${dry ? '(dry) ' : ''}${f} — ${n}`)
    if (!dry) fs.writeFileSync(f, out)
  }
}
console.log(`\n${total}곳${dry ? ' (바꾸지 않음)' : ' 바꿈'}`)
