#!/usr/bin/env node
// scripts/design/illo-tines-gen.mjs
//
// **Tines 화풍 삽화 생성기**(DD-68 ⑤) — 무료 Qwen-Image(DashScope 국제판, 신규 100장/90일)로
// 우리 소재를 참조 사이트와 같은 밀도·화풍으로 그린다.
//
//   node scripts/design/illo-tines-gen.mjs                 # 없는 것만 만든다(재실행 안전)
//   node scripts/design/illo-tines-gen.mjs --only hero     # 하나만
//   node scripts/design/illo-tines-gen.mjs --force         # 있는 것도 다시(한도를 쓴다)
//   node scripts/design/illo-tines-gen.mjs --rekey         # 생성 없이 기존 파일의 바탕만 다시 투명하게(한도 0)
//
// 원칙
//   - 참조 사이트의 그림을 입력으로 넣지 않는다(파생물 금지) — 화풍은 **글 설명**으로만 준다.
//   - 소재는 우리 기능(읽기 · 단어 · 망각 · 듣기 · 퀴즈)이다. 참조의 사물(로봇 · 기사 투구 · 드론)을 쓰지 않는다.
//   - 화풍 문장은 아래 STYLE 한 곳뿐이다 — 장면마다 따로 적으면 서가가 두 화풍으로 갈린다.
//   - 글자는 굽지 않는다(no text) — 문구는 HTML 이 맡는다.
//
// 산출: apps/web/public/illustrations/tines/<id>.webp (Chromium 캔버스로 WebP 변환 — sharp·ffmpeg 불필요)
// 키: scripts/comic/.dashscope-token (gitignore) 또는 env DASHSCOPE_API_KEY.
// 무료 한도(분당 ~3장 스로틀)가 있으므로 장면 사이에 4초를 둔다. 한도를 넘으면 Kaggle T4 경로(scripts/comic/kaggle)로 옮긴다.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const ONLY = arg('--only', null)
const FORCE = argv.includes('--force')
const REKEY = argv.includes('--rekey')
const OUT = path.join(ROOT, 'apps/web/public/illustrations/tines')

const KEY = process.env.DASHSCOPE_API_KEY
  || (fs.existsSync(path.join(ROOT, 'scripts/comic/.dashscope-token')) ? fs.readFileSync(path.join(ROOT, 'scripts/comic/.dashscope-token'), 'utf8').trim() : '')
if (!KEY) { console.error('DashScope 키가 없다 — scripts/comic/.dashscope-token 또는 DASHSCOPE_API_KEY'); process.exit(3) }
const ENDPOINT = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

/** 화풍 — 참조 사이트에서 관찰한 특징을 글로 옮긴 것. 색은 스킨 토큰(skins/tines.css) 값이다. */
const PALETTE = 'lavender #c3b5ff, violet #714bd0, deep purple #542f9c, pink #ff87c8, mint green #91d1af, peach #ffbc8a, butter yellow #ffd88c'
const STYLE_DENSE = `Flat vector illustration, extremely dense decorative floral pattern: hundreds of small stylized flowers, daisies, tulips, leaves and buds packed tightly with no empty space, bold uniform dark purple outlines of equal weight, limited flat palette of ${PALETTE} on a plain cream background #fcf9f5, playful retro screen-print style, crisp shapes, no gradients, no shading, no texture, no text, no letters, no numbers, no watermark`
const STYLE_SPOT = `Flat vector spot illustration of a single object centered on a plain cream background #fcf9f5 with generous empty margin, a small cluster of stylized flowers and leaves at its base, bold uniform dark purple outlines of equal weight, limited flat palette of ${PALETTE}, playful retro screen-print style, crisp shapes, no gradients, no shading, no texture, no text, no letters, no numbers, no watermark`
const NEG = 'text, letters, words, numbers, watermark, logo, signature, gradient, shading, 3d render, photo, realistic, blurry, noise, grain, frame, border'

/** 장면 — id · 크기(Qwen 지원 비율) · 화풍 · 장면 문장. */
const SCENES = [
  { id: 'hero-book-field', size: '1664*928', style: STYLE_DENSE,
    scene: 'A giant open book seen from slightly above; its pages burst into a lush dense field of flowers that spills over the edges, while small blank flashcards hang above it like bunting on a string.' },
  { id: 'bed-flowers', size: '1664*928', style: STYLE_DENSE,
    scene: 'A wide low mound of densely packed flowers running along the bottom edge of the frame like a flower bed; the upper half of the image is completely empty plain background.' },
  { id: 'spot-reading', size: '1328*1328', style: STYLE_SPOT,
    scene: 'A vintage brass magnifying glass leaning on a small stack of books, the lens showing a few enlarged blank lines.' },
  { id: 'spot-vault', size: '1328*1328', style: STYLE_SPOT,
    scene: 'A round glass jar with a cork lid, filled with small blank square word tiles.' },
  { id: 'spot-memory', size: '1328*1328', style: STYLE_SPOT,
    scene: 'A terracotta flower pot with a young sprout, next to a small round alarm clock, symbolising spaced review.' },
  { id: 'spot-listening', size: '1328*1328', style: STYLE_SPOT,
    scene: 'A pair of retro over-ear headphones whose cable curls into a vine with small leaves.' },
  { id: 'spot-comic', size: '1328*1328', style: STYLE_SPOT,
    scene: 'A small stack of vintage comic books with blank covers, a round paintbrush resting on top with a drop of fresh paint.' },
  { id: 'spot-quiz', size: '1328*1328', style: STYLE_SPOT,
    scene: 'A sharpened pencil lying across a blank index card with three empty round checkboxes.' },
]

async function generate(s) {
  const body = {
    model: 'qwen-image-max',
    input: { messages: [{ role: 'user', content: [{ text: `${s.scene} ${s.style}` }] }] },
    parameters: { n: 1, size: s.size, watermark: false, prompt_extend: false, negative_prompt: NEG },
  }
  for (let a = 0; a < 3; a++) {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(240000) })
    const j = await r.json().catch(() => ({}))
    const url = j.output?.choices?.[0]?.message?.content?.find((p) => p.image)?.image
    if (r.ok && url) return Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(120000) })).arrayBuffer())
    const why = JSON.stringify(j).slice(0, 240)
    if (r.status === 429) { await new Promise((z) => setTimeout(z, 10000)); continue }
    throw new Error(`${r.status} ${why}`)
  }
  throw new Error('스로틀이 풀리지 않았다(429 ×3)')
}

/**
 * 바탕 빼기 + WebP 인코딩(페이지 안에서). 생성 이미지의 크림 바탕은 장마다 조금씩 달라 페이지 바탕 위에서
 * 상자 테두리가 보인다 — **가장자리에서 이어진** 바탕색 화소만 투명하게 한다(그림 안쪽 크림색은 남는다).
 * 경계는 바탕과의 거리로 알파를 부드럽게 준다(외곽선 주변 계단 방지).
 */
function keyAndEncode(src) {
  return (async () => {
    const img = new Image(); img.src = src; await img.decode()
    const W = img.naturalWidth, H = img.naturalHeight
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const id = g.getImageData(0, 0, W, H), d = id.data
    // 바탕색 = 네 모서리 16px 칸의 중앙값
    const samples = []
    for (const [x0, y0] of [[0, 0], [W - 16, 0], [0, H - 16], [W - 16, H - 16]])
      for (let y = y0; y < y0 + 16; y++) for (let x = x0; x < x0 + 16; x++) { const i = (y * W + x) * 4; samples.push([d[i], d[i + 1], d[i + 2]]) }
    const med = [0, 1, 2].map((k) => samples.map((p) => p[k]).sort((a, b) => a - b)[samples.length >> 1])
    const dist = (i) => Math.hypot(d[i] - med[0], d[i + 1] - med[1], d[i + 2] - med[2])
    const HARD = 22, SOFT = 48
    const seen = new Uint8Array(W * H), stack = []
    for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x) }
    for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1) }
    while (stack.length) {
      const p = stack.pop()
      if (seen[p]) continue
      seen[p] = 1
      const i = p * 4, e = dist(i)
      if (e > SOFT) continue
      d[i + 3] = e <= HARD ? 0 : Math.round(255 * (e - HARD) / (SOFT - HARD))
      if (e > HARD) continue // 부드러운 경계에서는 더 퍼지지 않는다
      const x = p % W, y = (p / W) | 0
      if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1)
      if (y > 0) stack.push(p - W); if (y < H - 1) stack.push(p + W)
    }
    g.putImageData(id, 0, 0)
    return c.toDataURL('image/webp', 0.86).split(',')[1]
  })()
}

fs.mkdirSync(OUT, { recursive: true })
if (REKEY) {
  const b = await chromium.launch(); const pg = await b.newPage()
  for (const s of SCENES.filter((x) => !ONLY || x.id === ONLY)) {
    const f = path.join(OUT, `${s.id}.webp`)
    if (!fs.existsSync(f)) { console.log(`  - ${s.id} 없음`); continue }
    const b64 = await pg.evaluate(keyAndEncode, `data:image/webp;base64,${fs.readFileSync(f).toString('base64')}`)
    fs.writeFileSync(f, Buffer.from(b64, 'base64'))
    console.log(`  ✓ ${s.id} 바탕 투명화`)
  }
  await b.close()
  process.exit(0)
}
const todo = SCENES.filter((s) => (!ONLY || s.id === ONLY) && (FORCE || !fs.existsSync(path.join(OUT, `${s.id}.webp`))))
console.log(`생성 ${todo.length} · 건너뜀 ${SCENES.length - todo.length}(이미 있음)`)
const browser = todo.length ? await chromium.launch() : null
const page = browser ? await browser.newPage() : null
let made = 0, failed = 0
for (const s of todo) {
  try {
    const t = Date.now()
    const png = await generate(s)
    // 바탕 빼기 + WebP(품질 0.86) — Chromium 캔버스
    const b64 = await page.evaluate(keyAndEncode, `data:image/png;base64,${png.toString('base64')}`)
    const buf = Buffer.from(b64, 'base64')
    fs.writeFileSync(path.join(OUT, `${s.id}.webp`), buf)
    made++
    console.log(`  ✓ ${s.id} ${s.size} · ${Math.round(buf.length / 1024)} KiB · ${((Date.now() - t) / 1000).toFixed(0)}s`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${s.id} — ${e.message}`)
  }
  await new Promise((z) => setTimeout(z, 4000))
}
if (browser) await browser.close()
console.log(`만듦 ${made} · 실패 ${failed} — 실패한 것은 다시 돌리면 그것만 만든다`)
if (failed) process.exitCode = 1
