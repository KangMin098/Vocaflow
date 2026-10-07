// scripts/csat/pilot/synthetic/run-synthetic.mts
//
// G6-S 하니스 — 합성 학습자(.pilot-private/synthetic/gen/<persona>.json)를 **실제 개발 DB 경로**로 통과시킨다:
//   테스트 계정(@example.com) → 기록 저장(csat_ec_record_session_held · 봉인 대상 = personas.targets, 정오 무관)
//   → 학습자 로그인으로 수집 열기 → 확인 → 막힌 곳 · 이유 · 범주 · 해석(같은 순서 · 앱과 같은 evidenceValue)
//   → 서버 감지기(증거 저장 트랜잭션 트리거) → 대기 probe 가 뜨면 합성 응답(건너뜀 포함 · 세션 상한 3) → 수집 완료
//   → 감지기 실행 · 신호 · probe 기록 수집 → pre/post 판정 packet(비식별) + 숨은 정답 원인(따로)
//   → 계정 삭제(수집이 completed 라 묘비 없음) · 새 열린 묘비 0 확인
// 판정 packet · 정답 원인 · 매핑은 저장소 밖(.pilot-private/synthetic/)에만. DB 의 v0.1 회차 · 판정 표에는 아무것도 쓰지 않는다.
//
//   cd apps/web && node <tsx cli> --env-file=<apps/web/.env.local> ../../scripts/csat/pilot/synthetic/run-synthetic.mts
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { createRequire } from 'node:module'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { captureProbeConfig } from '@/lib/csat/ec-pilot/probes'
import { evidenceValue, type EvidenceInput } from '@/lib/csat/ec-pilot/targets'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const PRIV = path.join(ROOT, '.pilot-private/synthetic')
const DEV_REF = 'jajenrevcbmrpaliomxv'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!URL_?.includes(DEV_REF)) { console.error('개발 프로젝트가 아니다'); process.exit(2) }
const TAX = 'v0.1', CAP = 3
const opt = { auth: { persistSession: false, autoRefreshToken: false } }
const svc = createClient(URL_, SERVICE, opt)
// 실행 기록 · 신호 · 묘비 표는 어느 역할에도 권한이 없다(G4) — 소유자 연결로 읽기만 한다
const pg = createRequire(path.join(ROOT, 'scripts/csat/error-evidence/isolated-pg/package.json'))('pg')
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()

type Attempt = { no: number; true_cause: string | null; reason: string; blocked: { part: 'passage' | 'stem' | 'option'; sentence: number; option?: number } | null
  interpretation: { state: 'answered' | 'unknown' | 'skipped'; text?: string }; category: string | null; probe_option: 'A' | 'B' | 'C' | 'D' | null }
type Gen = { persona: string; exams: Record<string, { answers: Record<string, number>; attempts: Attempt[] }> }
type Item = { no: number; id: string; type: string; target: boolean; answer: number; stem: string; choices: string[]; sentences: { k: number; text: string }[] }

const personas = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'personas.json'), 'utf8')) as { exams: string[]; targets: number[]; personas: { key: string }[] }
const items = JSON.parse(fs.readFileSync(path.join(PRIV, 'items.json'), 'utf8')) as Record<string, Item[]>
const probeCfg = captureProbeConfig()
const run = randomUUID().slice(0, 8)
const log: string[] = []
const say = (s: string) => { console.log(s); log.push(s) }

// 문항 원문(passage 전체)은 DB 에서 — evidenceValue 가 앱과 같은 문자 범위를 계산하도록
async function itemSource(id: string) {
  const { data, error } = await svc.from('csat_items').select('id, stem, passage, choices').eq('id', id).single()
  if (error) throw new Error(`${id}: ${error.message}`)
  return { itemId: data.id as string, stem: data.stem as string | null, passage: data.passage as string | null, choices: (data.choices as string[] | null) ?? null }
}

const accounts: { persona: string; id: string; client: SupabaseClient }[] = []
const outcome: Record<string, unknown>[] = []
const truth: Record<string, string | null> = {}
const failures: string[] = []
let tombBefore = 0

try {
  tombBefore = (await db.query(`select coalesce(max(id), 0)::int m from public.csat_ec_capture_tombstone`)).rows[0].m
  for (const p of personas.personas) {
    const file = path.join(PRIV, 'gen', `${p.key}.json`)
    if (!fs.existsSync(file)) { failures.push(`${p.key}: 생성 파일 없음`); continue }
    const gen = JSON.parse(fs.readFileSync(file, 'utf8')) as Gen
    const email = `ec-synth-${run}-${p.key.toLowerCase()}@example.com`, password = randomUUID()
    const cu = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test: 'G6-S synthetic learner' } })
    if (cu.error) throw new Error(`계정(${p.key}): ${cu.error.message}`)
    const client = createClient(URL_, ANON, opt)
    const si = await client.auth.signInWithPassword({ email, password })
    if (si.error) throw new Error(`로그인(${p.key}): ${si.error.message}`)
    accounts.push({ persona: p.key, id: cu.data.user.id, client })

    for (const [ei, exam] of personas.exams.entries()) {
      const g = gen.exams[exam]
      const list = items[exam]
      const responses = list.map((it) => {
        const chosen = Number(g.answers[String(it.no)])
        return { item_no: it.no, item_id: it.id, chosen_option: chosen, is_correct: chosen === Number(it.answer), confidence: 'sure' }
      })
      const raw = responses.filter((r) => r.is_correct).length * 2
      const rec = await svc.rpc('csat_ec_record_session_held', {
        p_session: { user_id: cu.data.user.id, exam_id: exam, mode: 'live', taken_at: '2026-10-07', client_key: randomUUID(), raw_score: raw, total_minutes: 70, entered_by: 'learner' },
        p_responses: responses, p_participant: true, p_taxonomy: TAX,
        p_config: { probe_cap: CAP, probes: probeCfg }, p_targets: personas.targets, p_evidence_eligible: true,
      })
      if (rec.error) throw new Error(`저장(${p.key}/${exam}): ${rec.error.message}`)
      const sid = (rec.data as { session_id: string }).session_id
      const op = await client.rpc('csat_ec_capture_open', { p_session: sid })
      if (op.error) throw new Error(`수집 열기(${p.key}/${exam}): ${op.error.message}`)
      const cf = await client.rpc('csat_ec_confirm_session', { p_session: sid, p_took_exam: true, p_judged_each: true })
      if (cf.error) throw new Error(`확인(${p.key}/${exam}): ${cf.error.message}`)
      let probesShown = 0
      for (const a of [...g.attempts].sort((x, y) => x.no - y.no)) {
        const it = list.find((x) => x.no === a.no)!
        const key = `${p.key}-E${ei + 1}-#${a.no}`
        truth[key] = a.true_cause
        const src = await itemSource(it.id)
        const add = async (input: EvidenceInput) => {
          const value = evidenceValue(input, src)
          if (!value) { failures.push(`${key}: ${input.kind} 값 계산 실패`); return }
          const r = await client.rpc('csat_ec_add_process_evidence', { p_session: sid, p_item_no: a.no, p_kind: input.kind, p_value: value, p_supersedes: null })
          if (r.error) failures.push(`${key}: ${input.kind} 저장 실패 — ${r.error.message}`)
        }
        if (a.blocked) await add({ kind: 'blocked_span', part: a.blocked.part, option: a.blocked.part === 'option' ? (a.blocked.option ?? 1) : null, sentence: a.blocked.sentence })
        if (a.reason?.trim()) await add({ kind: 'reason', text: a.reason.trim() })
        if (a.category) await add({ kind: 'category', group: a.category as never })
        await add(a.interpretation.state === 'answered' ? { kind: 'interpretation', state: 'answered', text: (a.interpretation.text ?? '').trim() } : { kind: 'interpretation', state: a.interpretation.state })
        // 화면처럼: 이 문항 증거를 다 남긴 뒤 대기 probe 확인 → 합성 응답
        const pend = await client.rpc('csat_ec_my_pending_probes', { p_session: sid })
        const mine = ((pend.data ?? []) as { item_no: number; probe_key: string; boundary_key: string; taxonomy_version: string }[]).filter((x) => x.item_no === a.no)
        let probe: string | null = null
        for (const q of mine) {
          const def = probeCfg.find((d) => d.key === q.probe_key)
          if (!def) { failures.push(`${key}: probe 정의 없음 ${q.probe_key}`); continue }
          const option = a.probe_option
          const r = await client.rpc('csat_ec_add_probe_response', { p_session: sid, p_item_no: a.no, p_value: { probe_key: def.key, probe_version: def.version, taxonomy_version: q.taxonomy_version, boundary_key: q.boundary_key, prompt_hash: def.prompt_hash, option, skipped: option === null }, p_session_cap: CAP })
          if (r.error) { probe = /상한/.test(r.error.message) ? 'capped' : `error:${r.error.message.slice(0, 60)}`; continue }
          probesShown++; probe = option ?? 'skipped'
        }
        outcome.push({ key, persona: p.key, exam, no: a.no, type: it.type, correct: Number(g.answers[String(a.no)]) === Number(it.answer), interp: a.interpretation.state, category: a.category, probeOffered: mine.length > 0, probe })
      }
      const fin = await client.rpc('csat_ec_capture_finish', { p_session: sid })
      if (fin.error || (fin.data as { status?: string })?.status !== 'completed') failures.push(`${p.key}/${exam}: 수집 완료 실패 — ${fin.error?.message ?? JSON.stringify(fin.data)}`)
      // 감지기 결과(문항별 마지막 실행) · 신호 — 소유자 연결로 읽어 outcome 에 붙인다
      const runs = (await db.query(`select distinct on (item_no) item_no, result from public.csat_ec_detector_run where session_id = $1 order by item_no, id desc`, [sid])).rows as { item_no: number; result: string }[]
      const sigs = (await db.query(`select s.item_no, s.boundary_key, r.reason from public.csat_ec_boundary_signal s left join public.csat_ec_boundary_signal_retraction r on r.signal_id = s.id where s.session_id = $1`, [sid])).rows as { item_no: number; boundary_key: string; reason: string | null }[]
      for (const o of outcome) if ((o.key as string).startsWith(`${p.key}-E${ei + 1}-`)) { const no = o.no as number; o.detector = runs.find((x) => x.item_no === no)?.result ?? 'none'; o.signals = sigs.filter((x) => x.item_no === no).map((x) => `${x.boundary_key}${x.reason ? ':' + x.reason : ''}`) }
      // 감지기 기록 — service 는 표 권한이 없다(RPC 전용 설계) → 판정 packet 은 canonical 입력 함수로(소유자 권한은 하니스 밖) 대신 학습자 본인 유효 증거로 만든다
      const ev = await client.rpc('csat_ec_my_process_evidence', { p_session: sid })
      if (ev.error) failures.push(`${p.key}/${exam}: 증거 조회 실패 — ${ev.error.message}`)
      const byItem = new Map<number, { kind: string; value: Record<string, unknown> }[]>()
      for (const r of (ev.data ?? []) as { item_no: number; kind: string; value: Record<string, unknown>; created_at: string }[]) {
        const l = byItem.get(r.item_no) ?? []; l.push({ kind: r.kind, value: r.value }); byItem.set(r.item_no, l)
      }
      for (const a of g.attempts) {
        const it = list.find((x) => x.no === a.no)!
        const key = `${p.key}-E${ei + 1}-#${a.no}`
        const evid = byItem.get(a.no) ?? []
        const strip = (e: { kind: string; value: Record<string, unknown> }) => {
          const v = { ...e.value }; delete v.item_id
          if (e.kind === 'blocked_span') { const part = v.part as string; const k = v.sentence as number; v.text = part === 'passage' ? it.sentences[k]?.text : part === 'stem' ? it.stem : it.choices[((v.option as number) ?? 1) - 1]; delete v.start; delete v.end }
          if (e.kind === 'targeted_probe') { const d = probeCfg.find((x) => x.key === v.probe_key); v.question = '방금 적은 뜻은 어떻게 떠올렸나요?'; v.options = { A: '그 단어가 원래 그런 뜻이라고 생각했어요', B: '단어의 기본 뜻에서 문맥이나 비유를 따라가 그렇게 생각했어요', C: '둘 다 조금씩 영향을 줬어요', D: '잘 모르겠어요' }; delete v.prompt_hash; void d }
          return { kind: e.kind, value: v }
        }
        const base = { attempt: key, synthetic: true, item: { type: it.type, stem: it.stem, passage: it.sentences.map((s) => s.text).join(' '), choices: it.choices, answer: it.answer }, chosen: Number(g.answers[String(a.no)]) }
        const pre = { ...base, evidence_profile: 'pre_probe', process_evidence: evid.filter((e) => e.kind !== 'targeted_probe').map(strip) }
        const post = { ...base, evidence_profile: 'all', process_evidence: evid.map(strip) }
        for (const [dir, pk] of [['pre', pre], ['post', post]] as const) {
          fs.mkdirSync(path.join(PRIV, 'packets', dir), { recursive: true })
          fs.writeFileSync(path.join(PRIV, 'packets', dir, `${key}.json`), JSON.stringify(pk, null, 1))
        }
      }
      say(`${p.key}/${exam}: ${responses.filter((r) => r.is_correct).length}/28 정답 · 대상 8 · probe 응답 ${probesShown} · 완료 ${fin.data ? (fin.data as { status?: string }).status : '-'}`)
    }
  }
  // 감지기 실행 결과(개수만) — 실행 기록 표는 service 도 못 읽는다 → 대기 probe 제시 여부로 대신 집계(outcome.probeOffered)
} catch (e) {
  failures.push(`실행: ${(e as Error).message}`)
} finally {
  for (const a of accounts) {
    const d = await svc.auth.admin.deleteUser(a.id)
    if (d.error) failures.push(`계정 삭제(${a.persona}): ${d.error.message}`)
  }
  const openTomb = (await db.query(`select count(*)::int n from public.csat_ec_capture_tombstone where id > $1 and closed_at is null`, [tombBefore])).rows[0].n as number
  if (openTomb) failures.push(`새 열린 묘비 ${openTomb}개 — 시험 전체가 보류된다`)
  await db.end()
  fs.mkdirSync(PRIV, { recursive: true })
  fs.writeFileSync(path.join(PRIV, 'truth.json'), JSON.stringify(truth, null, 1))
  fs.writeFileSync(path.join(PRIV, 'outcome.json'), JSON.stringify({ run, at: new Date().toISOString(), outcome, failures, log }, null, 1))
  say(`\n완료 — attempt ${outcome.length} · probe 제시 ${outcome.filter((o) => o.probeOffered).length} · 실패 ${failures.length} · 새 열린 묘비 ${openTomb}`)
  for (const f of failures.slice(0, 20)) console.log('  ✗', f)
  process.exitCode = failures.length ? 1 : 0
}
