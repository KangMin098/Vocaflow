// scripts/comic/pd/page-letter.mjs
//
// 구성 보존 모던 레터링 — PDCP(Claude Code 작업 기반, GPU 모델 없음).
// 원작 페이지 구성 그대로 두고(page-modern 결과 위) "문구"만 현대화한다: 원작 말풍선/캡션 자리에
// 깨끗한 모던 말풍선(흰 배경+둥근 느낌+모던 sans) + i+1 재작성 텍스트를 얹어 옛 손글씨를 대체한다.
//
// ★ 좌표는 OCR 이 아니라 **Claude Code 오퍼레이터가 이미지를 눈으로 보고 지정**한다(정밀). 스펙 파일:
//   work/<slug>/letter.spec.json = { "<page>": [ {type:'balloon'|'caption', x,y,w,h, text}, ... ] }  (x/y/w/h = 0~1 비율)
//
//   node scripts/comic/pd/page-letter.mjs --workdir work/<slug> [--page 0004]

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')
const FF = process.env.FFMPEG_BIN || (fs.existsSync(path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe')) ? path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe') : 'ffmpeg')

const WD = arg('workdir')
const ONLY = arg('page', null)
if (!WD || !fs.existsSync(WD)) { console.error(`--workdir <dir> 필요: ${WD}`); process.exit(2) }
const specFile = path.join(WD, 'letter.spec.json')
if (!fs.existsSync(specFile)) { console.error(`letter.spec.json 없음: ${specFile} — 오퍼레이터가 좌표+대사를 작성해야 함`); process.exit(2) }
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'))

const outDir = path.join(WD, 'page-letter')
fs.mkdirSync(outDir, { recursive: true })
const FONT = path.join(outDir, 'sans.ttf'); if (!fs.existsSync(FONT)) fs.copyFileSync('C:/Windows/Fonts/segoeui.ttf', FONT)
const FONTB = path.join(outDir, 'sansb.ttf'); if (!fs.existsSync(FONTB)) fs.copyFileSync('C:/Windows/Fonts/segoeuib.ttf', FONTB)
const esc = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:')
const dimsOf = (f) => { const o = spawnSync(FF, ['-i', f], { encoding: 'utf8' }).stderr || ''; const m = o.match(/, (\d+)x(\d+)/); return m ? { w: +m[1], h: +m[2] } : null }
const wrap = (t, mc) => { const w = t.split(' '); const L = []; let c = ''; for (const x of w) { if ((c + ' ' + x).trim().length > mc && c) { L.push(c); c = x } else c = (c + ' ' + x).trim() } if (c) L.push(c); return L }

const pages = Object.keys(spec).filter((p) => !ONLY || p === ONLY)
const records = []
for (const page of pages) {
  const modern = path.join(WD, 'page-modern', `${page}.jpg`)
  const inFile = fs.existsSync(modern) ? modern : path.join(WD, 'restored', `${page}.jpg`)
  if (!fs.existsSync(inFile)) { console.error(`  ✗ 페이지 이미지 없음: ${page}`); continue }
  const dim = dimsOf(inFile); if (!dim) continue
  const { w: W, h: H } = dim
  const balloons = spec[page]
  const filters = []
  balloons.forEach((b, bi) => {
    const x0 = Math.round(b.x * W), y0 = Math.round(b.y * H), bw = Math.round(b.w * W), bh = Math.round(b.h * H)
    const isCap = b.type === 'caption'
    // 옛 레터링 덮기: 흰 채움(캡션은 살짝 웜) + 얇은 테두리(모던 말풍선 윤곽)
    const fill = isCap ? '0xFBFAF7' : 'white'
    filters.push(`drawbox=x=${x0}:y=${y0}:w=${bw}:h=${bh}:color=${fill}@1:t=fill`)
    filters.push(`drawbox=x=${x0}:y=${y0}:w=${bw}:h=${bh}:color=0x2A2A2A@0.9:t=${Math.max(2, Math.round(H * 0.0012))}`)
    if (isCap) filters.push(`drawbox=x=${x0}:y=${y0}:w=${Math.max(6, Math.round(W * 0.005))}:h=${bh}:color=0x2E7D5A:t=fill`) // 캡션 좌측 forest 강조
    // 텍스트: 박스에 맞춰 폰트/줄바꿈 근사
    let fsz = Math.max(16, Math.min(Math.round(bh * (isCap ? 0.32 : 0.42)), Math.round(H * 0.02)))
    let mc = Math.max(8, Math.floor((bw - (isCap ? W * 0.02 : 0)) / (fsz * 0.5)))
    let lines = wrap(b.text, mc)
    while (lines.length * fsz * 1.3 > bh - 12 && fsz > 12) { fsz -= 1; mc = Math.max(8, Math.floor(bw / (fsz * 0.5))); lines = wrap(b.text, mc) }
    const tf = path.join(outDir, `t_${page}_${bi}.txt`); fs.writeFileSync(tf, lines.join('\n'), 'utf8')
    const padL = isCap ? Math.round(W * 0.014) : 0
    filters.push(`drawtext=fontfile='${esc(isCap ? FONT : FONTB)}':textfile='${esc(tf)}':fontcolor=0x1A1A1A:fontsize=${fsz}:line_spacing=5:x=${x0}+${padL}+(${bw}-${padL}-text_w)/2:y=${y0}+(${bh}-text_h)/2`)
  })
  const out = path.join(outDir, `${page}.jpg`)
  const r = spawnSync(FF, ['-y', '-i', inFile, '-vf', filters.join(','), '-q:v', '3', out], { encoding: 'utf8' })
  if (r.status !== 0 || !fs.existsSync(out)) { console.error(`  ✗ ${page} 레터링 실패: ${(r.stderr || '').split('\n').slice(-2).join(' ')}`); continue }
  console.log(`  ✓ ${page} — 모던 레터링 ${balloons.length}개`)
  // 원작↔결과 병치
  const cmp = path.join(outDir, `compare_${page}.jpg`)
  spawnSync(FF, ['-y', '-i', path.join(WD, 'restored', `${page}.jpg`), '-i', out, '-filter_complex', `[0]scale=-1:1000,pad=iw+4:ih:0:0:color=0xCCCCCC[a];[1]scale=-1:1000[b];[a][b]hstack=inputs=2[s]`, '-map', '[s]', '-q:v', '3', cmp], { encoding: 'utf8' })
  records.push({ page, balloons: balloons.length, out: path.relative(REPO, out), compare: path.relative(REPO, cmp) })
}
for (const f of fs.readdirSync(outDir)) if (/^t_.*\.txt$/.test(f)) fs.unlinkSync(path.join(outDir, f))
fs.writeFileSync(path.join(outDir, 'page-letter.manifest.json'), JSON.stringify({ operator: 'claude-code', method: 'in-place modern lettering (operator-placed coords, no OCR, no GPU)', pages: records, verdict: null, note: '좌표=오퍼레이터 육안 지정(정밀). 구성 보존+디자인(page-modern)+문구(모던 말풍선) 모두 현대화.' }, null, 2))
console.log(`\n✓ 구성 보존 모던 레터링 — ${records.length}p · ${outDir}`)
