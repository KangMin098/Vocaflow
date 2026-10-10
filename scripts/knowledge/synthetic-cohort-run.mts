// scripts/knowledge/synthetic-cohort-run.mts
//
// 합성 학습자 집단 운영(2026-10-10 · 사용자 승인 「합성 학습자 40명」) — 실제 학습자가 없는 개발 단계에서
// Claude Code 가 페르소나로 지문을 읽고 낸 답(answers-*.json)을 **실제 학습자 화면**으로 제출하고, 학습 지도가 내린 판정 · 다음 할 일을 모은다.
//   계정: @vocaflow.local 합성 도메인만(기록은 전부 synthetic — 성과 신호 · 효과 판정에서 빠진다). 없으면 만들고, 있으면 그대로 쓴다.
//   비밀번호: 실행마다 새로 만들어 그 실행 안에서만 쓴다(파일 · 로그에 남기지 않는다).
//   쓰지 않는 것: 원리 · 적용 · 항목 · trial · 스키마. 끝나도 기록은 지우지 않는다(재현용 · 승인 조건).
//   실행: cd apps/web && node --env-file=<.env.local> <tsx cli> ../../scripts/knowledge/synthetic-cohort-run.mts --cohort <폴더> [--base http://localhost:3011] [--parallel 4]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../..')
const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const COHORT = arg('--cohort', '')
const BASE = arg('--base', 'http://localhost:3011')
const PARALLEL = Number(arg('--parallel', '4'))
// --resume: 앞 실행에서 오류 없이 끝난 페르소나는 다시 하지 않는다(첫 시도는 이미 기록됐다 — 재제출은 첫 시도를 바꾸지 않지만 기록이 쌓인다)
const RESUME = process.argv.includes('--resume')
if (!COHORT) throw new Error('--cohort <personas.json · answers-*.json 폴더> 가 필요하다')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')

interface Persona { id: string; group: string; profile: string; trait: string; email: string; items: string[] }
interface Answer { persona: string; item: string; claim: number; support: number[]; relation: string; thinking?: string }
const personas = JSON.parse(fs.readFileSync(path.join(COHORT, 'personas.json'), 'utf8')) as Persona[]
const answers: Answer[] = fs.readdirSync(COHORT).filter((f) => /^answers-[A-Z]\.json$/.test(f)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(COHORT, f), 'utf8')))
if (personas.length > 40) throw new Error('승인 범위는 40명이다')
for (const p of personas) if (!/^cohort-p\d{2}@vocaflow\.local$/.test(p.email)) throw new Error(`합성 도메인 계정이 아니다: ${p.email}`)

const PASSWORD = crypto.randomBytes(18).toString('base64url')

async function ensureUser(email: string): Promise<string> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email === email)
    if (hit) {
      const { error: e } = await db.auth.admin.updateUserById(hit.id, { password: PASSWORD })
      if (e) throw e
      return hit.id
    }
    if (data.users.length < 200) break
  }
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { synthetic_cohort: true } })
  if (error) throw error
  return data.user.id
}

interface Row {
  persona: string
  group: string
  submitted: { item: string; correct: boolean | null; error?: string }[]
  find: string | null
  decision: string | null
  skill: string | null
  nextVisible: boolean
  error?: string
}

async function runPersona(browser: { newContext: (o: object) => Promise<any> }, p: Persona): Promise<Row> {
  const row: Row = { persona: p.id, group: p.group, submitted: [], find: null, decision: null, skill: null, nextVisible: false }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(120_000)
  const go = async (url: string) => {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})
  }
  try {
    await go('/login')
    await page.fill('input[type="email"]', p.email)
    await page.fill('input[type="password"]', PASSWORD)
    await Promise.all([page.waitForURL((u: URL) => !u.pathname.startsWith('/login')), page.click('button[type="submit"]')])
    for (const item of p.items) {
      const a = answers.find((x) => x.persona === p.id && x.item === item)
      if (!a) { row.submitted.push({ item, correct: null, error: '답 없음' }); continue }
      await go(`/csat/item/${item.replace('#', '-')}#principle`)
      const panel = page.getByTestId('principle-panel')
      if (!(await panel.isVisible().catch(() => false))) { row.submitted.push({ item, correct: null, error: '원리 패널 없음' }); continue }
      await panel.locator('button').first().click()
      await page.getByTestId('principle-task').waitFor()
      await page.locator(`[data-claim="${a.claim}"]`).click()
      for (const s of a.support.filter((x) => x !== a.claim)) await page.locator(`[data-support="${s}"]`).click()
      await page.locator(`[data-relation="${a.relation}"]`).check()
      const btn = page.getByRole('button', { name: '확인하기' })
      if (!(await btn.isEnabled())) { row.submitted.push({ item, correct: null, error: '제출 불가(근거 0개 등)' }); continue }
      await btn.click()
      const res = page.getByTestId('principle-result')
      await res.waitFor()
      row.submitted.push({ item, correct: (await res.getAttribute('data-correct')) === 'true' })
    }
    await go('/csat/diagnosis?tab=map')
    await page.locator('button[data-step="structure"]').first().click()
    await page.getByTestId('find-practice-link').first().waitFor()
    row.find = await page.getByTestId('find-outcome').getAttribute('data-state').catch(() => null)
    row.decision = await page.getByTestId('learning-decision').getAttribute('data-action').catch(() => null)
    row.skill = await page.getByTestId('skill-diagnosis').getAttribute('data-status').catch(() => null)
    row.nextVisible = (await page.getByTestId('learning-decision-link').isVisible().catch(() => false)) || (await page.getByTestId('rx-transfer').isVisible().catch(() => false))
    if (p.id.endsWith('1')) await page.screenshot({ path: path.join(COHORT, `map-${p.id}.png`) })
  } catch (e) {
    row.error = (e as Error).message.split('\n')[0]
  } finally {
    await ctx.close()
  }
  return row
}

for (const p of personas) await ensureUser(p.email)
console.log(`계정 ${personas.length}개 준비(합성 도메인)`)
const browser = await chromium.launch()
const rows: Row[] = []
const prevPath = path.join(COHORT, 'run-result.json')
const done = new Map<string, Row>()
if (RESUME && fs.existsSync(prevPath)) for (const r of JSON.parse(fs.readFileSync(prevPath, 'utf8')) as Row[]) if (!r.error && r.submitted.length && r.submitted.every((s) => !s.error)) done.set(r.persona, r)
rows.push(...done.values())
console.log(`이어 하기: 끝난 ${done.size}명 건너뜀`)
const queue = personas.filter((p) => !done.has(p.id))
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (let p = queue.shift(); p; p = queue.shift()) {
    const r = await runPersona(browser, p)
    rows.push(r)
    console.log(`${r.persona}(${r.group}) ${r.submitted.map((s) => `${s.item}:${s.correct === null ? 'x' : s.correct ? 'O' : 'X'}`).join(' ')} → 판정 ${r.find} · 다음 ${r.decision} · 직접확인 ${r.skill ?? '-'} · 표시 ${r.nextVisible}${r.error ? ' · 오류 ' + r.error : ''}`)
  }
}))
await browser.close()
rows.sort((a, b) => a.persona.localeCompare(b.persona))
fs.writeFileSync(path.join(COHORT, 'run-result.json'), JSON.stringify(rows, null, 1))

// 집계 — 프로필 × 판정 · 다음 할 일(효과가 아니다: 같은 문항을 다른 페르소나가 어떻게 겪는지의 분포)
const by = (k: (r: Row) => string) => rows.reduce<Record<string, Record<string, number>>>((m, r) => {
  m[r.group] ??= {}
  m[r.group][k(r)] = (m[r.group][k(r)] ?? 0) + 1
  return m
}, {})
console.log('판정', JSON.stringify(by((r) => r.find ?? 'none')))
console.log('다음 할 일', JSON.stringify(by((r) => r.decision ?? 'none')))
console.log('정답률', JSON.stringify(Object.fromEntries(['A', 'B', 'C', 'D'].map((g) => {
  const s = rows.filter((r) => r.group === g).flatMap((r) => r.submitted).filter((x) => x.correct !== null)
  return [g, `${s.filter((x) => x.correct).length}/${s.length}`]
}))))
const errors = rows.filter((r) => r.error || r.submitted.some((s) => s.error))
console.log(errors.length ? `오류 ${errors.length}명` : '오류 없음')
process.exit(errors.length ? 1 : 0)
