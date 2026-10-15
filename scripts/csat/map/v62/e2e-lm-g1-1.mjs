// scripts/csat/map/v62/e2e-lm-g1-1.mjs
//
// LM-G1.1 — R5 다음 행동 단일 출처 브라우저 검증(T13–T20). 합성 계정(끝에 삭제) · 기존 기록 API(/api/csat/item/{slug}/task)로만 시도를 남긴다.
//   ① 직접 확인 2 실패 → REPAIR   ② 바로잡기 2 실패 → 수행 2 · 모든 표면이 바로잡기 · 재시도 링크(막힌 문항)
//   ③ 바로잡기 정답 → 모든 표면이 같은 다음 단계   ④ 학습 후 복귀 → 같은 TASK · Workspace   ⑤ 과거 asof → 학습 시작 링크 0
// 표면: 빠른 팝업(pop-next) · Workspace 행(ws-next · 단계) · 상세 모달(ws-stage now · ws-modal-next) · PLAN 탭(R5 data-stage · plan-go) · 근거 드로어(inspector-next) · 상단 띠(umap-top-next, R5 가 1번일 때).
// 정답 · 오답은 주석(apps/web/src/lib/knowledge/annotations/claim-support-*.json)으로 만든다. 학습 효과 증거 아님. 이메일 · 비밀번호 · id 는 남기지 않는다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-lm-g1-1.mjs --base http://localhost:3005 --evidence <dir>
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
const EVID = path.resolve(ROOT, arg('--evidence', 'tmp/lm-g1-1'))
const T = 'r.central_meaning'
const WS = 'ws.central-meaning'
const ANN = path.join(ROOT, 'apps/web/src/lib/knowledge/annotations')
fs.mkdirSync(EVID, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const results = []
const rec = (name, ok, detail) => { results.push({ name, ok, detail: detail ?? null }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 500)}` : ''}`) }
const users = []
const browser = await chromium.launch()
let shots = 0
const shot = (page, name) => page.screenshot({ path: path.join(EVID, `${String(++shots).padStart(2, '0')}-${name}.png`) })
const slugOf = (href) => href ? href.split('#')[0].split('?')[0].split('/').pop() : null

function annotation(slug) {
  const files = fs.readdirSync(ANN).filter((f) => f.startsWith(`claim-support-${slug.toLowerCase()}.v`)).sort()
  if (!files.length) throw new Error(`주석 없음 ${slug}`)
  return JSON.parse(fs.readFileSync(path.join(ANN, files.at(-1)), 'utf8'))
}
async function answer(page, slug, ok) {
  const a = annotation(slug)
  const response = { claim: ok ? a.claim : (a.claim + 1) % a.sentenceCount, support: a.support, relation: a.relationProbe.relation }
  const r = await page.request.post(`${BASE}/api/csat/item/${slug}/task`, { data: { response, sec: 40, clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date().toISOString(), helpLevel: 'independent' } })
  const j = await r.json().catch(() => null)
  await page.waitForTimeout(1200) // 시각 순서가 갈리게
  return { status: r.status(), isCorrect: j?.grade?.isCorrect ?? null }
}
async function login() {
  const email = `map-lmg11-${Date.now()}@example.com`
  const password = `Lg-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(120_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })).status() !== 200) throw new Error('목표 실패')
  return { ctx, page }
}
async function openMap(page, q = '') {
  await page.goto(`${BASE}/csat/diagnosis?tab=map&view=full&map_task=${T}&ws=${WS}${q}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="umap-canvas"]', { timeout: 120_000 })
  await page.waitForTimeout(700)
}
// 모든 표면을 한 번에 읽는다 — 같은 근거를 서로 다르게 말하는지 본다
async function surfaces(page, name) {
  const s = {}
  s.selected = await page.getAttribute('[data-testid="unified-map"]', 'data-selected')
  s.ws = await page.getAttribute('[data-testid="unified-map"]', 'data-ws')
  s.top = await page.$eval('[data-testid="umap-top-next"]', (a) => ({ task: a.getAttribute('data-task'), href: a.getAttribute('href') })).catch(() => null)
  s.row = await page.$eval(`[data-testid="ws-row"][data-ws="${WS}"]`, (r) => ({ state: r.getAttribute('data-state'), stage: r.querySelector('[class*="trackName"]')?.textContent ?? null, next: r.querySelector('[data-testid="ws-next"]')?.getAttribute('href') ?? null })).catch(() => null)
  // 빠른 팝업 — 초점 잡힌 R5 를 한 번 더 누른다
  await page.click(`[data-node="${T}"]`)
  await page.waitForSelector(`[data-testid="task-pop"][data-task="${T}"]`).catch(() => {})
  s.pop = await page.$eval('[data-testid="task-pop"]', (p) => ({ next: p.querySelector('[data-testid="pop-next"]')?.getAttribute('href') ?? null, blocked: p.querySelector('[data-testid="pop-blocked"]')?.getAttribute('data-reason') ?? null, stage: [...p.querySelectorAll('dd')][2]?.textContent ?? null })).catch(() => null)
  // 근거 드로어
  await page.click('[data-testid="pop-detail"]').catch(() => {})
  await page.waitForSelector('[data-testid="ins-drawer"] [data-testid="task-inspector"]').catch(() => {})
  s.drawer = await page.$eval('[data-testid="ins-drawer"]', (d) => ({ next: d.querySelector('[data-testid="inspector-next"]')?.getAttribute('href') ?? null, current: d.querySelector('[data-current="true"]')?.getAttribute('data-stage') ?? null })).catch(() => null)
  if (name) await shot(page, `${name}-drawer`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // Workspace 상세 모달 · PLAN 탭
  await page.click(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`)
  await page.waitForSelector('[data-testid="ws-modal"]')
  s.modal = await page.$eval('[data-testid="ws-modal"]', (m) => ({ now: m.querySelector('[data-testid="ws-stage"][data-now="true"]')?.getAttribute('data-stage') ?? null, next: m.querySelector('[data-testid="ws-modal-next"]')?.getAttribute('href') ?? null }))
  if (name) await shot(page, `${name}-modal`)
  await page.click('[data-testid="ws-tab-plan"]')
  await page.waitForSelector('[data-testid="ws-modal"] [data-testid="plan-section"]')
  s.plan = await page.$eval(`[data-testid="plan-section"] li[data-task="${T}"]`, (li) => ({ stage: li.getAttribute('data-stage'), done: li.getAttribute('data-done'), go: li.querySelector('[data-testid="plan-go"]')?.getAttribute('href') ?? null })).catch(() => null)
  if (name) await shot(page, `${name}-plan`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  s.overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  return s
}
const same = (...hrefs) => { const xs = hrefs.filter((h) => h !== undefined).map(slugOf); return xs.length > 0 && xs.every((x) => x === xs[0]) }

try {
  const { ctx, page } = await login()
  // ① 직접 확인 2 실패 — 지도가 내미는 확인 문항(R5 다음 행동)에 오답
  const checked = []
  for (let i = 0; i < 2; i++) {
    await openMap(page)
    const s = await surfaces(page, null)
    const href = s.drawer?.next ?? s.pop?.next
    const slug = slugOf(href)
    if (!slug) throw new Error(`확인 문항 링크 없음 ${JSON.stringify(s)}`)
    checked.push({ slug, ...(await answer(page, slug, false)) })
  }
  await openMap(page)
  const s1 = await surfaces(page, 'T01')
  const blocked = checked.map((c) => c.slug)
  rec('T01 직접 확인 2 실패 → 모든 표면이 바로잡기 · 막힌 문항 링크', checked.every((c) => c.status === 200 && c.isCorrect === false) && s1.plan?.stage === 'repair' && s1.modal?.now === 'repair' && blocked.includes(slugOf(s1.pop?.next)) && same(s1.pop?.next, s1.drawer?.next, s1.row?.next, s1.plan?.go), { checked, s1 })

  // ② 바로잡기 2회 실패(G02)
  const repairs = []
  for (const slug of blocked) repairs.push({ slug, ...(await answer(page, slug, false)) })
  await openMap(page)
  const s2 = await surfaces(page, 'T02')
  rec('T02 (G02) 바로잡기 2 실패 → 수행 2 유지 · PLAN · 모달 · 행 모두 바로잡기(TRANSFER 아님)', repairs.every((r) => r.status === 200 && r.isCorrect === false) && s2.plan?.stage === 'repair' && s2.plan?.done === '2' && s2.modal?.now === 'repair', { repairs, plan: s2.plan, modal: s2.modal, row: s2.row })
  rec('T16 · T03 실패한 바로잡기 재시도 링크가 실제로 있고 막힌 문항이다', !!s2.pop?.next && blocked.includes(slugOf(s2.pop.next)), { pop: s2.pop })
  rec('T13 · T14 · T15 지도 팝업 = Workspace 행 = 상세 모달 = PLAN 탭 = 근거 드로어(같은 다음 행동)', same(s2.pop?.next, s2.drawer?.next, s2.row?.next, s2.modal?.next, s2.plan?.go) && (s2.top === null || s2.top.task !== T || same(s2.top.href, s2.pop?.next)), { pop: s2.pop?.next, drawer: s2.drawer?.next, row: s2.row?.next, modal: s2.modal?.next, plan: s2.plan?.go, top: s2.top })
  rec('T20 페이지 가로 넘침 0(1440)', s2.overflowX === 0, { overflowX: s2.overflowX })

  // ④ 학습 후 복귀(T18) — 행의 다음 행동으로 문항에 갔다가 「학습 지도로」
  await openMap(page)
  const go = await page.getAttribute(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-next"]`, 'href')
  await page.goto(`${BASE}${go}`, { waitUntil: 'domcontentloaded' })
  // 확인 모드 문항은 해설을 열어야 「학습 지도로」 가 나온다(e2e-map-return 과 같은 절차 · 시도 기록은 남기지 않는다)
  if (await page.waitForSelector('[data-testid="item-check-mode"]', { timeout: 60_000 }).catch(() => null)) await page.click('[data-testid="item-check-explain"]')
  const back = await page.waitForSelector('[data-testid="item-back-map"]', { timeout: 120_000 }).then(() => page.getAttribute('[data-testid="item-back-map"]', 'href')).catch(() => null)
  if (back) {
    await page.goto(`${BASE}${back}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="unified-map"]')
    await page.waitForTimeout(600)
  }
  const r18 = { back: back ? new URL(back, BASE).searchParams.get('map_task') : null, selected: await page.getAttribute('[data-testid="unified-map"]', 'data-selected').catch(() => null), ws: await page.getAttribute('[data-testid="unified-map"]', 'data-ws').catch(() => null) }
  rec('T18 학습 후 지도 복귀 → 같은 TASK · Workspace 문맥', r18.back === T && r18.selected === T && r18.ws === WS, r18)

  // ③ 바로잡기 정답 → 모든 표면이 같은 다음 단계
  const fix = await answer(page, blocked[0], true)
  await openMap(page)
  const s3 = await surfaces(page, 'T04')
  rec('T04 적격 바로잡기 성공 → PLAN 단계가 바로잡기를 벗어나고 모든 표면이 같은 단계 · 같은 링크', fix.isCorrect === true && s3.plan?.stage !== 'repair' && s3.plan?.stage === s3.modal?.now && same(s3.pop?.next, s3.drawer?.next, s3.row?.next, s3.modal?.next, s3.plan?.go), { fix, plan: s3.plan, modal: s3.modal, pop: s3.pop, row: s3.row })
  rec('T17 링크가 없는 단계는 학습 가능으로 보이지 않는다(행 상태 · 링크 일치)', (s3.row?.next === null) === (s3.row?.state === 'locked' || s3.row?.state === 'preparing'), { row: s3.row })

  // ⑤ 과거 asof — 모든 학습 시작 표면 0
  const y = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  await openMap(page, `&asof=${y}`)
  await page.click(`[data-node="${T}"]`).catch(() => {})
  await page.waitForTimeout(500)
  const past = await page.$$eval('[data-testid="pop-next"], [data-testid="ws-next"], [data-testid="umap-top-next"], [data-testid="inspector-next"], [data-testid="ws-modal-next"], [data-testid="plan-go"]', (xs) => xs.length)
  rec('T19 과거 asof → 학습 시작 링크 0(팝업 · 행 · 띠 · 드로어 · 모달 · PLAN)', past === 0, { past })
  await shot(page, 'T19-past')
  await ctx.close()
} finally {
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  let left = 0
  for (const id of users) { const { data } = await db.auth.admin.getUserById(id); if (data?.user) left++ }
  await browser.close()
  fs.writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({ base: BASE, pass: results.filter((r) => r.ok).length, fail: results.filter((r) => !r.ok).length, accountsLeft: left, results }, null, 2))
  console.log(`accounts created ${users.length} · left ${left}`)
  console.log(`PASS ${results.filter((r) => r.ok).length} · FAIL ${results.filter((r) => !r.ok).length}`)
}
