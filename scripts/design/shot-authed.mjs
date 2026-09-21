#!/usr/bin/env node
// scripts/design/shot-authed.mjs
//
// **로그인해야 보이는 화면**을 1:1 로 찍는다(DD-68 4단계 — 서가 · 학습자 셸). 검증 계정으로 한 번 로그인하고
// 상태를 tmp 에 둔 뒤 같은 상태로 여러 화면을 연다(로그인 반복은 인증 레이트리밋에 걸린다).
//
//   node --env-file=apps/web/.env.local scripts/design/shot-authed.mjs /library/books /hub --slices 2 [--vp 390]
//
// 계정: env PLAYWRIGHT_TEST_EMAIL · PLAYWRIGHT_TEST_PASSWORD (값은 출력하지 않는다 — 없으면 이름만 알린다).
//   이메일이 없으면 e2e 와 같은 기본 검증 계정(apps/web/tests/e2e/fixtures/test-user.ts)을 쓴다.
// 산출: docs/design/shots/replica/authed-<경로>-1440-NN.png (gitignore — 실데이터가 찍힌다)

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
const SLICES = Number(flag('--slices', '1'))
const BASE = flag('--base', 'http://localhost:3000')
const VW = Number(flag('--vp', '1440'))
const VH = VW < 700 ? 844 : 900
const routes = argv.filter((a, i) => a.startsWith('/') && argv[i - 1] !== '--base' && argv[i - 1] !== '--vp')
const OUT = path.join(ROOT, 'docs/design/shots/replica')
const STATE = path.join(ROOT, 'tmp/authed-state.json')

const EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || 'lexicon-test@vocaflow.local' // e2e fixtures/test-user.ts 와 같은 기본값
const missing = ['PLAYWRIGHT_TEST_PASSWORD'].filter((k) => !process.env[k])
if (missing.length) { console.error(`검증 계정 env 가 없다: ${missing.join(', ')} — node --env-file=apps/web/.env.local 로 실행`); process.exit(3) }

fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(path.dirname(STATE), { recursive: true })
const browser = await chromium.launch()

async function login() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.getByLabel(/이메일/).fill(EMAIL)
  await page.getByLabel(/비밀번호/).first().fill(process.env.PLAYWRIGHT_TEST_PASSWORD)
  await page.getByRole('button', { name: /^로그인/ }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
  await ctx.storageState({ path: STATE })
  console.log(`로그인 → ${new URL(page.url()).pathname}`)
  await ctx.close()
}
if (!fs.existsSync(STATE) || Date.now() - fs.statSync(STATE).mtimeMs > 30 * 60_000) await login()

const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, storageState: STATE })
for (const r of routes) {
  const page = await ctx.newPage()
  const url = `${BASE}${r}${r.includes('?') ? '&' : '?'}skin=tines`
  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 }).catch((e) => ({ status: () => `ERR ${e.message.split('\n')[0]}` }))
  const landed = new URL(page.url()).pathname
  if (landed.startsWith('/login')) { console.log(`${r} → 로그인으로 튕김(상태 만료) — tmp/authed-state.json 을 지우고 다시`); await page.close(); continue }
  await page.waitForTimeout(800)
  const H = await page.evaluate(() => document.documentElement.scrollHeight)
  const name = r.replace(/^\//, '').replace(/[/?=&]+/g, '-') || 'root'
  for (let i = 0; i < Math.min(SLICES, Math.ceil(H / VH)); i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * VH); await page.waitForTimeout(250)
    const f = path.join(OUT, `authed-${name}-${VW}-${String(i + 1).padStart(2, '0')}.png`)
    await page.screenshot({ path: f })
    console.log(path.relative(ROOT, f))
  }
  console.log(`${r} · ${res.status?.()} · 도착 ${landed} · 문서 ${H}px`)
  await page.close()
}
await browser.close()
