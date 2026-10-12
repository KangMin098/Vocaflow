// scripts/csat/meaning-support-isolated-seed.mjs
//
// **v3.1 원문 이해 — 격리 CI 화면 검증용 문항 fixture.** (작업 지시 C1 §「격리 화면 검증의 데이터 전제」)
//
//   VOCAFLOW_CSAT_ISOLATED_NAMESPACE=csat-v31 VOCAFLOW_CSAT_ISOLATED_RUN_ID=<run>-<attempt> \
//     node scripts/csat/meaning-support-isolated-seed.mjs            # dry-run — 가드 + 계획 출력만(DB 접속 없음)
//   ... node scripts/csat/meaning-support-isolated-seed.mjs --commit  # 러너의 로컬 Supabase 에 적재
//
// 가드(항상 먼저 · 클라이언트를 만들기 전): namespace 정확히 csat-v31 · run ID `^[0-9]+-[0-9]+$` 64자 이하 ·
//   NEXT_PUBLIC_SUPABASE_URL 이 http + loopback(127.0.0.1 · localhost · ::1) + 54321. 하나라도 어긋나면 거부(키 · URL 원문은 출력하지 않는다).
//   환경 변수는 프로세스 환경에서만 읽는다(.env 파일을 읽지 않는다 — 파일 값이 공유 DB 를 가리키는 사고를 막는다).
// 소유 marker: `.agent-logs/csat-v31-owner.json`(gitignore) — namespace · run ID · manifest 해시 · 문항/회차/유형 ID · 대상 fingerprint.
//   다른 run · 다른 manifest 의 marker 면 중단. marker 가 없는데 allowlist 의 행이 이미 있으면 소유를 주장하지 않고 중단.
//   같은 run + manifest 재실행은 같은 ID 에 upsert(멱등 · 결과 동일). 전역 delete/truncate 없음. 복구 경계 = CI 러너 폐기.
// 적재(비민감 metadata 만): 회차 1 · 유형 3 · 문항 3(stem '' · 지문/선지/정답 없음) · 분석(placeholder 문장 · 버전만 의미) + 3인 pass 검수 행.
//   공개 2026#34 = 분석 v5(= 배포 탐구/교수 설명 결속 버전) · stale 2026#38 = 분석 v6(record+1 → lookupInquiry stale)
//   2026#22 = 분석 v5. 보류(access_withheld)는 정본 Reveal Gate(20261005170000)의 회차 단위 capture 로만 — 앱 플래그 · 테스트 전용 API 없음.
//   --commit 은 적재 뒤 게이트 RPC 셋(embargoed_items/exams · reveal_state)이 있고 2026 에 활성 보류 · 열린 묘비가 없는지 확인한다.
//   ⚠️ 보류 시작(csat_ec_record_session_held)에 필요한 sealed taxonomy 는 만들지 않는다 — 정본 경로(마이그레이션 시드 + csat_ec_taxonomy_seal ·
//      is_admin())가 격리 DB 에서 서지 않는다(is_admin 정의 마이그레이션 20260706010000 이 known-failure). 우회 금지라 멈춤(보고서 참고).
// 재실행 안전: 예(같은 run/manifest). 되돌리기: 러너 폐기(공유 DB 에는 marker 를 만들지 않는다 — 가드가 막는다).

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isKiceExam } from './lib-exam-id.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const MARKER_PATH = path.join(ROOT, '.agent-logs', 'csat-v31-owner.json')
export const NAMESPACE = 'csat-v31'
const RUN_ID_RE = /^[0-9]+-[0-9]+$/
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

export class SeedRefusal extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'SeedRefusal'
  }
}

// ── 고정 manifest (allowlist) ────────────────────────────────────────────────
const PLACEHOLDER = '격리 검증용 fixture — 분석 본문 없음'
export const FIXTURE = Object.freeze({
  exam: { id: '2026', label: '2026학년도 수능', kind: 'suneung', organizer: 'kice', grade: 3, year: 2026, exam_year: 2025, month: 11, item_count: 0, has_answer_key: false, source_note: 'csat-v31 isolated fixture' },
  types: [
    { id: 'R-GIST', name: '요지', section: '독해' },
    { id: 'R-BLANK', name: '빈칸 추론', section: '독해' },
    { id: 'R-INSERT', name: '문장 삽입', section: '독해' },
  ],
  // state: public(분석 버전 = 배포 결속) · stale(결속 +1) · access_withheld(Reveal Gate 보류)
  items: [
    { id: '2026#22', no: 22, type_id: 'R-GIST', state: 'access_withheld', analysis_version: 5 },
    { id: '2026#34', no: 34, type_id: 'R-BLANK', state: 'public', analysis_version: 5 },
    { id: '2026#38', no: 38, type_id: 'R-INSERT', state: 'stale', analysis_version: 6 },
  ],
})
export const ALLOWED_ITEM_IDS = Object.freeze(FIXTURE.items.map((i) => i.id))
const PERSONAS = ['setter', 'analyst', 'tutor']

/** 배포 탐구 결속 버전과 manifest 상태가 맞는지(public/held = record, stale = record+1) — 데이터가 바뀌면 manifest 가 낡았음을 알린다 */
export function checkManifestAgainstRecords(records, fixture = FIXTURE) {
  for (const it of fixture.items) {
    const rec = records[it.id]
    if (!rec || typeof rec.analysis_version !== 'number') throw new SeedRefusal(`배포 탐구 레코드 없음: ${it.id}`)
    const want = it.state === 'stale' ? rec.analysis_version + 1 : rec.analysis_version
    if (it.analysis_version !== want) throw new SeedRefusal(`manifest 버전 불일치: ${it.id} (${it.state})`)
  }
}

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v))
export const manifestHash = (fixture = FIXTURE) => createHash('sha256').update(canon(fixture), 'utf8').digest('hex')

// ── 가드 ────────────────────────────────────────────────────────────────────
/** 환경 가드 — 어긋나면 SeedRefusal. 메시지에 키 · URL 원문을 싣지 않는다. 반환값의 fingerprint 도 해시뿐 */
export function guardEnv(env) {
  const ns = env.VOCAFLOW_CSAT_ISOLATED_NAMESPACE
  if (ns !== NAMESPACE) throw new SeedRefusal(`VOCAFLOW_CSAT_ISOLATED_NAMESPACE 가 정확히 ${NAMESPACE} 여야 한다(${ns ? '다른 값' : '미설정'})`)
  const runId = env.VOCAFLOW_CSAT_ISOLATED_RUN_ID
  if (typeof runId !== 'string' || runId.length === 0) throw new SeedRefusal('VOCAFLOW_CSAT_ISOLATED_RUN_ID 미설정')
  if (runId.length > 64) throw new SeedRefusal('VOCAFLOW_CSAT_ISOLATED_RUN_ID 가 64자를 넘는다')
  if (!RUN_ID_RE.test(runId)) throw new SeedRefusal('VOCAFLOW_CSAT_ISOLATED_RUN_ID 형식이 <run>-<attempt>(숫자)가 아니다')
  const raw = env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) throw new SeedRefusal('NEXT_PUBLIC_SUPABASE_URL 미설정')
  let u
  try {
    u = new URL(raw)
  } catch {
    throw new SeedRefusal('NEXT_PUBLIC_SUPABASE_URL 을 해석할 수 없다')
  }
  if (u.protocol !== 'http:') throw new SeedRefusal('대상이 로컬 http 가 아니다 — 격리 Supabase 만 허용')
  if (!LOOPBACK.has(u.hostname)) throw new SeedRefusal('대상 host 가 loopback(127.0.0.1 · localhost · ::1)이 아니다 — 원격 · 공유 DB 거부')
  if (u.port !== '54321') throw new SeedRefusal('대상 port 가 54321 이 아니다 — 격리 Supabase 만 허용')
  if (u.username || u.password) throw new SeedRefusal('URL 에 자격 증명이 들어 있다 — 거부')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new SeedRefusal('SUPABASE_SERVICE_ROLE_KEY 미설정')
  const fingerprint = createHash('sha256').update(`${u.hostname}:${u.port}`, 'utf8').digest('hex').slice(0, 16)
  return { namespace: ns, runId, url: raw, fingerprint }
}

/** allowlist 밖 문항 ID 거부 */
export function guardAllowlist(ids) {
  const bad = ids.filter((id) => !ALLOWED_ITEM_IDS.includes(id))
  if (bad.length > 0) throw new SeedRefusal(`allowlist 밖 문항 ID: ${bad.join(', ')}`)
  // 집합 분리(exam-id 가드) — fixture 는 평가원 문항만. 학평 문항은 DB 굽기 경로가 달라 이 seed 가 만들지 않는다
  const notKice = ids.filter((id) => !isKiceExam(id))
  if (notKice.length > 0) throw new SeedRefusal(`평가원 밖 문항 ID: ${notKice.join(', ')}`)
}

/** marker 판정 — 'fresh'(없음) · 'same'(같은 run+manifest). 다르면 SeedRefusal */
export function guardMarker(marker, { namespace, runId, hash }) {
  if (marker == null) return 'fresh'
  if (marker.namespace !== namespace) throw new SeedRefusal('다른 namespace 의 소유 marker — 중단')
  if (marker.runId !== runId) throw new SeedRefusal('다른 run 의 소유 marker — 중단(이 러너의 fixture 가 아니다)')
  if (marker.manifestHash !== hash) throw new SeedRefusal('같은 run 이지만 manifest 가 다르다 — 중단')
  return 'same'
}

export const fileMarkerIo = (file = MARKER_PATH) => ({
  read() {
    if (!fs.existsSync(file)) return null
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      throw new SeedRefusal('소유 marker 를 읽을 수 없다 — 중단')
    }
  },
  write(m) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(m, null, 2)}\n`)
    fs.renameSync(tmp, file)
  },
})

// ── DB 어댑터(supabase-js) — 테스트는 같은 모양의 가짜를 주입한다 ─────────────
export function supabaseDb(client) {
  const must = (r, what) => {
    if (r.error) throw new Error(`${what} 실패: ${r.error.message}`)
    return r.data
  }
  return {
    async existing(table, ids) {
      if (ids.length === 0) return []
      return (must(await client.from(table).select('id').in('id', ids), `${table} 조회`) ?? []).map((r) => r.id)
    },
    async upsert(table, rows, onConflict) {
      return must(await client.from(table).upsert(rows, { onConflict }).select(), `${table} upsert`) ?? []
    },
    async analysesOf(itemIds) {
      return must(await client.from('csat_item_analyses').select('id, item_id, version, status').in('item_id', itemIds), '분석 조회') ?? []
    },
    async setStatus(ids, status) {
      if (ids.length === 0) return
      must(await client.from('csat_item_analyses').update({ status }).in('id', ids).select('id'), '분석 상태 갱신')
    },
    async gate(itemIds, examIds) {
      const e = (r) => (r.error ? `${r.error.code ?? ''} ${r.error.message ?? ''}`.trim() : null)
      const a = await client.rpc('csat_ec_embargoed_items', { p_items: itemIds })
      const b = await client.rpc('csat_ec_embargoed_exams', { p_exams: examIds })
      // 없는 세션 id — 함수가 있으면 오류 없이 null(행 없음), 없으면 PGRST202
      const c = await client.rpc('csat_ec_reveal_state', { p_session: '00000000-0000-0000-0000-000000000000' })
      return { items: a.error ? null : a.data, exams: b.error ? null : b.data, error: e(a) ?? e(b) ?? e(c) }
    },
  }
}

/** PostgREST 의 「함수 없음」 오류(PGRST202 · schema cache · does not exist)인가 */
export function isMissingRpc(error) {
  if (!error) return false
  return /PGRST202|42883|does not exist|Could not find the function|schema cache/i.test(String(error))
}

export function plan(fixture = FIXTURE) {
  const exam = fixture.exam
  const types = fixture.types.map((t) => ({ ...t, in_scope: true, status: 'active' }))
  const items = fixture.items.map((i) => ({
    id: i.id, exam_id: exam.id, no: i.no, section: '독해', in_scope: true, type_id: i.type_id,
    stem: '', passage: null, choices: null, answer: null, answers: null, points: null, body_ok: false, raw_block: null,
  }))
  const analyses = fixture.items.map((i) => ({
    item_id: i.id, version: i.analysis_version, measured_ability: PLACEHOLDER, design_intent: PLACEHOLDER,
    answer_locus: null, choice_analysis: [], solve_procedure: [], required_vocab: [], answer_unknown: true,
    status: 'in_review', source: 'csat-v31-isolated-fixture',
  }))
  return { exam, types, items, analyses }
}

/**
 * 적재 본체. 가드는 db 를 만들기 전에 모두 돈다 — makeDb 는 가드 통과 뒤에만 불린다.
 * @returns {{ mode: 'dry-run' | 'committed', marker, counts }}
 */
export async function runSeed({ env, commit = false, ids = ALLOWED_ITEM_IDS, records, makeDb, markerIo = fileMarkerIo(), log = () => {} }) {
  const g = guardEnv(env)
  guardAllowlist(ids)
  const fixture = { ...FIXTURE, items: FIXTURE.items.filter((i) => ids.includes(i.id)) }
  if (records) checkManifestAgainstRecords(records, fixture)
  const hash = manifestHash(fixture)
  const state = guardMarker(markerIo.read(), { namespace: g.namespace, runId: g.runId, hash })
  const p = plan(fixture)
  const marker = {
    namespace: g.namespace, runId: g.runId, manifestHash: hash, targetFingerprint: g.fingerprint,
    examIds: [p.exam.id], typeIds: p.types.map((t) => t.id), itemIds: p.items.map((i) => i.id),
    states: Object.fromEntries(fixture.items.map((i) => [i.id, i.state])), accounts: 'spec-created(this run only)',
  }
  log(`계획: 회차 ${p.exam.id} · 유형 ${marker.typeIds.join(',')} · 문항 ${fixture.items.map((i) => `${i.id}=${i.state}(v${i.analysis_version})`).join(' · ')} · marker ${state}`)
  if (!commit) return { mode: 'dry-run', marker, counts: null }

  const db = await makeDb(g)
  if (state === 'fresh') {
    // marker 없는데 대상 ID 가 이미 있으면 남의 행 — 소유를 주장하지 않는다
    const pre = [
      ...(await db.existing('csat_exams', marker.examIds)),
      ...(await db.existing('csat_types', marker.typeIds)),
      ...(await db.existing('csat_items', marker.itemIds)),
    ]
    if (pre.length > 0) throw new SeedRefusal(`marker 없이 이미 존재하는 fixture ID: ${pre.join(', ')} — 중단`)
    markerIo.write(marker)
  }
  await db.upsert('csat_exams', [p.exam], 'id')
  await db.upsert('csat_types', p.types, 'id')
  await db.upsert('csat_items', p.items, 'id')
  await db.upsert('csat_item_analyses', p.analyses, 'item_id,version')
  const rows = (await db.analysesOf(marker.itemIds)).filter((r) => p.analyses.some((a) => a.item_id === r.item_id && a.version === r.version))
  if (rows.length !== p.analyses.length) throw new Error(`분석 행 수 불일치: ${rows.length}/${p.analyses.length}`)
  await db.upsert('csat_analysis_reviews', rows.flatMap((r) => PERSONAS.map((persona) => ({ analysis_id: r.id, persona, verdict: 'pass', findings: [], checked: ['csat-v31 isolated fixture'] }))), 'analysis_id,persona')
  await db.setStatus(rows.map((r) => r.id), 'published')

  // 접근 정책 확인 — 정본 Reveal Gate(마이그레이션 20261005170000)의 RPC 셋이 있고, 지금 2026 회차에 활성 보류 · 열린 묘비가 없어야 한다.
  //   (embargoed_exams 는 capture held/collecting 과 열린 묘비를 함께 본다.) 어긋나면 실패 — skip 으로 바꾸지 않는다.
  const gate = await db.gate(marker.itemIds, marker.examIds)
  if (gate.error) {
    throw new SeedRefusal(isMissingRpc(gate.error)
      ? 'Reveal Gate RPC(csat_ec_embargoed_items/exams · csat_ec_reveal_state)가 격리 DB 에 없다 — 마이그레이션 20261005170000 적용 실패'
      : `Reveal Gate 판정 실패: ${gate.error}`)
  }
  if (!Array.isArray(gate.items) || !Array.isArray(gate.exams)) throw new SeedRefusal('Reveal Gate 응답이 배열이 아니다')
  if (gate.items.length > 0 || gate.exams.length > 0) {
    throw new SeedRefusal(`2026 회차에 활성 보류 또는 열린 묘비가 있다(보류 문항 ${gate.items.length} · 회차 ${gate.exams.length}) — fixture 시작 상태가 아니다`)
  }
  return { mode: 'committed', marker, counts: { exams: 1, types: p.types.length, items: p.items.length, analyses: rows.length, reviews: rows.length * 3 } }
}

async function main() {
  const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/inquiry-data.json'), 'utf8')).items
  const r = await runSeed({
    env: process.env,
    commit: process.argv.includes('--commit'),
    records,
    log: (m) => console.log(m),
    makeDb: async (g) => {
      const { createClient } = await import('@supabase/supabase-js')
      return supabaseDb(createClient(g.url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }))
    },
  })
  if (r.mode === 'dry-run') console.log('dry-run — DB 에 쓰지 않았다. 적용은 --commit.')
  else console.log(`적재 완료(격리 · ${r.marker.namespace}): ${JSON.stringify(r.counts)}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`${e.name === 'SeedRefusal' ? '거부' : '실패'}: ${e.message}`)
    process.exit(1)
  })
}
