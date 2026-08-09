// scripts/comic/pd/ai-restyle/ingest.mjs
//
// AI 리스타일 결과 회수 — Kaggle/RunPod 이 만든 리스타일 패널 zip 을 work/<slug>/ai-restyle/output/ 로
// 풀고, 원작|리스타일 비교 프리뷰 + ai-restyle.manifest.json(verdict) 을 만들어 Admin 모니터에 노출한다.
//
//   node scripts/comic/pd/ai-restyle/ingest.mjs --workdir work/<slug> --zip <restyled.zip>

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..', '..')
const FF = process.env.FFMPEG_BIN || (fs.existsSync(path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe')) ? path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe') : 'ffmpeg')

const WD = arg('workdir')
const ZIP = arg('zip')
if (!WD || !fs.existsSync(WD)) { console.error(`--workdir <dir> 필요: ${WD}`); process.exit(2) }
if (!ZIP || !fs.existsSync(ZIP)) { console.error(`--zip <restyled.zip> 필요(존재해야 함): ${ZIP}`); process.exit(2) }

const outDir = path.join(WD, 'ai-restyle')
const resDir = path.join(outDir, 'output')
fs.mkdirSync(resDir, { recursive: true })

// zip 해제 — Windows/리눅스 공통으로 bsdtar(tar) 가 zip 을 푼다.
const un = spawnSync('tar', ['-xf', path.resolve(ZIP), '-C', resDir], { encoding: 'utf8' })
if (un.status !== 0) { console.error(`zip 해제 실패(tar): ${(un.stderr || '').split('\n').slice(-2).join(' ')}`); process.exit(1) }
const outs = fs.readdirSync(resDir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
if (!outs.length) { console.error('리스타일 이미지 없음'); process.exit(1) }

// 원작|리스타일 비교 프리뷰(첫 3패널) — 모니터 갤러리 썸네일
const inDir = path.join(outDir, 'inputs')
const pick = outs.slice(0, 3)
const rows = []
for (const f of pick) {
  const orig = path.join(inDir, f); const res = path.join(resDir, f)
  if (!fs.existsSync(orig) || !fs.existsSync(res)) continue
  const row = path.join(outDir, `_cmp_${f}`)
  spawnSync(FF, ['-y', '-i', orig, '-i', res, '-filter_complex', `[0]scale=-1:400,pad=iw+4:ih:0:0:color=0xCCCCCC[a];[1]scale=-1:400[b];[a][b]hstack=inputs=2[s]`, '-map', '[s]', '-update', '1', '-frames:v', '1', '-q:v', '3', row], { encoding: 'utf8' })
  if (fs.existsSync(row)) rows.push(row)
}
if (rows.length) {
  const inputs = rows.flatMap((f) => ['-i', f])
  const chain = rows.map((_, i) => `[${i}:v]`).join('')
  spawnSync(FF, ['-y', ...inputs, '-filter_complex', `${chain}vstack=inputs=${rows.length}[s]`, '-map', '[s]', '-update', '1', '-frames:v', '1', '-q:v', '3', path.join(outDir, 'compare_preview.jpg')], { encoding: 'utf8' })
  for (const r of rows) fs.unlinkSync(r)
}

const jobPath = path.join(outDir, 'job.json')
const engine = fs.existsSync(jobPath) ? (JSON.parse(fs.readFileSync(jobPath, 'utf8')).engine || 'ai-restyle') : 'ai-restyle'
fs.writeFileSync(path.join(outDir, 'ai-restyle.manifest.json'), JSON.stringify({
  operator: 'claude-code', track: 'ai-restyle (GPU 모델, 선택)', engine, panels: outs.length,
  note: '원작 재작화(화풍 변경, 구도 유지) + 레터링 오버레이 폴백. 작화 보존 트랙과 병렬 비교.',
  verdict: null, // Claude Code/사용자가 비교 후 채택·반려 기록
}, null, 2))
console.log(`✓ AI 리스타일 회수 — 패널 ${outs.length} · ${path.relative(REPO, resDir)}`)
console.log(`  compare_preview.jpg + ai-restyle.manifest.json → 모니터 '현대화 산출물'`)
console.log(`  판정: node scripts/comic/pd/oplog.mjs --slug <slug> --phase ai-restyle --action adopt|reject ...`)
