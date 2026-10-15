// scripts/csat/map/v62/e2e-map-return.mjs
//
// 학습지도 v6.2 P-M2 — 「한 지도에서 TASK 를 고르고 기출을 학습한 뒤, 기록 · 계획 · 선택 문맥을 잃지 않고 같은 TASK 로 돌아온다」를
// 실제 개발 서버 · 개발 DB · 브라우저로 확인한다. 합성 계정(끝에 삭제) — 학습 효과의 증거가 아니라 제품 흐름 검증이다.
//   ① 기록 + 목표 80 → 지도에서 기본 선택이 아닌 TASK(근거 위치 E2) 선택 → 그 묶음 계획 확정(버전 1 · 학습자 Workspace UUID 생김)
//   ② Inspector 「다음 행동」 → 문항(확인 모드) → 「해설 보기」 → 「학습 지도로」 → /csat 홈: 같은 TASK 선택 · 같은 묶음 계획 열림 · 알림 없음
//   ③ 떠난 사이 계획이 바뀜(다른 탭에서 버전 2) → 같은 경로로 돌아오면 「계획이 바뀌었어요」 · 최신 버전 표시
//   ④ 떠난 사이 목표가 바뀜 → 「목표가 바뀌었어요」
//   ⑤ 형식이 맞는 남의 UUID 를 주소에 넣어도 아무것도 읽히지 않고 「지금 계획」을 보인다(되살리기 없음)
//   ⑥ 과거 기준(?asof=) 지도에서는 다음 행동 링크가 없다
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-map-return.mjs --base http://localhost:3005
import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3005'
const READY = 'M2409'
const TASK = 'e.evidence_location'
const WS = 'ws.evidence-locate'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, label) => { const { data, error } = await q; if (error) throw new Error(`${label}: ${error.message}`); return data }

const results = []
const rec = (name, ok, detail) => { results.push({ name, ok }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`) }

const users = []

// LM-W1 — Inspector 는 상시 열이 아니라 「노드 → 빠른 팝업 → 자세한 근거 보기」 드로어 안에 있다(내용 · testid 그대로)
async function openInspector(page, task) {
  await page.waitForSelector(`[data-node="${task}"]`)
  if (!(await page.$(`[data-testid="ins-drawer"] [data-testid="task-inspector"][data-task="${task}"]`))) {
    if (await page.$('[data-testid="ins-drawer"]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(200) }
    if (await page.$('[data-testid="ws-modal"]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(200) }
    // 홈 복귀는 그 칸으로 부드럽게 스크롤한다 — 스크롤이 멈춘 뒤 누르고, 팝업이 안 떴으면 다시(움직이는 칸을 놓친 클릭)
    for (let i = 0; i < 3 && !(await page.$(`[data-testid="task-pop"][data-task="${task}"]`)); i++) {
      await page.locator(`[data-node="${task}"]`).scrollIntoViewIfNeeded()
      await page.waitForTimeout(600)
      await page.click(`[data-node="${task}"]`)
      await page.waitForTimeout(300)
    }
    await page.waitForSelector(`[data-testid="task-pop"][data-task="${task}"]`)
    await page.click('[data-testid="pop-detail"]')
  }
  await page.waitForSelector(`[data-testid="ins-drawer"] [data-testid="task-inspector"][data-task="${task}"]`)
}

const browser = await chromium.launch()
try {
  const email = `map-v62-return-${Date.now()}@example.com`
  const password = `Mr-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  const key = Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', READY), 'key')).map((k) => [k.no, k.answers[0]]))
  const W = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  const choices = Object.fromEntries(Object.keys(key).map((no) => [no, W.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
  if ((await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: READY, mode: 'live', takenAt: new Date().toISOString().slice(0, 10), totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })).status() !== 200) throw new Error('기록 실패')
  if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })).status() !== 200) throw new Error('목표 실패')
  for (let i = 0; i < 60; i++) {
    if ((await must(db.from('csat_dx_snapshot').select('id').eq('user_id', u.user.id).limit(1), 'snapshot')).length) break
    await new Promise((r) => setTimeout(r, 1000))
  }

  // ① TASK 선택 · 계획 확정
  await page.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="unified-map"]')
  const first = await page.getAttribute('[data-testid="unified-map"]', 'data-selected')
  await openInspector(page, TASK)
  await page.click('[data-testid="inspector-plan-toggle"]') // LM-W1 — 그 묶음의 Workspace 모달 · 계획 탭
  const plan = page.locator(`[data-testid="umap-plan"][data-ws="${WS}"] [data-testid="plan-section"]`)
  await plan.waitFor()
  await plan.locator('[data-testid="plan-save"]').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="plan-section"]')?.getAttribute('data-saved-version') === '1', null, { timeout: 60_000 }).catch(async (e) => { console.log('[probe]', JSON.stringify(await plan.evaluate((el) => ({ store: el.getAttribute('data-store'), ver: el.getAttribute('data-saved-version'), state: el.querySelector('[data-testid="plan-save-state"]')?.textContent, err: el.querySelector('[data-testid="plan-error"]')?.textContent, notSaved: el.querySelector('[data-testid="plan-not-saved"]')?.textContent })))); await page.screenshot({ path: 'tmp/v62-shots/return-probe.png' }); throw e })
  rec('① 기본 선택이 아닌 TASK 를 골라 그 묶음 계획을 확정(버전 1)', first !== TASK, { first, chosen: TASK })
  const wsRow = (await must(db.from('learner_workspace').select('id, template_id').eq('user_id', u.user.id).eq('template_id', WS), 'ws'))[0]

  // ② 문항 → 해설 → 지도로
  await page.keyboard.press('Escape')
  await openInspector(page, TASK)
  const goHref = await page.getAttribute('[data-testid="inspector-next"]', 'href')
  const q = new URL(goHref, BASE).searchParams
  rec('② 다음 행동 링크에 영구 TASK · 템플릿 · 학습자 Workspace UUID · 계획 버전 · 목표 버전이 실린다', q.get('map_task') === TASK && q.get('ws') === WS && q.get('map_ws') === wsRow?.id && q.get('map_plan') === '1' && !!q.get('map_goal') && q.get('check') === '1', Object.fromEntries(q))
  await page.goto(`${BASE}${goHref}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="item-check-mode"]')
  await page.click('[data-testid="item-check-explain"]')
  await page.waitForSelector('[data-testid="item-back-map"]')
  const backHref = await page.getAttribute('[data-testid="item-back-map"]', 'href')
  const back = async (href) => {
    await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="unified-map"]')
    await page.waitForTimeout(500)
    return {
      selected: await page.getAttribute('[data-testid="unified-map"]', 'data-selected'),
      inspector: await page.getAttribute('[data-testid="unified-map"]', 'data-selected'), // LM-W1 — Inspector 는 드로어(닫힘) · 고른 TASK 로 대조
      planWs: await page.locator('[data-testid="umap-plan"]').getAttribute('data-ws').catch(() => null),
      savedVersion: await page.locator('[data-testid="umap-plan"] [data-testid="plan-section"]').getAttribute('data-saved-version').catch(() => null),
      notes: await page.locator('[data-testid="umap-return-note"] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind'))).catch(() => []),
    }
  }
  const r2 = await back(backHref)
  rec('② 「학습 지도로」 → 홈 지도: 같은 TASK 선택 · 같은 묶음 계획 열림 · 저장 버전 1 · 알림 없음', r2.selected === TASK && r2.inspector === TASK && r2.planWs === WS && r2.savedVersion === '1' && r2.notes.length === 0, r2)

  // ③ 떠난 사이 계획 버전이 바뀜(다른 탭)
  const tab = await ctx.newPage()
  await tab.goto(`${BASE}/csat/diagnosis?tab=map&map_task=${TASK}&ws=${WS}`, { waitUntil: 'domcontentloaded' })
  // LM-W1 — 주소의 ws 만으로는 모달을 열지 않는다 · 리스트의 그 묶음 「자세히 · 계획」 → 계획 탭
  await tab.click(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`)
  await tab.click('[data-testid="ws-tab-plan"]')
  const plan2 = tab.locator(`[data-testid="umap-plan"][data-ws="${WS}"] [data-testid="plan-section"]`)
  await plan2.waitFor()
  await plan2.getByRole('button', { name: /계획 한 문항 줄이기$/ }).first().click()
  await plan2.locator('[data-testid="plan-save"]').click()
  await tab.waitForFunction(() => document.querySelector('[data-testid="plan-section"]')?.getAttribute('data-saved-version') === '2', null, { timeout: 60_000 })
  await tab.close()
  const r3 = await back(backHref)
  rec('③ 떠난 사이 계획이 바뀌면 「계획이 바뀌었어요」 · 최신 버전 2 를 보인다(옛 버전 1 을 되살리지 않음)', r3.selected === TASK && r3.notes.includes('plan_changed') && r3.savedVersion === '2', r3)

  // ④ 떠난 사이 목표가 바뀜
  if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 70 } })).status() !== 200) throw new Error('목표 변경 실패')
  const r4 = await back(backHref)
  rec('④ 떠난 사이 목표가 바뀌면 「목표가 바뀌었어요」', r4.notes.includes('goal_changed') && r4.selected === TASK, r4)

  // ⑤ 형식이 맞는 남의 UUID — 조회 없음 · 지금 계획 · 「다른 계획」 알림
  const fake = backHref.replace(/map_ws=[0-9a-f-]+/, `map_ws=${crypto.randomUUID()}`)
  const r5 = await back(fake)
  rec('⑤ 남의(존재하지 않는) Workspace UUID 를 넣어도 지금 계획을 보이고 되살리지 않는다', r5.notes.includes('workspace_replaced') && r5.savedVersion === '2' && r5.selected === TASK, r5)

  // ⑥ 과거 기준 지도 — 학습 활동 시작 링크 없음
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  await page.goto(`${BASE}/csat/diagnosis?tab=map&asof=${yesterday}&map_task=${TASK}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="unified-map"]')
  await openInspector(page, TASK)
  // LM-W1 — 드로어 Inspector · 빠른 팝업 · 리스트 · 상단 띠 어디에도 학습 시작 링크가 없다
  const pastNext = await page.locator('[data-testid="inspector-next"], [data-testid="pop-next"], [data-testid="ws-next"], [data-testid="umap-top-next"], [data-testid="ws-modal-next"]').count()
  rec('⑥ 과거 기준 지도에서는 다음 행동 링크가 없다(보기 전용)', pastNext === 0 && (await page.locator('[data-testid="umap-past"]').count()) === 1, { pastNext })
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
}
const failed = results.filter((r) => !r.ok).length
console.log(failed ? `FAIL ${failed}` : 'ALL PASS')
process.exit(failed ? 1 : 0)
