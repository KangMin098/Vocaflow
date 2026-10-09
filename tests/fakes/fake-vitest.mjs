// tests/fakes/fake-vitest.mjs — 읽기 전용 live 검증 러너(lib/liveverify.mjs)용 가짜 vitest
// 호출: node fake-vitest.mjs <testRel> <outputFile>  · 결과 모양은 FAKE_VITEST(pass|skip|fail|none)
import fs from 'node:fs'
const [, , testRel, out] = process.argv
const mode = process.env.FAKE_VITEST || 'pass'
// 테스트 계정이 자식 환경에 들어왔는지 기록(값 확인용 — 비밀값은 넣지 않는다)
fs.writeFileSync(`${out}.env-seen`, JSON.stringify({ MAP_LIVE_USER: process.env.MAP_LIVE_USER ?? null, FAKE_SECRET_SEEN: process.env.FAKE_SECRET ? true : false }))
if (mode === 'none') process.exit(1)
const r = { pass: [1, 0, 0], skip: [0, 0, 1], fail: [0, 1, 0] }[mode]
fs.writeFileSync(out, JSON.stringify({ numPassedTests: r[0], numFailedTests: r[1], numPendingTests: r[2], numTodoTests: 0, numTotalTests: 1, testRel }))
