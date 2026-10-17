// apps/web/src/lib/csat/map/v62/factory-bridge/stock-resolver.ts
//
// I0-3 — 적격 재고 우선 해결기(순수 · 읽기 전용 입력). 수요 줄 하나에 대해 기존 자료 후보를 하나씩 판정하고,
// 적격 기존 자료로 채울 수 있는 만큼 채운 뒤 **남는 부족분만** 신규 생산 필요량으로 돌려준다.
// supplyFor(supply.ts)는 학습자 화면의 공급 가능성 진단으로 그대로 둔다 — 그 「available」 은 교수 적합성 null 도 지금 보여 주므로
// 여기서는 쓰지 않는다(FQ A~H · 서버 승인 · 현재 revision · 실행기 · 학습자 노출을 모두 본다).
// 재사용: bindResult · approvalState · toSupplyQualification · supplyEligible · deliveryCheck(qualification.ts) · runnerFor(factory-integration.ts).
// G(학습자 노출)는 개인별 공급 시점 검사다 — exposure 를 모르면(null) 평가 역할은 적격으로 세지 않는다(fail-closed).

import type { MaterialRole } from '../demand'
import { canonicalJson } from '../canonical-json'
import { runnerFor, type RunnerFormat } from '../factory-integration'
import { approvalState, ASSESSMENT_ROLES, bindResult, supplyEligible, toSupplyQualification, type Exposure, type FqResult, type ReleaseApproval } from '../qualification'
import { assertMaterialCount } from './material-unit'

export type StockState =
  | 'eligible_existing'
  | 'candidate_unreviewed'
  | 'awaiting_release'
  | 'blocked_rights'
  | 'blocked_gold'
  | 'blocked_exposure'
  | 'blocked_runner'

export type LineState = 'satisfied' | 'insufficient_quantity' | 'not_installed' | 'read_error'

export interface StockCandidate {
  artifact: { kind: 'dcp_item' | 'csat_item' | 'textbook_activity' | 'workspace_bundle'; ref: string; contentType: string | null }
  /** 서버가 실제 행에서 계산한 현재 revision — 읽을 reader 가 없으면 null */
  currentRevision: string | null
  /** 정규 지문 identity(같은 지문의 다른 문항은 서로 독립 관찰이 아니다) — 모르면 null */
  passage: string | null
  /** 이 산출물 · TASK · 역할에 묶인 자격 결과(연구 스냅샷) — 없으면 미검수 */
  fq: FqResult | null
  qualificationId: string | null
  /** 서버가 원장에서 읽은 승인(클라이언트 입력 금지) */
  approvals: readonly ReleaseApproval[]
  /** 이 학습자의 노출(공급 시점) — 모르면 null */
  exposure: Exposure | null
}

export interface CandidateVerdict { ref: string; state: StockState; missing: string[] }

export interface StockResolution {
  role: MaterialRole
  task: string
  requested: number
  line: LineState
  /** 적격으로 고른 기존 자료(평가 역할은 지문당 하나) */
  eligible: string[]
  /** 상태별 수 — 미검수 후보와 적격을 따로 센다 */
  counts: Record<StockState, number>
  /** 신규 생산 필요량 — 원장을 못 읽으면 null(정상 0건과 구별) */
  newProductionNeeded: number | null
  verdicts: CandidateVerdict[]
}

const ZERO = (): Record<StockState, number> => ({ eligible_existing: 0, candidate_unreviewed: 0, awaiting_release: 0, blocked_rights: 0, blocked_gold: 0, blocked_exposure: 0, blocked_runner: 0 })
const RUNNABLE: ReadonlySet<RunnerFormat> = new Set(['dcp_existing', 'csat_item_screen'])

export function judgeCandidate(c: StockCandidate, want: { task: string; role: MaterialRole }): CandidateVerdict {
  const v = (state: StockState, missing: string[]): CandidateVerdict => ({ ref: c.artifact.ref, state, missing })
  // 실행기 · revision reader 가 없는 종류는 자격이 있어도 공급할 수 없다(학생 오답과 무관)
  const runner = runnerFor({ kind: c.artifact.kind, contentType: c.artifact.contentType ?? '' } as Parameters<typeof runnerFor>[0])
  if (!RUNNABLE.has(runner)) return v('blocked_runner', [`runner:${runner}`])
  if (!c.fq || !c.qualificationId) return v('candidate_unreviewed', ['qualification'])
  if (c.currentRevision === null) return v('candidate_unreviewed', ['revision_unreadable'])
  const bound = bindResult(c.fq, { contentId: c.artifact.ref, revision: c.currentRevision, task: want.task, role: want.role })
  if (!bound.ok) return v('candidate_unreviewed', [bound.error])
  const ax = c.fq.axes
  if (ax.F.state === 'fail') return v('blocked_rights', ['F'])
  const assessment = ASSESSMENT_ROLES.has(want.role)
  if (assessment && ax.E.state === 'fail') return v('blocked_gold', ['E'])
  const approval = approvalState(c.qualificationId, c.approvals)
  const q = toSupplyQualification(c.fq, approval)
  const base = supplyEligible(q, want.role)
  if (!base.ok) {
    // 축은 pass 인데 승인만 없으면 출시 대기 — 축 자체가 unknown 이면 미검수
    const axisOk = (k: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'H') => ax[k].state === 'pass'
    const pendingOnlyApproval = base.missing.every((m) => (m === 'rights' && axisOk('F') && !approval.public) || (m === 'assessment' && axisOk('E') && !approval.assessment))
    if (pendingOnlyApproval) return v('awaiting_release', base.missing.map((m) => `approval:${m === 'rights' ? 'public' : 'assessment'}`))
    if (base.missing.includes('runnable')) return v('blocked_runner', ['H'])
    if (assessment && base.missing.includes('assessment') && ax.E.state !== 'pass') return v('blocked_gold', ['E'])
    return v('candidate_unreviewed', base.missing)
  }
  if (assessment && c.exposure !== 'none') return v('blocked_exposure', [`learner:${c.exposure ?? 'unknown'}`])
  return v('eligible_existing', [])
}

/**
 * 수요 줄 하나를 기존 재고로 해결한다. read = 원장 상태: ok · not_installed(표가 아직 없음) · error(읽기 실패).
 * not_installed · error 는 「후보 0 · 신규 생산 n」으로 바꾸지 않는다 — newProductionNeeded = null.
 */
export function resolveStock(want: { task: string; role: MaterialRole; requested: number }, read: 'ok' | 'not_installed' | 'error', candidates: readonly StockCandidate[]): StockResolution {
  const requested = assertMaterialCount(want.requested, 'stock_requested')
  if (read !== 'ok') return { role: want.role, task: want.task, requested, line: read === 'error' ? 'read_error' : 'not_installed', eligible: [], counts: ZERO(), newProductionNeeded: null, verdicts: [] }
  const counts = ZERO()
  const verdicts = candidates.map((c) => judgeCandidate(c, want))
  const eligible: string[] = []
  const usedPassages = new Set<string>()
  const assessment = ASSESSMENT_ROLES.has(want.role)
  // Output refs identify items. Conflicting versions/approvals of the same ref cannot
  // select a winner by input order. Exact duplicate rows count only once.
  const signatures = new Map<string, Set<string>>()
  for (const c of candidates) {
    const values = signatures.get(c.artifact.ref) ?? new Set<string>()
    values.add(canonicalJson(c))
    signatures.set(c.artifact.ref, values)
  }
  const seen = new Set<string>()
  verdicts.forEach((v, i) => {
    let state = v.state
    if ((signatures.get(v.ref)?.size ?? 0) > 1 || seen.has(v.ref)) {
      state = 'candidate_unreviewed'
      v.state = state
      v.missing.push((signatures.get(v.ref)?.size ?? 0) > 1 ? 'conflicting_candidate' : 'duplicate_artifact')
    }
    seen.add(v.ref)
    if (state === 'eligible_existing' && assessment) {
      const p = candidates[i].passage
      // 같은 지문의 다른 문항을 두 번째 평가 자료로 세지 않는다 · 지문 identity 를 모르면 평가 자료로 세지 않는다
      if (p === null || usedPassages.has(p)) { state = 'blocked_exposure'; v.missing.push(p === null ? 'passage_unknown' : 'shared_passage') ; v.state = state }
      else usedPassages.add(p)
    }
    counts[state]++
    if (state === 'eligible_existing' && eligible.length < requested) eligible.push(v.ref)
  })
  const need = Math.max(0, requested - eligible.length)
  return { role: want.role, task: want.task, requested, line: need === 0 ? 'satisfied' : 'insufficient_quantity', eligible, counts, newProductionNeeded: need, verdicts }
}
