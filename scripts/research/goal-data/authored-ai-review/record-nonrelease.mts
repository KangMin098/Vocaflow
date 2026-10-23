// scripts/research/goal-data/authored-ai-review/record-nonrelease.mts
// T-0098 · T-0102 합의 — 영수증 범위 문항을 **출시 승인 없이** 등록 → AI 결정 → 자격까지만 기록한다(content_release_approve 호출 없음).
//   · 실행 주체: 관리자 로그인 세션만(signInWithPassword · anon 키). service_role · 직접 SQL · 계정 가장 금지.
//   · H 축: Gold 에서 형식별 전체 응답을 만들어 실제 gradeAuthored 로 채점 — 정답이면 pass, 아니면 unknown(상수 pass 금지).
//   · 재사용 자격은 반환 ID 의 axes · revision · annotation 을 SELECT 로 대조해 어긋나면 중단(조용히 통과시키지 않는다).
// 건식(기본): 영수증 검증 + H 프로브 + 호출 계획만 출력, DB 접속 없음.
//   TSX_TSCONFIG_PATH=tsconfig.json <tsx> ../../scripts/research/goal-data/authored-ai-review/record-nonrelease.mts
// 실행: --execute --confirm <sql_sha256 — 사용자 승인값> · 환경변수 VF_ADMIN_EMAIL · VF_ADMIN_PASSWORD · NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY
//       · VF_SUPABASE_JS(@supabase/supabase-js 패키지 경로 — 이 worktree 에 node_modules 가 없을 때)
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { aiQualificationAxes, jsCanonicalSha, verifyAiReviewReceipt, type AiReviewReceipt } from '@/lib/csat/authored/ai-review'
import { gradeAuthored, registrationArgs, setFormat, type AuthoredItem, type AuthoredSet } from '@/lib/knowledge/authored/authored-items'

const ROOT = path.resolve(process.cwd(), '..', '..')
const OUT = path.join(ROOT, 'docs/research/goal-data-batches/authored-ai-review')
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/final/review/FINAL_CONTENT_DECISION_MANIFEST_20261022.json'), 'utf8'))
const sha = (x: string | Buffer) => createHash('sha256').update(x).digest('hex')
const argv = process.argv.slice(2)
const execute = argv.includes('--execute')
const confirm = argv[argv.indexOf('--confirm') + 1]

/** Gold → 형식별 학습자 응답(정답을 고른 응답). 채점기가 이 응답을 정답으로 보는지가 H 축 근거다 */
function goldResponse(set: AuthoredSet, it: AuthoredItem): unknown {
  const g = it.gold as Record<string, any>
  switch (setFormat(set)) {
    case 'central_meaning': return { choice: g.answer, claim: g.claim, support: g.support, relation: g.relationProbe?.relation }
    case 'choice_evidence': return { choice: g.answer, evidence: g.evidence }
    case 'option_correspondence': return { choice: g.answer, options: (g.options ?? []).map((o: any) => ({ verdict: o.verdict, sentence: o.sentence ?? null })) }
    case 'contextual_sense': return { choice: g.answer, cue: g.cue }
    case 'sentence_relation': return { pairs: (g.pairs ?? []).map((p: any) => p.relation) }
    case 'form_scope': return { choice: g.answer, reason: g.reason }
    case 'discourse_roles': return { roles: g.roles, pattern: g.pattern }
    case 'demand_choice': return { choice: g.answer }
    case 'segment_choice': return { choice: g.answer, reason: g.reason }
    case 'equivalence': return { same: g.same, relation: g.relation }
  }
}

const plan: { set: string; id: string; role: string; ref: string; runnable: boolean; axes: unknown; annotation: string }[] = []
const sets: { set: AuthoredSet; bytes: Buffer; receipt: AiReviewReceipt }[] = []
for (const s of man.sets) {
  const rp = path.join(OUT, s.set_revision, 'receipt.json')
  if (!fs.existsSync(rp)) continue
  const bytes = fs.readFileSync(path.join(ROOT, s.file))
  const set = JSON.parse(bytes.toString('utf8')) as AuthoredSet
  const receipt = JSON.parse(fs.readFileSync(rp, 'utf8')) as AiReviewReceipt
  const raw = Object.fromEntries((['claude', 'codex'] as const).map((a) => [a, {
    result: fs.readFileSync(path.join(OUT, s.set_revision, 'round2', a, 'result.txt'), 'utf8'),
    session: JSON.parse(fs.readFileSync(path.join(OUT, s.set_revision, 'round2', a, 'session.json'), 'utf8')),
  }]))
  const check = verifyAiReviewReceipt(receipt, set, bytes, raw as never)
  if (!check.ok) { console.error(`중단 — ${s.set_revision} 영수증 검증 실패: ${check.errors.join(',')}`); process.exit(2) }
  sets.push({ set, bytes, receipt })
  for (const id of receipt.scope) {
    const it = set.items.find((x) => x.id === id)!
    const runnable = gradeAuthored(set, it, goldResponse(set, it))?.grade.isCorrect === true
    const args = registrationArgs(set, it)
    plan.push({ set: set.set, id, role: it.role, ref: args.p_ref as string, runnable, axes: aiQualificationAxes(it, runnable), annotation: args.p_annotation_ref as string })
  }
}
const planSha = sha(JSON.stringify(plan))
const h = { pass: plan.filter((p) => p.runnable).length, unknown: plan.filter((p) => !p.runnable).length }

// 승인 대상 SQL — 실행기가 부를 RPC 를 같은 인자로 적은 문서(사용자가 보고 sha256 으로 승인). 관리자 로그인 세션에서만 성공한다(auth.uid 필수)
const lit = (v: unknown) => { const s = typeof v === 'string' ? v : JSON.stringify(v); if (s.includes('$vf$')) throw new Error('literal 충돌'); return `$vf$${s}$vf$` }
const sqlParts: string[] = [
  '-- T-0098 비출시 기록 — 등록 → AI 결정 → 자격(출시 승인 · 사람 결정 없음)',
  `-- plan_sha256 ${planSha} · ${sets.length}세트 · ${plan.length}문항 · H pass ${h.pass} / unknown ${h.unknown}`,
  '-- 실행: scripts/research/goal-data/authored-ai-review/record-nonrelease.mts --execute (관리자 로그인 세션 RPC, 이 파일과 같은 인자)',
  '-- 호출하지 않는 것: content_release_approve · content_human_decision_record · 기존 행 UPDATE/DELETE',
]
for (const { set, receipt } of sets) {
  sqlParts.push('', `-- 세트 ${set.set} · 영수증 source ${receipt.source_file_sha256}`, 'do $do$', `declare v_receipt jsonb := ${lit(receipt)}::jsonb; v_ref text; v_decision uuid;`, 'begin')
  for (const id of receipt.scope) {
    const it = set.items.find((x) => x.id === id)!
    const p = plan.find((x) => x.id === id && x.set === set.set)!
    const a = registrationArgs(set, it) as Record<string, unknown>
    const named = Object.entries(a).map(([k, v]) => `${k} => ${lit(v)}${typeof v === 'object' && v !== null ? '::jsonb' : ''}`).join(', ')
    sqlParts.push(
      `  v_ref := public.authored_item_register(${named});`,
      '  v_decision := public.content_ai_decision_record(p_ref => v_ref, p_receipt => v_receipt);',
      `  perform public.authored_ai_qualify(p_ref => v_ref, p_role => ${lit(it.role)}, p_axes => ${lit(p.axes)}::jsonb, p_annotation_ref => ${lit(a.p_annotation_ref)}, p_evidence_ids => array['ai_decision:' || v_decision, ${lit('ai_receipt:' + receipt.source_file_sha256)}, ${lit('js_gold:' + jsCanonicalSha(it.gold))}, 'rights:first_party_original_declaration', ${lit(`h_probe:${p.runnable ? 'gold_response_graded_correct' : 'not_runnable'}`)}]);`,
    )
  }
  sqlParts.push('end $do$;')
}
const sqlText = sqlParts.join('\n') + '\n'
const sqlSha = sha(sqlText)
fs.writeFileSync(path.join(OUT, 'nonrelease-calls.sql'), sqlText)
fs.writeFileSync(path.join(OUT, 'nonrelease-plan.json'), JSON.stringify({ plan_sha256: planSha, items: plan.length, H: h, calls: ['authored_item_register', 'content_ai_decision_record', 'authored_ai_qualify'], not_called: ['content_release_approve', 'content_human_decision_record'], plan }, null, 2) + '\n')
console.log(JSON.stringify({ plan_sha256: planSha, sql_sha256: sqlSha, sets: sets.length, items: plan.length, H: h }))
if (!execute) process.exit(0)

// ── 실행(관리자 로그인 세션) ─────────────────────────────────────────
// --confirm 은 사용자가 승인한 SQL sha256 — 이 파일과 AI-Control T-0098 승인값 둘 다와 같아야 한다
if (confirm !== sqlSha) { console.error('중단 — --confirm 이 현재 nonrelease-calls.sql sha 와 다르다'); process.exit(2) }
const q0 = JSON.parse(fs.readFileSync(path.join(process.env.VF_CONTROL_ROOT ?? 'D:/workspace/Vocaflow-AI-Control', 'state/TASK_QUEUE.json'), 'utf8'))
const t0098 = (q0.tasks ?? q0).find((t: { task_id: string }) => t.task_id === 'T-0098')
if (t0098?.approval?.by !== 'user' || t0098.approval.sql_sha256 !== sqlSha) { console.error('중단 — T-0098 사용자 승인(sql_sha256)이 이 SQL 과 다르다'); process.exit(2) }
const env = (k: string) => { const v = process.env[k]; if (!v) { console.error(`중단 — ${k} 없음`); process.exit(2) } return v }
const req = createRequire(process.env.VF_SUPABASE_JS ? path.join(process.env.VF_SUPABASE_JS, 'package.json') : import.meta.url)
const { createClient } = req(process.env.VF_SUPABASE_JS ?? '@supabase/supabase-js') as typeof import('@supabase/supabase-js')
const db = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
const login = await db.auth.signInWithPassword({ email: env('VF_ADMIN_EMAIL'), password: env('VF_ADMIN_PASSWORD') })
if (login.error || !login.data.user) { console.error(`중단 — 로그인 실패: ${login.error?.message}`); process.exit(2) }
const uid = login.data.user.id
const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const r = await db.rpc(fn, args)
  if (r.error) throw new Error(`${fn}: ${r.error.message ?? r.error.code}`)
  return r.data as T
}
const results: unknown[] = []
for (const { set, receipt } of sets) {
  for (const id of receipt.scope) {
    const it = set.items.find((x) => x.id === id)!
    const p = plan.find((x) => x.id === id && x.set === set.set)!
    const args = registrationArgs(set, it)
    const ref = await call<string>('authored_item_register', args)
    const decisionId = await call<string>('content_ai_decision_record', { p_ref: ref, p_receipt: receipt })
    const goldHash = jsCanonicalSha(it.gold)
    const qualificationId = await call<string>('authored_ai_qualify', {
      p_ref: ref, p_role: it.role, p_axes: p.axes, p_annotation_ref: args.p_annotation_ref,
      p_evidence_ids: [`ai_decision:${decisionId}`, `ai_receipt:${receipt.source_file_sha256}`, `js_gold:${goldHash}`, 'rights:first_party_original_declaration', `h_probe:${p.runnable ? 'gold_response_graded_correct' : 'not_runnable'}`],
    })
    // 재사용 자격 대조 — 반환 행의 axes · annotation 이 이번 계획과 같아야 한다
    const q = await db.from('content_qualification').select('id, axes, annotation_ref').eq('id', qualificationId).single()
    if (q.error) throw new Error(`content_qualification 조회: ${q.error.message}`)
    const d = await db.from('content_ai_decision').select('id, decided_by').eq('id', decisionId).single()
    const sameAxes = JSON.stringify(jsCanonicalSha(q.data.axes)) === JSON.stringify(jsCanonicalSha(p.axes))
    if (!sameAxes || q.data.annotation_ref !== args.p_annotation_ref) throw new Error(`기존 자격 불일치: ${ref} (${qualificationId})`)
    results.push({ ref, decisionId, qualificationId, decided_by: d.data?.decided_by ?? null, executed_by: uid, reused_decision: d.data?.decided_by !== uid })
  }
}
fs.writeFileSync(path.join(OUT, 'nonrelease-result.json'), JSON.stringify({ plan_sha256: planSha, executed_by: uid, at: new Date().toISOString(), results }, null, 2) + '\n')
console.log(`기록 ${results.length}건 — 출시 승인 0 · 사람 결정 0`)
