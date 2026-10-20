// tests/fakes/role-agent.mjs — deterministic transport fixture, never real AI evidence.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const prompt = fs.readFileSync(0, 'utf8'), agent = process.argv[2]
const emit = (s) => console.log(agent === 'claude' ? JSON.stringify({ result: s, total_cost_usd: 0.001 }) : s)
if (prompt.includes('vfc-design') && !prompt.includes('vfc-review')) {
  emit('```json vfc-design\n' + JSON.stringify({ summary: 'local fixture proposal', design: 'reuse src helper and node tests', acceptance: ['fixture outcome'], allowed_paths: ['src/**'], preserved_contracts: ['no DB'], db_changes: false }) + '\n```')
} else if (prompt.includes('vfc-plan')) {
  const n = JSON.parse(prompt.match(/Immutable acceptance: (.+?)\. Dependencies:/)[1]).length
  emit('```json vfc-plan\n' + JSON.stringify({ status: 'READY', goal_fit: 'fixture', reuse: [], steps: ['implement and test'], acceptance_indexes: Array.from({ length: n }, (_, i) => i), risks: [] }) + '\n```')
} else if (prompt.includes('vfc-review')) {
  const key = path.join(process.env.FAKE_STATE_DIR, `${agent}-role-review-count`)
  const n = Number(fs.existsSync(key) ? fs.readFileSync(key, 'utf8') : 0) + 1
  fs.writeFileSync(key, String(n))
  const block = process.env.FAKE_ROLE_P1 === '1' && n === 1
  emit('```json vfc-review\n' + JSON.stringify({ verdict: block ? 'REQUEST_CHANGES' : 'APPROVE', findings: block ? [{ id: 'RP1', severity: 'P1', scope: 'in', claim: 'fixture repair required' }] : [], ran_tests: false }) + '\n```')
} else {
  const id = prompt.match(/## Task (T-\d+)/)[1]
  const report = prompt.match(/Write the report JSON to: (.+)/)[1].trim()
  const n = (prompt.match(/^\[\d+\] /gm) || []).length
  fs.mkdirSync('src', { recursive: true }); fs.mkdirSync('.vfc-runs', { recursive: true })
  fs.appendFileSync(`src/${id}.mjs`, `// fixture ${agent}\n`)
  fs.writeFileSync('.vfc-runs/fixture.log', 'fixture test: pass\n')
  fs.writeFileSync(report, JSON.stringify({ task_id: id, status: 'implemented', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tests: [{ command: 'fixture', result: 'pass', skip_count: 0, log_path: '.vfc-runs/fixture.log', covers: Array.from({ length: n }, (_, i) => i) }] }))
  emit('fixture done')
}
