#!/usr/bin/env node
// scripts/design/illo-tines-gen.mjs
//
// **Tines 화풍 삽화 생성기**(DD-68 ⑤) — 무료 Qwen-Image(DashScope 국제판, 신규 100장/90일)로
// 우리 소재를 참조 사이트와 같은 밀도·화풍으로 그린다.
//
//   node scripts/design/illo-tines-gen.mjs                 # 없는 것만 만든다(재실행 안전)
//   node scripts/design/illo-tines-gen.mjs --only a,b      # 몇 개만(쉼표)
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
import { NEG, SCENES, keyAndEncode } from './lib/illo-tines-scenes.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const ONLY = arg('--only', null)?.split(',') ?? null
const FORCE = argv.includes('--force')
const REKEY = argv.includes('--rekey')
const OUT = path.join(ROOT, 'apps/web/public/illustrations/tines')

const KEY = process.env.DASHSCOPE_API_KEY
  || (fs.existsSync(path.join(ROOT, 'scripts/comic/.dashscope-token')) ? fs.readFileSync(path.join(ROOT, 'scripts/comic/.dashscope-token'), 'utf8').trim() : '')
if (!KEY) { console.error('DashScope 키가 없다 — scripts/comic/.dashscope-token 또는 DASHSCOPE_API_KEY'); process.exit(3) }
const ENDPOINT = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

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

fs.mkdirSync(OUT, { recursive: true })
if (REKEY) {
  const b = await chromium.launch(); const pg = await b.newPage()
  for (const s of SCENES.filter((x) => !ONLY || x.id === ONLY)) {
    const f = path.join(OUT, `${s.id}.webp`)
    if (!fs.existsSync(f)) { console.log(`  - ${s.id} 없음`); continue }
    const b64 = await pg.evaluate(keyAndEncode, [`data:image/webp;base64,${fs.readFileSync(f).toString('base64')}`, s.key])
    fs.writeFileSync(f, Buffer.from(b64, 'base64'))
    console.log(`  ✓ ${s.id} 바탕 투명화`)
  }
  await b.close()
  process.exit(0)
}
const todo = SCENES.filter((s) => (!ONLY || ONLY.includes(s.id)) && (FORCE || !fs.existsSync(path.join(OUT, `${s.id}.webp`))))
console.log(`생성 ${todo.length} · 건너뜀 ${SCENES.length - todo.length}(이미 있음)`)
const browser = todo.length ? await chromium.launch() : null
const page = browser ? await browser.newPage() : null
let made = 0, failed = 0
for (const s of todo) {
  try {
    const t = Date.now()
    const png = await generate(s)
    // 바탕 빼기 + WebP(품질 0.86) — Chromium 캔버스
    const b64 = await page.evaluate(keyAndEncode, [`data:image/png;base64,${png.toString('base64')}`, s.key])
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
