// apps/web/tests/e2e/utils/ec-pilot.ts
//
// 오답 원인 Pilot E2E(60–63 spec) 공용 도우미.
// 계정은 러너(scripts/csat/pilot/run-e2e.mjs)가 실행마다 만들어 EC_E2E_ACCOUNTS(JSON)로 넘긴다 — 참가자 id 는 서버 env
// CSAT_EC_PILOT_USER_IDS 에도 같이 들어간다. 각 테스트는 끝나면 자기 계정을 지운다(기록 · 증거 · capture 가 cascade 로 사라지고
// 그 시험의 전역 보류도 풀린다 — 보류는 요청자 무관이라 남겨 두면 다음 테스트의 결과가 423 이 된다).
// 경계 · probe · 범주는 DB 봉인 v0.1 에서 읽는다(하드코딩 금지 — G4 가드). taxonomy 사전은 authenticated 만 읽으므로 학습자 로그인으로 읽는다.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'

import { PROBE_DEFINITIONS } from '../../../src/lib/csat/ec-pilot/probes'
import { STUDENT_GROUPS } from '../../../src/lib/csat/ec-pilot/targets'

export interface Account { email: string; password: string; id: string }
export type Role = 'full' | 'variants' | 'correction' | 'bypass' | 'other' | 'taxonomy' | 'nonparticipant' | 'gate'

const ACCOUNTS: Partial<Record<Role, Account>> = (() => {
  try { return JSON.parse(process.env.EC_E2E_ACCOUNTS ?? '{}') as Partial<Record<Role, Account>> } catch { return {} }
})()

/** 이번 실행 단계 — pilot: 참가자 env 를 채운 서버 · gate: 참가자 env 를 비운 서버 */
export const PHASE = process.env.EC_E2E_PHASE ?? ''
export const TAXONOMY = 'v0.1'
export const WRONG = [21, 22, 23]
/** 시나리오별 시험 — 서로 겹치지 않게(보류는 시험 단위 · 요청자 무관이라 겹치면 서로의 공개를 막는다) */
export const EXAMS = { full: '2024', variants: '2025', correction: '2026', bypass: '2016', taxonomy: '2015', nonparticipant: '2017', gate: '2022' } as const
/** 학생 화면에 원인 코드 · 경계 · taxonomy 용어가 보이면 실패 */
export const FORBIDDEN = /[VSREBX]\.[a-z_]{3,}|taxonomy|provisional|boundary|multiple_plausible|경계|원인 코드/

export function account(role: Role): Account | null {
  const a = ACCOUNTS[role]
  return a && a.email && a.password && a.id ? a : null
}

export const ready = (phase: string) => PHASE === phase && !!process.env.PLAYWRIGHT_BASE_URL

const opt = { auth: { persistSession: false, autoRefreshToken: false } }
export const svc = (): SupabaseClient => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opt)

export async function learner(a: Account): Promise<SupabaseClient> {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opt)
  const { error } = await c.auth.signInWithPassword({ email: a.email, password: a.password })
  expect(error).toBeNull()
  return c
}

/** 계정 삭제(cascade). 이미 없으면 통과 */
export async function dropAccount(a: Account): Promise<void> {
  const { error } = await svc().auth.admin.deleteUser(a.id)
  if (error && !/not.?found/i.test(error.message)) throw new Error(`계정 삭제 실패: ${error.message}`)
}

export interface Boundary { boundaryKey: string; probeKey: string; groupA: string; groupB: string; outside: string }

/** 봉인 v0.1 의 provisional 경계 중 저장소에 probe 문구가 있는 첫 경계 + 그 경계 밖 학생 범주 */
export async function sealedBoundary(c: SupabaseClient): Promise<Boundary> {
  const { data: tv, error: te } = await c.from('csat_ec_taxonomy_version').select('status, note').eq('version', TAXONOMY).maybeSingle()
  expect(te).toBeNull()
  expect(tv?.status).toBe('sealed')
  const { data: bs, error: be } = await c.from('csat_ec_boundary').select('boundary_key, probe_key, code_a, code_b')
    .eq('version', TAXONOMY).eq('status', 'provisional').not('probe_key', 'is', null).order('boundary_key')
  expect(be).toBeNull()
  const keys = new Set(PROBE_DEFINITIONS.map((d) => d.key))
  const b = (bs ?? []).find((x) => keys.has(x.probe_key as string))
  expect(b, '저장소 probe 문구가 있는 v0.1 경계').toBeTruthy()
  const { data: codes, error: ce } = await c.from('csat_ec_code').select('code, student_group').eq('version', TAXONOMY).in('code', [b!.code_a, b!.code_b])
  expect(ce).toBeNull()
  const group = (code: unknown) => (codes ?? []).find((x) => x.code === code)?.student_group as string
  const groupA = group(b!.code_a), groupB = group(b!.code_b)
  const outside = STUDENT_GROUPS.map((g) => g.key as string).find((g) => g !== 'unsure' && g !== groupA && g !== groupB)!
  return { boundaryKey: b!.boundary_key as string, probeKey: b!.probe_key as string, groupA, groupB, outside }
}

export const groupLabel = (key: string) => STUDENT_GROUPS.find((g) => g.key === key)!.label

export async function login(page: Page, a: Account): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', a.email)
  await page.fill('input[type="password"]', a.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

/** 정답 키(공개 채점 키) — 기록 입력용 */
export async function answerKey(exam: string): Promise<Record<number, number>> {
  const { data, error } = await svc().from('csat_dx_answer_key').select('no, answers').eq('exam_id', exam).order('no')
  expect(error).toBeNull()
  expect(data).toHaveLength(45)
  return Object.fromEntries((data ?? []).map((r) => [r.no as number, (r.answers as number[])[0]]))
}

/** 수능 기록 새로 입력 — WRONG 만 틀리게 → 「채점하고 저장」 */
export async function submitRecord(page: Page, exam: string): Promise<void> {
  const key = await answerKey(exam)
  await page.goto('/csat/diagnosis?tab=records&modal=new')
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('종류').selectOption('suneung')
  await dialog.getByLabel('회차').selectOption(exam)
  await dialog.getByRole('button', { name: '다음' }).click()
  for (let no = 1; no <= 45; no++) {
    const pick = WRONG.includes(no) ? (key[no] % 5) + 1 : key[no]
    await dialog.getByRole('radio', { name: `${no}번 ${pick}`, exact: true }).click()
  }
  await dialog.getByRole('button', { name: '채점하고 저장' }).click()
}

/** 참가자 저장 → 수집 화면(결과 없음). 세션 id 를 돌려준다 */
export async function submitAsParticipant(page: Page, exam: string): Promise<string> {
  await submitRecord(page, exam)
  await page.waitForURL(/capture=/, { timeout: 60_000 })
  await expect(page.getByText('풀이를 조금만 더 알려 주세요')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/45문항 중 \d+문항 맞음/)).toHaveCount(0)
  return new URL(page.url()).searchParams.get('capture')!
}

export async function confirmTwo(page: Page): Promise<void> {
  await page.getByRole('radiogroup', { name: /시간을 재고 풀었나요/ }).getByRole('radio', { name: '네' }).click()
  await page.getByRole('radiogroup', { name: /선지를 하나씩 따져/ }).getByRole('radio', { name: '네' }).click()
  await page.getByRole('button', { name: '다음' }).click()
}

/** 지금 화면의 문항 번호(정오 표시 없음 확인 포함) */
export async function currentItem(page: Page): Promise<number> {
  const head = page.getByRole('dialog').getByText(/^\d+번$/).first()
  await expect(head).toBeVisible({ timeout: 30_000 })
  const no = Number((await head.textContent())!.replace('번', ''))
  // 앱이 만든 글자만 본다 — 문항 원문(발문 · 지문 · 선지)은 「어법상 틀린 것은?」처럼 금지어를 담을 수 있으므로 빼고 검사한다
  const body = await page.evaluate(async (itemNo) => {
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
    let text = norm(dialog.innerText)
    const sid = new URL(location.href).searchParams.get('capture')
    const st = sid ? await fetch(`/api/csat/ec/capture?session=${sid}`).then((r) => r.json()).catch(() => null) : null
    const it = (st?.items ?? []).find((x: { itemNo: number }) => x.itemNo === itemNo) as { stem: string; passage: { text: string }[]; choices: { text: string }[] } | undefined
    if (!it) return text
    const parts = [it.stem, ...it.passage.map((p) => p.text), ...it.choices.map((c) => c.text)].map(norm).filter(Boolean).sort((a, b) => b.length - a.length)
    for (const p of parts) text = text.split(p).join(' ')
    return text
  }, no)
  expect(body).not.toMatch(FORBIDDEN)
  expect(body).not.toMatch(/정답|오답|틀린|맞은/)
  return no
}

/** 문항 하나 입력. interp: 문자열 = 「내가 이해한 뜻」 · 'unknown' · 'skipped'. group: 학생 범주 key 또는 null(고르지 않음) */
export async function fillItem(page: Page, o: { reason: string; interp: string; group: string | null; blockFirst?: boolean }): Promise<void> {
  const d = page.getByRole('dialog')
  if (o.blockFirst) {
    const sentence = d.locator('[lang="en"] button').first()
    await sentence.click()
    await expect(sentence).toHaveAttribute('aria-pressed', 'true')
  } else {
    await d.getByRole('button', { name: '막힌 곳 없음' }).click()
  }
  await d.getByLabel('이 답을 고른 이유').fill(o.reason)
  const interpGroup = d.getByRole('radiogroup', { name: /어떻게 이해했나요/ })
  if (o.interp === 'unknown') await interpGroup.getByRole('radio', { name: '잘 모르겠어요' }).click()
  else if (o.interp === 'skipped') await interpGroup.getByRole('radio', { name: '건너뛰기' }).click()
  else {
    await interpGroup.getByRole('radio', { name: '내가 이해한 뜻 적기' }).click()
    await d.getByLabel('내가 이해한 뜻').fill(o.interp)
  }
  if (o.group) await d.getByRole('radiogroup', { name: '어디가 가장 어려웠나요?' }).getByRole('radio', { name: groupLabel(o.group), exact: true }).click()
  await d.getByRole('button', { name: /^저장하고/ }).click()
}

/** 다음 화면을 기다린다 — probe · 결과 · 또는 prev 와 다른 문항. 저장 직후 옛 화면을 다음 화면으로 오인하지 않게 prev 를 넘긴다 */
export async function nextPhase(page: Page, prev: number | null = null): Promise<'probe' | 'item' | 'result'> {
  const d = page.getByRole('dialog')
  const probe = d.getByText(new RegExp(`^(${PROBE_DEFINITIONS.map((p) => p.intro).join('|')})$`))
  const result = page.getByText('이번 시험 결과')
  const head = d.getByText(/^\d+번$/).first()
  let out: 'probe' | 'item' | 'result' | null = null
  await expect.poll(async () => {
    out = null
    if (await result.isVisible()) out = 'result'
    else if (await probe.first().isVisible()) out = 'probe'
    else if ((await head.isVisible()) && (await d.getByRole('button', { name: '저장하는 중…' }).count()) === 0) {
      const no = Number(((await head.textContent()) ?? '').replace('번', ''))
      if (no !== prev) out = 'item'
    }
    return out
  }, { timeout: 30_000 }).not.toBeNull()
  return out!
}

/** 봉인된 수집 대상(학습자 RPC) */
export async function sealedTargets(c: SupabaseClient, sessionId: string): Promise<number[]> {
  const { data, error } = await c.rpc('csat_ec_my_capture_state', { p_session: sessionId })
  expect(error).toBeNull()
  const t = (data as { targets?: unknown } | null)?.targets
  return Array.isArray(t) ? t.filter((x): x is number => typeof x === 'number').sort((a, b) => a - b) : []
}

export async function captureStatus(c: SupabaseClient, sessionId: string): Promise<string | null> {
  const { data, error } = await c.rpc('csat_ec_my_capture_state', { p_session: sessionId })
  expect(error).toBeNull()
  return (data as { status?: string } | null)?.status ?? null
}

/**
 * 정리 — 열린 수집을 앱 API 로 끝낸다(확인 · 남은 해석 skipped · finish). 활성 capture(held · collecting)를 가진 계정을 지우면
 * 묘비가 남아 그 시험이 모든 사용자에게 계속 보류된다(REVEAL_GATE 설계 · 1차 실행 실측). 그래서 계정을 지우기 전에 completed 로 닫는다.
 */
export async function completeViaApi(page: Page, sessionId: string): Promise<string> {
  return page.evaluate(async (id) => {
    const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const st = await fetch(`/api/csat/ec/capture?session=${id}`)
    if (st.ok) {
      const cap = (await st.json()) as { items: { itemNo: number; saved: { interpretation: string | null } }[] }
      await post('/api/csat/ec/confirm', { sessionId: id, tookExam: true, judgedEach: true })
      for (const it of cap.items) if (!it.saved.interpretation) await post('/api/csat/ec/evidence', { sessionId: id, itemNo: it.itemNo, evidence: { kind: 'interpretation', state: 'skipped' } })
    }
    const f = await post('/api/csat/ec/capture', { session: id, action: 'finish' })
    return ((await f.json().catch(() => ({}))) as { status?: string }).status ?? `http ${f.status}`
  }, sessionId)
}

/** 계정 정리 — 열린 수집이 있으면 먼저 completed 로 닫고(묘비 방지) 지운다. 닫기 실패는 숨기지 않는다 */
export async function closeAndDrop(page: Page, a: Account, sessionId: string | null): Promise<void> {
  const status = sessionId ? await learner(a).then((c) => captureStatus(c, sessionId)).catch(() => 'unknown') : null
  if (sessionId && (status === 'held' || status === 'collecting' || status === 'unknown')) {
    const st =await completeViaApi(page, sessionId).catch((e: unknown) => `오류 ${e instanceof Error ? e.message : String(e)}`)
    if (st !== 'completed' && st !== 'none') throw new Error(`수집을 닫지 못했다(${st}) — 계정을 지우면 묘비가 남는다. 계정은 그대로 둔다`)
  }
  await dropAccount(a)
}

/** 본인 유효 과정 증거 — `문항:종류:상태|글자|범주` 목록 */
export async function evidenceKinds(c: SupabaseClient, sessionId: string): Promise<string[]> {
  const { data, error } = await c.rpc('csat_ec_my_process_evidence', { p_session: sessionId })
  expect(error).toBeNull()
  type Row = { item_no: number; kind: string; value: { state?: string; option?: string; group?: string; skipped?: boolean } }
  return ((data ?? []) as Row[]).map((r) => `${r.item_no}:${r.kind}:${r.value.skipped ? 'skipped' : r.value.state ?? r.value.option ?? r.value.group ?? ''}`)
}

/** 본인 대기 probe(학습자 RPC) */
export async function pendingProbes(c: SupabaseClient, sessionId: string): Promise<{ item_no: number; probe_key: string; taxonomy_version: string }[]> {
  const { data, error } = await c.rpc('csat_ec_my_pending_probes', { p_session: sessionId })
  expect(error).toBeNull()
  return (data ?? []) as { item_no: number; probe_key: string; taxonomy_version: string }[]
}
