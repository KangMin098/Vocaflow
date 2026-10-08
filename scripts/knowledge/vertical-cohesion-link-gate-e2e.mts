// scripts/knowledge/vertical-cohesion-link-gate-e2e.mts
//
// 두 번째 수직 경로 「노출 0」 브라우저 E2E(2026-10-08) — `vertical-cohesion-link-build.mts --no-activate` 뒤 상태를 확인한다.
//   A 학습자: /csat/item/2022-36 에 응집 과제 칸이 없다 · 과제 기록 API 가 거부한다(적용이 draft)
//   B 기존 사슬: /csat/item/2022-20 의 claim-support 칸은 그대로 보인다
//   C 학습 지도: 지도 화면 어디에도 응집 과제(2022-36#principle) 링크가 없다
// 쓰기: 테스트 학습자 1(끝에 삭제). 지식 행은 읽기만 한다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/knowledge/vertical-cohesion-link-gate-e2e.mts [--base http://localhost:3001]
import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3001'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }

const { data: task, error: te } = await db.from('knowledge_items').select('id, status').eq('slug', 'task-cohesion-link').single()
if (te) throw te
const { data: apps, error: ae } = await db.from('knowledge_applications').select('surface_ref, status').eq('item_id', task.id)
if (ae) throw ae
rec('전제 — 응집 적용이 모두 active 아님', (apps ?? []).length === 2 && (apps ?? []).every((a) => a.status !== 'active'), apps)

const email = `vertical-gate-${Date.now()}@example.com`
const password = `Vc-${crypto.randomBytes(9).toString('base64url')}-Aa1`
const { data: created, error: ce } = await db.auth.admin.createUser({ email, password, email_confirm: true })
if (ce) throw ce
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })

  await page.goto(`${BASE}/csat/item/2022-36`, { waitUntil: 'networkidle' })
  rec('A 2022-36 문항 화면이 열린다', !page.url().includes('/login'), page.url())
  rec('A 응집 과제 칸 없음(노출 0)', (await page.locator('[data-task="cohesion-link"]').count()) === 0)
  rec('A 다른 원리 칸도 없음', (await page.locator('[data-testid="principle-panel"]').count()) === 0)
  const res = await page.request.post(`${BASE}/api/csat/item/2022-36/task`, { data: { response: { picks: { cue1: 3, cue2: 2 }, order: 1 }, sec: 10 } })
  rec('A 과제 기록 API 거부(적용 꺼짐)', res.status() >= 400 && res.status() !== 500, res.status())

  await page.goto(`${BASE}/csat/item/2022-20`, { waitUntil: 'networkidle' })
  rec('B 기존 claim-support 칸 그대로', (await page.locator('[data-testid="principle-panel"]').count()) === 1)

  await page.goto(`${BASE}/csat/map`, { waitUntil: 'networkidle' })
  rec('C 지도에 응집 과제 링크 없음', (await page.locator('a[href*="2022-36"]').count()) === 0, page.url())
} finally {
  await browser.close()
  const { count } = await db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', created.user.id)
  rec('수행 기록이 생기지 않았다', count === 0, count)
  await db.auth.admin.deleteUser(created.user.id)
}
if (fail) { console.log(`실패 ${fail}`); process.exitCode = 1 } else console.log('모든 단언 통과')
