// scripts/design/coverage-report.mjs
// Explicit inputs make current evidence reproducible; historical captures do not imply current visual approval.
// node scripts/design/coverage-report.mjs --history <dir> --current <dir> --out tmp/coverage
import fs from 'node:fs'
import path from 'node:path'
import { routeInventory, reportEvidence, summarizeCoverage } from './lib/render-evidence.mjs'

const args = process.argv.slice(2)
const inputs = []
let out = 'tmp/design-coverage'
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out' && args[i + 1]) out = args[++i]
  else if (['--history', '--current'].includes(args[i]) && args[i + 1]) inputs.push({ dir: args[++i], current: args[i - 1] === '--current' })
  else throw new Error('Use --history <dir>, --current <dir>, --out <prefix>')
}
if (!inputs.length) throw new Error('Evidence inputs required')
const inventory = routeInventory('apps/web/src/app').filter(r => !r.route.startsWith('/csat'))
const files = new Map()
function walk(dir, current) {
  if (!fs.existsSync(dir)) throw new Error(`Evidence path missing: ${dir}`)
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name)
    if (f.isDirectory()) walk(p, current)
    else if (/^_.*\.json$/.test(f.name)) files.set(path.resolve(p), { file: p.replaceAll('\\', '/'), current })
  }
}
for (const { dir, current } of inputs) walk(dir, current)
const evidence = [...files.values()].flatMap(({ file, current }) => reportEvidence(JSON.parse(fs.readFileSync(file, 'utf8')), { file, current }))
const routes = summarizeCoverage(inventory, evidence).map(r => ({ ...r, file: r.file.replaceAll('\\', '/') }))
const counts = { routes: routes.length, normalEvidence: routes.filter(r => r.historical).length, currentNormal: routes.filter(r => r.current).length, currentFourConditions: routes.filter(r => r.fourConditions).length, isolatedOnly: routes.filter(r => r.isolatedOnly).length }
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(`${out}.json`, JSON.stringify({ at: new Date().toISOString(), inputs, counts, routes }, null, 2))
fs.writeFileSync(`${out}.md`, `# PC 학습자 전수 검증 대장\n\n현재 증거 입력: ${inputs.filter(i => i.current).map(i => `\`${i.dir}\``).join(' · ')}.\n\n정상 렌더는 시각 수용/상호작용 통과가 아니다. 오류/로그인 복귀/격리 부품/성공 여부 불명은 정상 증거에서 제외한다.\n\n${JSON.stringify(counts)}\n\n| 라우트 | 과거 포함 정상 | 현재 묶음 정상 | 현재 4조건 | 최신 근거 |\n|---|---|---|---|---|\n` + routes.map(r => `| \`${r.route}\` | ${r.historical ? '✓' : '—'} | ${r.current ? '✓' : '—'} | ${r.fourConditions ? '✓' : '—'} | ${r.evidence.slice(-1).join('')} |`).join('\n') + '\n')
console.log(JSON.stringify(counts))
