// scripts/ci/authored-isolated-seed.mjs
//
// **격리 CI 전용 — 창작 공급(authored_item) 화면 검증 fixture.** 개발 DB · 운영 DB 에는 절대 쓰지 않는다.
//
//   node scripts/ci/authored-isolated-seed.mjs            # dry-run — 가드 + 계획 출력만(DB 접속 없음)
//   node scripts/ci/authored-isolated-seed.mjs --commit   # 러너의 로컬 Supabase 에 적재
//
// 가드(항상 먼저 · 클라이언트를 만들기 전): NEXT_PUBLIC_SUPABASE_URL 이 http + loopback(127.0.0.1 · localhost) + 54321,
//   --commit 은 GITHUB_ACTIONS=true · CI=true 일 때만. 환경 변수는 프로세스 환경에서만 읽는다(.env 파일을 읽지 않는다).
// 무엇(승인 패키지 실행을 **흉내** — 실제 승인이 아니다):
//   격리 관리자 계정(iso-authored-admin-<run>) → 보류 창작 SQL 이 러너 DB 에 설치됐는지 확인 → R5 창작 9문항 등록 → FQ1.1 자격 →
//   권리 · Gold 결정 행(evidence_ref = 'isolated-fixture:ci', note = 「CI 격리 fixture — 사람 결정 아님」) → public · assessment 승인.
//   사람 결정 원장의 'human-reviewed' 진술은 **버려지는 러너 DB 의 시험 행**이다 — 개발 DB 의 사람 결정과 혼동하지 않는다(가드가 막는다).
// 재실행 안전: 등록 · 결정은 같은 본문이면 같은 행(멱등). 되돌리기: 러너 폐기.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
// 저장소의 창작 세트 전부(R5 + 확장) — 형식별 브라우저 e2e 가 각 TASK 의 자료를 받는다
const SET_DIR = path.join(ROOT, 'apps/web/src/lib/knowledge/authored')
// 같은 디렉터리에 세트가 아닌 자산(예: schema 'vf.source-central-meaning-lesson/1' 수업 모델)도 산다 — `set` 키가 없으면 세트가 아니다.
// 세트인데 items 가 배열이 아니거나 세트가 0개면 조용히 넘기지 않고 실패한다
// 정본 목록은 제품 레지스트리(authored-items.ts 의 json import)다 — 폴더에는 대체된 옛 판(r5-cycle-supplement.v1)이 남아 있고,
// 그 판이 같은 문항 id 를 다른 본문으로 가져 `authored_item_register` 가 「ref exists with a different body」 로 거부했다(2026-10-24 CI).
export function loadSets(dir = SET_DIR) {
  const registry = fs.readFileSync(path.join(dir, 'authored-items.ts'), 'utf8')
  const names = [...new Set([...registry.matchAll(/from '\.\/([^']+\.json)'/g)].map((m) => m[1]))].sort()
  const sets = []
  for (const name of names) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
    if (typeof doc?.set !== 'string') continue
    if (!Array.isArray(doc.items) || doc.items.length === 0) throw new Error(`창작 세트 ${name} 에 items 배열이 없다`)
    sets.push(doc)
  }
  if (sets.length === 0) throw new Error(`창작 세트가 없다: ${dir}`)
  const owner = new Map()
  for (const s of sets) for (const it of s.items) {
    if (owner.has(it.id)) throw new Error(`문항 id ${it.id} 가 ${owner.get(it.id)} 와 ${s.set} 에 모두 있다 — ref 가 겹친다`)
    owner.set(it.id, s.set)
  }
  return sets
}
const SETS = loadSets()
const ASSESS = new Set(['independent_check', 'transfer', 'delayed_check'])
const AXES = Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((k) => [k, { state: 'pass' }]))
export const FIXTURE_NOTE = 'CI 격리 fixture — 사람 결정 아님'

export function guard(env = process.env, commit = false) {
  let u
  try { u = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '') } catch { throw new Error('격리 URL 이 아니다') }
  if (u.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(u.hostname) || u.port !== '54321') throw new Error('격리 DB(loopback:54321)가 아니면 거부')
  if (commit && !(env.GITHUB_ACTIONS === 'true' && env.CI === 'true')) throw new Error('--commit 은 CI 러너에서만')
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('로컬 데모 키가 없다')
  return u.toString()
}

const versionOf = (set) => set.set.slice(set.set.lastIndexOf('.') + 1)
export const plan = () => SETS.flatMap((set) => set.items.map((it) => ({
  set: set.set, ref: `authored:${it.id}`, role: it.role, group: it.passageGroup, annotationRef: `${set.taskKey}-${it.id}.${versionOf(set)}`,
})))

async function main() {
  const commit = process.argv.includes('--commit')
  const url = guard(process.env, commit)
  console.log(`[authored-isolated-seed] 대상 ${url} · 문항 ${plan().length}개 · ${commit ? 'commit' : 'dry-run'}`)
  if (!commit) { for (const p of plan()) console.log(`  ${p.ref} ${p.role} ${p.group}`); return }
  const { createClient } = await import('@supabase/supabase-js')
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const probe = await service.from('authored_item').select('ref', { head: true, count: 'exact' })
  if (probe.error) throw new Error(`창작 공급 SQL 이 러너 DB 에 없다: ${probe.error.message}`)
  const run = `${process.env.GITHUB_RUN_ID ?? 'local'}-${process.env.GITHUB_RUN_ATTEMPT ?? '0'}`
  const email = `iso-authored-admin-${run}@example.com`
  const password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
  const made = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (made.error) throw made.error
  const up = await service.from('user_profiles').upsert({ user_id: made.data.user.id, role: 'admin' }, { onConflict: 'user_id' })
  if (up.error) throw up.error
  const admin = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const login = await admin.auth.signInWithPassword({ email, password })
  if (login.error) throw login.error
  const call = async (fn, args) => { const r = await admin.rpc(fn, args); if (r.error) throw new Error(`${fn}: ${r.error.message}`); return r.data }
  for (const SET of SETS) for (const it of SET.items) {
    const ref = `authored:${it.id}`
    const annotationRef = `${SET.taskKey}-${it.id}.${versionOf(SET)}`
    await call('authored_item_register', {
      p_ref: ref, p_task: SET.taskId, p_task_key: SET.taskKey, p_role_class: ASSESS.has(it.role) ? 'assessment' : 'instruction',
      p_intended_role: it.role, p_group: it.passageGroup, p_body: it.body, p_gold: it.gold, p_annotation_ref: annotationRef,
      p_provenance: { ...SET.provenance, set: SET.set, item: it.id },
    })
    const rev = (await service.rpc('authored_item_revision', { p_ref: ref })).data
    const gh = (await service.rpc('authored_item_gold_hash', { p_ref: ref })).data
    if (typeof rev !== 'string' || typeof gh !== 'string') throw new Error(`hash 조회 실패 ${ref}`)
    const q = await call('content_qualification_record', {
      p_rules_version: 'FQ1.1', p_kind: 'authored_item', p_ref: ref, p_revision: rev, p_task: SET.taskId, p_role: it.role, p_axes: AXES,
      p_source_revision: 'self', p_source_hash: rev, p_analysis_revision: null, p_gold_revision: 'gold', p_gold_hash: gh,
      p_annotation_ref: annotationRef, p_annotation_hash: gh, p_defects: [], p_evidence_ids: ['isolated-fixture:ci'], p_method: FIXTURE_NOTE, p_supersedes: null,
    })
    await call('content_human_decision_record', { p_kind: 'rights', p_artifact_kind: 'authored_item', p_ref: ref, p_revision: rev, p_subject_hash: rev,
      p_basis: 'self_authored_original', p_scope: ASSESS.has(it.role) ? ['store', 'display', 'transmit', 'assess'] : ['store', 'display', 'transmit'], p_evidence_ref: 'isolated-fixture:ci', p_attest: 'human-reviewed', p_note: FIXTURE_NOTE })
    if (ASSESS.has(it.role)) {
      await call('content_human_decision_record', { p_kind: 'gold', p_artifact_kind: 'authored_item', p_ref: ref, p_revision: rev, p_subject_hash: gh,
        p_basis: 'human_gold_review', p_scope: ['assess'], p_evidence_ref: 'isolated-fixture:ci', p_attest: 'human-reviewed', p_note: FIXTURE_NOTE })
    }
    await call('content_release_approve', { p_qualification: q, p_scope: 'public', p_note: FIXTURE_NOTE })
    if (ASSESS.has(it.role)) await call('content_release_approve', { p_qualification: q, p_scope: 'assessment', p_note: FIXTURE_NOTE })
    console.log(`  ✓ ${ref}`)
  }
  fs.mkdirSync(path.join(ROOT, '.agent-logs'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, '.agent-logs', 'authored-isolated-admin.json'), JSON.stringify({ run, email, password, note: FIXTURE_NOTE }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(`[authored-isolated-seed] ${e.message}`); process.exit(1) })
}
