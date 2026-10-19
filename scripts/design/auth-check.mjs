// scripts/design/auth-check.mjs
//
// 인증 화면을 카드 한 장으로 바꾼 뒤(2026-10-19) 폼 동작이 그대로인지 확인한다 — 실제 로그인 · 가입 요청은 보내지 않는다.
//   빈 제출 → 검증 문구 · 비밀번호 보기 전환 · 화면 사이 링크 목적지 · 이메일 → 비밀번호 Tab 순서 · 다크 캡처
// 사용: node scripts/design/auth-check.mjs --base http://localhost:3041 --out <dir>

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require_ = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = require_('@playwright/test')
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const BASE = arg('base', 'http://localhost:3041')
const outDir = path.resolve(ROOT, arg('out', 'tmp/s6/auth-check'))

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  // 인증 요청이 실제로 나가지 않게 막는다(빈 제출은 화면 검증에서 끝나야 한다 — 나가면 그 자체가 결함)
  const authCalls = []
  await ctx.route(/\/auth\/v1\//, (route) => { authCalls.push(route.request().url().replace(/^https?:\/\/[^/]+/, '').slice(0, 60)); return route.abort() })
  const p = await ctx.newPage()
  const steps = []
  const step = async (name, fn) => {
    try { const r = await fn(); steps.push({ name, ...r }); process.stdout.write(`${r.ok ? '✓' : '✗'} ${name} ${JSON.stringify({ ...r, ok: undefined })}\n`) }
    catch (e) { steps.push({ name, ok: false, error: String(e).slice(0, 140) }); process.stdout.write(`✗ ${name} — ${String(e).slice(0, 90)}\n`) }
  }
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await p.waitForTimeout(4000)

  await step('빈 제출 → 검증 문구 · 인증 요청 없음', async () => {
    await p.getByRole('button', { name: /^로그인/ }).click()
    await p.waitForTimeout(800)
    const msg = await p.evaluate(() => {
      const inv = [...document.querySelectorAll('input')].filter((i) => i.getAttribute('aria-invalid') === 'true' || !i.checkValidity()).length
      const alerts = [...document.querySelectorAll('[role="alert"], .text-error, [id$="-error"]')].map((e) => e.textContent?.trim()).filter(Boolean)
      return { invalid: inv, alerts: alerts.slice(0, 3) }
    })
    return { ok: (msg.invalid > 0 || msg.alerts.length > 0) && authCalls.length === 0, ...msg, authCalls: authCalls.length }
  })
  await step('비밀번호 보기 전환', async () => {
    const pw = p.locator('input[type="password"], input[autocomplete="current-password"]').first()
    await pw.fill('example-password')
    const btn = p.getByRole('button', { name: /비밀번호 (보기|표시|숨기기)/ }).first()
    await btn.click()
    const t1 = await p.locator('input[autocomplete="current-password"], input[name="password"]').first().getAttribute('type')
    return { ok: t1 === 'text', typeAfter: t1 }
  })
  await step('Tab 순서 — 이메일 다음은 비밀번호 쪽', async () => {
    await p.locator('input[type="email"]').focus()
    await p.keyboard.press('Tab')
    const next = await p.evaluate(() => ({ tag: document.activeElement?.tagName, type: document.activeElement?.getAttribute('type'), name: (document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '').trim().slice(0, 20) }))
    return { ok: next.tag === 'A' || next.type === 'password' || next.type === 'text', next }
  })
  await step('링크 목적지 — 회원가입 · 비밀번호 찾기', async () => {
    const hrefs = await p.evaluate(() => [...document.querySelectorAll('main a')].map((a) => a.getAttribute('href')))
    return { ok: hrefs.some((h) => h?.startsWith('/signup')) && hrefs.some((h) => h?.startsWith('/reset-password')), hrefs }
  })
  await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark') })
  await p.waitForTimeout(400)
  await p.screenshot({ path: path.join(outDir, 'login-dark.png') })
  await browser.close()
  fs.writeFileSync(path.join(outDir, '_auth.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), steps }, null, 2))
  console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
