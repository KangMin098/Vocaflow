// scripts/csat/checklist-exp/usage.mjs
//
// **판정 서브에이전트가 쓴 토큰을 JSONL 기록에서 잰다(읽기 전용).**
//
// 서브에이전트 기록(한 줄 = 한 이벤트)의 assistant 메시지마다 `usage` 가 있다. 한 요청의 응답이 내용 블록별로 여러 줄에
// 나뉘어 기록되므로 `message.id` 로 한 번만 센다. 요청마다 컨텍스트 전체를 다시 싣기 때문에 **요청 수가 곧 비용**이다.
//
// 입력 환산 = 캐시 쓰기 ×1.25 + 캐시 읽기 ×0.1 + 캐시 안 된 입력 ×1 (같은 모델 안에서의 상대 가격 — 모델 간 비교는 단가를 곱한다).
// ⚠️ `output_tokens` 는 스트리밍 기록에 부분값만 남는 경우가 있어 참고로만 낸다(2026-09-26 측정에서 청크당 138~1,340 — 실제 JSON 출력보다 작다).
// 고정 비용 = 첫 요청의 캐시 쓰기(본문을 읽기 전 시스템 프롬프트·도구·지시) — 이후 요청마다 캐시 읽기로 다시 든다.
//
// 기록마다 이름표: 기록 안에 처음 나오는 출력 경로 `chunk-NN(.<suffix>)?.out.json` → `<work>/chunk-NN[.suffix]`.
//
// 실행: node scripts/csat/checklist-exp/usage.mjs <기록 폴더> [--match '<이름표 정규식>'] [--json out.json]
//   예: --match 'work-v2/chunk-\d+$' (Opus v2) · --match '\.hA$' (Haiku 첫 판정)

import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('사용: usage.mjs <기록 폴더> [--match <이름표 정규식>] [--json out.json]')
  process.exit(2)
}
const argOf = (k) => (process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : null)
const MATCH = argOf('match') ? new RegExp(argOf('match')) : null

const rows = []
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.output') || x.endsWith('.jsonl'))) {
  const seen = new Set()
  const reqs = []
  let label = null
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    if (!line) continue
    if (!label) {
      const m = line.match(/(work[\w-]*)\/(chunk-\d+(?:\.[A-Za-z0-9]+)?)\.out\.json/)
      if (m) label = `${m[1]}/${m[2]}`
    }
    let j
    try { j = JSON.parse(line) } catch { continue }
    const msg = j.message
    if (j.type !== 'assistant' || !msg?.usage) continue
    const id = msg.id ?? j.requestId ?? j.uuid
    if (seen.has(id)) continue
    seen.add(id)
    const u = msg.usage
    reqs.push({
      input: u.input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      model: msg.model,
    })
  }
  if (!reqs.length || !label) continue
  if (MATCH && !MATCH.test(label)) continue
  const sum = (k) => reqs.reduce((s, r) => s + r[k], 0)
  const fixed = reqs[0].cacheWrite
  rows.push({
    label,
    model: reqs[0].model,
    requests: reqs.length,
    fixed,
    input: sum('input'),
    cacheWrite: sum('cacheWrite'),
    cacheRead: sum('cacheRead'),
    output: sum('output'),
    inputEquiv: Math.round(sum('input') + 1.25 * sum('cacheWrite') + 0.1 * sum('cacheRead')),
    fixedEquiv: Math.round(1.25 * fixed + 0.1 * fixed * (reqs.length - 1)),
  })
}
rows.sort((a, b) => a.label.localeCompare(b.label))

const tot = (k) => rows.reduce((s, r) => s + r[k], 0)
console.log('  이름표                        모델                  요청  고정(첫 쓰기)  입력 환산  (고정 몫)')
for (const r of rows) {
  console.log(`  ${r.label.padEnd(28)} ${String(r.model).padEnd(20)} ${String(r.requests).padStart(4)} ${String(r.fixed).padStart(12)} ${String(r.inputEquiv).padStart(10)}  ${((r.fixedEquiv / r.inputEquiv) * 100).toFixed(0)}%`)
}
if (rows.length) {
  console.log(`  합계 ${rows.length}개 · 요청 ${tot('requests')} · 입력 환산 ${tot('inputEquiv').toLocaleString()} · 고정 몫 ${((tot('fixedEquiv') / tot('inputEquiv')) * 100).toFixed(1)}% · 청크당 평균 ${Math.round(tot('inputEquiv') / rows.length).toLocaleString()}`)
}
if (argOf('json')) fs.writeFileSync(path.resolve(argOf('json')), JSON.stringify(rows, null, 1) + '\n')
