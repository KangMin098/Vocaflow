#!/usr/bin/env node
// hooks/install.mjs — 정본 훅(codex-review.mjs · codex-review-policy.mjs)을 ~/.claude/hooks 에 설치한다.
// 기존 파일은 <이름>.bak-<날짜시각> 으로 남긴다(되돌리기: 백업을 원래 이름으로 복사). codex-review-lib.mjs · gate 는 건드리지 않는다.
//   node hooks/install.mjs [--dest <dir>] [--dry-run]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const destIdx = argv.indexOf('--dest')
const dest = destIdx >= 0 ? argv[destIdx + 1] : path.join(os.homedir(), '.claude', 'hooks')
const dry = argv.includes('--dry-run')
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13)
const out = []
if (!fs.existsSync(path.join(dest, 'codex-review-lib.mjs'))) {
  console.error(`${dest}/codex-review-lib.mjs 가 없다 — 이 훅은 기존 lib 를 쓴다. 설치 중단`)
  process.exit(1)
}
for (const name of ['codex-review-policy.mjs', 'codex-review.mjs']) {
  const src = path.join(here, name)
  const to = path.join(dest, name)
  if (fs.existsSync(to) && fs.readFileSync(to, 'utf8') === fs.readFileSync(src, 'utf8')) {
    out.push(`${name}: 이미 같다`)
    continue
  }
  if (fs.existsSync(to)) {
    const bak = `${to}.bak-${stamp}`
    if (!dry) fs.copyFileSync(to, bak)
    out.push(`${name}: 백업 ${path.basename(bak)}`)
  }
  // 원자적 교체: 같은 폴더 임시 파일 → rename. 다른 세션의 Stop 훅이 반쯤 쓴 파일을 import 하지 않게(RP-2026-10-10.1)
  if (!dry) {
    const tmp = `${to}.${process.pid}.tmp`
    fs.copyFileSync(src, tmp)
    fs.renameSync(tmp, to)
  }
  out.push(`${name}: ${dry ? '설치 예정' : '설치'} → ${to}`)
}
console.log(out.join('\n'))
