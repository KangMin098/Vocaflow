// scripts/db/factory-i1/spec.mjs
//
// Factory I1 배포 패키지의 고정 사양 — 정본 SHA · migration 버전 · 허용 객체 목록 · 전제 객체.
// 허용 목록은 격리 PostgreSQL 17 에서 원본 C→B→S(DB-1) · P(DB-2)를 올린 카탈로그 diff 실측(2026-10-17)을
// 승인 패키지 §3(docs/csat-learner/v62/FACTORY_I1_APPROVAL_PACKAGE.md)과 한 줄씩 대조해 고정했다. 손으로 늘리지 않는다 —
// 바꾸려면 SQL 정본이 바뀐 것이고, 그건 새 승인이다.

export const PROJECT_REF = 'jajenrevcbmrpaliomxv'
export const PRIOR_MAX_VERSION = '20261014091841' // 2026-10-17 읽기 전용 실측 — 이력 722행의 최댓값

export const SOURCES = {
  C: { file: '_pending_workspace_supply_c_qualification.sql', sha256: 'dd940568ef7170212bf23ac9f7fb89bb090e8f529eeb4c26bb9ccdbc1e503f66' },
  B: { file: '_pending_workspace_supply_b_orders.sql', sha256: 'e3f929d06f20518495682a36e0d1f8f483988f2a39feabd3e5d490c02a5293b2' },
  S: { file: '_pending_workspace_supply_i1_safety.sql', sha256: 'cc3d91001fc21800171c8210c3142ea9d6ef35facb7df877f88e4f0a97a3b6de' },
  P: { file: '_pending_workspace_supply_i1_partial.sql', sha256: '79807c38244982389ad2eb25b36350bc7121a84cc10b5ab54a1293b758e95041' },
}

export const STAGES = {
  db1: {
    version: '20261017200000',
    name: 'factory_i1_db1_supply_foundation',
    path: 'supabase/migrations/20261017200000_factory_i1_db1_supply_foundation.sql',
    segments: ['C', 'B', 'S'],
  },
  db2: {
    version: '20261017200100',
    name: 'factory_i1_db2_partial',
    // supabase/migrations 밖 — CI · supabase CLI · 어떤 러너도 DB-1 과 함께 집어 가지 못한다. 승격은 DB-1 실DB 검증 뒤 별도 PR.
    path: 'supabase/deploy/factory-i1/db2/20261017200100_factory_i1_db2_partial.sql',
    segments: ['P'],
  },
}

/** DB-1 이 새로 만드는 대상(하나라도 이미 있으면 DEPLOY_BLOCKED) */
export const DB1_TARGET_TABLES = ['content_qualification', 'content_release_approval', 'content_release_revocation',
  'workspace_content_demand', 'workspace_content_demand_line', 'factory_order', 'factory_order_event', 'workspace_content_delivery']
export const DB1_TARGET_FUNCTIONS = ['forbid_ledger_mutation', 'fq_axes_valid', 'fq_role_ok', 'content_qualification_record',
  'content_release_approve', 'content_release_revoke', 'ledger_writer_guard', 'factory_order_state_guard', 'workspace_demand_record',
  'factory_order_open', 'factory_order_transition', 'supply_artifact_revision', 'supply_learner_exposure', 'workspace_delivery_record',
  'supply_writer_guard', 'supply_delivery_valid']
/** DB-3(D3 · 보류)·I0 delta 의 객체 — DB-1/2 시점에 있으면 승인 밖의 적용이 있었던 것 */
export const FOREIGN_TARGETS = ['factory_product_order', 'factory_order_product_link']

/** 전제 — 2026-10-17 개발 DB 실측으로 모두 있음 */
export const REQUIRED_RELATIONS = ['auth.users', 'public.learner_workspace', 'public.learner_workspace_plan', 'public.csat_map_goal_version',
  'public.csat_items', 'public.csat_dcp_items', 'public.csat_dx_response', 'public.csat_dx_session', 'public.learning_task_attempts',
  'public.learning_sessions', 'public.csat_trap_attempts', 'public.csat_session_attempts', 'public.csat_review_queue', 'public.csat_item_attempts']
export const REQUIRED_FUNCTIONS = ['auth.uid()', 'public.is_admin()', 'public.is_admin_or_curator()', 'public.csat_source_is_eligible(uuid)',
  'public.csat_ec_embargoed_items(text[])']

/** 기존 권한 helper 두 개 — 적용 전 실측값과 DB-1 이 남길 값(본문 · ACL 불변, search_path 끝에 pg_temp) */
export const HELPERS = {
  'is_admin': { before: '{search_path=public}', after: '{"search_path=public, pg_temp"}' },
  'is_admin_or_curator': { before: '{"search_path=public, auth"}', after: '{"search_path=public, auth, pg_temp"}' },
}

const T8 = DB1_TARGET_TABLES
const tbl = (n) => `rel:public.${n}`

export const ALLOW = {
  db1: {
    // 기존 객체 중 바뀌어도 되는 것 = 권한 helper 두 개의 search_path 설정뿐
    changed: ['fn:public.is_admin()', 'fn:public.is_admin_or_curator()'],
    added: [
      // 기존 표 복합 고유키 3(제약 + 그 인덱스) — 데이터 변경 없음
      'con:public.csat_map_goal_version.csat_map_goal_version_id_user_key', 'rel:public.csat_map_goal_version_id_user_key',
      'con:public.learner_workspace.learner_workspace_id_user_key', 'rel:public.learner_workspace_id_user_key',
      'con:public.learner_workspace_plan.learner_workspace_plan_ws_ver_user_key', 'rel:public.learner_workspace_plan_ws_ver_user_key',
      // 새 표 8
      ...T8.map(tbl),
      // 새 표의 인덱스 · 시퀀스
      'rel:public.content_qualification_id_artifact_kind_artifact_ref_artifac_key', 'rel:public.content_qualification_identity',
      'rel:public.content_qualification_pkey', 'rel:public.content_qualification_supersedes_key',
      'rel:public.content_release_approval_pkey', 'rel:public.content_release_approval_qualification_id_scope_key',
      'rel:public.content_release_revocation_pkey',
      'rel:public.factory_order_event_id_seq', 'rel:public.factory_order_event_order_id_request_key_key',
      'rel:public.factory_order_event_order_id_seq_key', 'rel:public.factory_order_event_pkey',
      'rel:public.factory_order_line_id_order_seq_key', 'rel:public.factory_order_one_open_per_line',
      'rel:public.factory_order_pkey', 'rel:public.factory_order_user_id_request_key_key',
      'rel:public.workspace_content_delivery_line_id_artifact_kind_artifact_r_key', 'rel:public.workspace_content_delivery_pkey',
      'rel:public.workspace_content_delivery_user_id_request_key_key',
      'rel:public.workspace_content_demand_id_user_id_workspace_id_key', 'rel:public.workspace_content_demand_line_demand_id_line_no_key',
      'rel:public.workspace_content_demand_line_demand_id_role_task_id_key',
      'rel:public.workspace_content_demand_line_id_user_id_workspace_id_role__key', 'rel:public.workspace_content_demand_line_pkey',
      'rel:public.workspace_content_demand_pkey', 'rel:public.workspace_content_demand_user_id_signature_key',
      // 함수 16(C 7 · B 8 · S 1)
      'fn:public.content_qualification_record(p_rules_version text, p_kind text, p_ref text, p_revision text, p_task text, p_role text, p_axes jsonb, p_source_revision text, p_source_hash text, p_analysis_revision text, p_gold_revision text, p_gold_hash text, p_defects text[], p_evidence_ids text[], p_method text, p_supersedes uuid)',
      'fn:public.content_release_approve(p_qualification uuid, p_scope text, p_note text)',
      'fn:public.content_release_revoke(p_approval uuid, p_reason text)',
      'fn:public.factory_order_open(p_line uuid, p_reason text, p_quantity smallint, p_request_key uuid)',
      'fn:public.factory_order_state_guard()',
      'fn:public.factory_order_transition(p_order uuid, p_expected text, p_to text, p_reason text, p_run_id text, p_qualification uuid, p_request_key uuid)',
      'fn:public.forbid_ledger_mutation()', 'fn:public.fq_axes_valid(p jsonb)', 'fn:public.fq_role_ok(p jsonb, p_role text)',
      'fn:public.ledger_writer_guard()', 'fn:public.supply_artifact_revision(p_kind text, p_ref text)',
      'fn:public.supply_delivery_valid(p_delivery uuid)', 'fn:public.supply_learner_exposure(p_kind text, p_ref text, p_uid uuid)',
      'fn:public.supply_writer_guard()',
      'fn:public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)',
      'fn:public.workspace_demand_record(p_canonical text)',
      // 정책 8(C 3 · B 5) — 모두 SELECT 읽기
      'pol:public.content_qualification.cq_admin_read', 'pol:public.content_release_approval.cra_admin_read',
      'pol:public.content_release_revocation.crr_admin_read', 'pol:public.factory_order.fo_owner_read',
      'pol:public.factory_order_event.foe_owner_read', 'pol:public.workspace_content_delivery.wcdel_owner_read',
      'pol:public.workspace_content_demand.wcd_owner_read', 'pol:public.workspace_content_demand_line.wcdl_owner_read',
      // 트리거 17(C 6 · B 11)
      'trg:public.content_qualification.content_qualification_append_only', 'trg:public.content_qualification.content_qualification_writer',
      'trg:public.content_release_approval.content_release_approval_append_only', 'trg:public.content_release_approval.content_release_approval_writer',
      'trg:public.content_release_revocation.content_release_revocation_append_only', 'trg:public.content_release_revocation.content_release_revocation_writer',
      'trg:public.factory_order.factory_order_no_delete', 'trg:public.factory_order.factory_order_state_guard', 'trg:public.factory_order.factory_order_writer',
      'trg:public.factory_order_event.factory_order_event_append_only', 'trg:public.factory_order_event.factory_order_event_writer',
      'trg:public.workspace_content_delivery.workspace_content_delivery_append_only', 'trg:public.workspace_content_delivery.workspace_content_delivery_writer',
      'trg:public.workspace_content_demand.workspace_content_demand_no_update', 'trg:public.workspace_content_demand.workspace_content_demand_writer',
      'trg:public.workspace_content_demand_line.workspace_content_demand_line_no_update', 'trg:public.workspace_content_demand_line.workspace_content_demand_line_writer',
    ],
    // 새 표의 제약(con:)은 표 정의의 일부 — 표 이름 접두로 허용(제약 이름은 PostgreSQL 이 자동으로 짓는다). 기존 표 제약은 위에 이름으로만.
    addedConstraintTables: T8,
  },
  db2: {
    changed: ['con:public.factory_order.factory_order_state_check', 'rel:public.factory_order_one_open_per_line',
      'fn:public.factory_order_open(p_line uuid, p_reason text, p_quantity smallint, p_request_key uuid)',
      'fn:public.factory_order_transition(p_order uuid, p_expected text, p_to text, p_reason text, p_run_id text, p_qualification uuid, p_request_key uuid)'],
    added: ['fn:public.workspace_line_fulfillment(p_line uuid)'],
    addedConstraintTables: [],
  },
}

/** 쓰기 RPC — anon 실행권이 없어야 한다(독립 수용 §3 · supply-i1-independent.mjs 와 같은 목록) */
export const WRITER_RPCS = ['workspace_demand_record', 'factory_order_open', 'factory_order_transition', 'workspace_delivery_record',
  'content_qualification_record', 'content_release_approve', 'content_release_revoke']
