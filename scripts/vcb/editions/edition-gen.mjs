#!/usr/bin/env node
// scripts/vcb/editions/edition-gen.mjs
//
// **VCB 에디션 표지 — 3단계 생성.** `work/prompts.out.json`(아트 디렉터가 채운 권별 피사체·화풍)을
// 이미지로 굽는다. 산출: apps/web/public/covers/vocab/editions/<slug>.webp (1024², WebP q0.86)
//
//   node scripts/vcb/editions/edition-gen.mjs                    # 없는 것만(재실행 안전)
//   node scripts/vcb/editions/edition-gen.mjs --only a,b         # 몇 권만
//   node scripts/vcb/editions/edition-gen.mjs --force            # 있는 것도 다시(한도를 쓴다)
//   node scripts/vcb/editions/edition-gen.mjs --backend openai   # 백엔드 고정(qwen | openai)
//
// 백엔드: 기본 Qwen-Image(DashScope 국제판 무료 한도, 키 scripts/comic/.dashscope-token) →
//   실패(한도·오류)하면 그 권만 GPT Image(키 scripts/comic/.openai-token, 선불 크레딧)로 넘긴다.
// 화풍 문장은 edition-styles.mjs 한 곳뿐이다. 생성 기록은 work/gen-log.json 에 남는다(import 가 읽는다).

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from '../../design/lib/ref-page.mjs'
import { NEG, promptFor } from './edition-styles.mjs'

const HERE = import.meta.dirname
const WORK = path.join(HERE, 'work')
const OUT = path.join(ROOT, 'apps/web/public/covers/vocab/editions')
const argv = process.argv.slice(2)
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined }
const ONLY = arg('--only')?.split(',') ?? null
const FORCE = argv.includes('--force')
const BACKEND = arg('--backend') ?? 'auto'

const tok = (env, file) =>
  process.env[env] || (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8').trim() : '')
const QWEN_KEY = tok('DASHSCOPE_API_KEY', 'scripts/comic/.dashscope-token')
const OPENAI_KEY = tok('OPENAI_API_KEY', 'scripts/comic/.openai-token')

async function qwen(prompt) {
  if (!QWEN_KEY) throw new Error('DashScope 키 없음')
  const body = {
    model: 'qwen-image-max',
    input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
    parameters: { n: 1, size: '1328*1328', watermark: false, prompt_extend: false, negative_prompt: NEG },
  }
  for (let a = 0; a < 3; a++) {
    const r = await fetch('https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${QWEN_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240000),
    })
    const j = await r.json().catch(() => ({}))
    const url = j.output?.choices?.[0]?.message?.content?.find((p) => p.image)?.image
    if (r.ok && url) return Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(120000) })).arrayBuffer())
    if (r.status === 429) { await new Promise((z) => setTimeout(z, 12000)); continue }
    throw new Error(`qwen ${r.status} ${JSON.stringify(j).slice(0, 200)}`)
  }
  throw new Error('qwen 429 ×3')
}

async function openai(prompt) {
  if (!OPENAI_KEY) throw new Error('OpenAI 키 없음')
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    // OpenAI 에는 negative 필드가 없다 — 금지 목록을 문장으로 접는다.
    body: JSON.stringify({ model: 'gpt-image-1', prompt: `${prompt} Avoid entirely: ${NEG}.`, size: '1024x1024', quality: 'high', n: 1 }),
    signal: AbortSignal.timeout(300000),
  })
  const j = await r.json().catch(() => ({}))
  const b64 = j.data?.[0]?.b64_json
  if (!r.ok || !b64) throw new Error(`openai ${r.status} ${JSON.stringify(j).slice(0, 200)}`)
  return Buffer.from(b64, 'base64')
}

const prompts = JSON.parse(fs.readFileSync(path.join(WORK, 'prompts.out.json'), 'utf8'))
const logPath = path.join(WORK, 'gen-log.json')
const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : {}
fs.mkdirSync(OUT, { recursive: true })

const todo = Object.entries(prompts).filter(([slug]) =>
  (!ONLY || ONLY.includes(slug)) && (FORCE || !fs.existsSync(path.join(OUT, `${slug}.webp`))))
console.log(`생성 대상 ${todo.length}권 (전체 ${Object.keys(prompts).length})`)

const browser = await chromium.launch()
const page = await browser.newPage()
let ok = 0, failed = 0
for (const [slug, p] of todo) {
  const prompt = promptFor(p)
  let buf = null, model = null
  const order = BACKEND === 'auto' ? ['qwen', 'openai'] : [BACKEND]
  for (const be of order) {
    try {
      buf = be === 'qwen' ? await qwen(prompt) : await openai(prompt)
      model = be === 'qwen' ? 'qwen-image-max' : 'gpt-image-1'
      break
    } catch (e) {
      console.warn(`  ${slug} · ${be} 실패: ${e.message}`)
    }
  }
  if (!buf) { failed++; continue }
  // 1024² WebP — 원본 비율(정사각)을 지키고 가운데를 쓴다.
  const b64 = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode()
    const S = 1024, c = document.createElement('canvas'); c.width = S; c.height = S
    const m = Math.min(img.naturalWidth, img.naturalHeight)
    c.getContext('2d').drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, S, S)
    return c.toDataURL('image/webp', 0.86).split(',')[1]
  }, `data:image/png;base64,${buf.toString('base64')}`)
  fs.writeFileSync(path.join(OUT, `${slug}.webp`), Buffer.from(b64, 'base64'))
  log[slug] = { model, style: p.style, prompt, generated_at: new Date().toISOString() }
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2))
  ok++
  console.log(`  ✓ ${slug} (${model})`)
  if (model === 'qwen-image-max') await new Promise((z) => setTimeout(z, 4000)) // 무료 한도 스로틀
}
await browser.close()
console.log(`완료 ${ok} · 실패 ${failed} · 건너뜀 ${Object.keys(prompts).length - todo.length}`)
if (failed) process.exitCode = 1
