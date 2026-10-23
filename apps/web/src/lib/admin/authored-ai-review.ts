// apps/web/src/lib/admin/authored-ai-review.ts
// Actual admin caller for the reviewed authored supply service. Preview is read-only;
// register uses the authenticated admin session, never a service-role impersonation.
import { createHash } from 'node:crypto'

import { NextResponse, type NextRequest } from 'next/server'

import type { AdminUser } from '@/lib/auth/require-admin-api'
import { recordAiReviewedSupply, verifyAiReviewReceipt, type AiReviewReceipt, type RawEvidence } from '@/lib/csat/authored/ai-review'
import type { AuthoredSet } from '@/lib/knowledge/authored/authored-items'

type Session = Parameters<typeof recordAiReviewedSupply>[0]
type Evidence = Record<'claude' | 'codex', { input: string; result: string; session: NonNullable<RawEvidence['claude']>['session'] }>
interface Body { action: 'preview' | 'register'; set_bytes: string; receipt: AiReviewReceipt; evidence: Evidence }
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const exact = (x: Record<string, unknown>, keys: string[]) => Object.keys(x).sort().join(',') === [...keys].sort().join(',')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const json = (x: unknown, status = 200) => NextResponse.json(x, { status, headers: { 'cache-control': 'no-store' } })

/** Original input and output are mandatory at this production boundary. */
export function parseAuthoredAiBody(x: unknown): { body: Body; set: AuthoredSet } | null {
  if (!obj(x) || !exact(x, ['action', 'set_bytes', 'receipt', 'evidence']) || (x.action !== 'preview' && x.action !== 'register')
      || typeof x.set_bytes !== 'string' || !obj(x.receipt) || !obj(x.evidence) || !exact(x.evidence, ['claude', 'codex'])) return null
  for (const agent of ['claude', 'codex']) {
    const e = x.evidence[agent]
    if (!obj(e) || !exact(e, ['input', 'result', 'session']) || typeof e.input !== 'string' || typeof e.result !== 'string' || !obj(e.session)
        || e.session.status !== 'exited') return null
    const reviews = x.receipt.reviews
    const r = Array.isArray(reviews) ? reviews.find((v: unknown) => obj(v) && v.agent === agent) : null
    if (!obj(r) || sha(e.input) !== r.prompt_sha256 || sha(e.result) !== r.response_sha256 || e.session.request_id !== r.request_id) return null
  }
  try {
    const set: unknown = JSON.parse(x.set_bytes)
    if (!obj(set) || !obj(set.provenance) || !Array.isArray(set.provenance.derivedFrom) || !Array.isArray(set.items)) return null
    return { body: x as unknown as Body, set: set as unknown as AuthoredSet }
  } catch { return null }
}

export function createAuthoredAiPost(deps: {
  guard: () => Promise<AdminUser | NextResponse>
  session: () => Promise<Session>
}) {
  return async (req: NextRequest) => {
    const admin = await deps.guard()
    if (admin instanceof NextResponse) return admin
    if (req.headers.get('origin') !== req.nextUrl.origin) return json({ error: '요청 출처를 확인할 수 없습니다.' }, 403)
    if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON 요청이 필요합니다.' }, 415)
    const raw = await req.text()
    if (Buffer.byteLength(raw, 'utf8') > 400_000) return json({ error: '요청 본문이 너무 큽니다.' }, 413)
    let parsed: ReturnType<typeof parseAuthoredAiBody>
    try { parsed = parseAuthoredAiBody(JSON.parse(raw)) } catch { return json({ error: '검수 자료 형식을 확인해 주세요.' }, 400) }
    if (!parsed) return json({ error: '세트 원본과 두 AI의 입력·응답·세션 원본이 필요합니다.' }, 400)
    const { body, set } = parsed
    let check: ReturnType<typeof verifyAiReviewReceipt>
    try { check = verifyAiReviewReceipt(body.receipt, set, body.set_bytes, body.evidence) } catch { return json({ error: '검수 자료 형식을 확인해 주세요.' }, 400) }
    if (!check.ok) return json({ status: 'rejected', errors: check.errors }, 422)
    if (body.action === 'preview') return json({ status: 'verified', refs: check.refs, registered: false, released: false, humanReview: false, rightsGrant: false })
    if (admin.role !== 'admin') return json({ error: '공급 등록은 관리자만 실행할 수 있습니다.' }, 403)
    try {
      const result = await recordAiReviewedSupply(await deps.session(), set, body.set_bytes, body.receipt, body.evidence)
      return json(result, result.status === 'ok' ? 200 : 422)
    } catch {
      return json({ error: '등록 결과를 확인하지 못했습니다. 같은 원본으로 다시 요청하면 완료된 단계부터 복구합니다.' }, 503)
    }
  }
}
