// scripts/csat/map/v62/shot-rail-zoom.mjs
//
// 학습지도 v6.2 P-M1 QA — 레일 펼침(220) / 접힘(64) × 1280 · 1440 × 브라우저 확대 100 · 125 %(CSS 폭 = 화면 폭 / 1.25).
// 임시 합성 계정(기록 0 · 끝에 삭제). 재는 것: 페이지 가로 넘침 · 노드가 자기 열 밖 · 레일 폭 · Inspector 폭 · Tab 키로 노드에 초점이 가는가.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/shot-rail-zoom.mjs --base http://localhost:3005 --out tmp/v62-shots
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
fs.mkdirSync(OUT, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const email = `map-v62-rail-${Date.now()}@example.com`
const password = `Mr-${crypto.randomBytes(9).toString('base64url')}-Aa1`
const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
if (error) throw error
const browser = await chromium.launch()
const rows = []
try {
  for (const rail of ['closed', 'open']) {
    for (const screen of [1280, 1440]) {
      for (const zoom of [1, 1.25]) {
        const ctx = await browser.newContext({ viewport: { width: Math.round(screen / zoom), height: Math.round(900 / zoom) }, deviceScaleFactor: zoom })
        await ctx.addInitScript((v) => { try { localStorage.setItem('csat-rail', v) } catch {} }, rail)
        const page = await ctx.newPage()
        page.setDefaultTimeout(240_000)
        await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
        await page.fill('input[type="email"]', email)
        await page.fill('input[type="password"]', password)
        await page.click('button[type="submit"]')
        await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
        await page.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('[data-testid="unified-map"]')
        await page.waitForTimeout(800)
        const m = await page.evaluate(() => {
          const railEl = document.querySelector('nav[aria-label], aside nav, [data-rail]')?.closest('aside, nav')
          const ins = document.querySelector('[data-testid="task-inspector"]')
          return {
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            nodeSpill: [...document.querySelectorAll('[data-testid="umap-node"]')].filter((n) => { const c = n.closest('section[data-domain]').getBoundingClientRect(); const r = n.getBoundingClientRect(); return r.right > c.right + 0.5 || r.left < c.left - 0.5 }).length,
            railW: railEl ? Math.round(railEl.getBoundingClientRect().width) : null,
            inspectorW: ins ? Math.round(ins.getBoundingClientRect().width) : null,
            nodes: document.querySelectorAll('[data-testid="umap-node"]').length,
            minColW: Math.round(Math.min(...[...document.querySelectorAll('section[data-domain]')].map((c) => c.getBoundingClientRect().width))),
            wrapW: Math.round(document.querySelector('[data-testid="unified-map"]').getBoundingClientRect().width),
          }
        })
        // 키보드 — 검색 칸에서 Tab 을 눌러 가며 노드에 초점이 닿는지(최대 40회)
        await page.focus('[data-testid="umap-search"]')
        let reached = null
        for (let i = 0; i < 40 && !reached; i++) {
          await page.keyboard.press('Tab')
          reached = await page.evaluate(() => document.activeElement?.getAttribute('data-node') ?? null)
        }
        const tag = `rail-${rail}-${screen}-z${zoom * 100}`
        await page.screenshot({ path: path.join(OUT, `${tag}.png`) })
        const r = { tag, ...m, keyboardNode: reached }
        rows.push(r)
        console.log(JSON.stringify(r))
        await ctx.close()
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'rail-zoom.json'), JSON.stringify(rows, null, 2))
} finally {
  await browser.close()
  await db.auth.admin.deleteUser(u.user.id).catch(() => {})
}
