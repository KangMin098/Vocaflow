// docs/research/r5-e2e-20261018/capture-r5.mjs
//
// R5 끝단 경로 화면 증거 — 합성 학습자(만들고 끝에 삭제)로 /csat/diagnosis?tab=map&view=full 을 열어 R5 Inspector 를 1280 · 1440 에서 캡처한다.
// 목표 저장 · 학습 기록 쓰기 없음(계정 생성 · 삭제만). 이메일 · 비밀번호 · UUID 는 결과에 남기지 않는다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> docs/research/r5-e2e-20261018/capture-r5.mjs --base http://localhost:3011
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3011')
const OUT = path.join(import.meta.dirname, 'screens')
fs.mkdirSync(OUT, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const email = `map-r5e2e-${Date.now()}@example.com`
const password = `R5-${crypto.randomBytes(9).toString('base64url')}-Aa1`
const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
if (error) throw error
const browser = await chromium.launch()
const TASK = 'r.central_meaning'
const dom = () => {
  const t = (id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].map((e) => e.textContent?.trim())
  return {
    ability: t('inspector-ability'),
    abilityProgress: document.querySelector('[data-testid="inspector-ability"]')?.getAttribute('data-progress') ?? null,
    supplyRows: [...document.querySelectorAll('[data-testid="inspector-supply"] li[data-role]')].map((l) => ({ role: l.getAttribute('data-role'), state: l.getAttribute('data-state'), step: l.getAttribute('data-step'), bucket: l.querySelector('[data-bucket]')?.getAttribute('data-bucket'), text: l.textContent?.trim() })),
    fallback: t('inspector-fallback'),
    principle: t('inspector-principle-path'),
    principleAiOnly: document.querySelector('[data-testid="inspector-principle-path"]')?.getAttribute('data-ai-only') ?? null,
    principleLinks: [...document.querySelectorAll('[data-testid="inspector-principle-link"]')].map((a) => a.getAttribute('href')?.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<uuid>')),
    returnSummary: t('inspector-return-summary'),
    returnNote: t('umap-return-note'),
    next: t('inspector-next'),
    blocked: t('inspector-blocked'),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
}
const results = {}
try {
  for (const width of (arg('--width', '') ? [Number(arg('--width'))] : [1280, 1440])) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await ctx.newPage()
    page.setDefaultTimeout(180_000)
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('input[type="email"]'); await page.waitForLoadState('load'); await page.waitForTimeout(4000)
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit', timeout: 60_000 }).catch(async (e) => { console.log('LOGIN-FAIL', await page.locator('form').innerText().catch(() => '')); throw e })
    for (const [name, q] of [['map', ''], ['return', `&map_task=${TASK}`]]) {
      await page.goto(`${BASE}/csat/diagnosis?tab=map&view=full${q}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-testid="umap-canvas"]')
      await page.waitForTimeout(800)
      await page.screenshot({ path: path.join(OUT, `${width}-${name}-map.png`) })
      await page.click(`[data-node="${TASK}"]`)
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(OUT, `${width}-${name}-popup.png`) })
      // 컴팩트 팝업 → 「자세한 근거 · 학습 경로」 서랍
      const opener = page.locator('[data-testid="pop-detail"]').first()
      if (!(await page.waitForSelector('[data-testid="pop-detail"]', { timeout: 8_000 }).catch(() => null))) { await page.click(`[data-node="${TASK}"]`); await page.waitForSelector('[data-testid="pop-detail"]', { timeout: 20_000 }).catch(() => null) }
      if (await opener.count()) await opener.click()
      await page.waitForSelector('[data-testid="task-inspector"]', { timeout: 30_000 }).catch(() => null)
      await page.waitForTimeout(400)
      const ins = page.locator('[data-testid="task-inspector"]')
      if (await ins.count()) {
        await page.screenshot({ path: path.join(OUT, `${width}-${name}-inspector.png`) })
        await ins.screenshot({ path: path.join(OUT, `${width}-${name}-inspector-full.png`) }).catch(() => null)
      }
      results[`${width}-${name}`] = await page.evaluate(dom)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  await db.auth.admin.deleteUser(u.user.id)
  const gone = await db.auth.admin.getUserById(u.user.id)
  results.accountDeleted = !gone.data?.user
  fs.writeFileSync(path.join(OUT, `dom-evidence${arg('--width', '') ? '-' + arg('--width') : ''}.json`), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 1).slice(0, 6000))
}
