// scripts/lcp/story/s4-harness-eval.ts
//
// T-0174 LCP Story S4 — 격리 브라우저 하네스의 Server Action 대역 뒤에서 도는 「실제 서버 로직 + 가짜 DB」 평가기(tsx 자식 프로세스).
// stdin { action, args, statePath, actor, now } → stdout { value, rpc_calls }.
//
// 실제(제품 코드 그대로): apps/web/src/lib/library/story/admin.ts 의 checkStoryCandidate · registerStoryCandidate · submitStoryReview ·
//   listStorySlots · loadStoryBundle · recordStoryRights · publishStory · withdrawStory, witness.ts 의 attestStoryValidation,
//   그리고 그것들이 부르는 실제 S2 검증기 · plan · buildValidationAttestation(@vocaflow/library-pipeline/story).
//   액션 이름 → 함수 대응은 app/admin/curation/story-actions.ts 의 배선과 같다(그 파일은 next/headers · 쿠키 · service 키를 끌어와 여기서 import 하지 않는다).
// 대역(명시): 쿠키 세션 클라이언트(auth.getUser · user_profiles · rpc)와 서비스 주체 클라이언트(rpc)를 아래 FakeStoryDb 가 받는다.
//   FakeStoryDb 는 supabase/migrations/20261025094450_lcp_story_s3_schema.sql 의 관리 RPC 9개 + 증인 RPC 2개 규칙을 메모리에서 흉내 낸다
//   (require_staff · 정체 해시 재사용 created=false · self_review · self_review_claim · review_binding_mismatch · publisher_is_producer ·
//   not_latest_version · rights_unconfirmed · review_missing/not_qualifying · live_release_exists · validation_attestation_missing ·
//   attestation_binding_mismatch · withdraw changed=false). 해시는 SQL 과 같은 정의를 패키지 sha256Canonical 로 계산한다.
//   PostgREST · RLS · 잠금 · 트랜잭션 · JWT 역할 주장은 흉내 내지 않는다 — 그 실제 검증은 수용된 S3 격리 PG17 시험(59/0/0)이다.
// 상태는 statePath(JSON, gitignored work/ 아래)에 저장된다. 시각은 입력 now 를 주입받는다(시계를 읽지 않는다).
// 'server-only' 는 NODE_OPTIONS=--conditions=react-server 로 빈 모듈이 되게 실행한다(스펙이 그렇게 띄운다).
//
//   echo '{...}' | NODE_OPTIONS=--conditions=react-server node <tsx cli> scripts/lcp/story/s4-harness-eval.ts

import fs from 'node:fs'

import {
  checkStoryCandidate,
  listStorySlots,
  loadStoryBundle,
  publishStory,
  recordStoryRights,
  registerStoryCandidate,
  submitStoryReview,
  withdrawStory,
  type StoryDeps,
  type StoryRpcClient,
  type StoryRpcResponse,
  type StoryServiceClient,
} from '../../../apps/web/src/lib/library/story/admin'
import { attestStoryValidation } from '../../../apps/web/src/lib/library/story/witness'
import { sha256Canonical, sha256Hex } from '../../../packages/library-pipeline/src/story/canonical'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Actor {
  uid: string
  role: string
  status: string
}
interface Fault {
  kind: 'network' | 'error'
  message?: string
  times: number
}
export interface FakeState {
  seq: number
  sources: Json[]
  policies: Json[]
  slots: Json[]
  versions: Json[]
  reviews: Json[]
  rights: Json[]
  attestations: Json[]
  releases: Json[]
  faults: Record<string, Fault>
  rpc_log: { fn: string; actor: string | null; result: 'ok' | 'error' | 'network'; code?: string }[]
}

export function emptyState(): FakeState {
  return { seq: 0, sources: [], policies: [], slots: [], versions: [], reviews: [], rights: [], attestations: [], releases: [], faults: {}, rpc_log: [] }
}

const VALIDATOR = { name: 'lcp-story-s2', contract: 'lcp-story/s2@1' }
const REQUIRED_BASE = ['source_alignment', 'meaning_preservation', 'preserve_items', 'language_target', 'cognitive_target', 'background_supports', 'sensitivity_handling', 'hook_spoiler_free', 'naturalness']

class StoryRaise extends Error {
  constructor(public code: string, public details: string | null = null) {
    super(code)
  }
}

/** supabase/migrations/20261025094450_lcp_story_s3_schema.sql 의 관리 · 증인 RPC 를 메모리에서 흉내 내는 대역. */
export class FakeStoryDb {
  constructor(public state: FakeState, private now: Date) {}

  private id(): string {
    this.state.seq += 1
    return `00000000-0000-4000-9000-${this.state.seq.toString(16).padStart(12, '0')}`
  }

  private requireStaff(actor: Actor | null, min: 'curator' | 'admin'): string {
    if (!actor) throw new StoryRaise('story:auth_required')
    if (actor.status !== 'active') throw new StoryRaise('story:account_blocked')
    if (actor.role !== 'admin' && actor.role !== 'curator') throw new StoryRaise('story:staff_required')
    if (min === 'admin' && actor.role !== 'admin') throw new StoryRaise('story:admin_required')
    return actor.uid
  }

  private sourceIdentity(snapshot: Json, textSha: string): string {
    const { text: _t, text_sha256: _s, rights, ...rest } = snapshot
    void _t
    void _s
    const sorted = [...((rights as Json[]) ?? [])].sort((a, b) => (a.asset < b.asset ? -1 : a.asset > b.asset ? 1 : 0))
    return sha256Canonical({ ...rest, text_sha256: textSha, rights: sorted })
  }

  private requiredRights(source: Json): { asset: string; status: string | null }[] {
    const assets = ['source_text']
    const claimsTranslation = ((source.snapshot_meta.rights as Json[]) ?? []).some((r) => r.asset === 'translation')
    if (source.original_language !== source.text_language || claimsTranslation) assets.push('translation')
    return assets.map((asset) => {
      const last = this.state.rights.filter((d) => d.source_id === source.id && d.asset === asset).sort((a, b) => b.seq - a.seq)[0]
      return { asset, status: last ? last.status : null }
    })
  }

  private rightsOk(source: Json): boolean {
    return this.requiredRights(source).every((r) => r.status === 'confirmed')
  }

  private latest(slotId: string): Json | undefined {
    return this.state.versions.filter((v) => v.slot_id === slotId).sort((a, b) => b.seq - a.seq)[0]
  }

  private binding(version: Json): Json {
    const slot = this.state.slots.find((s) => s.id === version.slot_id)!
    const source = this.state.sources.find((s) => s.id === slot.source_id)!
    const policy = this.state.policies.find((p) => p.id === slot.policy_id)!
    const shas = this.state.reviews.filter((r) => r.edition_version_id === version.id).map((r) => r.review_sha256 as string).sort()
    return {
      source_sha256: source.text_sha256,
      source_identity_sha256: source.identity_sha256,
      policy_sha256: policy.policy_sha256,
      target_sha256: slot.target_sha256,
      edition_sha256: version.edition_sha256,
      activities_sha256: version.activities_sha256,
      review_sha256s: shas,
    }
  }

  call(fn: string, args: Json, actor: Actor | null, service: boolean): unknown {
    switch (fn) {
      case 'story_admin_register_source': {
        const uid = this.requireStaff(actor, 'curator')
        const p = args.p_snapshot as Json
        if (p?.schema !== 'lcp-story/source-snapshot@1') throw new StoryRaise('story:snapshot_schema')
        if (p.synthetic !== false) throw new StoryRaise('story:synthetic_not_allowed')
        if (p.normalization !== 'story-text-v1') throw new StoryRaise('story:normalization')
        if (typeof p.text !== 'string' || p.text === '') throw new StoryRaise('story:text_missing')
        const sha = sha256Hex(p.text)
        if (sha !== p.text_sha256) throw new StoryRaise('story:text_hash_mismatch')
        const rights = p.rights as Json[]
        if (!Array.isArray(rights) || rights.filter((r) => r.asset === 'source_text').length !== 1 || new Set(rights.map((r) => r.asset)).size !== rights.length) {
          throw new StoryRaise('story:rights_claims_invalid')
        }
        const identity = this.sourceIdentity(p, sha)
        const existing = this.state.sources.find((s) => s.identity_sha256 === identity)
        if (existing) return [{ source_id: existing.id, identity_sha256: identity, text_sha256: sha, created: false }]
        const kind = p.edition?.source_kind
        if (kind === 'library_book') throw new StoryRaise('story:library_book_not_found') // 하네스는 원본 library_books 를 흉내 내지 않는다
        if (kind !== 'external_file') throw new StoryRaise('story:source_kind_not_allowed', String(kind ?? 'null'))
        if (p.edition?.library_book_id != null) throw new StoryRaise('story:library_book_id_unexpected')
        const { text: _t, text_sha256: _s, ...meta } = p
        void _t
        void _s
        const row = {
          id: this.id(), snapshot_id: p.snapshot_id, work_key: p.work?.work_key, snapshot_meta: meta, body: p.text, text_sha256: sha, identity_sha256: identity,
          original_language: p.work?.original_language, text_language: p.edition?.text_language, coverage: p.coverage,
          paragraph_count: p.text.split('\n\n').length, library_book_id: null, correspondence: 'not_library_book', registered_by: uid, registered_at: this.now.toISOString(),
        }
        this.state.sources.push(row)
        return [{ source_id: row.id, identity_sha256: identity, text_sha256: sha, created: true }]
      }
      case 'story_admin_register_policy': {
        const uid = this.requireStaff(actor, 'curator')
        const source = this.state.sources.find((s) => s.id === args.p_source_id)
        if (!source) throw new StoryRaise('story:source_not_found')
        const p = args.p_policy as Json
        if (p?.schema !== 'lcp-story/editorial-policy@1') throw new StoryRaise('story:policy_schema')
        if (p.source_sha256 !== source.text_sha256) throw new StoryRaise('story:policy_source_stale')
        if (p.work_key !== source.work_key) throw new StoryRaise('story:work_key_mismatch')
        if (!Array.isArray(p.production) || p.production.length === 0) throw new StoryRaise('story:production_missing')
        if (new Set(p.production.map((i: Json) => i.edition_key)).size !== p.production.length) throw new StoryRaise('story:duplicate_edition_key')
        const { production: _prod, ...core } = p
        void _prod
        const coreSha = sha256Canonical(core)
        const full = sha256Canonical(p)
        const rowsOf = (policyId: string, created: boolean) =>
          this.state.slots.filter((s) => s.policy_id === policyId).sort((a, b) => (a.edition_key < b.edition_key ? -1 : 1))
            .map((s) => ({ policy_id: policyId, policy_sha256: coreSha, slot_id: s.id, edition_key: s.edition_key, target_sha256: s.target_sha256, created }))
        const existing = this.state.policies.find((x) => x.source_id === source.id && x.policy_full_sha256 === full)
        if (existing) return rowsOf(existing.id, false)
        for (const item of p.production as Json[]) {
          if (item.transformation === 'renarration') throw new StoryRaise('story:renarration_excluded')
          const first = item.scope?.first_paragraph
          const last = item.scope?.last_paragraph
          if (typeof first !== 'number' || typeof last !== 'number' || first < 0 || first > last || last > source.paragraph_count - 1) throw new StoryRaise('story:scope_invalid', item.edition_key)
          if (item.coverage === 'complete_work' && (source.coverage !== 'complete_work' || first !== 0 || last !== source.paragraph_count - 1)) throw new StoryRaise('story:coverage_claim_invalid', item.edition_key)
        }
        const policyId = this.id()
        this.state.policies.push({ id: policyId, source_id: source.id, policy: p, policy_sha256: coreSha, policy_full_sha256: full, registered_by: uid })
        for (const item of p.production as Json[]) {
          this.state.slots.push({ id: this.id(), policy_id: policyId, source_id: source.id, work_key: source.work_key, edition_key: item.edition_key, kind: item.kind, coverage: item.coverage, production: item, target_sha256: sha256Canonical(item) })
        }
        return rowsOf(policyId, true)
      }
      case 'story_admin_submit_edition': {
        const uid = this.requireStaff(actor, 'curator')
        const slot = this.state.slots.find((s) => s.id === args.p_slot_id)
        if (!slot) throw new StoryRaise('story:slot_not_found')
        const source = this.state.sources.find((s) => s.id === slot.source_id)!
        const policy = this.state.policies.find((p) => p.id === slot.policy_id)!
        const a = args.p_artifact as Json
        if (a?.schema !== 'lcp-story/edition@1') throw new StoryRaise('story:edition_schema')
        if (a.edition_key !== slot.edition_key || a.kind !== slot.kind) throw new StoryRaise('story:edition_slot_mismatch')
        const expected = { source_sha256: source.text_sha256, source_identity_sha256: source.identity_sha256, policy_sha256: policy.policy_sha256, target_sha256: slot.target_sha256 }
        if (sha256Canonical(a.binding ?? null) !== sha256Canonical(expected)) throw new StoryRaise('story:edition_binding_stale')
        if (a.produced_by?.provenance !== 'ai_generated' && a.produced_by?.provenance !== 'human_authored') throw new StoryRaise('story:producer_provenance')
        if (!a.produced_by?.session_id) throw new StoryRaise('story:producer_session_missing')
        if (!Array.isArray(a.units) || a.units.length === 0 || a.units.some((u: Json) => !String(u.text ?? '').trim()) || !Array.isArray(a.activities) || !Array.isArray(a.assets) || !String(a.title ?? '').trim() || !String(a.hook?.text ?? '').trim()) {
          throw new StoryRaise('story:edition_incomplete')
        }
        const { activities, ...rest } = a
        const editionSha = sha256Canonical(rest)
        const activitiesSha = sha256Canonical(activities)
        const existing = this.state.versions.find((v) => v.slot_id === slot.id && v.edition_sha256 === editionSha && v.activities_sha256 === activitiesSha)
        if (existing) return [{ edition_version_id: existing.id, edition_sha256: editionSha, activities_sha256: activitiesSha, created: false }]
        const seq = this.state.versions.length + 1
        const row = { id: this.id(), seq, slot_id: slot.id, artifact: a, edition_sha256: editionSha, activities_sha256: activitiesSha, unit_count: a.units.length, has_assets: a.assets.length > 0, producer_claim: a.produced_by, submitted_by: uid, submitted_at: this.now.toISOString() }
        this.state.versions.push(row)
        return [{ edition_version_id: row.id, edition_sha256: editionSha, activities_sha256: activitiesSha, created: true }]
      }
      case 'story_admin_submit_review': {
        const uid = this.requireStaff(actor, 'curator')
        const version = this.state.versions.find((v) => v.id === args.p_edition_version_id)
        if (!version) throw new StoryRaise('story:edition_version_not_found')
        if (version.submitted_by === uid) throw new StoryRaise('story:self_review')
        const slot = this.state.slots.find((s) => s.id === version.slot_id)!
        const source = this.state.sources.find((s) => s.id === slot.source_id)!
        const policy = this.state.policies.find((p) => p.id === slot.policy_id)!
        const r = args.p_review as Json
        if (r?.schema !== 'lcp-story/review@1') throw new StoryRaise('story:review_schema')
        if (!['ai_review', 'human_review'].includes(r.provenance)) throw new StoryRaise('story:review_provenance')
        if ((r.provenance === 'human_review') !== (r.reviewer?.kind === 'human')) throw new StoryRaise('story:review_provenance')
        if (!r.reviewer?.session_id || r.reviewer.session_id === version.producer_claim?.session_id) throw new StoryRaise('story:self_review_claim')
        const binding = {
          task_id: version.artifact.task_id, edition_key: slot.edition_key, source_sha256: source.text_sha256, source_identity_sha256: source.identity_sha256,
          policy_sha256: policy.policy_sha256, target_sha256: slot.target_sha256, edition_sha256: version.edition_sha256, activities_sha256: version.activities_sha256,
        }
        if (sha256Canonical(r.binding ?? null) !== sha256Canonical(binding)) throw new StoryRaise('story:review_binding_mismatch')
        if (!['approve', 'changes_requested', 'hold', 'reject'].includes(r.verdict) || !Array.isArray(r.checks) || !Array.isArray(r.issues)) throw new StoryRaise('story:review_incomplete')
        if (new Date(r.reviewed_at).getTime() > this.now.getTime()) throw new StoryRaise('story:time_in_future')
        if (r.issues.some((i: Json) => i.severity === 'critical' && i.status === 'accepted_risk')) throw new StoryRaise('story:critical_issue_accepted')
        if (r.verdict === 'approve' && (r.checks.some((c: Json) => c.verdict === 'fail' || c.verdict === 'hold') || r.issues.some((i: Json) => i.severity === 'critical' && i.status === 'open'))) {
          throw new StoryRaise('story:review_inconsistent')
        }
        const required = [...REQUIRED_BASE, ...(version.artifact.activities?.length ? ['activities'] : []), ...(version.artifact.assets?.length ? ['assets'] : [])]
        const qualifies = r.verdict === 'approve' && required.every((req) => r.checks.some((c: Json) => c.check === req && c.verdict === 'pass')) &&
          !r.issues.some((i: Json) => i.status === 'open' && (i.severity === 'critical' || i.severity === 'major'))
        const sha = sha256Canonical(r)
        const existing = this.state.reviews.find((x) => x.edition_version_id === version.id && x.review_sha256 === sha)
        if (existing) return [{ review_id: existing.id, review_sha256: sha, qualifies, created: false }]
        const row = { id: this.id(), edition_version_id: version.id, review: r, review_sha256: sha, verdict: r.verdict, qualifies, submitted_by: uid, submitted_at: this.now.toISOString() }
        this.state.reviews.push(row)
        return [{ review_id: row.id, review_sha256: sha, qualifies, created: true }]
      }
      case 'story_admin_record_rights': {
        const uid = this.requireStaff(actor, 'admin')
        if (!this.state.sources.some((s) => s.id === args.p_source_id)) throw new StoryRaise('story:source_not_found')
        const row = { id: this.id(), seq: this.state.rights.length + 1, source_id: args.p_source_id, asset: args.p_asset, status: args.p_status, basis: args.p_basis, evidence_ref: args.p_evidence_ref ?? null, decided_by: uid, decided_at: this.now.toISOString() }
        this.state.rights.push(row)
        return row.id
      }
      case 'story_admin_publish': {
        const uid = this.requireStaff(actor, 'admin')
        const version = this.state.versions.find((v) => v.id === args.p_edition_version_id)
        if (!version) throw new StoryRaise('story:edition_version_not_found')
        const slot = this.state.slots.find((s) => s.id === version.slot_id)!
        const source = this.state.sources.find((s) => s.id === slot.source_id)!
        const policy = this.state.policies.find((p) => p.id === slot.policy_id)!
        if (this.latest(slot.id)?.id !== version.id) throw new StoryRaise('story:not_latest_version')
        if (version.submitted_by === uid) throw new StoryRaise('story:publisher_is_producer')
        if (version.has_assets) throw new StoryRaise('story:assets_not_supported')
        if (source.snapshot_meta.synthetic !== false || version.producer_claim?.provenance === 'synthetic_fixture') throw new StoryRaise('story:synthetic_not_allowed')
        if (!this.rightsOk(source)) {
          throw new StoryRaise('story:rights_unconfirmed', this.requiredRights(source).map((r) => `${r.asset}:${r.status ?? 'missing'}`).join(','))
        }
        const reviews = this.state.reviews.filter((r) => r.edition_version_id === version.id)
        if (reviews.length === 0) throw new StoryRaise('story:review_missing')
        if (reviews.some((r) => !r.qualifies)) throw new StoryRaise('story:review_not_qualifying')
        if (this.state.releases.some((rl) => rl.source_id === source.id && rl.edition_key === slot.edition_key && rl.withdrawn_at === null)) throw new StoryRaise('story:live_release_exists')
        const bindingSha = sha256Canonical(this.binding(version))
        const att = this.state.attestations.find((a) => a.edition_version_id === version.id && a.binding_sha256 === bindingSha && sha256Canonical(a.validator) === sha256Canonical(VALIDATOR))
        if (!att) throw new StoryRaise('story:validation_attestation_missing', bindingSha)
        const shas = reviews.map((r) => r.review_sha256 as string).sort()
        const key = `lsr_${sha256Canonical({
          work_key: source.work_key, edition_key: slot.edition_key, source_identity_sha256: source.identity_sha256, source_text_sha256: source.text_sha256,
          policy_sha256: policy.policy_sha256, target_sha256: slot.target_sha256, edition_sha256: version.edition_sha256, activities_sha256: version.activities_sha256,
          review_sha256s: shas, quality_contract: 'lcp-story/quality@1',
        }).slice(0, 32)}`
        if (this.state.releases.some((rl) => rl.release_key === key)) throw new StoryRaise('story:release_key_exists', key)
        const row = { id: this.id(), release_key: key, slot_id: slot.id, edition_version_id: version.id, source_id: source.id, edition_key: slot.edition_key, published_by: uid, published_at: this.now.toISOString(), withdrawn_at: null as string | null, attestation_id: att.id }
        this.state.releases.push(row)
        return [{ release_id: row.id, release_key: key }]
      }
      case 'story_admin_withdraw': {
        const uid = this.requireStaff(actor, 'admin')
        if (!String(args.p_reason ?? '').trim()) throw new StoryRaise('story:withdraw_reason_required')
        const rl = this.state.releases.find((x) => x.release_key === args.p_release_key)
        if (!rl) throw new StoryRaise('story:release_not_found')
        if (rl.withdrawn_at !== null) return [{ release_key: rl.release_key, withdrawn_at: rl.withdrawn_at, changed: false }]
        rl.withdrawn_at = this.now.toISOString()
        rl.withdrawn_by = uid
        rl.withdraw_reason = args.p_reason
        return [{ release_key: rl.release_key, withdrawn_at: rl.withdrawn_at, changed: true }]
      }
      case 'story_admin_list_slots': {
        this.requireStaff(actor, 'curator')
        return [...this.state.slots].sort((a, b) => (a.work_key + a.edition_key < b.work_key + b.edition_key ? -1 : 1)).map((s) => {
          const versions = this.state.versions.filter((v) => v.slot_id === s.id)
          const reviews = this.state.reviews.filter((r) => versions.some((v) => v.id === r.edition_version_id))
          const releases = this.state.releases.filter((rl) => rl.slot_id === s.id)
          return {
            slot_id: s.id, work_key: s.work_key, edition_key: s.edition_key, kind: s.kind, coverage: s.coverage, source_id: s.source_id, policy_id: s.policy_id,
            latest_version_id: this.latest(s.id)?.id ?? null, version_count: versions.length, review_count: reviews.length,
            qualifying_review_count: reviews.filter((r) => r.qualifies).length,
            live_release_key: releases.find((rl) => rl.withdrawn_at === null)?.release_key ?? null,
            withdrawn_release_count: releases.filter((rl) => rl.withdrawn_at !== null).length,
          }
        })
      }
      case 'story_admin_get_bundle': {
        this.requireStaff(actor, 'curator')
        const version = this.state.versions.find((v) => v.id === args.p_edition_version_id)
        if (!version) throw new StoryRaise('story:edition_version_not_found')
        const slot = this.state.slots.find((s) => s.id === version.slot_id)!
        const source = this.state.sources.find((s) => s.id === slot.source_id)!
        const policy = this.state.policies.find((p) => p.id === slot.policy_id)!
        const binding = this.binding(version)
        const bindingSha = sha256Canonical(binding)
        const rightsOk = this.rightsOk(source)
        const latestRights = new Map<string, Json>()
        for (const d of [...this.state.rights].filter((d) => d.source_id === source.id).sort((a, b) => a.seq - b.seq)) latestRights.set(d.asset, d)
        return {
          source: { id: source.id, meta: source.snapshot_meta, body: source.body, text_sha256: source.text_sha256, identity_sha256: source.identity_sha256, correspondence: source.correspondence, library_book_id: null, registered_by: source.registered_by, registered_at: source.registered_at },
          policy: { id: policy.id, policy: policy.policy, policy_sha256: policy.policy_sha256 },
          slot: { id: slot.id, edition_key: slot.edition_key, production: slot.production, target_sha256: slot.target_sha256 },
          version: { id: version.id, artifact: version.artifact, edition_sha256: version.edition_sha256, activities_sha256: version.activities_sha256, submitted_by: version.submitted_by, submitted_at: version.submitted_at, is_latest: this.latest(slot.id)?.id === version.id },
          reviews: this.state.reviews.filter((r) => r.edition_version_id === version.id).map((r) => ({ id: r.id, review: r.review, review_sha256: r.review_sha256, verdict: r.verdict, qualifies: r.qualifies, submitted_by: r.submitted_by, submitted_at: r.submitted_at })),
          validation: { binding, binding_sha256: bindingSha, attested: this.state.attestations.some((a) => a.edition_version_id === version.id && a.binding_sha256 === bindingSha) },
          rights_ok: rightsOk,
          rights: [...latestRights.values()].sort((a, b) => (a.asset < b.asset ? -1 : 1)).map((d) => ({ asset: d.asset, status: d.status, basis: d.basis, evidence_ref: d.evidence_ref, decided_by: d.decided_by, decided_at: d.decided_at })),
          releases: this.state.releases.filter((rl) => rl.slot_id === slot.id).map((rl) => ({ release_key: rl.release_key, published_at: rl.published_at, withdrawn_at: rl.withdrawn_at, available: rl.withdrawn_at === null && rightsOk })),
        }
      }
      case 'story_service_validation_input': {
        if (!service) throw new StoryRaise('story:service_role_required')
        const version = this.state.versions.find((v) => v.id === args.p_edition_version_id)
        if (!version) throw new StoryRaise('story:edition_version_not_found')
        const slot = this.state.slots.find((s) => s.id === version.slot_id)!
        const source = this.state.sources.find((s) => s.id === slot.source_id)!
        const policy = this.state.policies.find((p) => p.id === slot.policy_id)!
        return {
          edition_version_id: version.id,
          edition_key: slot.edition_key,
          snapshot: { ...source.snapshot_meta, text: source.body, text_sha256: source.text_sha256 },
          policy: policy.policy,
          artifact: version.artifact,
          reviews: this.state.reviews.filter((r) => r.edition_version_id === version.id).sort((a, b) => (a.review_sha256 < b.review_sha256 ? -1 : 1)).map((r) => r.review),
        }
      }
      case 'story_service_attest_validation': {
        if (!service) throw new StoryRaise('story:service_role_required')
        const version = this.state.versions.find((v) => v.id === args.p_edition_version_id)
        if (!version) throw new StoryRaise('story:edition_version_not_found')
        const binding = this.binding(version)
        if (binding.review_sha256s.length === 0) throw new StoryRaise('story:review_missing')
        const a = args.p_attestation as Json
        if (!a || typeof a !== 'object' || Array.isArray(a)) throw new StoryRaise('story:attestation_invalid', 'not an object')
        if (Object.keys(a).sort().join(',') !== 'binding,checks,schema,validated_at,validator') throw new StoryRaise('story:attestation_invalid', 'keys')
        if (a.schema !== 'lcp-story/validation-attestation@1' || sha256Canonical(a.validator) !== sha256Canonical(VALIDATOR)) throw new StoryRaise('story:attestation_invalid', 'schema/validator')
        if (sha256Canonical(a.checks) !== sha256Canonical({ snapshot: 'valid', policy: 'valid', edition: 'valid', reviews: 'valid' })) throw new StoryRaise('story:attestation_invalid', 'checks')
        const at = new Date(String(a.validated_at)).getTime()
        if (!Number.isFinite(at)) throw new StoryRaise('story:attestation_invalid', 'validated_at')
        if (at > this.now.getTime() + 30_000) throw new StoryRaise('story:time_in_future')
        if (sha256Canonical(a.binding) !== sha256Canonical(binding)) throw new StoryRaise('story:attestation_binding_mismatch')
        const sha = sha256Canonical(binding)
        const existing = this.state.attestations.find((x) => x.edition_version_id === version.id && x.binding_sha256 === sha)
        if (existing) return [{ attestation_id: existing.id, binding_sha256: sha, created: false }]
        const row = { id: this.id(), edition_version_id: version.id, binding_sha256: sha, validator: VALIDATOR, actor_kind: 'service_validator' }
        this.state.attestations.push(row)
        return [{ attestation_id: row.id, binding_sha256: sha, created: true }]
      }
      default:
        throw new StoryRaise('story:unknown_rpc', fn)
    }
  }

  rpc(fn: string, args: Json, actor: Actor | null, service: boolean): StoryRpcResponse {
    const fault = this.state.faults[fn]
    if (fault && fault.times > 0) {
      fault.times -= 1
      if (fault.kind === 'network') {
        this.state.rpc_log.push({ fn, actor: actor?.uid ?? null, result: 'network' })
        throw new Error('fetch failed')
      }
      this.state.rpc_log.push({ fn, actor: actor?.uid ?? null, result: 'error', code: fault.message })
      return { data: null, error: { message: fault.message ?? 'story:rpc_failed' } }
    }
    try {
      const data = this.call(fn, args ?? {}, actor, service)
      this.state.rpc_log.push({ fn, actor: service ? null : actor?.uid ?? null, result: 'ok' })
      return { data, error: null }
    } catch (e) {
      if (!(e instanceof StoryRaise)) throw e
      this.state.rpc_log.push({ fn, actor: service ? null : actor?.uid ?? null, result: 'error', code: e.code })
      return { data: null, error: { message: e.code, details: e.details } }
    }
  }
}

/** 하네스 대역이 보낸 인자 — FormData 는 { __formData: [[k, string | { __file, name, type, text }]] } */
function decode(v: unknown): unknown {
  if (v && typeof v === 'object' && '__formData' in (v as Json)) {
    const form = new FormData()
    for (const [k, val] of (v as Json).__formData as [string, unknown][]) {
      if (val && typeof val === 'object' && (val as Json).__file) {
        const f = val as Json
        form.append(k, new File([f.text as string], f.name as string, { type: (f.type as string) || 'application/json' }))
      } else form.append(k, String(val))
    }
    return form
  }
  return v
}

export async function runAction(action: string, rawArgs: unknown[], db: FakeStoryDb, actor: Actor | null, now: Date): Promise<unknown> {
  const client = {
    auth: { getUser: async () => ({ data: { user: actor ? { id: actor.uid } : null }, error: null }) },
    from: () => ({
      select: () => ({
        eq: (_c: string, uid: string) => ({
          maybeSingle: async () => ({ data: actor && actor.uid === uid ? { role: actor.role, status: actor.status } : null, error: null }),
        }),
      }),
    }),
    rpc: async (fn: string, args?: Record<string, unknown>) => db.rpc(fn, (args ?? {}) as Json, actor, false),
  } as unknown as StoryRpcClient
  const service: StoryServiceClient = { rpc: async (fn, args) => db.rpc(fn, (args ?? {}) as Json, null, true) }
  const deps: StoryDeps = { client, now: () => now }
  const args = rawArgs.map(decode)
  switch (action) {
    case 'listStorySlotsAction': return listStorySlots(deps)
    case 'loadStoryBundleAction': return loadStoryBundle(deps, args[0])
    case 'checkStoryCandidateAction': return checkStoryCandidate(deps, args[0] as FormData)
    case 'registerStoryCandidateAction': return registerStoryCandidate(deps, args[0] as FormData)
    case 'submitStoryReviewAction': return submitStoryReview(deps, args[0] as FormData)
    case 'recordStoryRightsAction': return recordStoryRights(deps, args[0])
    case 'attestStoryValidationAction': return attestStoryValidation({ ...deps, createServiceClient: () => service }, args[0])
    case 'publishStoryAction': return publishStory(deps, args[0])
    case 'withdrawStoryAction': return withdrawStory(deps, args[0], args[1])
    default: throw new Error(`unknown story action ${action}`)
  }
}

async function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8')) as { action: string; args: unknown[]; statePath: string; actor: Actor | null; now: string }
  const state: FakeState = fs.existsSync(input.statePath) ? (JSON.parse(fs.readFileSync(input.statePath, 'utf8')) as FakeState) : emptyState()
  const before = state.rpc_log.length
  const now = new Date(input.now)
  const db = new FakeStoryDb(state, now)
  const value = await runAction(input.action, input.args, db, input.actor, now)
  fs.writeFileSync(input.statePath, JSON.stringify(state))
  process.stdout.write(JSON.stringify({ value, rpc_calls: state.rpc_log.slice(before) }))
}

if (process.argv[1] && /s4-harness-eval\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) void main()
