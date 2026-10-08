// scripts/knowledge/edit-statement.mts
//
// 항목 문장 고치기 — 관리자 화면(항목 상세 「문장 고치기」)으로만(2026-10-08). 채택 · 적용 중이면 DB 가드가 검토 중으로 돌린다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/knowledge/edit-statement.mts <slug> --file <새 문장 txt> [--base http://localhost:3001]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../..')
const slug = process.argv[2]
const file = process.argv[process.argv.indexOf('--file') + 1]
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3001'
if (!/^[a-z0-9-]+$/.test(slug ?? '') || !file) throw new Error('사용: <slug> --file <txt>')
const text = fs.readFileSync(file, 'utf8').trim()
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(180_000)
  await page.goto(`${BASE}/admin/knowledge/item/${slug}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => {})
  const sf = page.locator('section', { has: page.locator('#statement-form') })
  const save = sf.getByRole('button', { name: '문장 저장' })
  // 수화 전에 채우면 React 상태가 못 받는다 — 버튼이 켜질 때까지 다시 채운다
  for (let i = 0; i < 20 && !(await save.isEnabled()); i++) { await sf.getByLabel('항목 문장').fill(text); await page.waitForTimeout(500) }
  await save.click()
  const fb = sf.locator('[role="status"], [role="alert"]').first()
  await fb.waitFor()
  console.log(await fb.innerText())
} finally {
  await browser.close()
}
