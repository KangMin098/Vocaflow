// scripts/knowledge/vnext-admin-e2e.mts
//
// 학습 원리 vNext 관리자 5개 업무 공간 브라우저 검증(2026-10-08) — 개발 서버(DEV_ADMIN_BYPASS)에서:
//   ① 5개 공간 + 기존 8 URL + 새 하위 화면이 열리고(200 · 제목 · 업무 공간 내비 · 오류 화면 아님) 1440px 캡처
//   ② 실제 쓰기 경로 한 바퀴: 탐구 질문 열기 → 항목 잇기(지지) → 상세에 보임 · 지도 노드 판 · 운영실 단계 수 증가
// 쓰기는 zz-vnext-e2e- 시험 질문 하나뿐이고 끝에 지운다(연결은 cascade). 개발 프로젝트가 아니면 멈춘다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/knowledge/vnext-admin-e2e.mts [--base http://localhost:3001]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3001'
const OUT = path.join(ROOT, 'tmp/knowledge/e2e')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
fs.mkdirSync(OUT, { recursive: true })
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 260)}`) }

const PAGES: [string, string][] = [
  ['/admin/knowledge', '원리 운영실'], ['/admin/knowledge/map', '역량 · 원리 지도'], ['/admin/knowledge/lab', '탐구 · 근거 연구소'],
  ['/admin/knowledge/lab/research', '연구 서지'], ['/admin/knowledge/design', '학습 설계 · 검증'], ['/admin/knowledge/product', '제품 적용 · 품질'],
  // 기존 8 URL(+ 가져오기 원장) — 공간의 탭으로 흡수, URL 그대로
  ['/admin/knowledge/principles', '본질 · 원리'], ['/admin/knowledge/methods', '방법론 · 공부법'], ['/admin/knowledge/review', '검토 대기'],
  ['/admin/knowledge/sources', '근거 · 출처'], ['/admin/knowledge/sources/csat', '기출 원천'], ['/admin/knowledge/experts', '전문가 · 채널'],
  ['/admin/knowledge/gaps', '공백'], ['/admin/methodology', ''],
]
const SLUG = `zz-vnext-e2e-${Date.now().toString(36)}`
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(180_000)
  for (const [url, title] of PAGES) {
    const res = await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})
    const h1 = (await page.locator('h1').first().innerText().catch(() => '')).trim()
    const nav = await page.locator('[data-testid="knowledge-workspaces"]').count()
    const failed = await page.getByText('불러오지 못했습니다').count()
    rec(`${url} 열림`, res?.status() === 200 && failed === 0 && (title === '' || h1 === title) && (url === '/admin/methodology' || nav === 1), { status: res?.status(), h1, nav, failed })
    await page.screenshot({ path: path.join(OUT, `${url.replace(/\//g, '_').replace(/^_/, '')}.png`), fullPage: false })
  }
  // 상세(지도 노드 판) — 실제 항목 하나
  const { data: one } = await db.from('knowledge_items').select('slug').eq('slug', 'method-reasoned-review').maybeSingle()
  if (one) {
    await page.goto(`${BASE}/admin/knowledge/map?node=${one.slug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="node-panel"]')
    const panel = await page.locator('[data-testid="node-panel"]').innerText()
    rec('지도 노드 판 — 위 · 아래 연결 · 근거 세 축', panel.includes('위로') && panel.includes('아래로') && panel.includes('근거'), panel.slice(0, 160))
    await page.screenshot({ path: path.join(OUT, 'map-node.png') })
    await page.goto(`${BASE}/admin/knowledge/item/${one.slug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})
    rec('항목 상세 — 종류 · 근거 축 폼 · 연구 근거 폼 · 제품 적용 칸', (await page.locator('[data-testid="kind-form"]').count()) + 1 > 0 && (await page.getByText('연구 근거 붙이기').count()) === 1 && (await page.getByRole('heading', { name: '제품 적용' }).count()) === 1)
  }
  // 쓰기 한 바퀴 — 탐구 질문 → 잇기
  const opsBefore = await page.goto(`${BASE}/admin/knowledge`, { waitUntil: 'networkidle' }).then(() => page.locator('[data-stage="inquiry"]').innerText())
  await page.goto(`${BASE}/admin/knowledge/lab`, { waitUntil: 'networkidle' })
  await page.getByLabel(/질문 — 무엇을 알고 싶은가/).fill('글의 주장과 근거 관계를 아는 능력은 어떻게 기르고 확인하는가(E2E 시험)')
  await page.getByLabel(/주소 이름/).fill(SLUG)
  await page.getByRole('button', { name: '질문 열기' }).click()
  await page.getByText('질문을 열었습니다').waitFor()
  rec('탐구 질문 열기(관리자 액션)', true)
  await page.goto(`${BASE}/admin/knowledge/lab/${SLUG}`, { waitUntil: 'networkidle' })
  await page.getByLabel('항목 주소 이름').fill('method-reasoned-review')
  await page.getByRole('button', { name: '잇기' }).click()
  await page.getByText('이었습니다').waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  const compare = await page.locator('[data-testid="inquiry-compare"]').innerText()
  rec('주장 비교 — 지지 칸에 이은 항목', compare.includes('근거 기록 후 해설 대조'), compare.slice(0, 200))
  await page.screenshot({ path: path.join(OUT, 'inquiry-detail.png'), fullPage: true })
  await page.goto(`${BASE}/admin/knowledge`, { waitUntil: 'networkidle' })
  const opsAfter = await page.locator('[data-stage="inquiry"]').innerText()
  rec('운영실 탐구 단계 수가 실제로 바뀜(DB 즉석 계산)', opsBefore !== opsAfter, { opsBefore: opsBefore.replace(/\s+/g, ' '), opsAfter: opsAfter.replace(/\s+/g, ' ') })
  await page.screenshot({ path: path.join(OUT, 'ops-after.png'), fullPage: true })
} catch (e) {
  rec('실행 오류 없이 끝남', false, (e as Error).message)
} finally {
  await browser.close()
  await db.from('knowledge_inquiries').delete().like('slug', 'zz-vnext-e2e-%')
  const { count } = await db.from('knowledge_inquiries').select('id', { count: 'exact', head: true }).like('slug', 'zz-vnext-e2e-%')
  const { count: links } = await db.from('knowledge_inquiry_links').select('id', { count: 'exact', head: true })
  rec('정리 — 시험 질문 · 연결 0', count === 0 && links === 0, { count, links })
}
console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
process.exit(fail ? 1 : 0)
