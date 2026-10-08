#!/usr/bin/env node
// scripts/design/ours-text-metrics.mjs
//
// 우리 화면 글자 측정 — 참조 캡처와 같은 뷰포트(spec.image)로 학습 지도 상세를 열어, 비교 대상 글자의 계산된 font-size 와
// 화면 위치(Range)를 뽑고 스크린샷을 남긴다. 잉크 높이는 같은 스크린샷에 ref-scan --ink 를 돌려 잰다(참조와 같은 도구 · 같은 문턱).
//   node --env-file=<apps/web/.env.local> scripts/design/ours-text-metrics.mjs [--base http://localhost:3000] [--out tmp/ours-text.png]
// 로그인은 임시 테스트 계정(@example.com)을 만들고 끝나면 지운다(서비스 키 필요).
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const BASE = arg('--base', 'http://localhost:3000')
const OUT = path.resolve(ROOT, arg('--out', 'tmp/ours-text.png'))
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/refs/3b/access-map/spec.json'), 'utf8'))
const { createClient } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@supabase/supabase-js')
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const email = `text-metrics-${process.pid}-${spec.image.w}@example.com`
const password = `Tm-${Math.random().toString(36).slice(2)}-Aa1`
const { data: made, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
if (error) throw error

// 비교 대상: 참조와 같은 역할 · 같은 문자 체계(한글끼리 · 라틴 대문자끼리)
const TARGETS = [
  { key: 'item', text: 'Workspace 만들기', first: 'W', note: '사이드바 항목(라틴 대문자) ↔ 참조 Recents' },
  { key: 'label', text: 'Workspace', first: 'W', note: '사이드바 묶음 제목 ↔ 참조 Spaces' },
  { key: 'node', text: '어휘', first: '어', note: '지도 노드 이름(한글) ↔ 참조 서준 강' },
  { key: 'colhead', text: '핵심 능력', first: '핵', note: '지도 열 머리' },
  { key: 'tab', text: '학습 지도', first: '학', note: '상단 탭' },
]
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: spec.image.w, height: spec.image.h }, deviceScaleFactor: 1 })
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
  await page.goto(`${BASE}/csat/diagnosis?tab=map&view=full`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-map-cols]')
  await page.waitForTimeout(1200)
  const out = await page.evaluate((targets) => targets.map((t) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = walker.nextNode())) {
      if (n.textContent.trim() !== t.text && !(t.key === 'item' && n.textContent.includes(t.text))) continue
      const i = n.textContent.indexOf(t.first)
      if (i < 0) continue
      const r = document.createRange()
      r.setStart(n, i); r.setEnd(n, i + 1)
      const b = r.getBoundingClientRect()
      if (!b.width) continue
      const cs = getComputedStyle(n.parentElement)
      return { ...t, fontSize: parseFloat(cs.fontSize), weight: cs.fontWeight, family: cs.fontFamily.split(',')[0], box: [Math.floor(b.left) - 1, Math.floor(b.top), Math.ceil(b.right) + 1, Math.ceil(b.bottom)] }
    }
    return { ...t, missing: true }
  }), TARGETS)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  await page.screenshot({ path: OUT })
  console.log(JSON.stringify({ shot: path.relative(ROOT, OUT), targets: out }, null, 1))
} finally {
  await browser.close()
  await svc.auth.admin.deleteUser(made.user.id)
}
