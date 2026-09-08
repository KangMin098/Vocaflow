// scripts/csat/check-derived-fresh.mjs
//
// **지문 의존 산출물이 낡았는지 한 번에 본다.**
//
// 2026-09-07 에 `type-bands-all.json` 이 12일간 「고쳐지기 전 지문」 위에 서 있던 것을 찾았다.
// 무서운 것은 **그것이 어떤 파일 목록에도 안 보였다**는 점이다 — 입력(`columns2/`·
// `classified.json`)의 git 상태는 전부 「깨끗」이었다. 낡은 것은 입력이 아니라 **파서**
// (`lib-passage.mjs`·`clean-passage.mjs`)였고, 파서가 바뀌면 입력이 그대로여도 산출물이 낡는다.
//
// 그래서 낡음은 **다시 만들어 비교하는 것 말고 알 방법이 없다.** 이 스크립트가 그 일을 한다:
// 산출물을 백업 → 생성기 실행 → 대조 → **원래대로 되돌린다**(검사는 고치지 않는다).
//
// ⚠️ **모든 생성기를 무턱대고 돌리면 안 된다.** `measure-source-genre.mjs` 는 덤프 `.txt` 를
//    **명령행 인자**로 받는데, 인자 없이 돌리면 오류 없이 `bySource` 가 통째로 빈다
//    (2026-09-07 실측: 1,431 → 257 bytes). 「전부 재생성」 스크립트를 짜면 그날 그 파일이 죽는다.
//    그래서 여기엔 **인자 없이 돌려도 되는 것만** 싣고, 나머지는 이유와 함께 제외 목록에 둔다.
//
// 실행: node scripts/csat/check-derived-fresh.mjs          # 낡은 것이 있으면 exit 1
//       node scripts/csat/check-derived-fresh.mjs --fix    # 낡은 것을 실제로 갱신한다

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const DIR = path.resolve('scripts/csat/data')
const FIX = process.argv.includes('--fix')

/** 인자 없이 돌려도 되는 생성기 — `{ 생성기: 산출물 }` */
const TARGETS = [
  ['check-choice-band.mjs', 'choice-bands.json'],
  ['check-passage-band.mjs', 'type-bands.json'],
  ['measure-difficulty.mjs', 'difficulty-axis.json'],
  ['measure-extraction.mjs', 'extraction.json'],
  ['measure-thesis-spread.mjs', 'thesis-spread.json'],
  ['measure-type-constraints.mjs', 'type-constraints.json'],
  ['verify-d1-rules.mjs', 'd1-rules-verify.json'],
  ['measure-vocab-format.mjs', 'vocab-format.json'],
  ['generate-exam-frame.mjs', 'exam-frame-freedom.json'],
  ['test-point-slot.mjs', 'point-slot.json'],
  ['test-exam-difficulty.mjs', 'exam-difficulty.json'],
  ['build-bands-all.mjs', 'type-bands-all.json'],
]

/**
 * **인자가 있어야 하는 것 — 여기서 돌리지 않는다.**
 * 이 목록을 지우고 위로 옮기면 그 파일이 조용히 빈 값이 된다. 이유를 함께 남기는 이유다.
 */
const EXCLUDED = [
  ['measure-source-genre.mjs', 'source-genre.json', '덤프 .txt 를 argv 로 받는다 — 인자 없이 돌리면 bySource 가 통째로 빈다'],
  ['measure-source-gap.mjs', 'source-gap.json', '덤프 .txt 를 argv 로 받는다 (현재는 인자 없이도 산출물이 같지만 보장이 아니다)'],
]

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derived-'))
const stale = []
const failed = []

try {
  for (const [script, out] of TARGETS) {
    const outPath = path.join(DIR, out)
    const before = fs.existsSync(outPath) ? fs.readFileSync(outPath) : null
    if (before) fs.writeFileSync(path.join(tmp, out), before)

    try {
      execFileSync(process.execPath, [path.join('scripts/csat', script)], { stdio: 'pipe' })
    } catch (e) {
      failed.push({ script, why: String(e.message).split('\n')[0].slice(0, 80) })
      if (before) fs.writeFileSync(outPath, before)      // 실패해도 원래대로
      continue
    }

    const after = fs.existsSync(outPath) ? fs.readFileSync(outPath) : null
    const changed = !before || !after || !before.equals(after)
    if (changed) stale.push({ script, out, from: before?.length ?? 0, to: after?.length ?? 0 })
    // **검사는 고치지 않는다** — `--fix` 일 때만 새 값을 남긴다
    if (!FIX && before) fs.writeFileSync(outPath, before)
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}

console.log(`지문 의존 산출물 검사 — 대상 ${TARGETS.length} · 제외 ${EXCLUDED.length}`)
console.log('='.repeat(68))
for (const [s, o, why] of EXCLUDED) console.log(`  제외  ${o.padEnd(24)} ${why}`)
if (failed.length) {
  console.log()
  for (const f of failed) console.log(`  ⚠️ 실행 실패  ${f.script} — ${f.why}`)
}
console.log()

if (!stale.length) {
  console.log(`  낡은 것 0 — ${TARGETS.length}개 전부 최신.`)
  process.exit(failed.length ? 1 : 0)
}

console.log(`  ⚠️ 낡은 산출물 ${stale.length}:`)
for (const s of stale) console.log(`     ${s.out.padEnd(24)} ${s.from} → ${s.to} bytes   (${s.script})`)
console.log()
if (FIX) {
  console.log('  --fix 로 갱신했다. ⚠️ 이 수치를 인용하는 문서도 같은 커밋에서 고칠 것')
  console.log('     (CSAT_DESIGNER_MODEL.md §6.10 난도 축 · §7.5 추출률 · CSAT_TYPE_BLUEPRINTS.md 는 render-blueprints.mjs 로 재렌더)')
  process.exit(0)
}
console.log('  `node scripts/csat/check-derived-fresh.mjs --fix` 로 갱신한다.')
process.exit(1)
