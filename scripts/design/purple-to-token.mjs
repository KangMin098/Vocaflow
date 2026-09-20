// scripts/design/purple-to-token.mjs
//
// **옛 AI-보라를 토큰으로 바꾼다 — 기본은 예행(dry-run).**
//
// 결정: DD-01(액센트 = Deep Ink `--p`) · DD-55(관리자는 `--p` + **주묵 표식**, 보라는 신규 금지·감소만).
// 이 스크립트는 그 「감소」를 기계적으로 한 번에 한다. 판단이 필요한 것(그라디언트 구조·화면 도움말
// 문구)은 **건드리지 않고 보고만** 한다 — 색을 바꾸면서 구조까지 바꾸면 diff 를 아무도 못 읽는다.
//
// 바꾸는 것(정확 일치만):
//   #8B5CF6            → var(--p)            구조·액센트 색
//   #8B5CF61A · …18    → var(--p-light)      옅은 배경 tint(알파 hex)
//   #7C3AED · #6D28D9  → var(--p-hover)      그라디언트 끝·진한 변형
//   #A78BFA            → var(--p-light)      옅은 변형
//   var(--ios-purple)      → var(--p)
//   var(--ios-purple-ink)  → var(--p)
//   var(--ios-purple-tint) → var(--p-light)
//
// 건드리지 않는 것(보고만):
//   · `from-[...] to-[...]` 같은 **그라디언트 구조** — 색은 바뀌지만 그라디언트 자체는 평균 신호다.
//     구조 제거는 화면별 판단이라 Gate 4 (ii)·(iii) 에서 한다.
//   · `bg-violet-500` 류 **Tailwind 팔레트 클래스** — 클래스 이름은 토큰으로 1:1 치환되지 않는다.
//   · 테스트 픽스처(`__tests__` 아래) — 회귀가 옛 값을 일부러 들고 있을 수 있다.
//   · 문서·도움말 문구(「보라 테두리」) — 사람 문장이라 따로 고친다(같은 커밋에서).
//
// 실행:
//   node scripts/design/purple-to-token.mjs            # 예행 — 무엇이 바뀌는지만
//   node scripts/design/purple-to-token.mjs --write    # 적용
//   node scripts/design/purple-to-token.mjs --scope apps/web/src/app/admin --write

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WRITE = process.argv.includes('--write')
const scopeIdx = process.argv.indexOf('--scope')
const SCOPE = scopeIdx > 0 ? process.argv[scopeIdx + 1] : 'apps/web/src'

/** 정확 일치 치환표. 순서가 중요하다 — 알파가 붙은 8자리를 먼저 바꾼다. */
const RULES = [
  [/#8B5CF61A/gi, 'var(--p-light)'],
  [/#8B5CF618/gi, 'var(--p-light)'],
  [/#8B5CF6/gi, 'var(--p)'],
  [/#7C3AED/gi, 'var(--p-hover)'],
  [/#6D28D9/gi, 'var(--p-hover)'],
  [/#A78BFA/gi, 'var(--p-light)'],
  [/var\(--ios-purple-ink\)/g, 'var(--p)'],
  [/var\(--ios-purple-tint\)/g, 'var(--p-light)'],
  [/var\(--ios-purple\)/g, 'var(--p)'],
]

/** 손대지 않고 보고만 하는 것. */
const REPORT_ONLY = [
  [/(?<![\w-])(?:bg|text|border|from|to|via|ring)-(?:violet|purple|indigo)-\d{2,3}/g, 'Tailwind 보라 팔레트 클래스'],
  [/(?:from|to|via)-\[var\(--p[a-z-]*\)\]/g, '그라디언트 구조(색은 토큰으로 바뀜)'],
]

const files = execSync(`git ls-files ${SCOPE}`, { cwd: ROOT, maxBuffer: 1e9 })
  .toString()
  .split('\n')
  .filter((f) => /\.(tsx?|css)$/.test(f))

let changedFiles = 0
let changedHits = 0
const reportOnly = []
const skippedTests = []

for (const rel of files) {
  const path = join(ROOT, rel)
  const before = readFileSync(path, 'utf8')
  let after = before
  let hits = 0
  for (const [re, to] of RULES) {
    after = after.replace(re, () => {
      hits++
      return to
    })
  }
  if (hits) {
    if (/__tests__|\.test\.tsx?$/.test(rel)) {
      skippedTests.push(`${rel} (${hits})`)
      continue // 회귀가 옛 값을 일부러 들고 있을 수 있다 — 사람이 본다
    }
    changedFiles++
    changedHits += hits
    if (WRITE) writeFileSync(path, after)
  }
  for (const [re, why] of REPORT_ONLY) {
    const found = before.match(re)
    if (found) reportOnly.push(`${rel}: ${why} × ${found.length}`)
  }
}

console.log(
  JSON.stringify(
    {
      mode: WRITE ? 'write' : 'dry-run',
      scope: SCOPE,
      changedFiles,
      changedHits,
      skippedTests,
      reportOnly: reportOnly.slice(0, 20),
      reportOnlyTotal: reportOnly.length,
    },
    null,
    2,
  ),
)
