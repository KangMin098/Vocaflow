// scripts/comic/pd/dialogue-below.mjs
//
// 비파괴 모던 대사 레이어 — PDCP 재레터링 피벗(Claude Code 작업 기반, GPU 모델 없음).
// 원작 위에 덮어쓰지 않는다(좌표 부정확·작화 훼손으로 반려). 대신 각 모던 컷 "아래"에
// 깨끗한 대사 바(모던 sans + i+1 재작성 대사)를 붙여 세로로 잇는다 — 웹툰 나레이션 거터 스타일 +
// 학습 레이어(선택가능 텍스트·TTS·i+1 을 웹 리더가 이 좌표 없는 대사로 그대로 렌더).
//   ① webtoon --modern 이 만든 flat-color 컷(작화 보존) ② 그 아래 refined 모던 대사 바(box 불필요).
// Claude Code 오퍼레이터가 결과를 보고 바 높이·폰트·여백 반복(자기발전). dialogue.manifest.json 기록(모니터링).
//
//   node scripts/comic/pd/dialogue-below.mjs --workdir work/<slug> [--width 900] [--limit N]

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')
const FF = process.env.FFMPEG_BIN || (fs.existsSync(path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe')) ? path.join(REPO, 'tools', 'ffmpeg', 'ffmpeg.exe') : 'ffmpeg')

const WD = arg('workdir')
const W = Number(arg('width', 900))
const LIMIT = arg('limit') ? Number(arg('limit')) : null
if (!WD || !fs.existsSync(WD)) { console.error(`--workdir <dir> 필요: ${WD}`); process.exit(2) }

const outDir = path.join(WD, 'dialogue')
const cardDir = path.join(outDir, 'cards')
fs.mkdirSync(cardDir, { recursive: true })
// 모던 클린 sans(나레이션/학습 바) + 볼드(강조).
const FONT = path.join(outDir, 'sans.ttf')
if (!fs.existsSync(FONT)) fs.copyFileSync('C:/Windows/Fonts/segoeui.ttf', FONT)

const pm = JSON.parse(fs.readFileSync(path.join(WD, 'panels', 'panels.manifest.json'), 'utf8')).panels
// refined(모던 대사) — box 없이 panel(id) 단위. intake id↔(pageOrder,panelIndex) 매핑으로 컷에 붙인다.
const refined = JSON.parse(fs.readFileSync(path.join(WD, 'bubbles.refined.manifest.json'), 'utf8')).panels
const dlgKey = (po, pi) => `${po}-${pi}`
// 잡음 대사 필터(OCR 파편 "7]" 등): 알파벳 2+ 단어 없거나 3자 미만이면 버린다.
const keepText = (t) => t && /[A-Za-z]{2,}/.test(t) && t.replace(/\s+/g, ' ').trim().length >= 3
const dlgMap = new Map(refined.map((p) => [dlgKey(p.pageOrder, p.panelIndex), (p.bubbles || []).map((b) => b.text).filter(keepText)]))

const modernPanelDir = path.join(WD, 'webtoon', 'panels') // flat-color 모던 컷(webtoon --modern 산출)
let panels = [...pm].sort((a, b) => (a.pageOrder - b.pageOrder) || (a.panelIndex - b.panelIndex))
if (LIMIT) panels = panels.slice(0, LIMIT)

const wrap = (t, maxChars) => {
  const words = t.split(' '); const lines = []; let cur = ''
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim() }
  if (cur) lines.push(cur); return lines
}
const esc = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:')

const dimsOf = (file) => { const o = spawnSync(FF, ['-i', file], { encoding: 'utf8' }).stderr || ''; const m = o.match(/, (\d+)x(\d+)/); return m ? { w: +m[1], h: +m[2] } : null }

const composed = []
let idx = 0
for (const p of panels) {
  // 모던 컷 우선(webtoon --modern), 없으면 원본 컷.
  const modern = path.join(modernPanelDir, `${String(idx).padStart(3, '0')}.jpg`)
  const raw = path.isAbsolute(p.file) ? p.file : path.join(REPO, p.file)
  const panelImg = fs.existsSync(modern) ? modern : (fs.existsSync(raw) ? raw : path.join(WD, 'panels', path.basename(p.file)))
  idx++
  if (!fs.existsSync(panelImg)) continue

  const dlg = dlgMap.get(dlgKey(p.pageOrder, p.panelIndex)) || []
  // 컷을 W 폭으로 정규화
  const panelN = path.join(cardDir, `p_${String(idx).padStart(3, '0')}.jpg`)
  spawnSync(FF, ['-y', '-i', panelImg, '-vf', `scale=${W}:-1:flags=lanczos`, '-q:v', '3', panelN], { encoding: 'utf8' })

  if (!dlg.length) { composed.push({ panel: panelN, dialogue: [], out: panelN }); continue }

  // 대사 바 생성: 흰 카드 + 좌측 강조 바(웹툰 느낌) + 모던 sans 텍스트.
  const fs2 = 30
  const maxChars = Math.floor((W - 120) / (fs2 * 0.5))
  const allLines = []
  for (const d of dlg) { for (const l of wrap(d, maxChars)) allLines.push(l); allLines.push('') } // 대사 간 빈 줄
  if (allLines[allLines.length - 1] === '') allLines.pop()
  // line_spacing=8 을 포함한 실제 줄 높이로 카드를 넉넉히(마지막 줄 잘림 방지).
  const padY = 36, lineH = fs2 + 16
  const cardH = padY * 2 + allLines.length * lineH
  const txtFile = path.join(cardDir, `t_${idx}.txt`); fs.writeFileSync(txtFile, allLines.join('\n'), 'utf8')
  const card = path.join(cardDir, `c_${String(idx).padStart(3, '0')}.jpg`)
  const cardVf = [
    `drawbox=x=0:y=0:w=${W}:h=${cardH}:color=0xFBFAF7:t=fill`,
    `drawbox=x=0:y=0:w=8:h=${cardH}:color=0x2E7D5A:t=fill`, // 좌측 forest 강조(디자인 토큰색)
    `drawtext=fontfile='${esc(FONT)}':textfile='${esc(txtFile)}':fontcolor=0x1A1A1A:fontsize=${fs2}:line_spacing=8:x=54:y=${padY}`,
  ].join(',')
  spawnSync(FF, ['-y', '-f', 'lavfi', '-i', `color=white:s=${W}x${cardH}`, '-vf', cardVf, '-frames:v', '1', '-q:v', '3', card], { encoding: 'utf8' })

  // 컷 + 카드 세로 스택
  const pd = dimsOf(panelN), cd = dimsOf(card)
  const stacked = path.join(cardDir, `s_${String(idx).padStart(3, '0')}.jpg`)
  if (pd && cd) {
    spawnSync(FF, ['-y', '-i', panelN, '-i', card, '-filter_complex', `[0:v][1:v]vstack=inputs=2[s]`, '-map', '[s]', '-q:v', '3', stacked], { encoding: 'utf8' })
    composed.push({ panel: panelN, dialogue: dlg, card, out: fs.existsSync(stacked) ? stacked : panelN })
  } else composed.push({ panel: panelN, dialogue: dlg, out: panelN })
}

// 전체 세로 스택 + 프리뷰
const gutter = 40, BG = '0xF5F4F1'
const padded = composed.map((c, i) => {
  const o = path.join(cardDir, `g_${String(i).padStart(3, '0')}.jpg`)
  spawnSync(FF, ['-y', '-i', c.out, '-vf', `pad=iw:ih+${gutter}:0:0:color=${BG}`, '-q:v', '3', o], { encoding: 'utf8' })
  return o
}).filter((f) => fs.existsSync(f))
const inputs = padded.flatMap((f) => ['-i', f])
const chain = padded.map((_, i) => `[${i}:v]`).join('')
const strip = path.join(outDir, 'strip.jpg')
spawnSync(FF, ['-y', ...inputs, '-filter_complex', `${chain}vstack=inputs=${padded.length}[s]`, '-map', '[s]', '-q:v', '4', strip], { encoding: 'utf8' })
const preview = path.join(outDir, 'strip_preview.jpg')
spawnSync(FF, ['-y', '-i', strip, '-vf', 'scale=560:-1:flags=lanczos', '-q:v', '4', preview], { encoding: 'utf8' })

const mf = {
  operator: 'claude-code', method: 'non-destructive modern dialogue layer (caption below panel, no overwrite, no GPU)',
  workdir: path.resolve(WD), width: W, font: 'segoeui.ttf', accent: '#2E7D5A',
  panels: composed.length, withDialogue: composed.filter((c) => c.dialogue.length).length,
  strip: path.relative(REPO, strip), preview: path.relative(REPO, preview),
  note: '원작 위 덮어쓰기 반려 → 컷 아래 클린 모던 대사 바(refined i+1). 좌표 불필요. 웹 리더가 동일 대사를 HTML 로 렌더(선택가능·TTS·i+1).',
  verdict: null,
}
fs.writeFileSync(path.join(outDir, 'dialogue.manifest.json'), JSON.stringify(mf, null, 2))
// 임시 txt 정리
for (const f of fs.readdirSync(cardDir)) if (/^t_.*\.txt$/.test(f)) fs.unlinkSync(path.join(cardDir, f))
console.log(`✓ 대사 레이어 — 컷 ${composed.length}(대사 ${mf.withDialogue}) · ${path.relative(REPO, strip)}`)
console.log(`  preview: ${path.relative(REPO, preview)}`)
console.log('  → Claude Code 가 프리뷰를 열어 "모던 웹툰+대사?" 판정 → 바 높이·폰트·여백 반복(자기발전)')
