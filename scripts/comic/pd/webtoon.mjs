// scripts/comic/pd/webtoon.mjs
//
// 웹툰 세로 리플로우 — PDCP 현대화(Claude Code/CPU 기반, GPU 모델 없음). 페이지 기반 원작 컷을
// 모바일 웹툰형 세로 스크롤 스트립으로 재구성한다. 원작 작화는 보존하고 "제시·포맷"만 현대화.
//   ① 각 컷에 개선 복원(황색 중화 + 디스크린 + 채도·샤픈) 적용 → ② 일정 폭(웹툰)으로 세로 스택 + 거터.
// Claude Code 오퍼레이터가 결과 스트립/프리뷰를 보고 폭·거터·복원 파라미터를 반복 조정(자기발전).
// webtoon.manifest.json 에 전 과정 기록(모니터링).
//
//   node scripts/comic/pd/webtoon.mjs --workdir work/<slug> [--width 900] [--gutter 30] [--bg 0xF5F4F1] [--limit N]

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')
const FF = process.env.FFMPEG_BIN || (fs.existsSync(path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe')) ? path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe') : 'ffmpeg')

const WD = arg('workdir')
const W = Number(arg('width', 900))
const G = Number(arg('gutter', 30))
const BG = arg('bg', '0xF5F4F1') // 중성 웹툰 배경(약간 웜 뉴트럴)
const LIMIT = arg('limit') ? Number(arg('limit')) : null
if (!WD || !fs.existsSync(WD)) { console.error(`--workdir <dir> 필요: ${WD}`); process.exit(2) }

const pm = JSON.parse(fs.readFileSync(path.join(WD, 'panels', 'panels.manifest.json'), 'utf8')).panels
let panels = [...pm].sort((a, b) => (a.pageOrder - b.pageOrder) || (a.panelIndex - b.panelIndex))
if (LIMIT) panels = panels.slice(0, LIMIT)
if (!panels.length) { console.error('컷 없음'); process.exit(1) }

const outDir = path.join(WD, 'webtoon')
const tmpDir = path.join(outDir, 'panels')
fs.mkdirSync(tmpDir, { recursive: true })

// 개선 복원(v3 계열) + 웹툰 폭 정규화 + 하단 거터. 원작 컷 파일을 직접 처리(작화 보존).
const restoreVf = 'eq=gamma_b=1.1:saturation=1.34:contrast=1.07,hqdn3d=2:2:5:5,unsharp=5:5:0.5:5:5:0.0'
const cleaned = []
for (const [i, p] of panels.entries()) {
  const src = path.isAbsolute(p.file) ? p.file : path.join(REPO, p.file)
  const inFile = fs.existsSync(src) ? src : path.join(WD, 'panels', path.basename(p.file))
  const out = path.join(tmpDir, `${String(i).padStart(3, '0')}.jpg`)
  const vf = `${restoreVf},scale=${W}:-1:flags=lanczos,pad=${W}:ih+${G}:(ow-iw)/2:0:color=${BG}`
  const r = spawnSync(FF, ['-y', '-i', inFile, '-vf', vf, '-q:v', '3', out], { encoding: 'utf8' })
  if (r.status === 0 && fs.existsSync(out)) cleaned.push(out)
  else console.error(`  ✗ 컷 ${i} 처리 실패`)
}
if (!cleaned.length) { console.error('처리된 컷 없음'); process.exit(1) }

// 세로 스택(vstack) — 폭이 모두 W 로 정규화됐으므로 안전.
const inputs = cleaned.flatMap((f) => ['-i', f])
const chain = cleaned.map((_, i) => `[${i}:v]`).join('')
const strip = path.join(outDir, 'strip.jpg')
const r2 = spawnSync(FF, ['-y', ...inputs, '-filter_complex', `${chain}vstack=inputs=${cleaned.length}[s]`, '-map', '[s]', '-q:v', '4', strip], { encoding: 'utf8' })
if (r2.status !== 0 || !fs.existsSync(strip)) { console.error(`✗ vstack 실패: ${(r2.stderr || '').split('\n').slice(-3).join(' ')}`); process.exit(1) }

// 평가용 프리뷰(폭 축소) — Claude Code 가 열어보기 좋게.
const preview = path.join(outDir, 'strip_preview.jpg')
spawnSync(FF, ['-y', '-i', strip, '-vf', 'scale=560:-1:flags=lanczos', '-q:v', '4', preview], { encoding: 'utf8' })

// ffprobe 대체: strip 해상도
const dim = (() => { const o = spawnSync(FF, ['-i', strip], { encoding: 'utf8' }).stderr || ''; return (o.match(/, (\d+x\d+)/) || [])[1] || '?' })()
const mf = {
  operator: 'claude-code', method: 'webtoon-vertical-reflow (CPU/ffmpeg, no GPU model)',
  workdir: path.resolve(WD), width: W, gutter: G, bg: BG, panels: cleaned.length,
  restoreVf, strip: path.relative(REPO, strip), preview: path.relative(REPO, preview), stripDim: dim,
  verdict: null, note: 'Claude Code 가 strip_preview 를 보고 폭·거터·복원 파라미터 반복 조정(자기발전)',
}
fs.writeFileSync(path.join(outDir, 'webtoon.manifest.json'), JSON.stringify(mf, null, 2))
console.log(`✓ 웹툰 스트립 — 컷 ${cleaned.length} · ${dim} · 폭${W}/거터${G}`)
console.log(`  strip: ${mf.strip}\n  preview: ${mf.preview} (평가용)`)
console.log('  → Claude Code 가 프리뷰를 열어 "모던한 세로 스크롤?" 판정 → 파라미터 반복(자기발전)')
