#!/usr/bin/env node
// scripts/csat/map/e2e-map-goal.mjs
//
// 학습 지도 목표 중심 재설계 상태 E2E(2026-10-08) — 실제 개발 DB · 실제 기록 API · 실제 진단 엔진 · 실제 브라우저(1440px).
//   A 목표 설정 전 · B 목표 80 · 기록 없음 · C 목표 80 · 분석 준비 전 기록 · D 목표 80 · 분석된 기록(먼저 확인) · F 목표 80 · 분석된 기록 2회(변화)
// 상태 E(직접 확인된 원인)는 verified_diagnosis 를 만드는 경로가 아직 없어 화면 계약만 단위 테스트(goal-view)로 본다.
// 모든 상태 공통: 할 일 CTA 하나 · 목표 달성률(%) · 내부 코드 · 54라인 없음 · 기준 시험과 내 기록을 구분하는 문장.
// 계정은 끝에 지운다(기록 cascade). 개발 프로젝트가 아니면 멈춘다. 종료 코드 0 = 모든 단언 통과.
//   node --env-file=<apps/web/.env.local> scripts/csat/map/e2e-map-goal.mjs [--base http://localhost:3002] [--out tmp/map-goal]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const argv = process.argv.slice(2)
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3002')
const OUT = path.join(ROOT, arg('--out', 'tmp/map-goal'))
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, what) => { const r = await q; if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }
fs.mkdirSync(OUT, { recursive: true })
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 220)}`) }

const READY = 'M2409'
const users = []
const browser = await chromium.launch()
try {
  const keyOf = async (id) => Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', id), 'key')).map((k) => [k.no, k.answers[0]]))
  const readyKey = await keyOf(READY)
  let OFF = null
  for (const e of await must(db.from('csat_exams').select('id').eq('diagnosis_ready', false).eq('organizer', 'kice').order('id', { ascending: false }).limit(20), 'off')) {
    if ((await must(db.from('csat_dx_answer_key').select('no').eq('exam_id', e.id), 'n')).length === 45) { OFF = e.id; break }
  }
  const offKey = await keyOf(OFF)
  const answers = (key, wrong) => Object.fromEntries(Object.keys(key).map((no) => [no, wrong.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
  const W1 = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  const W2 = new Set([23, 32, 33, 36, 37, 38, 39])

  async function learner(tag, goal, records) {
    const email = `map-goal-e2e-${tag}-${Date.now()}@example.com`
    const password = `Mg-${crypto.randomBytes(9).toString('base64url')}-Aa1`
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    users.push(data.user.id)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const login = await ctx.newPage()
    login.setDefaultTimeout(240_000)
    await login.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await login.fill('input[type="email"]', email)
    await login.fill('input[type="password"]', password)
    await login.click('button[type="submit"]')
    await login.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })
    await login.close()
    const page = await ctx.newPage()
    page.setDefaultTimeout(240_000)
    for (const r of records) {
      const res = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: r.exam, mode: 'live', takenAt: r.takenAt, totalMinutes: 70, clientKey: crypto.randomUUID(), choices: answers(r.key, r.wrong), flags: {} } })
      if (res.status() !== 200) throw new Error(`${tag} 기록 실패 ${res.status()}`)
    }
    if (goal !== null) {
      const res = await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: goal } })
      if (res.status() !== 200) throw new Error(`${tag} 목표 실패`)
    }
    await page.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="learner-map"]').waitFor()
    await page.waitForLoadState('networkidle').catch(() => {})
    return page
  }
  const common = async (page, tag) => {
    const head = await page.locator('[data-testid="goal-header"]').innerText()
    const main = await page.locator('[data-testid="learner-map"]').innerText()
    rec(`${tag} · 할 일 CTA 하나`, (await page.locator('[data-testid="focus-cta"]').count()) === 1)
    rec(`${tag} · 목표 달성률 · 숙달 % 없음(첫 화면)`, !/\d+\s*%/.test(main), main.match(/\d+\s*%/)?.[0] ?? '')
    rec(`${tag} · 내부 코드(A1 · P1 · T1 · 54라인) 없음`, !/\b[A-JPT]\d{1,2}\b|54\s*라인/.test(main), main.match(/\b[A-JPT]\d{1,2}\b|54\s*라인/)?.[0] ?? '')
    rec(`${tag} · 기준 시험 ≠ 내 기록 구분 문장`, /계산 기준은 평가원 최근 \d+회의 문항 · 배점이에요\(내 기록과 별개\)/.test(head))
    return { head, main }
  }

  // A — 목표 설정 전
  {
    const page = await learner('a', null, [])
    const { head } = await common(page, 'A')
    rec('A · 목표 「아직 정하지 않았어요」(기본값을 정한 목표처럼 보이지 않음)', (await page.locator('[data-testid="learner-map"]').getAttribute('data-goal-set')) === 'false' && /아직 정하지 않았어요/.test(head) && !/100점/.test(head))
    rec('A · 할 일 = 목표 정하기', (await page.locator('[data-testid="focus-card"]').getAttribute('data-focus')) === 'goal' && /목표 정하기/.test(await page.locator('[data-testid="focus-cta"]').innerText()))
    await page.locator('[data-testid="focus-cta"]').click()
    rec('A · CTA → 목표 점수 고르기가 열림', (await page.getByRole('group', { name: '목표 점수 정하기' }).count()) === 1)
    await page.screenshot({ path: path.join(OUT, 'e2e-A.png') })
  }
  // B — 목표 80 · 기록 없음
  {
    const page = await learner('b', 80, [])
    const { head } = await common(page, 'B')
    rec('B · 목표 80점 · 2등급 구간(80~89점)', /수능 영어 80점/.test(head) && /2등급 구간\(80~89점\)/.test(head))
    rec('B · 시험 위치 「기록 없음」 · 목표까지 숫자 없음(가상 위치 없음)', /기록 없음/.test(await page.locator('[data-testid="position-exam"]').innerText()) && !/\d+점 남음/.test(await page.locator('[data-testid="position-gap"]').innerText()))
    rec('B · 할 일 = 시험 기록', (await page.locator('[data-testid="focus-card"]').getAttribute('data-focus')) === 'record')
    rec('B · 길 제목이 목표와 이어짐', /목표 80점으로 가는 영어 독해의 길/.test(await page.locator('#path-h').innerText()))
    await page.screenshot({ path: path.join(OUT, 'e2e-B.png') })
    // 목표 바꾸기 팝오버가 헤더에 잘리지 않는다(Codex P1) — 「적용」 버튼 가운데 점의 최상위 요소가 그 버튼이어야 누를 수 있다
    await page.locator('[data-testid="map-goal-edit"]').click()
    const group = page.getByRole('group', { name: '목표 점수 정하기' })
    await group.waitFor()
    const applyBtn = group.getByRole('button', { name: /적용/ })
    const box = await applyBtn.boundingBox()
    const hit = box ? await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent ?? '', { x: box.x + box.width / 2, y: box.y + box.height / 2 }) : ''
    rec('B · 목표 바꾸기 팝오버가 잘리지 않음(적용 버튼이 눌리는 자리)', /적용/.test(hit), { hit, box })
    const inputBox = await group.locator('#map-goal-input').boundingBox()
    rec('B · 적용 버튼 · 직접 입력 칸 높이 44px 이상', (box?.height ?? 0) >= 44 && (inputBox?.height ?? 0) >= 44, { apply: box?.height, input: inputBox?.height })
  }
  // C — 분석 준비 전 기록
  {
    const page = await learner('c', 80, [{ exam: OFF, key: offKey, wrong: W1, takenAt: '2026-09-20' }])
    await common(page, 'C')
    const exam = await page.locator('[data-testid="position-exam"]').innerText()
    rec('C · 시험 위치 = 실제 기록(최근 점수 · 등급 · 회차 · 날짜)', /최근 \d+점/.test(exam) && /\d등급/.test(exam) && /2026-09-20/.test(exam) && /기록 1회/.test(exam), exam)
    rec('C · 할 일 = 분석 준비 중', (await page.locator('[data-testid="focus-card"]').getAttribute('data-focus')) === 'pending')
  }
  // D — 분석된 기록 · 먼저 확인
  {
    const page = await learner('d', 80, [{ exam: READY, key: readyKey, wrong: W1, takenAt: '2026-09-20' }])
    await common(page, 'D')
    const focus = await page.locator('[data-testid="focus-card"]').getAttribute('data-focus')
    rec('D · 할 일 = 확인 활동(단계 · 구분 · 직접 중 하나 — routing 그대로)', ['step', 'distinguish', 'direct'].includes(focus), focus)
    rec('D · 「약점으로 확정된 것은 아니에요」 류 문구 유지', /확정된 것은 아니에요|정한 것이 아니라|가려 보고 정할게요/.test(await page.locator('[data-testid="focus-card"]').innerText()))
    const gap = await page.locator('[data-testid="position-gap"]').innerText()
    rec('D · 목표까지 = 최근 원점수 기준 거리', /\d+점 남음|목표 점수에 닿았어요/.test(gap), gap)
    rec('D · 단계 근거 상태 개수(읽기 7단계 합 7 · 직접 확인은 있을 때만)', (await page.locator('[data-testid="position-diagnosis"] li strong').allInnerTexts()).map(Number).reduce((a, b) => a + b, 0) === 7)
    await page.locator('[data-testid="read-path"] [data-step="structure"]').click()
    const sheet = page.locator('[data-step-sheet]')
    await sheet.waitFor()
    const link = await sheet.locator('[data-testid="step-goal-link"]').innerText()
    rec('D · 단계 시트 「목표와의 관계」 = 기준 시험 문항 · 배점 사실 + 점수 상승 약속 아님', /평가원 최근 \d+회/.test(link) && /문항 · [\d.]+점/.test(link) && /몇 점이 오른다는 뜻은 아니에요/.test(link) && /80점은 한 회 100점 중 20점까지 놓쳐도 되는 점수/.test(link), link.slice(0, 160))
    rec('D · 단계 시트 「아직 모르는 것」', /아직/.test(await sheet.locator('[data-testid="step-unknown"]').innerText()))
    await page.screenshot({ path: path.join(OUT, 'e2e-D-sheet.png') })
  }
  // G — 의심 기록은 현재 위치에 쓰지 않는다(Codex P1): 정상 기록 뒤에 전 문항 같은 번호(일괄 입력) 기록
  {
    const ones = Object.fromEntries(Object.keys(readyKey).map((no) => [no, 1]))
    const page = await learner('g', 80, [{ exam: READY, key: readyKey, wrong: W1, takenAt: '2026-09-06' }])
    const r = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: READY, mode: 'live', takenAt: '2026-09-27', totalMinutes: 70, clientKey: crypto.randomUUID(), choices: ones, flags: {} } })
    rec('G · 일괄 입력 기록 저장(기록 자체는 남는다)', r.status() === 200, r.status())
    await page.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="learner-map"]').waitFor()
    const exam = await page.locator('[data-testid="position-exam"]').innerText()
    rec('G · 현재 위치 = 신뢰도 통과 기록만(최근 = 09-06 기록 · 1회 · 변화 줄 없음)', /2026-09-06/.test(exam) && /기록 1회/.test(exam) && (await page.locator('[data-testid="position-change"]').count()) === 0, exam)
  }
  // F — 기록 2회 · 변화
  {
    const page = await learner('f', 80, [{ exam: READY, key: readyKey, wrong: W1, takenAt: '2026-09-06' }, { exam: READY, key: readyKey, wrong: W2, takenAt: '2026-09-27' }])
    await common(page, 'F')
    const change = await page.locator('[data-testid="position-change"]').innerText().catch(() => '')
    rec('F · 이전 ↔ 최근 실제 기록 비교', /이전 \d+점\(09\.06\) → 최근 \d+점 · [+-]?\d+점|변화 없음/.test(change), change)
    rec('F · 기록 2회', /기록 2회/.test(await page.locator('[data-testid="position-exam"]').innerText()))
    await page.screenshot({ path: path.join(OUT, 'e2e-F.png') })
  }
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  const left = users.length ? (await db.from('csat_dx_session').select('id', { count: 'exact', head: true }).in('user_id', users)).count : 0
  rec('정리 — 테스트 계정 기록 0', left === 0, { left })
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
