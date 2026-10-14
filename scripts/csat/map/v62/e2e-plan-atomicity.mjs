// scripts/csat/map/v62/e2e-plan-atomicity.mjs
//
// v6.2 P-M2b — 계획 저장 재시도 · 동시성 · 위조를 실제 API(개발 서버) · RPC · 개발 DB 로 재현한다. 합성 계정 2(끝에 삭제).
//   1 응답 유실 → 같은 키 · 같은 본문 재시도 = 처음 결과(reused) · 행 1개
//   2 같은 키 · 다른 본문 = 409 client_key_reused · DB 불변
//   3 첫 성공 뒤 목표 변경 → 같은 요청 재시도 = 처음 결과(목표 · 콘텐츠 재검사로 거절하지 않음)
//   4 두 기기 같은 Workspace 동시 저장(같은 expectedVersion · 다른 키) = 하나만 성공 · 하나 409
//   5 낡은 expectedVersion = 409 · DB 불변
//   6 다른 사용자가 같은 clientKey 를 써도 남의 행 · Workspace 를 받지 않는다(본인 행만) · 본문에 userId 를 넣으면 400
//   7 Workspace 종료 뒤 새로 저장 = 새 Workspace 버전 1 · 옛 이력 보존 · 옛 expectedVersion 은 409
//   8 실패 응답에는 부분 커밋이 없다(2 · 4 · 5 뒤 행 수)
// 4번 시나리오 「콘텐츠 가용성 변경」은 재시도가 재계산을 건너뛰는 같은 경로(3)로 확인하고, 순수 함수는 단위 테스트(plan-commit)로 고정한다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-plan-atomicity.mjs --base http://localhost:3005
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3005'
const TPL = 'ws.central-meaning'
const tpl = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v4/workspaces.json'), 'utf8')).templates.find((t) => t.id === TPL)
const ORDER = [...tpl.core, ...tpl.support]
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const results = []
const rec = (name, ok, detail) => { results.push({ name, ok }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`) }
const users = []
const browser = await chromium.launch()

async function learner(tag) {
  const email = `map-v62-atom-${tag}-${Date.now()}@example.com`
  const password = `Ma-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })).status() !== 200) throw new Error('목표 실패')
  return { id: u.user.id, page }
}
const post = async (who, body) => {
  const r = await who.page.request.post(`${BASE}/api/csat/diagnosis/map/plan`, { data: body })
  return { status: r.status(), body: await r.json().catch(() => null) }
}
const rows = async (userId) => (await db.from('learner_workspace_plan').select('workspace_id, plan_version, client_key').eq('user_id', userId).order('plan_version')).data ?? []
const body = (over = {}) => ({ template: TPL, order: ORDER, planned: {}, reason: 'initial', expectedVersion: 0, clientKey: crypto.randomUUID(), ...over })

try {
  const a = await learner('a')
  // 1 응답 유실 → 같은 키 · 같은 본문
  const b1 = body()
  const r1 = await post(a, b1)
  const r1b = await post(a, b1)
  const n1 = (await rows(a.id)).length
  rec('1 같은 키 · 같은 본문 재시도 = 처음 결과(reused) · 행 1개', r1.status === 200 && r1b.status === 200 && r1b.body?.reused === true && r1b.body?.version === r1.body?.version && n1 === 1, { first: r1, retry: r1b, rows: n1 })

  // 2 같은 키 · 다른 본문
  const r2 = await post(a, { ...b1, note: '다른 본문' })
  rec('2 같은 키 · 다른 본문 = 409 client_key_reused · 행 불변', r2.status === 409 && r2.body?.code === 'client_key_reused' && (await rows(a.id)).length === 1, r2)

  // 3 첫 성공 뒤 목표 변경 → 같은 요청 재시도
  const b3 = body({ reason: 'learner_adjust', expectedVersion: 1, order: [...ORDER].reverse() })
  const r3 = await post(a, b3)
  await a.page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 60 } })
  const r3b = await post(a, b3)
  rec('3 첫 성공 뒤 목표가 바뀌어도 같은 요청 재시도 = 처음 결과', r3.status === 200 && r3b.status === 200 && r3b.body?.reused === true && r3b.body?.version === 2 && (await rows(a.id)).length === 2, { r3, r3b })

  // 4 두 기기 동시 저장(같은 expectedVersion 2 · 다른 키)
  const [c1, c2] = await Promise.all([post(a, body({ reason: 'learner_adjust', expectedVersion: 2 })), post(a, body({ reason: 'learner_adjust', expectedVersion: 2, order: ORDER }))])
  const st = [c1.status, c2.status].sort()
  rec('4 같은 Workspace 동시 저장 = 하나만 성공(200) · 하나 409 · 행 3개', st[0] === 200 && st[1] === 409 && (await rows(a.id)).length === 3, { c1: c1.status, c2: c2.status })

  // 5 낡은 expectedVersion
  const r5 = await post(a, body({ reason: 'learner_adjust', expectedVersion: 1 }))
  rec('5 낡은 expectedVersion = 409 · 행 불변', r5.status === 409 && (await rows(a.id)).length === 3, r5)

  // 6 다른 사용자 · 위조
  const b = await learner('b')
  const r6 = await post(b, { ...b1 })
  const aRows = await rows(a.id)
  rec('6 다른 사용자가 같은 clientKey 를 써도 남의 Workspace · 버전을 받지 않는다', r6.status === 200 && r6.body?.reused === false && r6.body?.workspaceId !== r1.body?.workspaceId && r6.body?.version === 1 && aRows.length === 3, { r6 })
  const r6b = await post(b, { ...body(), userId: a.id })
  rec('6 본문에 userId 를 넣으면 거절(400)', r6b.status === 400, r6b)

  // 7 Workspace 종료 뒤 새로 저장
  const wsA = aRows[0].workspace_id
  const close = await db.from('learner_workspace').update({ status: 'closed' }).eq('id', wsA).eq('user_id', a.id)
  if (close.error) throw new Error(`종료 실패: ${close.error.message}`)
  const r7old = await post(a, body({ reason: 'learner_adjust', expectedVersion: 3 }))
  const r7 = await post(a, body())
  const after = await rows(a.id)
  rec('7 종료 뒤 옛 expectedVersion = 409 · 새로 저장 = 새 Workspace 버전 1 · 옛 이력 3개 보존', r7old.status === 409 && r7.status === 200 && r7.body?.version === 1 && r7.body?.workspaceId !== wsA && after.filter((x) => x.workspace_id === wsA).length === 3, { r7old: r7old.status, r7 })

  // 8 실패에는 부분 커밋 없음(위 2 · 4 · 5 · 7old 뒤 행 수)
  rec('8 실패 응답(409)은 행을 남기지 않는다', after.length === 4, { rows: after.length })
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
}
const failed = results.filter((r) => !r.ok).length
console.log(failed ? `FAIL ${failed}` : 'ALL PASS')
process.exit(failed ? 1 : 0)
