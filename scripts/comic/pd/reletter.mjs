// scripts/comic/pd/reletter.mjs
//
// HTML/CPU 재레터링 — PDCP 현대화의 마지막 레버(Claude Code 작업 기반, GPU 모델 없음).
// 낡은 손 레터링 말풍선을 "깨끗한 모던 말풍선 + 클린 폰트"로 덮어 재조판한다.
//   ① bubbles.local 의 말풍선 box(정규화 좌표)+원문을 읽어 ② 각 컷 이미지 위에
//   흰 말풍선(box 를 살짝 확장해 구 레터링을 덮음) + 모던 폰트(comicbd) 텍스트를 ffmpeg 로 합성.
// 원작 작화는 보존하고 "레터링(제시)"만 현대화한다. 결과를 Claude Code 오퍼레이터가 보고 반복(자기발전).
// reletter.manifest.json 에 좌표·텍스트·판정 기록(모니터링) — 동일 좌표를 웹 리더 HTML 오버레이도 재사용.
//
//   node scripts/comic/pd/reletter.mjs --workdir work/<slug> [--limit N] [--strip]
//
// 재레터링 원칙: box↔text 1:1 인 bubbles.local 을 쓴다(refined 는 병합되며 box 를 잃음).
//   잡음 필터(1토큰·알파벳 없음·박스 과소)는 건너뛴다. 텍스트는 문장부호 정리 + 대소문자 정규화.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const has = (n) => process.argv.includes(`--${n}`)
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')
const FF = process.env.FFMPEG_BIN || (fs.existsSync(path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe')) ? path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe') : 'ffmpeg')

const WD = arg('workdir')
const LIMIT = arg('limit') ? Number(arg('limit')) : null
if (!WD || !fs.existsSync(WD)) { console.error(`--workdir <dir> 필요: ${WD}`); process.exit(2) }

// 폰트: comicbd(클린 코믹 볼드) → 재레터링 디렉터리로 복사해 ffmpeg fontfile 경로 문제를 피한다.
const outDir = path.join(WD, 'reletter')
const cutDir = path.join(outDir, 'panels')
fs.mkdirSync(cutDir, { recursive: true })
const FONT_SRC = 'C:/Windows/Fonts/comicbd.ttf'
const FONT = path.join(outDir, 'letter.ttf')
if (!fs.existsSync(FONT)) fs.copyFileSync(FONT_SRC, FONT)

const pm = JSON.parse(fs.readFileSync(path.join(WD, 'panels', 'panels.manifest.json'), 'utf8')).panels
const bl = JSON.parse(fs.readFileSync(path.join(WD, 'bubbles.local.manifest.json'), 'utf8')).panels
const bubbleKey = (po, pi) => `${po}-${pi}`
const bubbleMap = new Map(bl.map((p) => [bubbleKey(p.pageOrder, p.panelIndex), p.bubbles || []]))

// 잡음 필터 + 텍스트 정리(모던 조판용).
const clean = (t) => t.replace(/\s+/g, ' ').trim()
const hasAlphaWord = (t) => /[A-Za-z]{2,}/.test(t)
const keepBubble = (b) => b.box && b.box.w >= 0.05 && b.box.h >= 0.02 && hasAlphaWord(b.text || '') && clean(b.text).length >= 3
// 대소문자 정규화: 전부 대문자(구 레터링) → 문장 케이스로. 고유명사 보존은 못하지만 가독은 확 오름.
const toSentence = (t) => {
  const s = clean(t)
  if (!/[a-z]/.test(s)) { // 전부 대문자면 문장 케이스
    return s.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase())
  }
  return s
}
// 폭 기준 그리디 줄바꿈(글자 수 추정).
const wrap = (t, maxChars) => {
  const words = t.split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w }
    else cur = (cur + ' ' + w).trim()
  }
  if (cur) lines.push(cur)
  return lines
}

let panels = [...pm].sort((a, b) => (a.pageOrder - b.pageOrder) || (a.panelIndex - b.panelIndex))
if (LIMIT) panels = panels.slice(0, LIMIT)

const dimsOf = (file) => {
  const o = spawnSync(FF, ['-i', file], { encoding: 'utf8' }).stderr || ''
  const m = o.match(/, (\d+)x(\d+)/)
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null
}

const records = []
let idx = 0
for (const p of panels) {
  const src = path.isAbsolute(p.file) ? p.file : path.join(REPO, p.file)
  const inFile = fs.existsSync(src) ? src : path.join(WD, 'panels', path.basename(p.file))
  if (!fs.existsSync(inFile)) { console.error(`  ✗ 컷 파일 없음: ${inFile}`); continue }
  const bubbles = (bubbleMap.get(bubbleKey(p.pageOrder, p.panelIndex)) || []).filter(keepBubble)
  const out = path.join(cutDir, `${String(idx).padStart(3, '0')}.jpg`)
  idx++
  if (!bubbles.length) { fs.copyFileSync(inFile, out); records.push({ page: p.page, panelIndex: p.panelIndex, bubbles: 0, out: path.relative(REPO, out) }); continue }

  const dim = dimsOf(inFile)
  if (!dim) { fs.copyFileSync(inFile, out); continue }
  const { w: W, h: H } = dim

  const filters = []
  const drawn = []
  bubbles.forEach((b, bi) => {
    const bx = b.box
    // 구 레터링을 덮도록 box 를 살짝 확장(패딩) + 화면 경계 클램프.
    const pad = 0.012
    const x0 = Math.max(0, (bx.x - pad)) * W
    const y0 = Math.max(0, (bx.y - pad)) * H
    const bw = Math.min(1, bx.w + pad * 2) * W
    const bh = Math.min(1, bx.h + pad * 2) * H
    const text = toSentence(b.text)
    // 폰트 크기: 박스 높이/줄수에 맞춤. 줄수는 폭 기준 추정으로 반복 근사.
    let fs2 = Math.max(14, Math.min(46, Math.round(bh * 0.62)))
    let maxChars = Math.max(6, Math.floor(bw / (fs2 * 0.58)))
    let lines = wrap(text, maxChars)
    // 줄수가 박스 높이를 넘으면 폰트 축소
    while (lines.length * fs2 * 1.25 > bh && fs2 > 12) { fs2 -= 2; maxChars = Math.max(6, Math.floor(bw / (fs2 * 0.58))); lines = wrap(text, maxChars) }
    const wrapped = lines.join('\n')
    const txtFile = path.join(outDir, `t_${idx}_${bi}.txt`)
    fs.writeFileSync(txtFile, wrapped, 'utf8')
    // 흰 말풍선(약간 둥근 느낌은 라이더 HTML 이 담당 — 여기선 클린 흰 박스로 구 레터링 덮음)
    filters.push(`drawbox=x=${Math.round(x0)}:y=${Math.round(y0)}:w=${Math.round(bw)}:h=${Math.round(bh)}:color=white@0.96:t=fill`)
    // 검은 테두리(모던 말풍선 윤곽)
    filters.push(`drawbox=x=${Math.round(x0)}:y=${Math.round(y0)}:w=${Math.round(bw)}:h=${Math.round(bh)}:color=black@0.85:t=3`)
    // 모던 폰트 텍스트(중앙 정렬)
    const ff = FONT.replace(/\\/g, '/').replace(/:/g, '\\:')
    const tf = txtFile.replace(/\\/g, '/').replace(/:/g, '\\:')
    filters.push(`drawtext=fontfile='${ff}':textfile='${tf}':fontcolor=black:fontsize=${fs2}:line_spacing=4:x=${Math.round(x0)}+(${Math.round(bw)}-text_w)/2:y=${Math.round(y0)}+(${Math.round(bh)}-text_h)/2`)
    drawn.push({ text, box: bx, fontsize: fs2, lines: lines.length })
  })

  const r = spawnSync(FF, ['-y', '-i', inFile, '-vf', filters.join(','), '-q:v', '3', out], { encoding: 'utf8' })
  if (r.status !== 0 || !fs.existsSync(out)) {
    console.error(`  ✗ 컷 ${p.page}-${p.panelIndex} 재레터링 실패: ${(r.stderr || '').split('\n').slice(-2).join(' ')}`)
    fs.copyFileSync(inFile, out)
    records.push({ page: p.page, panelIndex: p.panelIndex, bubbles: bubbles.length, error: true, out: path.relative(REPO, out) })
  } else {
    console.log(`  ✓ ${p.page}-${p.panelIndex}  말풍선 ${drawn.length} 재레터링`)
    records.push({ page: p.page, panelIndex: p.panelIndex, bubbles: drawn.length, drawn, out: path.relative(REPO, out) })
  }
}

// 임시 txt 정리
for (const f of fs.readdirSync(outDir)) if (/^t_.*\.txt$/.test(f)) fs.unlinkSync(path.join(outDir, f))

const mf = {
  operator: 'claude-code',
  method: 'html/cpu re-lettering (ffmpeg drawbox+drawtext, comicbd, no GPU model)',
  workdir: path.resolve(WD), font: 'comicbd.ttf', panels: records.length,
  reletteredBubbles: records.reduce((s, r) => s + (r.drawn ? r.drawn.length : 0), 0),
  records, verdict: null,
  note: 'box=bubbles.local(1:1). 모던 흰 말풍선+검정테두리+comicbd. 동일 좌표를 웹 리더 HTML 오버레이가 재사용.',
}
fs.writeFileSync(path.join(outDir, 'reletter.manifest.json'), JSON.stringify(mf, null, 2))
console.log(`\n✓ 재레터링 — 컷 ${records.length} · 말풍선 ${mf.reletteredBubbles} · ${outDir}`)

// --strip: 재레터링된 컷을 모던 웹툰과 동일 폭/거터로 세로 스택(평가용 프리뷰)
if (has('strip')) {
  const W = Number(arg('width', 900)), G = Number(arg('gutter', 60)), BG = '0xF5F4F1'
  const norm = records.map((r, i) => {
    const inp = path.join(REPO, r.out)
    const o = path.join(cutDir, `s_${String(i).padStart(3, '0')}.jpg`)
    spawnSync(FF, ['-y', '-i', inp, '-vf', `scale=${W}:-1:flags=lanczos,pad=${W}:ih+${G}:(ow-iw)/2:0:color=${BG}`, '-q:v', '3', o], { encoding: 'utf8' })
    return o
  }).filter((f) => fs.existsSync(f))
  const inputs = norm.flatMap((f) => ['-i', f])
  const chain = norm.map((_, i) => `[${i}:v]`).join('')
  const strip = path.join(outDir, 'strip.jpg')
  spawnSync(FF, ['-y', ...inputs, '-filter_complex', `${chain}vstack=inputs=${norm.length}[s]`, '-map', '[s]', '-q:v', '4', strip], { encoding: 'utf8' })
  const preview = path.join(outDir, 'strip_preview.jpg')
  spawnSync(FF, ['-y', '-i', strip, '-vf', 'scale=560:-1:flags=lanczos', '-q:v', '4', preview], { encoding: 'utf8' })
  console.log(`  strip: ${path.relative(REPO, strip)}  preview: ${path.relative(REPO, preview)}`)
}
console.log('  → Claude Code 가 결과를 열어 "모던 레터링?" 판정 → 패딩·폰트·정렬 반복(자기발전)')
