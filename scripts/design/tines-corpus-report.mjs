#!/usr/bin/env node
// scripts/design/tines-corpus-report.mjs
//
// tines-corpus.mjs 가 모은 페이지(tmp/tines-corpus/pages/*/data.json)를 **수치로만** 묶는다(DD-68).
//   · 색 면 팔레트 — 바탕색(sRGB 근사) · 그 위 글자색 · 모서리 · 전폭/카드 · 몇 페이지에서 · 면적
//   · 템플릿별 색 계열 비중 — 「보라만 옮겼다」(tines-mapping §12)를 템플릿 단위로 다시 잰다
//   · 글자색 분포(글자 수)
//   · 그림 규격 — 역할(hero · band · card · spot · inline · logo)별 크기 분위 · 비율 · 가로 위치 · 담긴 면 · 형식
//   · 역할별 모음판(tmp — 캡처에서 잘라 붙인 것이라 원본 취급, 저장소에 넣지 않는다)
// 산출: docs/design/refs/tines/corpus-summary.md · corpus.json(집계만)
//
//   node scripts/design/tines-corpus-report.mjs            # 요약 + 모음판
//   node scripts/design/tines-corpus-report.mjs --no-sheets

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, chromium } from './lib/ref-page.mjs'

const SRC = path.join(ROOT, 'tmp/tines-corpus/pages')
const SHEETS = path.join(ROOT, 'tmp/tines-corpus/sheets')
const OUT_MD = path.join(ROOT, 'docs/design/refs/tines/corpus-summary.md')
const OUT_JSON = path.join(ROOT, 'docs/design/refs/tines/corpus.json')
const NO_SHEETS = process.argv.includes('--no-sheets')

// ── 색 ──────────────────────────────────────────────────────────────
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
/** CSS 색 문자열 → [r,g,b,a] sRGB 0–255. display-p3 는 XYZ(D65)를 거쳐 sRGB 로 옮기고 잘라 낸다. */
function parse(c) {
  if (!c) return null
  let m = c.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]
  m = c.match(/^color\(display-p3\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+))?\)/)
  if (m) {
    const [r, g, b] = [+m[1], +m[2], +m[3]].map(lin)
    const X = 0.4865709 * r + 0.2656677 * g + 0.1982173 * b
    const Y = 0.2289746 * r + 0.6917385 * g + 0.0792869 * b
    const Z = 0.0451134 * g + 1.0439444 * b
    const s = [3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.969266 * X + 1.8760108 * Y + 0.041556 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z]
    return [...s.map((v) => Math.round(Math.min(1, Math.max(0, gam(Math.max(0, v)))) * 255)), m[4] === undefined ? 1 : +m[4]]
  }
  return null
}
const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const hex = (p) => '#' + p.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  const s = mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn)
  let h = 0
  if (mx !== mn) {
    if (mx === r) h = ((g - b) / (mx - mn)) % 6
    else if (mx === g) h = (b - r) / (mx - mn) + 2
    else h = (r - g) / (mx - mn) + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s, l]
}
function family(p) {
  const [h, s, l] = hsl(p)
  // 크림 바탕(#fcf9f5 · #f9f5ef — 따뜻한 색상 · 명도 94%↑)은 무채로 본다(라벤더 #ece8fd 는 보라로 남긴다) — 안 그러면 페이지 바탕이 「주황 면」으로 잡힌다
  if (s < 0.12 || (l > 0.94 && h >= 15 && h < 60)) return l > 0.9 ? '무채 밝음' : l < 0.2 ? '검정' : '회색'
  const hue = h < 15 || h >= 345 ? '빨강' : h < 45 ? '주황' : h < 70 ? '노랑' : h < 100 ? '라임' : h < 165 ? '초록' : h < 200 ? '청록' : h < 250 ? '파랑' : h < 290 ? '보라' : '자홍'
  return hue + (l > 0.8 ? ' 옅음' : l < 0.35 ? ' 짙음' : ' 진함')
}
const isPurple = (f) => /^(보라|파랑)/.test(f)
const rel = ([r, g, b]) => { const f = (v) => lin(v / 255); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const contrast = (a, b) => { const [x, y] = [rel(a), rel(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

// ── 읽기 ────────────────────────────────────────────────────────────
const pages = fs.existsSync(SRC)
  ? fs.readdirSync(SRC).map((d) => path.join(SRC, d, 'data.json')).filter((f) => fs.existsSync(f)).map((f) => ({ dir: path.dirname(f), ...JSON.parse(fs.readFileSync(f, 'utf8')) }))
  : []
if (!pages.length) { console.error('수집된 페이지가 없다 — 먼저 tines-corpus.mjs'); process.exit(2) }
const templates = [...new Set(pages.map((p) => p.template))].sort()

// ── 색 면 ───────────────────────────────────────────────────────────
const pal = new Map() // hex → {area, pages:Set, full, card, radius{}, ink{}}
const famByTpl = new Map()
for (const p of pages) {
  const docArea = 1280 * p.docH
  const fam = famByTpl.get(p.template) ?? {}
  // 바깥 면만 센다 — 안쪽 면이 바깥 면적을 두 번 세지 않게, 면적 합이 문서를 넘으면 비율로 누른다
  for (const s of p.surfaces) {
    const c = parse(s.bg)
    if (!c || c[3] < 0.5) continue
    const k = hex(c)
    const e = pal.get(k) ?? { rgb: c, area: 0, pages: new Set(), full: 0, card: 0, radius: {}, ink: {} }
    const a = s.w * s.h
    e.area += a
    e.pages.add(p.url)
    s.full ? e.full++ : e.card++
    e.radius[s.radius] = (e.radius[s.radius] || 0) + 1
    const ic = parse(s.ink)
    if (ic) { const ik = hex(ic); e.ink[ik] = (e.ink[ik] || 0) + 1 }
    pal.set(k, e)
    const f = family(c)
    fam[f] = (fam[f] || 0) + a / docArea / pages.filter((q) => q.template === p.template).length
  }
  famByTpl.set(p.template, fam)
}
const palette = [...pal.entries()].map(([k, e]) => {
  const inkTop = Object.entries(e.ink).sort((a, b) => b[1] - a[1])[0]?.[0]
  const radTop = Object.entries(e.radius).sort((a, b) => b[1] - a[1])[0]?.[0]
  return { hex: k, family: family(e.rgb), pages: e.pages.size, areaMpx: +(e.area / 1e6).toFixed(2), full: e.full, card: e.card, radius: radTop, ink: inkTop, contrast: inkTop ? +contrast(e.rgb, fromHex(inkTop)).toFixed(1) : null }
}).filter((x) => x.pages >= 2).sort((a, b) => b.pages * b.areaMpx - a.pages * a.areaMpx)

// ── 글자색 ──────────────────────────────────────────────────────────
const inkAll = {}
for (const p of pages) for (const [c, n] of Object.entries(p.inks)) { const x = parse(c); if (x) { const k = hex(x); inkAll[k] = (inkAll[k] || 0) + n } }
const inkTotal = Object.values(inkAll).reduce((a, b) => a + b, 0)
const inks = Object.entries(inkAll).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, n]) => ({ hex: k, family: family(fromHex(k)), share: +((n / inkTotal) * 100).toFixed(1) }))

// ── 그림 ────────────────────────────────────────────────────────────
const q = (arr, t) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(t * s.length))] }
const ext = (s) => (s.match(/\.(svg|png|webp|jpe?g|gif|avif|mp4|webm)(?:[?#&%]|$)/i)?.[1] ?? (s.startsWith('data:') ? 'data' : s ? '기타' : '없음')).toLowerCase()
const ROLES = ['hero', 'band', 'card', 'spot', 'inline', 'logo']
const vis = pages.flatMap((p) => p.visuals.map((v) => ({ ...v, template: p.template, page: p.url, dir: p.dir, docH: p.docH })))
// UI 조각(아이콘·화살표) — 40–64px 의 인라인 svg 는 삽화가 아니다
const isIcon = (v) => v.kind === 'svg' && Math.max(v.w, v.h) <= 64
const art = vis.filter((v) => !isIcon(v))
const byRole = {}
for (const r of ROLES) {
  const xs = art.filter((v) => v.role === r)
  if (!xs.length) continue
  const kinds = {}; const exts = {}; const pos = { 왼쪽: 0, 가운데: 0, 오른쪽: 0 }; const surf = {}
  for (const v of xs) {
    kinds[v.kind] = (kinds[v.kind] || 0) + 1
    const e = ext(v.src); exts[e] = (exts[e] || 0) + 1
    const cx = v.x + v.w / 2
    pos[cx < 1280 * 0.4 ? '왼쪽' : cx > 1280 * 0.6 ? '오른쪽' : '가운데']++
    const sc = v.surface ? parse(v.surface.bg) : null
    const sf = sc ? family(sc) : '페이지 바탕'
    surf[sf] = (surf[sf] || 0) + 1
  }
  const top = (o, n = 5) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${k} ${Math.round((c / xs.length) * 100)}%`).join(' · ')
  byRole[r] = {
    n: xs.length,
    pages: new Set(xs.map((v) => v.page)).size,
    uniqueSrc: new Set(xs.map((v) => v.src).filter(Boolean)).size,
    w: [q(xs.map((v) => v.w), 0.1), q(xs.map((v) => v.w), 0.5), q(xs.map((v) => v.w), 0.9)],
    h: [q(xs.map((v) => v.h), 0.1), q(xs.map((v) => v.h), 0.5), q(xs.map((v) => v.h), 0.9)],
    aspect: q(xs.map((v) => v.w / v.h), 0.5).toFixed(2),
    kinds: top(kinds), exts: top(exts), pos: top(pos, 3), surface: top(surf, 6),
    perPage: +(xs.length / pages.length).toFixed(1),
  }
}
const perTpl = templates.map((t) => {
  const ps = pages.filter((p) => p.template === t)
  const xs = art.filter((v) => v.template === t)
  const cnt = Object.fromEntries(ROLES.map((r) => [r, +(xs.filter((v) => v.role === r).length / ps.length).toFixed(1)]))
  const fam = famByTpl.get(t) ?? {}
  const tot = Object.values(fam).reduce((a, b) => a + b, 0)
  const purple = Object.entries(fam).filter(([k]) => isPurple(k)).reduce((a, [, v]) => a + v, 0)
  const other = Object.entries(fam).filter(([k]) => !isPurple(k) && !/무채|회색|검정/.test(k)).reduce((a, [, v]) => a + v, 0)
  const topFam = Object.entries(fam).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}`).join(' · ')
  return { template: t, pages: ps.length, docH: Math.round(ps.reduce((a, p) => a + p.docH, 0) / ps.length), surfacePct: +(tot * 100).toFixed(0), purplePct: +(purple * 100).toFixed(0), otherPct: +(other * 100).toFixed(0), topFam, ...cnt }
})

// ── 쓰기 ────────────────────────────────────────────────────────────
const md = []
md.push('<!-- 생성물: scripts/design/tines-corpus-report.mjs — 손으로 고치지 말 것 -->')
md.push(`# Tines 코퍼스 요약 (${pages.length}페이지 · 템플릿 ${templates.length})`)
md.push('')
md.push(`> 수집 \`scripts/design/tines-corpus.mjs\`(사이트맵 → 템플릿별 선정 · 1280 전체) · 원본은 \`tmp/tines-corpus/\`(저장소 밖). 색은 계산 스타일을 sRGB 로 옮긴 근사값.`)
md.push(`> 그림 ${vis.length}개 중 64px 이하 인라인 svg(아이콘) ${vis.length - art.length}개는 삽화에서 뺐다. 역할은 위치·크기로 추정한 것이다(hero = 첫 900px 안 폭 280↑ · band = 폭 80%↑ · spot = 긴 변 180↓ · card = 폭 62% 미만 칠한 면 안).`)
md.push('')
md.push('## 1. 색 면 팔레트 (2페이지 이상에 나온 바탕색, 페이지 수 × 면적 순)')
md.push('')
md.push('| 바탕 | 계열 | 페이지 | 면적(Mpx) | 전폭/카드 | 흔한 모서리 | 위 글자 | 대비 |')
md.push('|---|---|---|---|---|---|---|---|')
for (const s of palette.slice(0, 48)) md.push(`| \`${s.hex}\` | ${s.family} | ${s.pages} | ${s.areaMpx} | ${s.full}/${s.card} | ${s.radius} | \`${s.ink ?? '—'}\` | ${s.contrast ?? '—'} |`)
md.push('')
md.push('## 2. 템플릿별 색 면 비중 (문서 면적 대비 %, 페이지 평균)')
md.push('')
md.push('| 템플릿 | 페이지 | 평균 길이 | 칠한 면 | 보라·파랑 | **그 외 색** | 상위 계열 | hero | band | card | spot | inline | logo (페이지당 그림 수) |')
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const t of perTpl) md.push(`| ${t.template} | ${t.pages} | ${t.docH} | ${t.surfacePct} | ${t.purplePct} | **${t.otherPct}** | ${t.topFam} | ${t.hero} | ${t.band} | ${t.card} | ${t.spot} | ${t.inline} | ${t.logo} |`)
md.push('')
md.push('## 3. 글자색 (전 페이지 글자 수 비중)')
md.push('')
md.push('| 글자색 | 계열 | % |')
md.push('|---|---|---|')
for (const i of inks) md.push(`| \`${i.hex}\` | ${i.family} | ${i.share} |`)
md.push('')
md.push('## 4. 그림 규격 — 역할별')
md.push('')
md.push('| 역할 | 개수 | 페이지 | 페이지당 | 서로 다른 파일 | 폭 p10/중앙/p90 | 높이 p10/중앙/p90 | 비율(중앙) | 가로 위치 | 형식 | 담긴 면 |')
md.push('|---|---|---|---|---|---|---|---|---|---|---|')
for (const [r, v] of Object.entries(byRole)) md.push(`| ${r} | ${v.n} | ${v.pages} | ${v.perPage} | ${v.uniqueSrc} | ${v.w.join(' / ')} | ${v.h.join(' / ')} | ${v.aspect} | ${v.pos} | ${v.exts} | ${v.surface} |`)
md.push('')
fs.writeFileSync(OUT_MD, md.join('\n'))
fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedBy: 'scripts/design/tines-corpus-report.mjs', pages: pages.length, templates: templates.length, palette, perTemplate: perTpl, inks, byRole }, null, 1))
console.log(`${path.relative(ROOT, OUT_MD)} · ${pages.length}페이지 · 팔레트 ${palette.length} · 그림 ${art.length}`)

// ── 모음판 ──────────────────────────────────────────────────────────
if (!NO_SHEETS) {
  fs.mkdirSync(SHEETS, { recursive: true })
  const browser = await chromium.launch()
  for (const r of ['hero', 'band', 'card', 'spot', 'inline']) {
    // 페이지마다 고르게 — 한 페이지가 판을 독점하지 않게 페이지당 최대 3개
    const per = new Map()
    const pick = []
    for (const v of art.filter((x) => x.role === r && x.y + x.h <= Math.min(x.docH, 16000))) {
      const k = v.page
      if ((per.get(k) || 0) >= 3) continue
      per.set(k, (per.get(k) || 0) + 1)
      pick.push(v)
    }
    const cellW = r === 'spot' ? 200 : r === 'band' ? 640 : 320
    const tiles = pick.slice(0, r === 'band' ? 40 : 120).map((v) => {
      const sc = Math.min(1, cellW / v.w, (r === 'band' ? 300 : 240) / v.h)
      const img = pathToFileURL(path.join(v.dir, 'full-1280.jpg')).href
      return `<figure><div style="width:${Math.round(v.w * sc)}px;height:${Math.round(v.h * sc)}px;background:url('${img}') -${Math.round(v.x * sc)}px -${Math.round(v.y * sc)}px/${Math.round(1280 * sc)}px auto no-repeat"></div><figcaption>${v.template} · ${v.w}×${v.h} · ${v.kind}</figcaption></figure>`
    })
    const html = `<!doctype html><meta charset=utf-8><style>body{margin:12px;font:11px system-ui;background:#fff;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}figure{margin:0;padding:6px;border:1px solid #ddd}figcaption{margin-top:4px;color:#555}</style><h1 style="width:100%;font-size:16px">${r} — ${pick.length}개 중 ${tiles.length}</h1>${tiles.join('')}`
    const f = path.join(SHEETS, `${r}.html`)
    fs.writeFileSync(f, html)
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
    await page.goto(pathToFileURL(f).href)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(SHEETS, `${r}.png`), fullPage: true })
    await page.close()
    console.log(`모음판 ${r}: ${tiles.length}`)
  }
  await browser.close()
}
