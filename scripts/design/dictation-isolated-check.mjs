// scripts/design/dictation-isolated-check.mjs
//
// 받아쓰기 세션 **격리 시각 검증** — 공유 DB 에 쓰지 않는다(learner-tines-audit S4 · 사용자 지시 2026-10-19).
//
// 방법: 화면 코드는 그대로 두고 브라우저 수준에서 Supabase REST 요청을 가로챈다.
//   · GET dictation_sessions?id=eq.<가짜 id> → 고정 세션 1행(문항 3개) · GET dictation_attempts → []
//   · 그 밖의 **쓰기**(POST · PATCH · PUT · DELETE · /rpc/) → DB 에 보내지 않고 가짜 성공으로 응답하고 개수를 센다
//   · 그 밖의 읽기는 그대로 보낸다(로그인 세션 · 화면 셸)
// 이 검증은 **세션 · 팝업 · 상태의 화면**만 증명한다. 실제 저장 · 완주 흐름(적재 · 결과 기록)은 증명하지 않는다 —
// 쓰기를 막았기 때문이다. 결과표에서 그 둘을 따로 센다.
// 사용: node scripts/design/dictation-isolated-check.mjs --base http://localhost:3041 --out <dir> [--width 1440]

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
const outDir = path.resolve(ROOT, arg('out', 'tmp/s4/dictation'))
const width = Number(arg('width', '1440'))
const theme = arg('theme', 'light')
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')

const FAKE_ID = '00000000-0000-4000-8000-0000000d1c7a'
const FIXTURE = {
  id: FAKE_ID,
  title: '격리 검증 — 고정 문항',
  source_kind: 'custom',
  text_id: null,
  library_book_id: null,
  chapter_idx: null,
  shared_set_id: null,
  config: { chunkSize: 1, count: 3, order: 'sequential', scoring: 'smart', cefr: 'B1', speed: 1, autoRepeat: 0, hintsAllowed: true, voice: 'default' },
  items: [
    { index: 0, expectedText: 'Marley was dead, to begin with.', translation: '말리는 죽었다, 우선 그것부터.', targetWords: ['dead'], targetForms: { dead: ['dead'] }, contextLabel: '고정 문항 1' },
    { index: 1, expectedText: 'There is no doubt whatever about that.', translation: '그것에 대해서는 의심의 여지가 없다.', targetWords: ['doubt'], targetForms: { doubt: ['doubt'] }, contextLabel: '고정 문항 2' },
    { index: 2, expectedText: 'Scrooge signed it.', translation: '스크루지가 서명했다.', targetWords: ['signed'], targetForms: { signed: ['sign', 'signed'] }, contextLabel: '고정 문항 3' },
  ],
  started_at: '2026-10-19T00:00:00.000Z',
  completed_at: null,
  total_hints: 0,
}

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce', ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
  const blocked = []
  await ctx.route(/\/rest\/v1\/|\/rpc\//, async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (method === 'GET' && /\/rest\/v1\/dictation_sessions/.test(url) && url.includes(FAKE_ID)) {
      // maybeSingle() 은 Accept: application/vnd.pgrst.object+json 로 한 행을 받는다
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) })
    }
    if (method === 'GET' && /\/rest\/v1\/dictation_attempts/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      blocked.push(`${method} ${url.replace(/^https?:\/\/[^/]+/, '').slice(0, 90)}`)
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
    }
    return route.continue()
  })
  await ctx.addInitScript((t) => { try { localStorage.setItem('vocaflow-theme', t) } catch {} }, theme)
  const p = await ctx.newPage()
  const steps = []
  const step = async (name, fn) => {
    try { const r = await fn(); steps.push({ name, ...r }); process.stdout.write(`${r.ok ? '✓' : '✗'} ${name} ${JSON.stringify({ ...r, ok: undefined })}\n`) }
    catch (e) { steps.push({ name, ok: false, error: String(e).slice(0, 140) }); process.stdout.write(`✗ ${name} — ${String(e).slice(0, 90)}\n`) }
  }
  await p.goto(`${BASE}/dictate/session?sessionId=${FAKE_ID}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await p.waitForTimeout(7000)

  await step('세션 화면(고정 문항) — 전체화면 틀 · 진행 표시 · 입력', async () => {
    const r = await p.evaluate(() => ({
      text: document.querySelector('main')?.innerText.slice(0, 300) ?? '',
      inputs: document.querySelectorAll('main input, main textarea').length,
      close: [...document.querySelectorAll('a,button')].filter((e) => /세션 닫기/.test(e.getAttribute('aria-label') ?? e.textContent ?? '')).length,
    }))
    await p.screenshot({ path: path.join(outDir, `session-start@${width}-${theme}.png`) })
    return { ok: r.close === 1 && r.inputs > 0 && /1\s*\/\s*3/.test(r.text), close: r.close, inputs: r.inputs, head: r.text.slice(0, 80) }
  })
  await step('입력 → 제출 → 피드백 상태(쓰기는 막힘)', async () => {
    const input = p.locator('main input, main textarea').first()
    await input.click()
    await input.fill('Marley was dead to begin with')
    await p.keyboard.press('Enter')
    await p.waitForTimeout(1500)
    const after = await p.evaluate(() => document.querySelector('main')?.innerText.slice(0, 400) ?? '')
    await p.screenshot({ path: path.join(outDir, `session-feedback@${width}-${theme}.png`) })
    return { ok: after.length > 0, blockedWrites: blocked.length, head: after.slice(0, 100) }
  })
  await step('힌트 · 팝업 류 — 화면 안 대화상자/패널 열림 여부', async () => {
    const hint = p.getByRole('button', { name: /힌트|hint/i }).first()
    const has = await hint.count()
    if (has) { await hint.click().catch(() => {}); await p.waitForTimeout(600) }
    const dialogs = await p.locator('[role="dialog"]').count()
    await p.screenshot({ path: path.join(outDir, `session-hint@${width}-${theme}.png`) })
    return { ok: true, hintButton: has, dialogs }
  })
  await browser.close()
  fs.writeFileSync(path.join(outDir, `_dictation@${width}-${theme}.json`), JSON.stringify({ base: BASE, width, theme, at: new Date().toISOString(), isolation: 'network-intercept · writes blocked', blockedWrites: blocked, steps }, null, 2))
  console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length} · 막은 쓰기 ${blocked.length}건`)
}

run().catch((e) => { console.error(e); process.exit(1) })
