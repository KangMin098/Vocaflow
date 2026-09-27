#!/usr/bin/env node
// scripts/design/font-lookalike.mjs
//
// 참조 사이트 서체(상용 · 제품에 쓸 수 없다)와 **가장 닮은 무료 서체**를 픽셀로 고른다(DD-68).
//
//   node scripts/design/font-lookalike.mjs
//   node scripts/design/font-lookalike.mjs --capture tmp/tines-capture --out docs/design/refs/tines
//
// 방법: 같은 문장을 참조 서체와 후보로 캔버스에 그려 흑백 마스크를 만들고, 글자 덩어리의
// 바깥 상자에 맞춰 같은 크기로 늘린 뒤 겹침(IoU)을 잰다. 같은 크기에서의 **글줄 폭 비율**도 잰다 —
// 모양이 닮아도 폭이 다르면 줄바꿈과 레이아웃이 달라진다. 점수 = IoU × (1 − |1 − 폭 비율|).
//
// ⚠️ 참조 서체 파일은 `tmp/`(gitignore)의 로컬 미러에서만 읽고 **이 비교에만** 쓴다.
//    저장소에 남는 것은 점수 표뿐이다(서체 파일 · 렌더 이미지 0).

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const CAPTURE = path.resolve(ROOT, arg('--capture', 'tmp/tines-capture'))
const OUT = path.resolve(ROOT, arg('--out', 'docs/design/refs/tines'))

const findFont = (name) => {
  const hit = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === name) hit.push(p)
    }
  }
  walk(path.join(CAPTURE, 'assets'))
  if (!hit.length) throw new Error(`참조 서체 ${name} 이 미러에 없다 — scratchpad capture-tines 를 먼저 돌린다`)
  return hit[0]
}

// 역할 — 참조 사이트가 실제로 쓰는 자리(computed-summary 타입 스케일)와 같은 굵기·문장.
const ROLES = [
  {
    role: 'sans',
    ref: { family: 'Roobert', file: 'Roobert-Regular.woff2', weight: 400 },
    weight: 400,
    sample: 'You told everyone to use AI. Now give them a secure place to do it.',
    glyphs: 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789',
    candidates: ['Figtree', 'Manrope', 'Hanken Grotesk', 'Instrument Sans', 'Plus Jakarta Sans', 'DM Sans', 'Inter',
      'Onest', 'Schibsted Grotesk', 'Albert Sans', 'Urbanist', 'Outfit', 'Geist', 'Space Grotesk', 'Work Sans',
      'Sora', 'Rethink Sans', 'Bricolage Grotesque', 'Golos Text', 'Be Vietnam Pro', 'Red Hat Display', 'Wix Madefor Display'],
  },
  {
    role: 'sans-medium',
    ref: { family: 'Roobert', file: 'Roobert-Medium.woff2', weight: 500 },
    weight: 500,
    sample: 'Product Solutions Customers Discover Pricing Log in Sign up',
    glyphs: 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    candidates: null, // sans 상위 8개로 다시 잰다
  },
  {
    role: 'serif',
    ref: { family: 'Reckless', file: 'Reckless-Regular.woff2', weight: 400 },
    weight: 400,
    sample: 'Tines lets every team build. IT and Security maintain complete visibility.',
    glyphs: 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789',
    candidates: ['Fraunces', 'Newsreader', 'Instrument Serif', 'Young Serif', 'Gloock', 'DM Serif Display', 'Playfair Display',
      'Source Serif 4', 'Literata', 'Libre Caslon Text', 'Bodoni Moda', 'Crimson Pro', 'Besley', 'Brygada 1918',
      'Gelasio', 'Lora', 'Spectral', 'EB Garamond', 'Cormorant', 'Libre Baskerville', 'Noto Serif Display', 'Petrona'],
  },
  {
    role: 'mono',
    ref: { family: 'Roobert Mono', file: 'RoobertMono-Bold.woff2', weight: 700 },
    weight: 700,
    sample: 'BOOK A DEMO  SIGN UP FREE  100X SIMPLER',
    glyphs: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789',
    candidates: ['JetBrains Mono', 'IBM Plex Mono', 'Space Mono', 'DM Mono', 'Roboto Mono', 'Fira Code', 'Geist Mono',
      'Martian Mono', 'Red Hat Mono', 'Azeret Mono', 'Spline Sans Mono', 'Chivo Mono', 'Sometype Mono', 'Source Code Pro',
      'Ubuntu Mono', 'Overpass Mono', 'Share Tech Mono', 'Anonymous Pro'],
  },
]

// Google Fonts css2 는 없는 굵기를 요청하면 통째로 400 이다 — 굵기를 줄여 가며 되는 주소를 찾는다.
async function cssUrlFor(family, weight) {
  const fam = family.replace(/ /g, '+')
  for (const q of [`:wght@${weight}`, `:wght@400`, '']) {
    const url = `https://fonts.googleapis.com/css2?family=${fam}${q}&display=block`
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/124' } }).catch(() => null)
    if (r && r.ok) return { url, weight: q === `:wght@${weight}` ? weight : 400 }
  }
  return null
}

// ── 페이지 안: 마스크 · IoU · 폭 ─────────────────────────────────────
function measure({ refFamily, refWeight, cands, texts }) {
  const W = 2400, H = 220, SIZE = 96, NW = 900, NH = 120
  const draw = (family, weight, text) => {
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const g = c.getContext('2d')
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H)
    g.fillStyle = '#000'; g.textBaseline = 'alphabetic'
    g.font = `${weight} ${SIZE}px "${family}"`
    g.fillText(text, 10, 150)
    const width = g.measureText(text).width
    const d = g.getImageData(0, 0, W, H).data
    let x0 = W, y0 = H, x1 = 0, y1 = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4] < 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    // 바깥 상자를 NW×NH 로 늘려 모양만 비교한다(크기·위치 차이는 폭 비율이 따로 본다).
    const n = document.createElement('canvas')
    n.width = NW; n.height = NH
    const ng = n.getContext('2d')
    ng.fillStyle = '#fff'; ng.fillRect(0, 0, NW, NH)
    ng.drawImage(c, x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0), 0, 0, NW, NH)
    const nd = ng.getImageData(0, 0, NW, NH).data
    const mask = new Uint8Array(NW * NH)
    for (let i = 0; i < mask.length; i++) mask[i] = nd[i * 4] < 128 ? 1 : 0
    return { mask, width, inkH: y1 - y0 }
  }
  const iou = (a, b) => {
    let inter = 0, uni = 0
    for (let i = 0; i < a.length; i++) { inter += a[i] & b[i]; uni += a[i] | b[i] }
    return uni ? inter / uni : 0
  }
  const refs = texts.map((t) => draw(refFamily, refWeight, t))
  return cands.map(({ family, weight }) => {
    const r = texts.map((t, i) => {
      const m = draw(family, weight, t)
      return { iou: iou(refs[i].mask, m.mask), wr: m.width / refs[i].width, hr: m.inkH / refs[i].inkH }
    })
    const avg = (k) => r.reduce((s, x) => s + x[k], 0) / r.length
    const shape = avg('iou'), widthRatio = avg('wr'), heightRatio = avg('hr')
    return { family, weight, iou: +shape.toFixed(4), widthRatio: +widthRatio.toFixed(3), heightRatio: +heightRatio.toFixed(3),
      score: +(shape * Math.max(0, 1 - Math.abs(1 - widthRatio))).toFixed(4) }
  })
}

// ── 실행 ─────────────────────────────────────────────────────────────
const browser = await chromium.launch()
const results = {}
for (const R of ROLES) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const refPath = findFont(R.ref.file)
  // 참조 서체는 로컬 파일을 가상 주소로 내준다(네트워크로 다시 받지 않는다).
  await page.route('https://ref.local/**', (route) => route.fulfill({ body: fs.readFileSync(refPath), contentType: 'font/woff2' }))
  let cands = R.candidates
  if (!cands) cands = (results.sans?.ranking ?? []).slice(0, 8).map((x) => x.family)
  const links = []
  const usable = []
  for (const fam of cands) {
    const u = await cssUrlFor(fam, R.weight)
    if (!u) { console.log(`  ${R.role}: ${fam} — Google Fonts 에 없음, 건너뜀`); continue }
    links.push(`<link rel="stylesheet" href="${u.url}">`)
    usable.push({ family: fam, weight: u.weight })
  }
  const faces = `@font-face{font-family:"${R.ref.family}";src:url(https://ref.local/${R.ref.file}) format("woff2");font-weight:${R.ref.weight}}`
  await page.setContent(`<html><head>${links.join('')}<style>${faces}</style></head><body></body></html>`, { waitUntil: 'networkidle' })
  await page.evaluate(async ({ ref, usable }) => {
    const all = [{ family: ref.family, weight: ref.weight }, ...usable]
    await Promise.all(all.map((f) => document.fonts.load(`${f.weight} 96px "${f.family}"`).catch(() => {})))
  }, { ref: R.ref, usable })
  const loaded = await page.evaluate((usable) => usable.filter((f) => document.fonts.check(`${f.weight} 96px "${f.family}"`)), usable)
  const ranking = (await page.evaluate(measure, {
    refFamily: R.ref.family, refWeight: R.ref.weight, cands: loaded, texts: [R.sample, R.glyphs],
  })).sort((a, b) => b.score - a.score)
  results[R.role] = { reference: `${R.ref.family} ${R.ref.weight}`, sample: R.sample, ranking }
  console.log(`\n${R.role} (${R.ref.family} ${R.ref.weight}) — 후보 ${loaded.length}`)
  for (const x of ranking.slice(0, 6)) console.log(`  ${x.score.toFixed(3)}  IoU ${x.iou.toFixed(3)}  폭 ${x.widthRatio}  높이 ${x.heightRatio}  ${x.family} ${x.weight}`)
  await ctx.close()
}
await browser.close()

const data = { generatedBy: 'scripts/design/font-lookalike.mjs', generatedAt: new Date().toISOString().slice(0, 10), method: 'IoU × (1 − |1 − 폭 비율|), 문장 + 글자표 평균', results }
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'font-lookalike.json'), JSON.stringify(data, null, 2) + '\n')
const L = ['# 참조 서체 → 무료 대체 (픽셀 비교)', '', `> 생성 \`scripts/design/font-lookalike.mjs\` · ${data.generatedAt} · 손으로 고치지 말 것.`, `> 점수 = ${data.method}. 참조 서체 파일은 로컬 미러에서만 읽었다(저장소 0).`, '']
for (const [role, r] of Object.entries(results)) {
  L.push(`## ${role} — ${r.reference}`, '', '| 순위 | 서체 | 굵기 | 점수 | IoU | 폭 비율 | 높이 비율 |', '|---|---|---|---|---|---|---|')
  r.ranking.slice(0, 10).forEach((x, i) => L.push(`| ${i + 1} | ${x.family} | ${x.weight} | ${x.score} | ${x.iou} | ${x.widthRatio} | ${x.heightRatio} |`))
  L.push('')
}
fs.writeFileSync(path.join(OUT, 'font-lookalike.md'), L.join('\n'))
console.log(`\n${path.relative(ROOT, path.join(OUT, 'font-lookalike.json'))} · font-lookalike.md`)
