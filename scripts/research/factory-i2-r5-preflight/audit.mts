// scripts/research/factory-i2-r5-preflight/audit.mts
//
// Factory I2 — R5(r.central_meaning) 실제 공급 사전 감사(읽기 전용 · DB 쓰기 0 · 납품 0).
// 입력: DB 스냅샷(snapshot.sql · revisions.sql 결과 JSON) + 저장소 주석 · 골격 · v3 공개 해설 + PR #277 I0 해결기 원본(git show 로 임시 추출).
// 출력: docs/research/factory-i2-r5-preflight-20261017/AUDIT.json — 시계를 읽지 않는다(측정 시각은 스냅샷 값).
// 기대값과 다르면 exit 1(반례 판정이 바뀌면 조용히 지나가지 않는다).
//
//   cd apps/web && pnpm exec tsx ../../scripts/research/factory-i2-r5-preflight/audit.mts [--i0-ref pr277]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const EVID = path.join(ROOT, 'docs/research/factory-i2-r5-preflight-20261017')
const V62 = path.join(ROOT, 'apps/web/src/lib/csat/map/v62')
const I0_TMP = path.join(V62, '.i2-audit-i0')
const I0_FILES = ['stock-resolver.ts', 'material-unit.ts']
const i0Ref = process.argv.includes('--i0-ref') ? process.argv[process.argv.indexOf('--i0-ref') + 1] : 'pr277'

const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'))
const sha = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex')
const snap = read(path.join(EVID, 'db-snapshot.json'))
const revs: Record<string, string> = Object.fromEntries(read(path.join(EVID, 'db-revisions.json')).rows.map((r: { id: string; b_revision: string }) => [r.id, r.b_revision]))
const inquiry = read(path.join(ROOT, 'apps/web/src/lib/csat/inquiry-data.json')).items as Record<string, unknown>
const ANN_DIR = path.join(ROOT, 'apps/web/src/lib/knowledge/annotations')

const i0Blobs: Record<string, string> = {}

type Role = 'source_analysis' | 'model_explanation' | 'guided_practice' | 'independent_check' | 'transfer' | 'delayed_check'
const ROLES: Role[] = ['source_analysis', 'model_explanation', 'guided_practice', 'independent_check', 'transfer', 'delayed_check']
const TASK = 'r.central_meaning'

async function run(resolveStock: Function, demandSignature: Function, i0Head: string) {
  const failures: string[] = []
  const expect = (label: string, got: unknown, want: unknown) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
  }

  // 1) 출시 원장 — R5 TASK 자산은 claim-support 만(정의 v4 r.central_meaning assets). option-restate 는 R5 유형 문항이지만 다른 TASK
  const apps = snap.applications as { item: string; role: string; task_key: string; status: string; release_approved: boolean; surface_ref: string; type_id: string }[]
  const r5Apps = apps.filter((a) => a.task_key === 'claim-support')
  const otherTaskApps = apps.filter((a) => a.task_key !== 'claim-support')

  // 2) 문항별 감사
  const items = (snap.items as any[]).map((it) => {
    const app = r5Apps.find((a) => a.item === it.id)!
    const [exam, no] = it.id.split('#')
    const annFile = fs.readdirSync(ANN_DIR).filter((f) => f.toLowerCase().startsWith(`claim-support-${exam.toLowerCase()}-${no}.`)).sort().pop() ?? null
    const ann = annFile ? read(path.join(ANN_DIR, annFile)) : null
    const sk = read(path.join(ROOT, `apps/web/src/lib/csat/skeleton-data/${exam}.json`)).items.find((i: { id: string }) => i.id === it.id)
    const sig = sk ? sha(JSON.stringify(sk.sentences.map((s: { chars: number }) => s.chars))) : null
    const role: Role = app.role === 'transfer' ? 'transfer' : 'independent_check'
    const sameItemOtherTask = otherTaskApps.filter((a) => a.item === it.id && a.status === 'active').map((a) => a.surface_ref)
    const ex = it.exposure
    return {
      item: it.id, type: it.type, organizer: it.organizer, role, surfaceRef: app.surface_ref,
      release: { status: app.status, approvedB7: app.release_approved, scope: 'knowledge_applications(B7) — content_release_approval(public/assessment) 아님' },
      revision: { bRevision: revs[it.id] ?? null, passageSha256: it.passageSha256, analysisVersion: it.analysis?.published_version ?? null, unitsHash: it.analysis?.units_hash ?? null,
        annotation: ann ? { file: annFile, version: ann.version, skeletonSigMatch: ann.skeletonSig === sig, hash: sha(JSON.stringify(ann)) } : null },
      rights: { organizer: it.organizer, inPublicView: it.inPublicView, perItemRightsRecord: false, F: 'unknown' },
      task: { fit: 'claim-support 주석(주장·뒷받침·관계) — r.central_meaning 자산', limits: '자유 요약 · 조건/범위 전체 이해는 관찰하지 않음(R5_VERTICAL_ACCEPTANCE §55)' },
      teaching: { D: 'unknown', note: 'FQ 결과 없음 — fq1/fq11 연구 스냅샷에 R5 0건' },
      gold: { annotationBlindTwo: !!ann?.provenance?.reviewerBlind, supportDisputed: ann?.supportDisputed?.length ?? null, answerKey: it.hasAnswer, E: 'unknown' },
      runner: { existing: role === 'transfer' ? 'api/csat/item/[slug]/task (phase=transfer)' : 'api/csat/item/[slug]/task (phase=practice ← 확인 · 연습 구별 불가)', guidedPracticeAlsoServes: true },
      sharedPassage: { samePassageItems: it.samePassageItems, sameItemOtherTask },
      exposure: ex, v3Explanation: it.id in inquiry,
    }
  })

  // 3) 역할별 후보 · 기존 경로 이용 가능 · I2 신규 납품 자격
  const roleCount = (r: Role) => items.filter((i) => i.role === r).length
  // v3 공개 해설 — 평가원 골격(skeleton-data)의 R5 4유형 중 inquiry-data(공개 정본)에 있는 문항
  const R5_TYPES = new Set(['R-TOPIC', 'R-TITLE', 'R-GIST', 'R-CLAIM'])
  const SK = path.join(ROOT, 'apps/web/src/lib/csat/skeleton-data')
  const skel = fs.readdirSync(SK).flatMap((f) => (read(path.join(SK, f)).items ?? []) as { id: string; type_id: string }[]).filter((i) => R5_TYPES.has(i.type_id))
  const v3Public = skel.filter((i) => i.id in inquiry)
  const v3Held = skel.filter((i) => !(i.id in inquiry)).map((i) => i.id).sort()
  const byRole: Record<Role, { candidates: number | null; candidateBasis: string; existingPathAvailable: number | null; existingPathBasis: string; i2Eligible: number; i2Blocker: string }> = {
    source_analysis: { candidates: v3Public.length, candidateBasis: `평가원 R5 4유형 골격 ${skel.length}문항 중 공개 v3 해설(보류 ${v3Held.join(' · ')} · 학평 공개 보류)`, existingPathAvailable: null, existingPathBasis: 'v3 해설 공개분 — 학습자별 노출 규칙(study-items: 확인 문항을 먼저 풀어야 열림)으로 개인마다 다름', i2Eligible: 0, i2Blocker: 'C 미설치 · D(교수 적합성) unknown — supplyFor 의 available 은 teaching null' },
    model_explanation: { candidates: v3Public.length, candidateBasis: '같은 v3 해설(역할만 다름 — 별도 자료 아님)', existingPathAvailable: null, existingPathBasis: 'source_analysis 와 같음', i2Eligible: 0, i2Blocker: '같음' },
    guided_practice: { candidates: items.length, candidateBasis: 'claim-support 연습 풀 = 출시된 13 주석 문항(practice-server serverPool)', existingPathAvailable: items.length, existingPathBasis: '/csat/practice/claim-support — 평가 자료와 같은 문항', i2Eligible: 0, i2Blocker: 'C 미설치 · D unknown · 같은 문항을 평가에 쓰면 노출 충돌' },
    independent_check: { candidates: roleCount('independent_check'), candidateBasis: 'claim-support 확인(active · B7)', existingPathAvailable: roleCount('independent_check'), existingPathBasis: '신규 학습자 기준(노출 0) — 개인별로 시도 · 해설 · 연습 노출 제외', i2Eligible: 0, i2Blocker: 'C/B 미설치 · F/E unknown · assessment 승인 원장 없음' },
    transfer: { candidates: roleCount('transfer'), candidateBasis: 'claim-support 전이(active · B7)', existingPathAvailable: roleCount('transfer'), existingPathBasis: '신규 학습자 기준 — 2026#23 은 option-restate 확인으로도 출시(같은 문항 두 역할)', i2Eligible: 0, i2Blocker: '같음' },
    delayed_check: { candidates: 0, candidateBasis: '전용 자료 없음 — supply.ts 가 안 본 확인 문항을 재사용', existingPathAvailable: 0, existingPathBasis: '최소 지연 미구현(R5_VERTICAL_ACCEPTANCE R15) — 실행기 없음', i2Eligible: 0, i2Blocker: '실행기 · 지연 규칙 없음' },
  }
  expect('independent_check candidates', byRole.independent_check.candidates, 9)
  expect('transfer candidates', byRole.transfer.candidates, 4)
  expect('all sig match', items.every((i) => i.revision.annotation?.skeletonSigMatch), true)
  expect('ledgers installed', Object.values(snap.ledgers).some(Boolean), false)

  // 4) I0 해결기 실행 — (a) 현재 실제: 원장 미설치 (b) 설치 후 FQ 없음 (c) 반례 fixture
  const cand = (i: (typeof items)[number], over: Record<string, unknown> = {}) => ({
    artifact: { kind: 'csat_item', ref: i.item, contentType: i.role === 'transfer' ? 'transfer_task' : 'check_task' },
    currentRevision: i.revision.bRevision, passage: i.revision.passageSha256, fq: null, qualificationId: null, approvals: [], exposure: null, ...over,
  })
  const checks = items.filter((i) => i.role === 'independent_check')
  const transfers = items.filter((i) => i.role === 'transfer')
  const actual = {
    independent_check: resolveStock({ task: TASK, role: 'independent_check', requested: 2 }, 'not_installed', []),
    transfer: resolveStock({ task: TASK, role: 'transfer', requested: 1 }, 'not_installed', []),
  }
  const afterI1NoFq = {
    independent_check: resolveStock({ task: TASK, role: 'independent_check', requested: 2 }, 'ok', checks.map((i) => cand(i))),
    transfer: resolveStock({ task: TASK, role: 'transfer', requested: 1 }, 'ok', transfers.map((i) => cand(i))),
  }
  expect('actual line', actual.transfer.line, 'not_installed')
  expect('actual need null', actual.transfer.newProductionNeeded, null)
  expect('afterI1NoFq unreviewed', afterI1NoFq.independent_check.counts.candidate_unreviewed, 9)
  expect('afterI1NoFq transfer unreviewed', afterI1NoFq.transfer.counts.candidate_unreviewed, 4)

  // 반례 fixture — 축 전부 pass + 승인 2종을 **가정**한 기준 후보(실제 승인 아님)에서 하나씩만 바꾼다
  const base = transfers.find((i) => i.item === '2020#24')!
  const PASS = { state: 'pass' }
  const fq = (o: Record<string, unknown> = {}) => ({ content: { id: base.item, revision: base.revision.bRevision }, task: TASK, role: 'transfer', axes: { A: PASS, B: PASS, C: PASS, D: PASS, E: PASS, F: PASS, G: PASS, H: PASS }, eligibleRoles: ['transfer'], publicQualified: true, assessmentQualified: true, ...o })
  const appr = (revoked = false) => [{ id: 'fx-p', qualificationId: 'fx-q', scope: 'public', approverRole: 'admin', revoked }, { id: 'fx-a', qualificationId: 'fx-q', scope: 'assessment', approverRole: 'admin', revoked }]
  const ok = { fq: fq(), qualificationId: 'fx-q', approvals: appr(), exposure: 'none' }
  const one = (over: Record<string, unknown>, readState = 'ok', extra: unknown[] = []) => {
    const r = resolveStock({ task: TASK, role: 'transfer', requested: 1 }, readState, [cand(base, { ...ok, ...over }), ...extra])
    return { line: r.line, need: r.newProductionNeeded, verdicts: r.verdicts.map((v: { ref: string; state: string; missing: string[] }) => `${v.ref}:${v.state}:${v.missing.join('+')}`) }
  }
  const other = transfers.find((i) => i.item === '2021#24')!
  const counter = {
    control_all_pass_fixture: one({}),
    already_attempted: one({ exposure: 'attempted' }),
    explanation_only: one({ exposure: 'explanation_seen' }),
    shared_passage_seen: one({ exposure: 'shared_passage_seen' }),
    same_passage_second_item: one({}, 'ok', [cand(other, { ...ok, passage: base.revision.passageSha256, fq: fq({ content: { id: other.item, revision: other.revision.bRevision } }) })]),
    exposure_unknown: one({ exposure: null }),
    annotation_or_item_revision_changed: one({ currentRevision: 'changed-' + base.revision.bRevision }),
    release_revoked: one({ approvals: appr(true) }),
    rights_unknown: one({ fq: fq({ axes: { ...fq().axes, F: { state: 'unknown' } } }) }),
    gold_unknown: one({ fq: fq({ axes: { ...fq().axes, E: { state: 'unknown' } } }) }),
    runner_unsupported: one({ artifact: { kind: 'textbook_activity', ref: base.item, contentType: 'transfer_task' } }),
    role_mismatch_check_result_for_transfer: one({ fq: fq({ role: 'independent_check' }) }),
    read_error: one({}, 'error'),
    conflicting_duplicate_row: one({}, 'ok', [cand(base, { ...ok, approvals: appr(true) })]),
  }
  const st = (k: keyof typeof counter) => counter[k].verdicts[0]?.split(':').slice(0, 3).join(':') ?? counter[k].line
  expect('control', st('control_all_pass_fixture'), '2020#24:eligible_existing:')
  expect('attempted', st('already_attempted'), '2020#24:blocked_exposure:learner')
  expect('explanation', st('explanation_only'), '2020#24:blocked_exposure:learner')
  expect('shared', st('shared_passage_seen'), '2020#24:blocked_exposure:learner')
  expect('second same passage', counter.same_passage_second_item.verdicts[1], '2021#24:blocked_exposure:shared_passage')
  expect('unknown exposure', st('exposure_unknown'), '2020#24:blocked_exposure:learner')
  expect('revision', st('annotation_or_item_revision_changed'), '2020#24:candidate_unreviewed:revision_mismatch')
  expect('revoked', st('release_revoked'), '2020#24:awaiting_release:approval')
  expect('rights unknown', st('rights_unknown'), '2020#24:candidate_unreviewed:rights')
  expect('gold unknown', st('gold_unknown'), '2020#24:blocked_gold:E')
  expect('runner', st('runner_unsupported'), '2020#24:blocked_runner:runner')
  expect('role', st('role_mismatch_check_result_for_transfer'), '2020#24:candidate_unreviewed:role_mismatch')
  expect('read error', counter.read_error.line, 'read_error')
  expect('read error need', counter.read_error.need, null)
  expect('conflict', st('conflicting_duplicate_row'), '2020#24:candidate_unreviewed:conflicting_candidate')

  // 소유권 · 목표/PLAN revision — 해결기 밖(서버 · RLS 책임). 수요 서명이 둘을 결속하는지만 확인한다
  const demand = { template: 'ws.central-meaning', workspaceId: 'fx-ws', goalVersion: 1, planVersion: 1, definitionVersion: 'fx', core: TASK, support: [], lines: [{ role: 'transfer', task: TASK, quantity: { n: 1 }, csatTypes: ['R-TOPIC'], taskKeys: ['claim-support'], requires: {}, reason: 'fx' }] }
  const sig = (u: string, d: object) => demandSignature(u, d)
  const binding = {
    ownerChangesSignature: sig('u1', demand) !== sig('u2', demand),
    goalVersionChangesSignature: sig('u1', demand) !== sig('u1', { ...demand, goalVersion: 2 }),
    planVersionChangesSignature: sig('u1', demand) !== sig('u1', { ...demand, planVersion: 2 }),
    resolverChecksOwnership: false,
    note: '해결기는 학습자 · 목표 · PLAN 을 보지 않는다 — 소유권은 B RLS(미설치) · 목표/PLAN 은 수요 서명(새 수요)으로만 갈린다. 실제 거부는 I1 설치 뒤 서버 시험 대상',
  }
  expect('owner binding', binding.ownerChangesSignature, true)
  expect('goal binding', binding.goalVersionChangesSignature, true)
  expect('plan binding', binding.planVersionChangesSignature, true)

  // 5) 실제 노출 원장 기반 학습자 상황(익명 집계)
  const realExposed = items.filter((i) => i.exposure.attemptLearnersReal > 0).map((i) => i.item)
  const explanationOnly = items.filter((i) => i.exposure.explanationOnlyLearnersReal + i.exposure.explanationOnlyLearnersSynthetic > 0).map((i) => ({ item: i.item, real: i.exposure.explanationOnlyLearnersReal, synthetic: i.exposure.explanationOnlyLearnersSynthetic }))
  const phasesSeen = [...new Set(items.map((i) => i.exposure.attemptPhases).filter(Boolean))]

  const report = {
    schema: 'vf.factory-i2-r5-preflight/1', measuredAt: snap.measuredAt, task: TASK,
    inputs: { snapshotSha256: sha(fs.readFileSync(path.join(EVID, 'db-snapshot.json'))), revisionsSha256: sha(fs.readFileSync(path.join(EVID, 'db-revisions.json'))), i0Ref, i0Head, i0Blobs },
    ledgers: snap.ledgers, poolByType: snap.poolByType,
    r5Applications: r5Apps.length, sameTypeOtherTaskApplications: otherTaskApps.map((a) => a.surface_ref),
    byRole, items, i0: { actual, afterI1NoFq, counterexamples: counter, binding },
    exposureFacts: { realLearnerAttemptedItems: realExposed, explanationOnly, attemptPhasesSeen: phasesSeen, dxResponses: items.reduce((s, i) => s + i.exposure.dxResponseLearners, 0) },
    verdict: { i2EligibleTotal: 0, unknownPromoted: 0, failures },
  }
  fs.writeFileSync(path.join(EVID, 'AUDIT.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ byRole: Object.fromEntries(ROLES.map((r) => [r, [byRole[r].candidates, byRole[r].existingPathAvailable, byRole[r].i2Eligible]])), counter: Object.fromEntries(Object.keys(counter).map((k) => [k, st(k as keyof typeof counter)])), binding, failures }, null, 1))
  if (failures.length) process.exitCode = 1
}

// ── PR #277 I0 해결기 원본을 그대로 실행(수정 · 복제 커밋 없음 — 끝나면 지운다)
fs.mkdirSync(I0_TMP, { recursive: true })
try {
  for (const f of I0_FILES) {
    const rel = `apps/web/src/lib/csat/map/v62/factory-bridge/${f}`
    i0Blobs[f] = execFileSync('git', ['-C', ROOT, 'rev-parse', `${i0Ref}:${rel}`], { encoding: 'utf8' }).trim()
    fs.writeFileSync(path.join(I0_TMP, f), execFileSync('git', ['-C', ROOT, 'show', `${i0Ref}:${rel}`]))
  }
  const i0Head = execFileSync('git', ['-C', ROOT, 'rev-parse', i0Ref], { encoding: 'utf8' }).trim()
  const { resolveStock } = await import(pathToFileURL(path.join(I0_TMP, 'stock-resolver.ts')).href)
  const { demandSignature } = await import(pathToFileURL(path.join(V62, 'persist-contract.ts')).href)
  await run(resolveStock, demandSignature, i0Head)
} finally {
  fs.rmSync(I0_TMP, { recursive: true, force: true })
}
