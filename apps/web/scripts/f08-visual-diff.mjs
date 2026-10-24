// apps/web/scripts/f08-visual-diff.mjs
//
// F08 프로토타입 시각 회귀 비교. 기준선 = 지정 커밋에 보존된 docs/csat-learner/f08-proto/shots/*.png(git blob),
// 현재 = test-results/f08/*.png(같은 빌드·같은 과제로 다시 렌더). pixelmatch 로 픽셀 차이를 세고 diff 이미지를 남긴다.
// 사용: node scripts/f08-visual-diff.mjs <기준 커밋> <출력 폴더>

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// pixelmatch·pngjs 는 web 의 직접 의존성이 아니다(Playwright 가 끌어온 전이 의존성). 의존성을 늘리지 않고 pnpm 저장소에서 직접 연다.
const store = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../node_modules/.pnpm')
const req = createRequire(import.meta.url)
const pixelmatch = req(path.join(store, 'pixelmatch@5.3.0/node_modules/pixelmatch/index.js'))
const { PNG } = req(path.join(store, 'pngjs@7.0.0/node_modules/pngjs/lib/png.js'))

const [baseCommit, outDir] = process.argv.slice(2)
if (!baseCommit || !outDir) {
  console.error('usage: node scripts/f08-visual-diff.mjs <commit> <outDir>')
  process.exit(2)
}
fs.mkdirSync(outDir, { recursive: true })

const repo = execFileSync('git', ['rev-parse', '--show-toplevel']).toString().trim()
const listing = execFileSync('git', ['ls-tree', '--name-only', baseCommit, 'docs/csat-learner/f08-proto/shots/'], { cwd: repo }).toString()
const names = listing.split('\n').filter((n) => n.endsWith('.png')).map((n) => path.basename(n)).sort()

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const rows = []
for (const name of names) {
  const baseBuf = execFileSync('git', ['show', `${baseCommit}:docs/csat-learner/f08-proto/shots/${name}`], { cwd: repo, maxBuffer: 64 << 20 })
  const curPath = path.join('test-results/f08', name)
  if (!fs.existsSync(curPath)) { rows.push({ name, status: 'missing' }); continue }
  const curBuf = fs.readFileSync(curPath)
  const a = PNG.sync.read(baseBuf)
  const b = PNG.sync.read(curBuf)
  if (a.width !== b.width || a.height !== b.height) {
    rows.push({ name, status: 'size', base: `${a.width}x${a.height}`, current: `${b.width}x${b.height}`, base_sha256: sha(baseBuf), current_sha256: sha(curBuf) })
    continue
  }
  const diff = new PNG({ width: a.width, height: a.height })
  // threshold 0.1 = pixelmatch 기본(안티앨리어싱 무시 켬). 0 픽셀이 목표, 판정 기준은 아래 PASS 조건.
  const px = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 })
  if (px > 0) fs.writeFileSync(path.join(outDir, name.replace('.png', '.diff.png')), PNG.sync.write(diff))
  rows.push({ name, status: px === 0 ? 'identical' : 'diff', size: `${a.width}x${a.height}`, diff_pixels: px, diff_ratio: +(px / (a.width * a.height)).toFixed(6), base_sha256: sha(baseBuf), current_sha256: sha(curBuf) })
}
const summary = {
  base_commit: execFileSync('git', ['rev-parse', baseCommit], { cwd: repo }).toString().trim(),
  compared: rows.length,
  identical: rows.filter((r) => r.status === 'identical').length,
  diff: rows.filter((r) => r.status === 'diff').length,
  size_or_missing: rows.filter((r) => r.status === 'size' || r.status === 'missing').length,
  rows,
}
fs.writeFileSync(path.join(outDir, 'visual-diff.json'), JSON.stringify(summary, null, 2))
for (const r of rows) console.log([r.name, r.status, r.diff_pixels ?? '', r.diff_ratio ?? '', r.base ?? '', r.current ?? ''].join(' | '))
console.log(`compared ${summary.compared} · identical ${summary.identical} · diff ${summary.diff} · size/missing ${summary.size_or_missing}`)
