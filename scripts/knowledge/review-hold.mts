// scripts/knowledge/review-hold.mts
//
// 학습자 노출 보류(REVIEW_HOLD) · 재개 — 관리자 화면(E 제품 적용 · 품질)의 「중단」 · 「학습자에게 켜기」 버튼으로만(2026-10-08).
// 대상 = 「주장과 근거」 사슬의 학습자 적용 2건(문항 과제 claim-support:2022-20 · 지도 FIND b6-3). 항목 · 근거 · 검토 기록 · 수행 기록은 건드리지 않는다.
//   hold  : 두 적용을 이유와 함께 중단 → DB 트리거가 마지막 active 가 빠진 과제(applied)를 in_review 로 돌린다(knowledge_applications_after)
//   resume: 과제를 다시 채택 → 두 적용 켜기 → 과제 「제품 적용」 — 사용자가 정한 재노출 조건(Claude · Codex 둘 다 adopt)을 만족할 때만 부른다
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/knowledge/review-hold.mts hold|resume --reason "<사유>" [--base http://localhost:3001]
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../..')
const mode = process.argv[2]
const reason = process.argv.includes('--reason') ? process.argv[process.argv.indexOf('--reason') + 1] : ''
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3001'
if (!['hold', 'resume'].includes(mode) || reason.trim().length < 10) throw new Error('사용: hold|resume --reason "<10자 이상 사유>"')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')

const task = (await db.from('knowledge_items').select('id, slug, status, evidence_version, version').eq('slug', 'task-claim-support-link').single()).data as { id: string; slug: string; status: string }
const apps = ((await db.from('knowledge_applications').select('id, surface, surface_ref, status').eq('item_id', task.id)).data ?? []) as { id: string; surface: string; surface_ref: string; status: string }[]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(180_000)
const go = async (u: string) => { await page.goto(`${BASE}${u}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}) }
const done = async (t: string) => {
  const ok = page.getByText(t).first()
  const bad = page.locator('[role="alert"]').filter({ hasText: /./ }).first()
  await Promise.race([ok.waitFor(), bad.waitFor().then(async () => { throw new Error(`화면 오류: ${await bad.innerText()}`) })])
}
try {
  if (mode === 'hold') {
    for (const a of apps.filter((x) => x.status === 'active')) {
      await go('/admin/knowledge/product')
      const ctl = page.locator(`[data-testid="app-status-${a.id}"]`)
      await ctl.getByLabel(/이유/).fill(reason)
      await ctl.getByRole('button', { name: '중단' }).click()
      await done('저장했습니다')
      console.log(`· 중단 ${a.surface}:${a.surface_ref}`)
    }
  } else {
    // 사슬 위에서 아래로 — 검토 중인 방법 · 기제가 있으면 먼저 채택(과제 채택 뒤 위 층을 채택하면 순서가 뒤집힌다)
    for (const slug of ['claim-support-relation', 'method-claim-support-marking']) {
      const it = (await db.from('knowledge_items').select('status').eq('slug', slug).single()).data as { status: string }
      if (it.status !== 'in_review') continue
      await go(`/admin/knowledge/item/${slug}`)
      await page.locator('#status-reason').fill(reason)
      await page.getByRole('button', { name: '채택(으)로' }).click()
      await done('바꿨습니다. 검토 기록에 남았습니다.')
      console.log(`· ${slug} 다시 채택`)
    }
    if (task.status === 'in_review') {
      await go(`/admin/knowledge/item/${task.slug}`)
      await page.locator('#status-reason').fill(reason)
      await page.getByRole('button', { name: '채택(으)로' }).click()
      await done('바꿨습니다. 검토 기록에 남았습니다.')
      console.log('· 과제 다시 채택')
    }
    for (const a of apps.filter((x) => x.status === 'paused')) {
      await go('/admin/knowledge/product')
      await page.locator(`[data-testid="app-status-${a.id}"]`).getByRole('button', { name: '학습자에게 켜기' }).click()
      await done('저장했습니다')
      console.log(`· 켜기 ${a.surface}:${a.surface_ref}`)
    }
    await go(`/admin/knowledge/item/${task.slug}`)
    await page.locator('#status-reason').fill(reason)
    await page.getByRole('button', { name: '제품 적용(으)로' }).click()
    await done('바꿨습니다. 검토 기록에 남았습니다.')
    console.log('· 과제 → 제품 적용')
  }
} finally {
  await browser.close()
}
const after = await db.from('knowledge_items').select('slug, status, efficacy').in('slug', ['claim-support-relation', 'method-claim-support-marking', 'task-claim-support-link'])
const appsAfter = await db.from('knowledge_applications').select('surface, surface_ref, status, status_reason').eq('item_id', task.id)
console.log(JSON.stringify({ items: after.data, apps: appsAfter.data }))
