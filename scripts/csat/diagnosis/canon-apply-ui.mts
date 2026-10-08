// scripts/csat/diagnosis/canon-apply-ui.mts
//
// M2409 pilot canon 정본 저장 · 진단 반영 켜기(2026-10-08 · 사용자 승인) — **관리자 화면의 정상 경로만** 쓴다(브라우저로 조작).
//   1) 체크포인트 before(m2409-canon-20261008)
//   2) /admin/csat/diagnosis/exams/M2409 — 문항마다 역량 9개를 tri-model 최종값으로 고르고 「검수 저장」(saveItemTaggingAction →
//      requireAdmin → csat_dx_save_item_tagging). 선지 함정 · 오답률 · EBS 는 화면이 불러온 현재 값 그대로(바꾸지 않는다).
//   3) DB 확인 — 28/28 검수 · 252행 · 값 = 최종값 · 함정 키 = 저장 전 그대로 · 판정(readiness) 통과
//   4) /admin/csat/diagnosis/exams — M2409 행 「꺼짐 · 켜기」(setExamReadyAction — 판정 재확인 뒤 켬). 다른 시험은 건드리지 않는다
//   5) 체크포인트 after
// 직접 UPDATE 로 우회하지 않는다. 개발 서버의 관리자 접근은 DEV_ADMIN_BYPASS(개발 전용).
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/diagnosis/canon-apply-ui.mts [--base http://localhost:3000]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

import { ATTRIBUTE_CODES } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import { examReadiness } from '../../../apps/web/src/lib/csat/diagnosis/readiness.ts'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3000'
const EXAM = 'M2409'
const LABEL = 'm2409-canon-20261008'
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
const tri = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pilot/M2409-review-tri.json'), 'utf8')) as { items: { no: number; w: Record<string, number> }[] }
const before = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp/pilot/M2409-before.json'), 'utf8')) as { traps: { item_id: string; option_no: number; trap_key: string }[] }
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 400)}`) }

const ck = async (phase: 'before' | 'after', note: string) => {
  const { error } = await db.rpc('record_db_health_checkpoint', { p_label: LABEL, p_phase: phase, p_note: note })
  if (error) console.log(`체크포인트 ${phase} 실패(계속): ${error.message}`)
}
await ck('before', 'M2409 pilot canon — 관리자 경로 검수 저장 28문항 + 진단 반영 켜기')

const [exam0] = (await db.from('csat_exams').select('id, diagnosis_ready').eq('id', EXAM)).data ?? []
const readyBefore = ((await db.from('csat_exams').select('id').eq('diagnosis_ready', true)).data ?? []).map((r) => r.id as string)
rec('시작 상태 — M2409 꺼짐 · 다른 켜진 시험 없음', exam0?.diagnosis_ready === false && readyBefore.length === 0, { readyBefore })
if (fail) throw new Error('시작 상태가 예상과 다르다 — 멈춘다')

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  // 저장하면 서버 액션이 화면을 다시 그린다(revalidatePath) — 문항마다 페이지를 새로 열고, 결과는 DB 에서 그 문항 9행으로 확인한다
  const savedOk = async (no: number) => {
    for (let t = 0; t < 40; t++) {
      const rows = (await db.from('csat_dx_item_attribute').select('attribute_code, weight, reviewed_at, source').like('item_id', `${EXAM}#${no}`)).data ?? []
      const it = tri.items.find((x) => x.no === no)!
      if (rows.length === 9 && rows.every((r) => r.reviewed_at && r.source === 'admin' && r.weight === it.w[r.attribute_code as string])) return true
      await new Promise((res) => setTimeout(res, 500))
    }
    return false
  }
  for (const it of tri.items) {
    await page.goto(`${BASE}/admin/csat/diagnosis/exams/${EXAM}`, { waitUntil: 'networkidle' })
    const card = page.locator(`article[id="item-${EXAM}#${it.no}"]`)
    await card.scrollIntoViewIfNeeded()
    const selects = card.locator('fieldset').first().locator('select')
    if ((await selects.count()) !== 9) throw new Error(`${it.no}번 역량 칸이 9개가 아니다`)
    for (let i = 0; i < 9; i++) await selects.nth(i).selectOption(String(it.w[ATTRIBUTE_CODES[i]]))
    await card.getByRole('button', { name: '검수 저장' }).click()
    if (!(await savedOk(it.no))) throw new Error(`${it.no}번 저장이 DB 에 반영되지 않았다`)
    process.stdout.write(`${it.no} `)
  }
  console.log('')
  await page.screenshot({ path: path.join(ROOT, 'tmp/pilot/M2409-canon-tagging.png') })

  // ── DB 확인 ──
  const items = (await db.from('csat_items').select('id, no, answer, answers').eq('exam_id', EXAM)).data ?? []
  const attrs = (await db.from('csat_dx_item_attribute').select('item_id, attribute_code, weight, source, reviewed_at').like('item_id', `${EXAM}#%`)).data ?? []
  const traps = (await db.from('csat_dx_option_trap').select('item_id, option_no, trap_key').like('item_id', `${EXAM}#%`)).data ?? []
  const keyN = (await db.from('csat_dx_answer_key').select('no', { count: 'exact', head: true }).eq('exam_id', EXAM)).count ?? 0
  const mism: string[] = []
  for (const it of tri.items) for (const c of ATTRIBUTE_CODES) {
    const row = attrs.find((a) => a.item_id === `${EXAM}#${it.no}` && a.attribute_code === c)
    if (!row || row.weight !== it.w[c] || !row.reviewed_at || row.source !== 'admin') mism.push(`${it.no}${c}`)
  }
  rec('검수 저장 — 252행 · 28/28 검수 · 값 = tri 최종(0 포함) · source admin', attrs.length === 252 && mism.length === 0, { rows: attrs.length, mismatch: mism.slice(0, 10) })
  const tk = (t: { item_id: string; option_no: number; trap_key: string }) => `${t.item_id}/${t.option_no}/${t.trap_key}`
  const trapSame = traps.length === before.traps.length && before.traps.every((b) => traps.some((t) => tk(t) === tk(b)))
  rec('선지 함정 키 = 저장 전 그대로', trapSame, { before: before.traps.length, after: traps.length })
  const r = examReadiness(keyN, items.map((i) => ({ id: i.id as string, hasAnswer: i.answer !== null || ((i.answers as number[] | null) ?? []).length > 0, attrs: attrs.filter((a) => a.item_id === i.id).map((a) => ({ code: a.attribute_code as string, reviewed: a.reviewed_at !== null })) })))
  rec('판정(readiness) — 28/28 · 구조 문제 0 · 켤 수 있음', r.canEnable && r.reviewed === 28 && r.structural.length === 0, r)
  if (!r.canEnable) throw new Error('판정 미통과 — 켜지 않는다')

  // ── 진단 반영 켜기(관리자 목록) ──
  await page.goto(`${BASE}/admin/csat/diagnosis/exams`, { waitUntil: 'networkidle' })
  const row = page.locator('tr', { has: page.locator(`[data-testid="dx-readiness-${EXAM}"]`) })
  const btn = row.getByRole('button', { name: /꺼짐 · 켜기/ })
  await btn.scrollIntoViewIfNeeded()
  rec('관리자 목록 — M2409 검수 28/28 표시 · 켜기 버튼 활성', (await row.locator(`[data-testid="dx-readiness-${EXAM}"]`).innerText()).includes('28/28') && (await btn.isEnabled()))
  await btn.click()
  await row.getByRole('status').waitFor({ timeout: 20000 })
  rec('켜기 결과 메시지', (await row.getByRole('status').innerText()) === '진단 반영을 켰어요', await row.getByRole('status').innerText())
  await page.screenshot({ path: path.join(ROOT, 'tmp/pilot/M2409-canon-ready.png') })
  const readyAfter = ((await db.from('csat_exams').select('id').eq('diagnosis_ready', true)).data ?? []).map((x) => x.id as string)
  rec('진단 반영 — M2409 만 켜짐(다른 시험 불변)', readyAfter.length === 1 && readyAfter[0] === EXAM, { readyAfter })
} finally {
  await browser.close()
  await ck('after', fail ? `실패 ${fail}` : 'M2409 정본 28문항 저장 · 진단 반영 켬')
}
console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
if (fail) process.exit(1)
