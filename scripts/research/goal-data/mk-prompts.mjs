// scripts/research/goal-data/mk-prompts.mjs
//
// 범위 배치 분석자 프롬프트 생성 · 보존(T-0118 B11-P1-01) — 프롬프트 틀에서 청크마다 실행 전문을 만들어
// local/<batch>/prompts/<label>.md 로 저장하고, sha256 · 입력 청크 sha256 · 허용/금지 입력 목록을 manifest.json 에 남긴다.
//   node scripts/research/goal-data/mk-prompts.mjs <batch>
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const TEMPLATE = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping/prompts/batch-analyst.md')
const batch = process.argv[2]
if (!batch) throw new Error('mk-prompts <batch>')
const LOCAL = path.join(ROOT, 'scripts/research/goal-data/local', batch)
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
const tpl = fs.readFileSync(TEMPLATE, 'utf8')
const body = tpl.slice(tpl.indexOf('\n---\n') + 5).replace(/^\n+/, '')
const RULE = { A: '입력의 prior_analysis_unverified 는 검증 전 참고용 — 원문으로 확인한다.', B: '원문만 · 눈가림 — 기존 분석 · DB · 다른 판정 파일을 찾아보거나 읽지 않는다.' }
const chunks = fs.readdirSync(LOCAL).filter((f) => /^chunk-[AB]-\d+\.json$/.test(f)).sort()
if (!chunks.length) throw new Error(`${batch}: 청크가 없다 — 먼저 d2-run chunks`)
const outDir = path.join(LOCAL, 'prompts')
fs.mkdirSync(outDir, { recursive: true })
const runs = chunks.map((f) => {
  const chunk = f.replace(/\.json$/, '')
  const track = chunk.split('-')[1]
  const label = `${batch}-${chunk.replace('chunk-', '')}`
  const text = body.replaceAll('{BATCH}', batch).replaceAll('{TRACK}', track).replaceAll('{CHUNK}', chunk).replaceAll('{LABEL}', label).replaceAll('{TRACK_RULE}', RULE[track])
  if (/\{[A-Z_]+\}/.test(text)) throw new Error(`치환 안 된 자리 ${label}`)
  fs.writeFileSync(path.join(outDir, `${label}.md`), text)
  return {
    label, track, chunk, prompt_file: path.relative(ROOT, path.join(outDir, `${label}.md`)).replaceAll('\\', '/'), prompt_sha256: sha(text), input_chunk_sha256: sha(fs.readFileSync(path.join(LOCAL, f))),
    allowed_inputs: ['docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md', 'docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2.md … CONTRACT_V2_4.md', 'docs/csat-learner/v4/codebook.json', `scripts/research/goal-data/local/${batch}/${f}`, `d2-run ${batch} validate ${track} 출력`],
    forbidden_inputs: ['CONTRACT_V2_5.md · V2_5_* · prereg-* · v2_5-*', '같은 배치 다른 청크 · 다른 트랙 · input.json · history/ · prompts/', '다른 배치 폴더', 'docs 의 *-agreement* · *-links* · *-sample* · *-corrections* · *-comparison* · mapping-review.md', 'scripts/research/goal-data/*.mjs(검증기 · 실행기 소스)'],
  }
})
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ batch, template: path.relative(ROOT, TEMPLATE).replaceAll('\\', '/'), template_sha256: sha(tpl), generated_at: new Date().toISOString(), runs }, null, 1))
console.log(JSON.stringify(runs.map((r) => [r.label, r.prompt_sha256.slice(0, 12)])))
