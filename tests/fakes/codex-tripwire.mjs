// tests/fakes/codex-tripwire.mjs — 호출되면 표시만 남기는 가짜 Codex(RP-2026-10-10.2 회귀: 자동 경로에서 0회여야 한다)
import fs from 'node:fs'
import path from 'node:path'
fs.appendFileSync(path.join(process.env.FAKE_STATE_DIR || '.', 'codex-called.log'), `${new Date().toISOString()} ${process.argv.slice(2).join(' ')}\n`)
fs.readFileSync(0, 'utf8')
console.log('```json vfc-review\n{"verdict":"APPROVE","findings":[],"ran_tests":false}\n```')
