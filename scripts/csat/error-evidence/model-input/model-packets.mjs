// scripts/csat/error-evidence/model-input/model-packets.mjs
//
// 모델(Claude · Codex) 판정 입력의 **유일한 운영 경로** — PILOT_PROTOCOL §9. `csat_ec_ai_export` 를 부르고 deidentify.mjs 를 반드시 거친다.
// 원문 · 별칭 · 매핑 · 감사 로그는 저장소 밖(또는 gitignore 된 `.pilot-private/`)에만 쓴다 — 추적 경로면 시작하지 않는다.
// DB 는 읽기만 한다(service role 로 회차 대상 · 세션 소유자 · ai_export). 적재(csat_ec_ai_import)는 rehydrate 결과로 따로 한다.
//
//   자가검사(G6 체크리스트 — run 메타 verification.piiGuard 의 원천 기록):
//     node scripts/csat/error-evidence/model-input/model-packets.mjs selftest --run <run id>
//       → docs/csat-learner/pilot-runs/<run id>.pii-guard.json (원문 없음 · 커밋 · 규칙 해시 · 통과 수)
//   내보내기:
//     node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/csat/error-evidence/model-input/model-packets.mjs export \
//       --run <run id> --round <회차 id> --mapping <저장소 밖 매핑.json> --out <저장소 밖 디렉터리> --audit <저장소 밖 audit.jsonl> [--redactions <저장소 밖 redactions.json>]
//     매핑 형식: { "runId": "<run id>", "participants": { "P001": "<계정 uuid>", … } }
//     redactions 형식: { "<attempt key>": [{ "find": "<가릴 원문>", "replace": "[이름]" }] }
//     식별정보 꼴이 걸린 attempt 는 packet 을 쓰지 않고 규칙 이름만 출력한 뒤 exit 1 — redaction 을 더해 다시 실행한다.
//   되돌리기(적재 직전):
//     node scripts/csat/error-evidence/model-input/model-packets.mjs rehydrate --aliases <out>/aliases/<attempt>.json --in <모델 출력.json> --out <저장소 밖 파일>

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { DEID_VERSION, assertPrivatePath, attemptKey, auditLine, deidentifyPacket, detectPii, hashOf, rehydrate, residualIdentifiers, rulesHash, sha256 } from './deidentify.mjs'
import { NEGATIVE, POSITIVE } from './pii-fixtures.mjs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(DIR, '../../../..')
const RUNS = path.join(ROOT, 'docs/csat-learner/pilot-runs')
const RUN_ID = /^ec-pilot-run-[0-9]{8}-[0-9]+$/

function args(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { out[argv[i].slice(2)] = argv[i + 1]; i++ } else out._.push(argv[i])
  }
  return out
}
const die = (msg, code = 2) => { console.error(msg); process.exit(code) }
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

/** 합성 packet — 실제 학생 데이터 없이 치환 · 잔여 검사 · 해시 결정성을 확인한다 */
export function syntheticPacket(text = '두 번째 문장에서 흐름을 놓쳤어요') {
  return {
    round_id: 1, taxonomy_version: 'v0.1', choice_trap_map: 'v0.1:' + '0'.repeat(64), quality_rule_version: 'rq-1', evidence_profile: 'all',
    input_hash: 'f'.repeat(64),
    canonical_input: {
      format: 'ci-1', quality_rule: 'rq-1', item_id: '11111111-2222-4333-8444-555555555555', stem: '다음 글의 요지로 가장 적절한 것은?', passage: 'One. Two.',
      choices: ['a', 'b', 'c', 'd', 'e'], answer: 2, chosen_option: 3, option_traps: [],
      process_evidence: [
        ['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'reason', { text, session: '99999999-8888-4777-8666-555555555555' }],
        ['bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', 'interpretation', { state: 'answered', text: '「유의미한」으로 읽었어요' }],
      ],
    },
  }
}
const SYN_CTX = { sessionId: '99999999-8888-4777-8666-555555555555', itemNo: 21, participantKey: 'P001', examOrdinal: 1 }

/** 규칙 픽스처 + 합성 packet 검사. 실패 목록(규칙 이름 · 픽스처 번호만) */
export function selftest() {
  const fails = []
  let passed = 0
  POSITIVE.forEach(([rule, text], i) => { if (detectPii(text).includes(rule)) passed++; else fails.push(`positive[${i}]:${rule}`) })
  NEGATIVE.forEach((text, i) => { if (detectPii(text).length === 0) passed++; else fails.push(`negative[${i}]`) })
  const ok = deidentifyPacket(syntheticPacket(), SYN_CTX)
  if (ok.status === 'ok' && residualIdentifiers(ok.packet).length === 0) passed++; else fails.push('synthetic:clean')
  if (deidentifyPacket(syntheticPacket(), SYN_CTX).sha256After === ok.sha256After) passed++; else fails.push('synthetic:deterministic')
  const bad = deidentifyPacket(syntheticPacket('제 번호 010-1234-5678'), SYN_CTX)
  if (bad.status === 'blocked' && bad.packet === null) passed++; else fails.push('synthetic:block')
  const red = deidentifyPacket(syntheticPacket('제 번호 010-1234-5678'), { ...SYN_CTX, redactions: [{ find: '010-1234-5678', replace: '[연락처]' }] })
  if (red.status === 'ok') passed++; else fails.push('synthetic:redaction')
  return { passed, failed: fails.length, fails }
}

async function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) die('환경 변수 없음 — --env-file 로 실행')
  let mod
  try { mod = await import('@supabase/supabase-js') } catch {
    const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
    mod = await import(pathToFileURL(req.resolve('@supabase/supabase-js')).href)
  }
  return mod.createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function cmdExport(a) {
  if (!RUN_ID.test(a.run ?? '')) die('--run <ec-pilot-run-YYYYMMDD-n> 필요')
  if (!/^[0-9]+$/.test(a.round ?? '')) die('--round <회차 id> 필요')
  const mappingPath = assertPrivatePath(a.mapping)
  const outDir = assertPrivatePath(a.out)
  const auditPath = assertPrivatePath(a.audit)
  const redPath = a.redactions ? assertPrivatePath(a.redactions) : null
  const meta = readJson(path.join(RUNS, `${a.run}.json`))
  const mapping = readJson(mappingPath)
  if (mapping.runId !== a.run) die('매핑 파일의 runId 가 --run 과 다르다')
  const metaKeys = (meta.participants ?? []).map((p) => p.key).sort()
  const mapKeys = Object.keys(mapping.participants ?? {}).sort()
  if (JSON.stringify(metaKeys) !== JSON.stringify(mapKeys)) die('매핑의 익명 key 목록이 run 메타와 다르다')
  const byUser = new Map(Object.entries(mapping.participants).map(([k, uid]) => [String(uid).toLowerCase(), k]))
  const assign = new Map((meta.participants ?? []).map((p) => [p.key, p.exams]))
  const redactions = redPath ? readJson(redPath) : {}
  const db = await supabase()
  const { data: round, error: re } = await db.from('csat_ec_review_round').select('id, targets').eq('id', Number(a.round)).maybeSingle()
  if (re || !round) die(`회차 조회 실패: ${re?.message ?? '없음'}`)
  const targets = Array.isArray(round.targets) ? round.targets : []
  const sids = [...new Set(targets.map((t) => t.session_id))]
  const { data: sessions, error: se } = await db.from('csat_dx_session').select('id, user_id, exam_id').in('id', sids.length ? sids : ['00000000-0000-0000-0000-000000000000'])
  if (se) die(`세션 조회 실패: ${se.message}`)
  const sess = new Map((sessions ?? []).map((s) => [s.id, s]))
  fs.mkdirSync(path.join(outDir, 'aliases'), { recursive: true })
  const now = new Date().toISOString()
  const blocked = []
  let sent = 0
  for (const t of targets) {
    const s = sess.get(t.session_id)
    const pkey = s ? byUser.get(String(s.user_id).toLowerCase()) : undefined
    if (!s || !pkey) die(`회차 대상 세션이 run 참가자 매핑에 없다(대상 ${targets.indexOf(t) + 1}번째) — run 밖 데이터를 보내지 않는다`)
    const ord = (assign.get(pkey) ?? []).indexOf(s.exam_id) + 1
    if (ord < 1) die(`${pkey} 의 assignment 에 없는 시험이다 — run 밖 데이터를 보내지 않는다`)
    const key = attemptKey(pkey, ord, Number(t.item_no))
    const { data: packet, error: xe } = await db.rpc('csat_ec_ai_export', { p_round: Number(a.round), p_session: t.session_id, p_item_no: t.item_no })
    if (xe) die(`ai_export 실패(${key}): ${xe.message}`)
    const r = deidentifyPacket(packet, { sessionId: t.session_id, itemNo: Number(t.item_no), participantKey: pkey, examOrdinal: ord, redactions: redactions[key] ?? [] })
    fs.appendFileSync(auditPath, auditLine(a.run, r, now) + '\n')
    if (r.status !== 'ok') { blocked.push(`${r.attempt}: ${r.rules.join(',')}`); continue }
    fs.writeFileSync(path.join(outDir, `${r.attempt.replace(/[^A-Za-z0-9-]/g, '_')}.json`), JSON.stringify(r.packet, null, 2))
    fs.writeFileSync(path.join(outDir, 'aliases', `${r.attempt.replace(/[^A-Za-z0-9-]/g, '_')}.json`), JSON.stringify(r.aliases, null, 2))
    sent++
  }
  console.log(`비식별 packet ${sent} · 차단 ${blocked.length} (${DEID_VERSION} · 규칙 ${rulesHash().slice(0, 12)})`)
  if (blocked.length) { console.log('차단 — redaction 으로 가린 뒤 다시 실행:'); for (const b of blocked) console.log(`  ${b}`); process.exit(1) }
}

function cmdRehydrate(a) {
  const aliases = readJson(assertPrivatePath(a.aliases))
  const output = readJson(assertPrivatePath(a.in))
  const out = assertPrivatePath(a.out)
  fs.writeFileSync(out, JSON.stringify({ session_id: aliases.session_id, item_no: aliases.item_no, input_hash: aliases.input_hash, round_id: aliases.round_id, output: rehydrate(output, aliases) }, null, 2))
  console.log(`되돌림 완료(${aliases.attempt})`)
}

function cmdSelftest(a) {
  if (!RUN_ID.test(a.run ?? '')) die('--run <ec-pilot-run-YYYYMMDD-n> 필요')
  const r = selftest()
  const commit = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const record = { format: 'ec-pilot-pii-guard-1', runId: a.run, commit, deid: DEID_VERSION, rulesHash: rulesHash(), passed: r.passed, failed: r.failed, fails: r.fails, at: new Date().toISOString().replace(/\.[0-9]+Z$/, 'Z') }
  const file = path.join(RUNS, `${a.run}.pii-guard.json`)
  fs.mkdirSync(RUNS, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n')
  console.log(`PII 가드 자가검사 ${r.passed} 통과 · ${r.failed} 실패 → ${path.relative(ROOT, file)} (sha256 ${sha256(fs.readFileSync(file, 'utf8')).slice(0, 12)})`)
  if (r.failed) { for (const f of r.fails) console.log(`  FAIL ${f}`); process.exit(1) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = args(process.argv.slice(2))
  const cmd = a._[0]
  if (cmd === 'export') await cmdExport(a)
  else if (cmd === 'rehydrate') cmdRehydrate(a)
  else if (cmd === 'selftest') cmdSelftest(a)
  else die('사용: model-packets.mjs selftest|export|rehydrate …(파일 머리 참조)')
}

export { hashOf }
