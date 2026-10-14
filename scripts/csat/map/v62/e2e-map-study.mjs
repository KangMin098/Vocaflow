// scripts/csat/map/v62/e2e-map-study.mjs
//
// v6.2 P-M3b — 「TASK 를 고르고 → 허용된 기출 해부(출제 의도 · 정답 · 오답 설계)로 공부하고 → 같은 TASK · 계획으로 돌아온다」 + 노출 보호.
//   ① 기록 · 목표 뒤 R5: 기출 해부 링크에 안 푼 확인 · 전이 문항이 없다(보류 수만) · 연구 사례는 사람 검수 전 표시
//   ② 확인 문항 하나를 확인 모드로 푼다 → 지도로 돌아오면 그 문항이 「이미 풀어 본 확인 문항」 해부 링크로 열린다(나머지는 여전히 보류)
//   ③ 그 해부 링크 → 문항 해설 화면(정답 · 오답 설계) → 「학습 지도로」 → 같은 TASK 선택
//   ④ 해설 · 연구 근거를 연 것만으로 As-Is 근거 상태 · NeedRank 가 바뀌지 않는다
//   ⑤ E3 도 같은 규칙(안 푼 확인 문항 링크 없음)
// 합성 계정(끝에 삭제) — 학습 효과의 증거가 아니라 제품 흐름 · 노출 규칙 검증이다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-map-study.mjs --base http://localhost:3005
import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3005'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, label) => { const { data, error } = await q; if (error) throw new Error(`${label}: ${error.message}`); return data }
const results = []
const rec = (name, ok, detail) => { results.push({ name, ok }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`) }

const users = []
const browser = await chromium.launch()
try {
  const email = `map-v62-study-${Date.now()}@example.com`
  const password = `Ms-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  const key = Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', 'M2409'), 'key')).map((k) => [k.no, k.answers[0]]))
  const W = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  const choices = Object.fromEntries(Object.keys(key).map((no) => [no, W.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
  if ((await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: 'M2409', mode: 'live', takenAt: new Date().toISOString().slice(0, 10), totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })).status() !== 200) throw new Error('기록 실패')
  if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })).status() !== 200) throw new Error('목표 실패')

  const open = async (task) => {
    await page.goto(`${BASE}/csat/diagnosis?tab=map&map_task=${task}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector(`[data-testid="task-inspector"][data-task="${task}"]`)
    await page.waitForTimeout(400)
    return page.evaluate(() => ({
      links: [...document.querySelectorAll('[data-testid="inspector-study-link"]')].map((a) => ({ href: a.getAttribute('href'), basis: a.closest('li')?.getAttribute('data-basis') })),
      withheld: document.querySelector('[data-testid="inspector-study-withheld"]')?.textContent ?? null,
      next: document.querySelector('[data-testid="inspector-next"]')?.getAttribute('href') ?? null,
      evidence: document.querySelector('[data-testid="inspector-evidence"]')?.getAttribute('data-evidence') ?? null,
      need: document.querySelector('[data-testid="inspector-need"]')?.textContent ?? null,
    }))
  }
  const slugOf = (href) => href.split('#')[0].split('?')[0].split('/').pop()

  // ①
  const r1 = await open('r.central_meaning')
  const nextSlug = slugOf(r1.next)
  const attempted0 = r1.links.filter((l) => l.basis === 'attempted_check_item')
  rec('① 처음엔 안 푼 확인 문항 해부 링크가 없다(보류 안내만) · 다음 확인 문항도 링크에 없다', attempted0.length === 0 && !!r1.withheld && !r1.links.some((l) => slugOf(l.href) === nextSlug), { links: r1.links, withheld: r1.withheld, next: nextSlug })

  // ② 확인 문항 하나 풀기(확인 모드 · 오답 하나)
  await page.goto(`${BASE}${r1.next.split('#')[0]}`, { waitUntil: 'domcontentloaded' })
  const panel = page.locator('[data-testid="principle-panel"]')
  await panel.waitFor({ timeout: 120_000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  const task = panel.locator('[data-testid="principle-task"]')
  for (let k = 0; k < 10 && !(await task.count()); k++) {
    await panel.getByRole('button', { name: '직접 확인하기' }).click({ timeout: 10_000 }).catch(() => {})
    await page.waitForTimeout(800)
  }
  await panel.locator('[data-claim]').last().click()
  await panel.locator('[data-support]').first().click()
  await panel.locator('[data-relation]').last().check().catch(() => {})
  const resp = page.waitForResponse((r) => /\/api\/csat\/item\/.+\/task/.test(r.url()))
  await panel.getByRole('button', { name: '확인하기' }).click()
  rec('② 확인 문항 풀이 저장', (await resp).status() === 200)
  const r2 = await open('r.central_meaning')
  const opened = r2.links.filter((l) => l.basis === 'attempted_check_item').map((l) => slugOf(l.href))
  rec('② 푼 문항만 「이미 풀어 본 확인 문항」 해부로 열리고, 다른 확인 문항은 계속 보류', opened.length === 1 && opened[0] === nextSlug && !!r2.withheld, { opened, withheld: r2.withheld })

  // ③ 해부 → 해설 → 지도로
  const study = r2.links.find((l) => l.basis === 'attempted_check_item').href
  const q = new URL(study, BASE).searchParams
  await page.goto(`${BASE}${study}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="item-back-map"]')
  const explainShown = (await page.locator('[data-testid="item-check-mode"]').count()) === 0
  const back = await page.getAttribute('[data-testid="item-back-map"]', 'href')
  await page.goto(`${BASE}${back}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="unified-map"]')
  const sel = await page.getAttribute('[data-testid="unified-map"]', 'data-selected')
  rec('③ 해부 링크는 해설 화면(확인 모드 아님) · 문맥(map_task · ws) 실림 · 「학습 지도로」 → 같은 TASK', explainShown && q.get('map_task') === 'r.central_meaning' && sel === 'r.central_meaning', { explainShown, mapTask: q.get('map_task'), selected: sel })

  // ④ 해설 · 연구 근거 열람만으로는 상태 불변
  await page.click('[data-testid="inspector-research"] summary').catch(() => {})
  const r4 = await open('r.central_meaning')
  rec('④ 해설 · 연구 근거를 본 것만으로 근거 상태 · 요구가 바뀌지 않는다', r4.evidence === r2.evidence && r4.need === r2.need, { before: { e: r2.evidence, n: r2.need }, after: { e: r4.evidence, n: r4.need } })

  // ⑤ E3
  const e3 = await open('e.option_correspondence')
  const e3Next = e3.next ? slugOf(e3.next) : null
  rec('⑤ E3 도 안 푼 확인 문항은 해부 링크에 없다', e3.links.filter((l) => l.basis === 'attempted_check_item').length === 0 && !e3.links.some((l) => slugOf(l.href) === e3Next), { links: e3.links.length, next: e3Next })
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
}
const failed = results.filter((r) => !r.ok).length
console.log(failed ? `FAIL ${failed}` : 'ALL PASS')
process.exit(failed ? 1 : 0)
