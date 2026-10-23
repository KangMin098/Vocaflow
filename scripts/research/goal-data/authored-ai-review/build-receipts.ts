// scripts/research/goal-data/authored-ai-review/build-receipts.ts
// T-0098 — 2차 범위 검토 원본(round2/{claude,codex})에서 세트별 영수증(vocaflow.ai-authored-review-receipt/1)을 만들고
// 제품 검증기 verifyAiReviewReceipt(원본 result.txt · session.json 대조 포함)로 확인한다. DB 를 건드리지 않는다.
//   TSX_TSCONFIG_PATH=apps/web/tsconfig.json pnpm --filter web exec tsx ../../scripts/research/goal-data/authored-ai-review/build-receipts.ts
// 정규화 1건: Gold 에 answer 가 없는 형식에서 모델이 choice_0based=null 로 답하면 키를 빼고 싣는다(검증기 · DB 모두 「answer 없음」과 같게 본다).
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { AI_RECEIPT_SCHEMA, jsCanonicalSha, verifyAiReviewReceipt, type AiReview, type AiReviewReceipt } from '@/lib/csat/authored/ai-review'
import type { AuthoredSet } from '@/lib/knowledge/authored/authored-items'

const ROOT = path.resolve(process.cwd(), '..', '..')
const OUT = path.join(ROOT, 'docs/research/goal-data-batches/authored-ai-review')
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/final/review/FINAL_CONTENT_DECISION_MANIFEST_20261022.json'), 'utf8'))
const tally = JSON.parse(fs.readFileSync(path.join(OUT, 'round1-tally.json'), 'utf8'))
const sha = (x: string | Buffer) => createHash('sha256').update(x).digest('hex')
const parse = (t: string) => { const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null }

const summary: unknown[] = []
for (const s of man.sets) {
  const dir = path.join(OUT, s.set_revision, 'round2')
  if (!fs.existsSync(path.join(dir, 'claude/session.json')) || !fs.existsSync(path.join(dir, 'codex/session.json'))) {
    summary.push({ set: s.set_revision, status: 'no_round2', reason: '1차 두 모델 공통 수락 0 — 영수증 없음' }); continue
  }
  const bytes = fs.readFileSync(path.join(ROOT, s.file))
  const set = JSON.parse(bytes.toString('utf8')) as AuthoredSet
  const r1 = tally.sets.find((x: { set: string }) => x.set === s.set_revision)
  const reviews: AiReview[] = []
  const raw: Record<'claude' | 'codex', { result: string; session: Record<string, unknown> }> = {} as never
  for (const agent of ['claude', 'codex'] as const) {
    const result = fs.readFileSync(path.join(dir, agent, 'result.txt'), 'utf8')
    const session = JSON.parse(fs.readFileSync(path.join(dir, agent, 'session.json'), 'utf8'))
    const j = parse(result)
    raw[agent] = { result, session }
    reviews.push({
      agent, session_id: session.session_id, request_id: session.request_id, prompt_sha256: session.prompt_sha256, response_sha256: sha(result),
      source_file_sha256: j?.source_file_sha256, verdict: j?.verdict,
      items: (j?.items ?? []).map((v: Record<string, unknown>) => {
        const it = set.items.find((x) => x.id === v.id)
        const noAnswer = it && (it.gold as { answer?: unknown }).answer === undefined
        const { choice_0based, ...rest } = v
        return noAnswer && choice_0based === null ? rest : v
      }),
    } as AiReview)
  }
  // 범위 = 2차에서 두 모델 모두 다시 수락한 문항(1차 공통 수락의 부분집합)
  const answer = (id: string) => (set.items.find((x) => x.id === id)?.gold as { answer?: unknown } | undefined)?.answer
  const scope: string[] = r1.both_accepted.filter((id: string) => reviews.every((rv) => {
    const iv = rv.items.find((x) => x.id === id)
    return iv && iv.verdict === 'accept' && iv.choice_0based === answer(id) && (iv.gold_issues ?? []).length === 0
  }))
  const setAccept = reviews.every((rv) => rv.verdict === 'accept')
  const receipt: AiReviewReceipt = {
    schema: AI_RECEIPT_SCHEMA, set: set.set, source_file_sha256: sha(bytes), scope,
    items: scope.map((id) => { const it = set.items.find((x) => x.id === id)!
      return { id, role: it.role, item_canonical_sha256: jsCanonicalSha(it), body_canonical_sha256: jsCanonicalSha(it.body), gold_canonical_sha256: jsCanonicalSha(it.gold) } }),
    reviews, judgment: 'accepted_candidate_content_and_gold', rights_basis: 'first_party_original_declaration_only', rights_grant: false, human_review_claimed: false,
    not_reviewed: set.items.map((x) => x.id).filter((id) => !scope.includes(id)),
  }
  const check = verifyAiReviewReceipt(receipt, set, bytes, raw as never)
  const status = !setAccept ? 'round2_not_accept' : check.ok ? 'ok' : 'verify_failed'
  if (status === 'ok') fs.writeFileSync(path.join(OUT, s.set_revision, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  summary.push({ set: s.set_revision, status, scope: scope.length, assessment_in_scope: scope.filter((id) => ['independent_check', 'transfer', 'delayed_check'].includes(set.items.find((x) => x.id === id)!.role)).length,
    round1_both: r1.both_accepted.length, set_verdicts: reviews.map((r) => `${r.agent}:${r.verdict}`), errors: check.ok ? [] : check.errors })
}
fs.writeFileSync(path.join(OUT, 'receipts-summary.json'), JSON.stringify(summary, null, 2) + '\n')
for (const x of summary as Record<string, unknown>[]) console.log(JSON.stringify(x))
