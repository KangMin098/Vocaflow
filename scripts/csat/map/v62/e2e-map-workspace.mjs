// scripts/csat/map/v62/e2e-map-workspace.mjs
//
// 학습지도 × Workspace 통합 화면(LM-W1) — 화면 측정 · 상호작용 브라우저 검증.
//   --audit : 변경 전 · 후 같은 자로 잰다(페이지 높이 · 지도 캔버스 면적 · 컴포넌트 수 · 가로 넘침) — 결과를 비교 표에 쓴다.
//   기본    : 통합 화면 수용 시나리오(TASK → Workspace 강조 · Workspace → TASK 강조 · 팝업 · 모달 · ESC · 포커스 복귀 · 새로 고침 · 30 TASK).
// 합성 계정(끝에 삭제) — 학습 효과의 증거가 아니다. 계정 이메일 · 비밀번호 · id 는 남기지 않는다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-map-workspace.mjs --base http://localhost:3005 --evidence <dir> [--audit] [--label before]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const AUDIT = process.argv.includes('--audit')
const LABEL = arg('--label', AUDIT ? 'audit' : 'accept')
const BASE = arg('--base', 'http://localhost:3005')
const EVID = path.resolve(ROOT, arg('--evidence', 'tmp/v62-map-workspace'))
const READY = 'M2409'
fs.mkdirSync(EVID, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, label) => { const { data, error } = await q; if (error) throw new Error(`${label}: ${error.message}`); return data }
const startedAt = new Date().toISOString()
const results = []
const rec = (name, ok, detail) => { results.push({ name, ok, detail: detail ?? null }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ''}`) }
const users = []
const browser = await chromium.launch()
let shots = 0

async function account() {
  const email = `map-v62-ws-${Date.now()}@example.com`
  const password = `Mw-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  return { email, password }
}
async function open(acc, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', acc.email)
  await page.fill('input[type="password"]', acc.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  return { ctx, page }
}
async function map(page, q = '&view=full') {
  await page.goto(`${BASE}/csat/diagnosis?tab=map${q}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="umap-canvas"]', { timeout: 120_000 })
  await page.waitForTimeout(600)
}
const shot = (page, name, full = false) => page.screenshot({ path: path.join(EVID, `${String(++shots).padStart(2, '0')}-${name}.png`), fullPage: full })

// 같은 자 — 변경 전 · 후 모두 이 함수로 잰다
const measure = (page) => page.evaluate(() => {
  const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height) } }
  const root = document.querySelector('[data-testid="unified-map"]')
  const count = (sel) => document.querySelectorAll(sel).length
  return {
    viewport: { w: innerWidth, h: innerHeight },
    pageHeight: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    root: r('[data-testid="unified-map"]'),
    goalBar: r('[data-testid="umap-goalbar"], [data-testid="umap-top"]'),
    focusStrip: r('[data-testid="focus-strip"]'),
    canvas: r('[data-testid="umap-canvas"]'),
    inspector: r('[data-testid="task-inspector"]'),
    wsList: r('[data-testid="ws-list"]'),
    // 첫 화면(접힘선 위)에서 지도 캔버스가 차지하는 비율
    canvasAboveFold: (() => { const b = document.querySelector('[data-testid="umap-canvas"]')?.getBoundingClientRect(); if (!b) return null; const vis = Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0)) * Math.max(0, Math.min(b.right, innerWidth) - Math.max(b.left, 0)); return Math.round((vis / (innerWidth * innerHeight)) * 1000) / 10 })(),
    wsListTop: (() => { const b = document.querySelector('[data-testid="ws-list"]')?.getBoundingClientRect(); return b ? Math.round(b.top + scrollY) : null })(),
    nodes: count('[data-testid="umap-node"]'),
    cards: count('[data-testid="focus-card"]'),
    sections: root ? root.querySelectorAll('section, aside, details').length : null,
    buttons: root ? root.querySelectorAll('button, a[href]').length : null,
    textChars: root ? root.innerText.replace(/\s+/g, '').length : null,
  }
})

async function seed(page) {
  const key = Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', READY), 'key')).map((k) => [k.no, k.answers[0]]))
  const W = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  const choices = Object.fromEntries(Object.keys(key).map((no) => [no, W.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
  const r = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: READY, mode: 'live', takenAt: new Date().toISOString().slice(0, 10), totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })
  if (r.status() !== 200) throw new Error(`기록 실패 ${r.status()}`)
  if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })).status() !== 200) throw new Error('목표 실패')
}

const wsState = (page) => page.evaluate(() => ({
  selected: document.querySelector('[data-testid="unified-map"]')?.getAttribute('data-selected') ?? null,
  selectedWs: document.querySelector('[data-testid="unified-map"]')?.getAttribute('data-ws') ?? null,
  rows: [...document.querySelectorAll('[data-testid="ws-row"]')].map((e) => ({ id: e.getAttribute('data-ws'), link: e.getAttribute('data-link'), state: e.getAttribute('data-state'), sel: e.getAttribute('aria-pressed') ?? e.getAttribute('data-selected') })),
  nodes: Object.fromEntries([...document.querySelectorAll('[data-testid="umap-node"]')].filter((e) => e.getAttribute('data-link') && e.getAttribute('data-link') !== 'none').map((e) => [e.getAttribute('data-node'), e.getAttribute('data-link')])),
  popup: document.querySelector('[data-testid="task-pop"]')?.getAttribute('data-task') ?? null,
  modal: document.querySelector('[data-testid="ws-modal"]')?.getAttribute('data-ws') ?? null,
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))
const inView = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), ok: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight } }, sel)

try {
  const acc = await account()
  {
    const { ctx, page } = await open(acc, 1440)
    await seed(page)
    for (let i = 0; i < 60; i++) {
      await map(page)
      if (await page.$('[data-testid="ws-row"], [data-testid="focus-card"]')) break
      await page.waitForTimeout(3000)
    }
    await ctx.close()
  }

  if (AUDIT) {
    const out = {}
    for (const width of [1280, 1440]) {
      const { ctx, page } = await open(acc, width)
      for (const [k, q] of [['core', ''], ['full', '&view=full']]) {
        await map(page, q)
        out[`${width}-${k}`] = await measure(page)
        await shot(page, `${LABEL}-${width}-${k}`)
        await shot(page, `${LABEL}-${width}-${k}-page`, true)
      }
      await ctx.close()
    }
    fs.writeFileSync(path.join(EVID, `${LABEL}-measure.json`), JSON.stringify({ startedAt, base: BASE, measure: out }, null, 2))
    console.log(JSON.stringify(out, null, 1).slice(0, 3000))
  } else {
    for (const width of [1440, 1280]) {
      const { ctx, page } = await open(acc, width)
      await map(page)
      const s0 = await wsState(page)
      const m = await measure(page)
      rec(`W01 구조(${width}) — 상단 띠 → 지도 → 바로 아래 Workspace 리스트 · 오른쪽 상시 패널 없음 · 가로 넘침 0`, !!m.wsList && !!m.canvas && m.wsList.y >= m.canvas.y + m.canvas.h - 4 && m.wsList.y - (m.canvas.y + m.canvas.h) < 120 && !m.inspector && m.overflowX === 0, { canvas: m.canvas, wsList: m.wsList, inspector: m.inspector, overflowX: m.overflowX })
      rec(`W02 30 TASK 노드(${width})`, m.nodes === 30, { nodes: m.nodes })
      const first = s0.rows[0]
      rec(`W03 대표 Workspace 가 첫 줄 · 행마다 상태(${width})`, !!first && s0.rows.every((r) => r.state), s0.rows)
      if (width === 1440) await shot(page, 'W-1440-initial')
      // Workspace → TASK
      if (first) {
        await page.click(`[data-testid="ws-row"][data-ws="${first.id}"] [data-testid="ws-select"]`)
        await page.waitForTimeout(400)
        const s1 = await wsState(page)
        const linked = Object.entries(s1.nodes)
        rec(`W04 Workspace 선택 → 지도에 중심(core) · 지원(support) 강조 · 다른 행은 남음(${width})`, s1.selectedWs === first.id && linked.some(([, v]) => v === 'core') && s1.rows.length === s0.rows.length, { selectedWs: s1.selectedWs, linked })
        if (width === 1440) await shot(page, 'W-1440-ws-selected')
        // 같은 Workspace 상세(모달) — ESC · 포커스 복귀
        await page.click(`[data-testid="ws-row"][data-ws="${first.id}"] [data-testid="ws-open"]`)
        await page.waitForSelector('[data-testid="ws-modal"]')
        await page.waitForTimeout(300)
        const box = await inView(page, '[data-testid="ws-modal"]')
        const lock = await page.evaluate(() => getComputedStyle(document.body).overflow)
        const stages = await page.$$eval('[data-testid="ws-modal"] [data-testid="ws-stage"]', (xs) => xs.map((x) => x.getAttribute('data-stage')))
        rec(`W05 Workspace 상세 팝업 — 화면 안 · 스크롤 잠금 · 4단계(${width})`, !!box?.ok && lock === 'hidden' && stages.join(',') === 'check,repair,transfer,recheck', { box, lock, stages })
        if (width === 1440) await shot(page, 'W-1440-ws-modal')
        await page.keyboard.press('Escape')
        await page.waitForTimeout(250)
        const back = await page.evaluate(() => ({ modal: !!document.querySelector('[data-testid="ws-modal"]'), focus: document.activeElement?.getAttribute('data-testid'), lock: getComputedStyle(document.body).overflow }))
        rec(`W06 ESC 닫기 → 여는 버튼으로 포커스 복귀 · 잠금 해제(${width})`, !back.modal && back.focus === 'ws-open' && back.lock !== 'hidden', back)
      }
      // TASK → Workspace
      const coreTask = await page.evaluate(() => document.querySelector('[data-testid="umap-node"][data-link="core"]')?.getAttribute('data-node') ?? null)
      const t = coreTask ?? 'r.central_meaning'
      await page.click(`[data-node="${t}"]`)
      await page.waitForSelector(`[data-testid="task-pop"][data-task="${t}"]`)
      await page.waitForTimeout(300)
      const s2 = await wsState(page)
      const pbox = await inView(page, '[data-testid="task-pop"]')
      rec(`W07 TASK 선택 → 빠른 팝업(화면 안) · 관련 Workspace 행 강조(중심/지원 구분) · 다른 행 숨김 없음(${width})`, s2.selected === t && s2.popup === t && !!pbox?.ok && s2.rows.some((r) => r.link === 'core' || r.link === 'support') && s2.rows.length >= 1, { t, rows: s2.rows, pbox })
      if (width === 1440) await shot(page, 'W-1440-task-pop')
      // 무한 반복 · 튐 없음 — 500ms 뒤에도 같은 선택
      await page.waitForTimeout(500)
      const s3 = await wsState(page)
      rec(`W08 선택이 다른 TASK/Workspace 로 튀지 않음(${width})`, s3.selected === s2.selected && s3.selectedWs === s2.selectedWs, { a: [s2.selected, s2.selectedWs], b: [s3.selected, s3.selectedWs] })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(250)
      const closed = await page.evaluate(() => ({ pop: !!document.querySelector('[data-testid="task-pop"]'), focus: document.activeElement?.getAttribute('data-node') }))
      rec(`W09 TASK 팝업 ESC → 노드로 포커스 복귀(${width})`, !closed.pop && closed.focus === t, closed)
      // 키보드로 노드 열기
      await page.focus(`[data-node="${t}"]`)
      await page.keyboard.press('Enter')
      await page.waitForSelector('[data-testid="task-pop"]')
      rec(`W10 키보드 Enter 로 TASK 팝업(${width})`, true)
      // 자세한 근거 드로어 — 오른쪽 · 화면 안 · 기존 Inspector 내용 · Esc → 노드로 포커스
      await page.click('[data-testid="pop-detail"]')
      await page.waitForSelector('[data-testid="ins-drawer"] [data-testid="task-inspector"]')
      await page.waitForTimeout(350)
      const dbox = await inView(page, '[data-testid="ins-drawer"]')
      const dnext = await page.$$eval('[data-testid="inspector-next"], [data-testid="inspector-blocked"]', (xs) => xs.length)
      if (width === 1440) await shot(page, 'W-1440-drawer')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      const dback = await page.evaluate(() => ({ open: !!document.querySelector('[data-testid="ins-drawer"]'), focus: document.activeElement?.getAttribute('data-node') }))
      rec(`W15 자세한 근거 드로어 — 오른쪽 · 화면 안 · 다음 행동 1개 · Esc 포커스 복귀(${width})`, !!dbox?.ok && dbox.r >= (await page.evaluate(() => innerWidth)) - 16 && dbox.r - dbox.l <= 444 && dnext === 1 && !dback.open && dback.focus === t, { dbox, dnext, dback })
      await page.focus(`[data-node="${t}"]`)
      await page.keyboard.press('Enter')
      await page.waitForSelector('[data-testid="task-pop"]')
      await page.keyboard.press('Escape')
      // 새로 고침 → 선택 보존(주소)
      await page.click(`[data-node="${t}"]`)
      await page.waitForTimeout(400)
      const urlBefore = page.url()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-testid="umap-canvas"]')
      await page.waitForTimeout(600)
      const s4 = await wsState(page)
      rec(`W11 새로 고침 뒤 같은 TASK · Workspace 선택(${width})`, s4.selected === t && urlBefore.includes('map_task=') , { url: urlBefore.replace(BASE, ''), selected: s4.selected, ws: s4.selectedWs })
      // 뒤로가기 — 이전 선택으로
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {})
      await page.waitForTimeout(800)
      rec(`W12 뒤로가기 뒤 페이지 정상 · 가로 넘침 0(${width})`, (await wsState(page)).overflowX === 0)
      // 계획 모달(PlanSection 재사용)
      if (first) {
        await map(page)
        await page.click(`[data-testid="ws-row"][data-ws="${first.id}"] [data-testid="ws-open"]`)
        await page.waitForSelector('[data-testid="ws-modal"]')
        const planBtn = await page.$('[data-testid="ws-plan-open"]')
        if (planBtn) {
          await planBtn.click()
          await page.waitForSelector('[data-testid="ws-modal"] [data-testid="umap-plan"]')
          const pb = await inView(page, '[data-testid="ws-modal"]')
          rec(`W13 상세 PLAN — 같은 모달 안 PlanSection(화면 안)(${width})`, !!pb?.ok, pb)
          if (width === 1440) await shot(page, 'W-1440-plan')
        } else rec(`W13 상세 PLAN 버튼(${width})`, false, 'no ws-plan-open')
        await page.keyboard.press('Escape')
      }
      // 레일 접힘
      const rail = await page.$('[data-testid="rail-toggle"], button[aria-label*="메뉴 접기"], button[aria-label*="사이드바"]')
      if (rail) {
        await rail.click(); await page.waitForTimeout(400)
        const r = await wsState(page)
        rec(`W14 레일 접힘 · 가로 넘침 0(${width})`, r.overflowX === 0, { overflowX: r.overflowX })
        if (width === 1440) await shot(page, 'W-1440-rail-collapsed')
        await rail.click()
      } else console.log('[NOTE] 레일 토글 없음 — W14 생략')
      await ctx.close()
    }
  }
} finally {
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  const left = []
  for (const id of users) { const { data } = await db.auth.admin.getUserById(id); if (data?.user) left.push(1) }
  await browser.close()
  if (!AUDIT) fs.writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({ startedAt, endedAt: new Date().toISOString(), base: BASE, pass: results.filter((r) => r.ok).length, fail: results.filter((r) => !r.ok).length, accountsLeft: left.length, results }, null, 2))
  console.log(`accounts created ${users.length} · left ${left.length}`)
  console.log(`PASS ${results.filter((r) => r.ok).length} · FAIL ${results.filter((r) => !r.ok).length}`)
}
