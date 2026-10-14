// scripts/csat/map/v62/shot-unified-map.mjs
//
// 학습지도 v6.2 P-M1 화면 확인 — 임시 합성 계정(끝에 삭제)으로 단일 지도를 1280 · 1440 에서 찍고 기하를 잰다.
//   상태: A 기록 0 · 목표 없음  /  D M2409 기록 + 목표 80. 진입: /csat(홈) · ?tab=map · ?tab=map&view=full
//   잰 값: 페이지 가로 넘침 · Inspector 폭 · TASK 노드 수(30) · 고른 영역 열 폭 · 서로 다른 지도 엔진(옛 learner-map/read-path) 0
// 합성 계정 화면 확인은 제품 동작 검증이지 학습 효과가 아니다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/shot-unified-map.mjs --base http://localhost:3005 --out tmp/v62-shots
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3005')
const OUT = path.resolve(ROOT, arg('--out', 'tmp/v62-shots'))
const READY = 'M2409'
fs.mkdirSync(OUT, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, label) => { const { data, error } = await q; if (error) throw new Error(`${label}: ${error.message}`); return data }

const users = []
const browser = await chromium.launch()
const results = []
async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
}
async function measure(page, tag) {
  const m = await page.evaluate(() => {
    const ins = document.querySelector('[data-testid="task-inspector"]')
    const wide = document.querySelector('[data-wide="true"]')
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      nodeSpill: [...document.querySelectorAll('[data-testid="umap-node"]')].filter((n) => { const c = n.closest('section[data-domain]').getBoundingClientRect(); const r = n.getBoundingClientRect(); return r.right > c.right + 0.5 || r.left < c.left - 0.5 }).length,
      canvasOverflow: (() => { const c = document.querySelector('[data-testid="umap-canvas"]'); return c ? c.scrollWidth - c.clientWidth : null })(),
      inspectorW: ins ? Math.round(ins.getBoundingClientRect().width) : null,
      nodes: document.querySelectorAll('[data-testid="umap-node"]').length,
      domains: document.querySelectorAll('[data-testid="umap-domain"]').length,
      wideColW: wide ? Math.round(wide.getBoundingClientRect().width) : null,
      oldEngines: document.querySelectorAll('[data-testid="learner-map"], [data-testid="read-path"], [data-testid="need-panel"]').length,
      unified: document.querySelectorAll('[data-testid="unified-map"]').length,
      selected: document.querySelector('[data-testid="unified-map"]')?.getAttribute('data-selected') ?? null,
      next: document.querySelector('[data-testid="inspector-next"]')?.getAttribute('href') ?? null,
      blocked: document.querySelector('[data-testid="inspector-blocked"]')?.getAttribute('data-reason') ?? null,
      records: document.querySelector('[data-testid="umap-records"]')?.textContent?.replace(/\s+/g, ' ').slice(0, 80) ?? null,
    }
  })
  results.push({ tag, ...m })
  console.log(tag, JSON.stringify(m))
}

try {
  for (const state of ['A', 'D']) {
    const email = `map-v62-shot-${state.toLowerCase()}-${Date.now()}@example.com`
    const password = `Mv-${crypto.randomBytes(9).toString('base64url')}-Aa1`
    const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    users.push(u.user.id)
    for (const width of [1280, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } })
      const page = await ctx.newPage()
      page.setDefaultTimeout(240_000)
      await login(page, email, password)
      if (state === 'D' && width === 1280) {
        const key = Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', READY), 'key')).map((k) => [k.no, k.answers[0]]))
        const W = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
        const choices = Object.fromEntries(Object.keys(key).map((no) => [no, W.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
        const r = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: READY, mode: 'live', takenAt: new Date().toISOString().slice(0, 10), totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })
        if (r.status() !== 200) throw new Error(`기록 실패 ${r.status()}`)
        if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })).status() !== 200) throw new Error('목표 실패')
        for (let i = 0; i < 60; i++) {
          if ((await must(db.from('csat_dx_snapshot').select('id').eq('user_id', u.user.id).limit(1), 'snapshot')).length) break
          await new Promise((r2) => setTimeout(r2, 1000))
        }
      }
      for (const [name, url] of [['diag', '/csat/diagnosis?tab=map'], ['full', '/csat/diagnosis?tab=map&view=full'], ['home', '/csat']]) {
        await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" })
        await page.waitForSelector('[data-testid="unified-map"]', { timeout: 120_000 })
        const tag = `${state}-${name}-${width}`
        await measure(page, tag)
        await page.screenshot({ path: path.join(OUT, `${tag}.png`), fullPage: false })
      }
      if (state === 'D' && width === 1440) {
        // 상호작용 — 다른 영역 TASK 선택 → Inspector 갱신 · 그 영역 열 확장 / 학습계획 열기 / 기출 근거 시트 / 검색 / 키보드
        await page.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('[data-testid="unified-map"]')
        await page.click('[data-node="e.evidence_location"]')
        await page.waitForSelector('[data-testid="task-inspector"][data-task="e.evidence_location"]')
        const wideE = await page.getAttribute('[data-domain="E"]', 'data-wide')
        await measure(page, 'D-select-E2-1440')
        await page.screenshot({ path: path.join(OUT, 'D-select-E2-1440.png') })
        await page.click('[data-testid="inspector-plan-toggle"]')
        await page.waitForSelector('[data-testid="umap-plan"] [data-testid="plan-section"]', { timeout: 30_000 })
        await page.locator('[data-testid="umap-plan"] [data-testid="plan-section"]').scrollIntoViewIfNeeded()
        await page.screenshot({ path: path.join(OUT, 'D-plan-open-1440.png') })
        await page.click('[data-node="l.sound"]')
        const holdBlocked = await page.getAttribute('[data-testid="inspector-blocked"]', 'data-reason').catch(() => null)
        await page.fill('[data-testid="umap-search"]', '근거')
        const dimmed = await page.locator('[data-testid="umap-node"][data-dim="true"]').count()
        await page.fill('[data-testid="umap-search"]', '')
        await page.focus('[data-node="v.core_meaning"]')
        await page.keyboard.press('Enter')
        const kb = await page.getAttribute('[data-testid="task-inspector"]', 'data-task')
        const detail = await page.$('[data-testid="inspector-evidence-detail"]')
        let sheet = false
        if (detail) {
          await detail.click()
          sheet = (await page.locator('[role="dialog"]').count()) > 0
          await page.screenshot({ path: path.join(OUT, 'D-step-sheet-1440.png') })
        }
        const r = { tag: 'D-interact-1440', wideE, holdBlocked, dimmed, keyboardSelect: kb, stepSheet: sheet }
        results.push(r)
        console.log(JSON.stringify(r))
      }
      await ctx.close()
    }
  }
  fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(results, null, 2))
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
}
