// scripts/comic/pd/page-modern.mjs
//
// 원작 구성 보존 현대화 — PDCP(Claude Code 작업 기반, GPU 모델 없음).
// 웹툰 세로 리플로우처럼 컷을 재배치하지 않는다. **원작 페이지 구성(패널 배치)을 100% 그대로 두고**
// "디자인"만 현대화한다: 무테두리 crop + 화이트포인트 정규화(크림→순백) + 디스크린(halftone 제거)
// + 강채도 vibrant + 평면컬러 양자화(palette). 결과 = 원작 레이아웃 그대로인 "깨끗한 모던 디지털 코믹".
// (문구/레터링 현대화는 page-letter 단계에서 원작 말풍선 자리를 존중해 별도 적용.)
//
//   node scripts/comic/pd/page-modern.mjs --workdir work/<slug> [--colors 64] [--limit N]

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')
const FF = process.env.FFMPEG_BIN || (fs.existsSync(path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe')) ? path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe') : 'ffmpeg')

const WD = arg('workdir')
const LEVEL = String(arg('level', 'C')).toUpperCase() // 색감 강도 A(클린)/B(밸런스)/C(볼드). 사용자 선택=C.
const LIMIT = arg('limit') ? Number(arg('limit')) : null
if (!WD || !fs.existsSync(WD)) { console.error(`--workdir <dir> 필요: ${WD}`); process.exit(2) }

// 원본 스캔이 아니라 "복원(restored)" 페이지를 입력으로(이미 2x·크롭·디스큐 반영). 없으면 pages.
const srcDir = fs.existsSync(path.join(WD, 'restored')) && fs.readdirSync(path.join(WD, 'restored')).some((f) => /\.jpe?g$/i.test(f))
  ? path.join(WD, 'restored') : path.join(WD, 'pages')
let files = fs.readdirSync(srcDir).filter((f) => /\.jpe?g$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
if (LIMIT) files = files.slice(0, LIMIT)
if (!files.length) { console.error(`입력 페이지 없음: ${srcDir}`); process.exit(1) }

const outDir = path.join(WD, 'page-modern')
fs.mkdirSync(outDir, { recursive: true })

// 원작 구성 보존 = 리플로우/스택 없음. 페이지 단위로 "이미지=그래픽(색감)"만 현대화(3단계).
//   colorlevels: 크림 종이→순백 + 청색채널↑ 황색캐스트 제거  ·  smartblur: halftone 디스크린(radius ≤5)
//   eq: 강채도 vibrant  ·  palette: 평면컬러  ·  강도 A(클린)<B(밸런스)<C(볼드, 디지털 그래픽노블)
const LEVELS = {
  A: { grade: `crop=iw-12:ih-12,colorlevels=rimax=0.94:gimax=0.95:bimax=0.90,eq=saturation=1.22:contrast=1.06`, colors: 0 },
  B: { grade: `crop=iw-12:ih-12,colorlevels=rimax=0.92:gimax=0.93:bimax=0.86,smartblur=4:0.6:0,eq=saturation=1.5:contrast=1.15:gamma_b=1.02`, colors: 64 },
  C: { grade: `crop=iw-12:ih-12,colorlevels=rimax=0.90:gimax=0.91:bimax=0.84,smartblur=5:0.7:0,eq=saturation=1.78:contrast=1.24:gamma_b=1.02`, colors: 48 },
}
const sel = LEVELS[LEVEL] || LEVELS.C
const COLORS = sel.colors
const gradeVf = sel.grade
const paletteVf = COLORS ? `split[s0][s1];[s0]palettegen=max_colors=${COLORS}:stats_mode=full[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3` : null

const results = []
for (const f of files) {
  const inFile = path.join(srcDir, f)
  const out = path.join(outDir, f.replace(/\.jpe?g$/i, '.jpg'))
  const vf = paletteVf ? `${gradeVf},${paletteVf}` : gradeVf
  const r = spawnSync(FF, ['-y', '-i', inFile, '-vf', vf, '-q:v', '3', out], { encoding: 'utf8' })
  const ok = r.status === 0 && fs.existsSync(out)
  if (!ok) console.error(`  ✗ ${f}: ${(r.stderr || '').split('\n').slice(-2).join(' ')}`)
  else console.log(`  ✓ ${f} — 구성 보존 + 디자인 현대화`)
  results.push({ page: f, ok, out: path.relative(REPO, out) })
}

// 원작↔결과 병치 프리뷰(첫 페이지) — Claude Code 평가용
const first = results.find((r) => r.ok)
if (first) {
  const before = path.join(srcDir, first.page)
  const after = path.join(REPO, first.out)
  const cmp = path.join(outDir, 'compare_preview.jpg')
  const H = 900
  spawnSync(FF, ['-y', '-i', before, '-i', after, '-filter_complex',
    `[0]scale=-1:${H},pad=iw+4:ih:0:0:color=0xCCCCCC[a];[1]scale=-1:${H}[b];[a][b]hstack=inputs=2[s]`,
    '-map', '[s]', '-q:v', '3', cmp], { encoding: 'utf8' })
}

const mf = {
  operator: 'claude-code', method: 'page-preserving modernization (design only, original composition intact, no reflow, no GPU)',
  workdir: path.resolve(WD), level: LEVEL, colors: COLORS, source: path.relative(REPO, srcDir), pages: results.length,
  gradeVf, verdict: null,
  note: '원작 페이지 구성 100% 보존. 디자인만 현대화(무테두리+화이트포인트+디스크린+강채도+평면컬러). 문구는 page-letter 단계.',
}
fs.writeFileSync(path.join(outDir, 'page-modern.manifest.json'), JSON.stringify(mf, null, 2))
console.log(`\n✓ 구성 보존 현대화 — 페이지 ${results.filter((r) => r.ok).length}/${results.length} · ${outDir}`)
console.log(`  compare_preview.jpg (원작 | 결과) · page-modern.manifest.json`)
