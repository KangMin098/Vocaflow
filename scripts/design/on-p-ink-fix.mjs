// scripts/design/on-p-ink-fix.mjs
//
// **`--p` 면 위의 글자색을 `--on-p` 로 바꾼다 — 기본은 예행.**
//
// 왜 필요했나: 옛 보라를 `--p` 로 바꾸자(Gate 4 (i)) 그 면 위에 남아 있던 `text-white` 가
// **다크 테마 AA 미달**이 됐다. 다크 `--p`(#6B9BD1) 위 흰 글자는 2.90:1 이다.
// `on-p-contrast` 래칫이 그것을 잡았고, 기준선을 올리는 대신 **글자색을 같이 고친다.**
//
// 판정은 그 래칫과 **같은 규칙**을 쓴다(줄 단위 · 같은 className 문자열):
//   면   : bg-[var(--p)] · from-[var(--p)] · from/to-[var(--p-dark)] · bg-p(축약형)
//   글자 : text-white · text-[var(--ti)] · text-ti(축약형)  → text-[var(--on-p)]
// 한계도 같다 — 면과 글자가 다른 줄에 흩어지면 못 잡는다(하한 추정).
//
// 실행: node scripts/design/on-p-ink-fix.mjs [--scope apps/web/src/app/admin] [--write]

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WRITE = process.argv.includes('--write')
const scopeIdx = process.argv.indexOf('--scope')
const SCOPE = scopeIdx > 0 ? process.argv[scopeIdx + 1] : 'apps/web/src'

const P_SURFACE =
  /(bg-\[var\(--p\)\]|from-\[var\(--p\)\]|from-\[var\(--p-dark\)\]|to-\[var\(--p-dark\)\]|(?:^|\s|")bg-p(?![-\w]))/
const UNSAFE = [
  [/\btext-white\b/g, 'text-[var(--on-p)]'],
  [/text-\[var\(--ti\)\]/g, 'text-[var(--on-p)]'],
  [/((?:^|\s|"))text-ti(?![-\w])/g, '$1text-[var(--on-p)]'],
]

const files = execSync(`git ls-files ${SCOPE}`, { cwd: ROOT, maxBuffer: 1e9 })
  .toString()
  .split('\n')
  .filter((f) => f.endsWith('.tsx') && !/__tests__|\.test\./.test(f))

let changedFiles = 0
let changedLines = 0
const touched = []

for (const rel of files) {
  const path = join(ROOT, rel)
  const before = readFileSync(path, 'utf8')
  const lines = before.split('\n')
  let hits = 0
  const after = lines
    .map((line, i) => {
      if (!P_SURFACE.test(line)) return line
      let next = line
      for (const [re, to] of UNSAFE) next = next.replace(re, to)
      if (next !== line) {
        hits++
        touched.push(`${rel}:${i + 1}`)
      }
      return next
    })
    .join('\n')
  if (hits) {
    changedFiles++
    changedLines += hits
    if (WRITE) writeFileSync(path, after)
  }
}

console.log(
  JSON.stringify({ mode: WRITE ? 'write' : 'dry-run', scope: SCOPE, changedFiles, changedLines, sample: touched.slice(0, 10) }, null, 2),
)
