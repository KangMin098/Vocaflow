// scripts/design/style-gate.mjs
//
// 이미지 체계 삽화 검사 — brief Gate 5 자동 검사 · Gate 6 style-gate 의 1판. 규칙 정본 docs/design/03-system.md §3-9.
// 실행: node scripts/design/style-gate.mjs <svg 폴더> [--json <출력.json>]   (하나라도 FAIL 이면 exit 1)
//
// 삽화마다 재는 것:
//   L1  팔레트 칸 ≤ 5(선 --t1 · 면 --bg · 면 --bg2 · 무대 --grid-line/--bd · 액센트 --ju/--ju-wash) — 망각 계열은 --memory-* 허용
//       선 굵기 종류 ≤ 2(무대 · F1 데이터선 제외) · 액센트 면적 ≤ 10%(액센트 층 켜고/끈 픽셀 차) · <title> 있음
//   무대 동일성: <pattern> 24×24 · stroke var(--grid-line) · 무대 테두리 var(--bd) · rx 6 · 뼈대 층 main 있음
//   규칙: hex 리터럴 0 · 그라디언트 0 · 선 2px/3px 0(F1 데이터선 제외) · 큰 도형/무대 폭 60~85%
//   L3  금지 소재 낱말 0(title·글자·id) · 서체 Roobert/Reckless 0 · 새 색 ΔE2000 < 2 (Tines 목록) 0 — 예외 토큰 --bg · --bg2
//       경로 유사: Tines SVG 원본을 저장소에 두지 않으므로(brief A1) 비교 원본이 없으면 "원본 없음" 으로 기록한다
// 렌더는 저장소의 tokens.css + globals.css 를 읽는 임시 HTML 에서 한다(색 해석이 제품과 같다).

import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const req = createRequire(join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')

const dir = resolve(process.argv[2] ?? '')
if (!process.argv[2] || !existsSync(dir)) { console.error('사용: node scripts/design/style-gate.mjs <svg 폴더> [--json out.json]'); process.exit(2) }
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null

// docs/design/refs/tines/dna.md §10 — L3 목록(정확 일치 + ΔE2000 < 2)
const TINES = ['#FCF9F5', '#F3EFEA', '#5D38AE', '#714BD0', '#6741BF', '#542F9C', '#7A56E0', '#3F2374', '#452985', '#E4EEE6', '#ECE8FD', '#F5F2FB', '#FFEEDD', '#FFF1D1', '#FFC7E5', '#BEE9E4', '#F1ECF4', '#007F4A', '#D15C07', '#008784']
const EXEMPT_TOKENS = { '#FBFAF6': '--bg', '#F4F0E9': '--bg2' } // 조사 전부터 있던 토큰(03-system §3-9 · DD-31)
const FORBIDDEN = /꽃|덩굴|뿌리|식물|만화경|만다라|전지가위|가위|안테나|로봇|키오스크|신전|손|섬|캐릭터|얼굴|트로피|폭죽|flower|vine|robot|trophy|kaleido/i
const SLOT = { '--t1': '선', '--bg': '면(종이)', '--bg2': '면(그늘)', '--grid-line': '무대', '--bd': '무대', '--ju': '액센트', '--ju-wash': '액센트' }

function lab(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}
function de2000(h1, h2) {
  const [L1, a1, b1] = lab(h1), [L2, a2, b2] = lab(h2), d = Math.PI / 180
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, C1 = Math.hypot(ap1, b1), C2 = Math.hypot(ap2, b2)
  let hh1 = Math.atan2(b1, ap1) / d; if (hh1 < 0) hh1 += 360
  let hh2 = Math.atan2(b2, ap2) / d; if (hh2 < 0) hh2 += 360
  let dh = hh2 - hh1; if (C1 * C2 === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360
  const dL = L2 - L1, dC = C2 - C1, dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh * d) / 2)
  const Lm = (L1 + L2) / 2, Cpm = (C1 + C2) / 2
  let hm = hh1 + hh2; if (C1 * C2 !== 0) hm = Math.abs(hh1 - hh2) > 180 ? (hh1 + hh2 + 360) / 2 : (hh1 + hh2) / 2
  const T = 1 - 0.17 * Math.cos((hm - 30) * d) + 0.24 * Math.cos(2 * hm * d) + 0.32 * Math.cos((3 * hm + 6) * d) - 0.2 * Math.cos((4 * hm - 63) * d)
  const RC = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7)), RT = -Math.sin(2 * 30 * Math.exp(-(((hm - 275) / 25) ** 2)) * d) * RC
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cpm, SH = 1 + 0.015 * Cpm * T
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
}
const toHex = (s) => {
  const m = s.match(/[\d.]+/g).map(Number)
  const bg = [251, 250, 246] // 반투명은 --bg 위 합성
  const a = m.length === 4 ? m[3] : 1
  return '#' + [0, 1, 2].map((i) => Math.round(m[i] * a + bg[i] * (1 - a)).toString(16).padStart(2, '0')).join('').toUpperCase()
}

const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(join(ROOT, 'packages/design-tokens/src/tokens.css'))}">
<link rel="stylesheet" href="${pathToFileURL(join(ROOT, 'apps/web/src/app/globals.css'))}">
<link href="https://fonts.googleapis.com/css2?family=Hahmlet:wght@500&family=JetBrains+Mono&family=Lora:wght@500&display=block" rel="stylesheet">
<style>body{margin:0;background:var(--bg)}div{padding:8px}</style></head><body>
${files.map((f) => `<div data-file="${f}">${readFileSync(join(dir, f), 'utf8')}</div>`).join('\n')}</body></html>`
const tmp = join(tmpdir(), `style-gate-${process.pid}.html`)
writeFileSync(tmp, html)

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1400, height: 900 } })
await p.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' })
await p.evaluate(() => document.fonts.ready)
const results = []
for (const f of files) {
  const el = p.locator(`div[data-file="${f}"] > svg`)
  const raw = readFileSync(join(dir, f), 'utf8')
  const info = await el.evaluate((svg) => {
    const html = svg.outerHTML
    const vars = [...new Set([...html.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))]
    const pat = svg.querySelector('pattern')
    const stageRect = svg.querySelector('[data-layer=stage] rect[style*="url(#"]')
    const sw = new Set(), thick = []
    svg.querySelectorAll('*').forEach((e) => {
      if (e.closest('pattern') || e.closest('[data-layer=stage]') || e.hasAttribute('data-f1')) return
      const c = getComputedStyle(e)
      if (c.stroke && c.stroke !== 'none' && e.tagName !== 'text' && e.tagName !== 'g' && e.tagName !== 'svg') { sw.add(c.strokeWidth); if (parseFloat(c.strokeWidth) >= 2) thick.push(e.tagName) }
    })
    const cols = new Set()
    svg.querySelectorAll('*').forEach((e) => { if (e.closest('defs')) return; const c = getComputedStyle(e); for (const v of [c.fill, c.stroke]) if (v && v !== 'none' && !v.startsWith('url') && v !== 'rgb(0, 0, 0)') cols.add(v) })
    const texts = [...svg.querySelectorAll('text')].map((t) => t.textContent).join(' ')
    const fonts = [...new Set([...svg.querySelectorAll('text')].map((t) => getComputedStyle(t).fontFamily.split(',')[0].replace(/['"]/g, '')))]
    const vb = svg.viewBox.baseVal, main = svg.querySelector('[data-layer=main]')
    return {
      title: svg.querySelector('title')?.textContent ?? '', vars, sw: [...sw], thick, cols: [...cols], texts, fonts,
      stage: !!(pat && pat.getAttribute('width') === '24' && pat.getAttribute('height') === '24' && /var\(--grid-line\)/.test(pat.innerHTML) && stageRect && /var\(--bd\)/.test(stageRect.getAttribute('style')) && stageRect.getAttribute('rx') === '6'),
      mainRatio: main ? main.getBBox().width / vb.width : 0, size: `${vb.width}x${vb.height}`,
    }
  })
  const on = await el.screenshot()
  await el.evaluate((s) => s.querySelectorAll('[data-layer=accent]').forEach((g) => (g.style.visibility = 'hidden')))
  const off = await el.screenshot()
  const diff = await p.evaluate(async ([a, c]) => {
    const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u })
    const [i1, i2] = await Promise.all([load(a), load(c)])
    const cv = document.createElement('canvas'); cv.width = i1.width; cv.height = i1.height; const g = cv.getContext('2d')
    g.drawImage(i1, 0, 0); const d1 = g.getImageData(0, 0, cv.width, cv.height).data
    g.drawImage(i2, 0, 0); const d2 = g.getImageData(0, 0, cv.width, cv.height).data
    let n = 0; for (let j = 0; j < d1.length; j += 4) if (Math.abs(d1[j] - d2[j]) + Math.abs(d1[j + 1] - d2[j + 1]) + Math.abs(d1[j + 2] - d2[j + 2]) > 12) n++
    return n / (cv.width * cv.height)
  }, ['data:image/png;base64,' + on.toString('base64'), 'data:image/png;base64,' + off.toString('base64')])
  const slots = new Set(info.vars.filter((v) => SLOT[v]).map((v) => SLOT[v]))
  const extra = info.vars.filter((v) => !SLOT[v] && !/^--memory-/.test(v))
  const hexes = [...new Set(info.cols.map(toHex))]
  const exact = hexes.filter((h) => TINES.includes(h) && !EXEMPT_TOKENS[h])
  const near = []
  for (const h of hexes) for (const t of TINES) { const e = de2000(h, t); if (e < 2) near.push({ ours: h, tines: t, de: +e.toFixed(2), exempt: EXEMPT_TOKENS[h] ?? null }) }
  const r = {
    file: f, size: info.size, title: !!info.title, slots: slots.size, extraTokens: extra, memory: info.vars.some((v) => v.startsWith('--memory-')),
    strokeKinds: info.sw.length, strokes: info.sw, thick: info.thick.length, hex: (raw.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).length,
    gradient: /Gradient/.test(raw), stage: info.stage, mainRatio: +(info.mainRatio * 100).toFixed(0), accent: +(diff * 100).toFixed(2),
    forbidden: FORBIDDEN.test(info.title + ' ' + info.texts + ' ' + f), fonts: info.fonts, badFont: info.fonts.some((x) => /Roobert|Reckless/i.test(x)),
    exact: exact.length, nearNew: near.filter((n) => !n.exempt).length, nearExempt: near.filter((n) => n.exempt).map((n) => `${n.exempt}↔${n.tines} ${n.de}`),
  }
  r.fails = [
    !r.title && 'title', r.slots > 5 && 'slots>5', r.extraTokens.length && `token ${r.extraTokens}`, r.strokeKinds > 2 && 'strokes>2', r.thick && '2px+ line',
    r.hex && 'hex', r.gradient && 'gradient', !r.stage && 'stage', (r.mainRatio < 60 || r.mainRatio > 85) && `main ${r.mainRatio}%`, r.accent > 10 && 'accent>10%',
    r.forbidden && 'forbidden', r.badFont && 'font', r.exact && 'hex=Tines', r.nearNew && 'ΔE<2',
  ].filter(Boolean)
  results.push(r)
}
await b.close()

console.log('| 파일 | 규격 | title | 칸 | 선 종류 | 액센트 % | 큰 도형 % | 무대 | hex | 그라디언트 | 금지 소재 | 서체 | Tines 정확 | ΔE<2(새 색) | 판정 |')
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const r of results) {
  console.log(`| ${r.file.replace('.svg', '')} | ${r.size} | ${r.title ? '○' : '✗'} | ${r.slots}${r.memory ? '+memory' : ''} | ${r.strokeKinds} (${r.strokes.join('/')}) | ${r.accent} | ${r.mainRatio} | ${r.stage ? '○' : '✗'} | ${r.hex} | ${r.gradient ? '✗' : 0} | ${r.forbidden ? '✗' : 0} | ${r.fonts.join('·') || '—'} | ${r.exact} | ${r.nearNew} | ${r.fails.length ? 'FAIL ' + r.fails.join(',') : 'PASS'} |`)
}
const ex = [...new Set(results.flatMap((r) => r.nearExempt))]
console.log(`\n예외 토큰 근접(허용): ${ex.join(' · ') || '없음'} · 경로 유사: Tines SVG 원본 없음(brief A1) — 비교 대상 0`)
const failed = results.filter((r) => r.fails.length)
console.log(`\nPASS ${results.length - failed.length}/${results.length}`)
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2) + '\n')
process.exit(failed.length ? 1 : 0)
