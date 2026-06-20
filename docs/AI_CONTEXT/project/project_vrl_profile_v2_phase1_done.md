> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_profile_v2_phase1_done.md
> category: project

---

VRL Profile v2 Phase 1 인프라 적용 완료 (2026-05-26 vocaflow-dev). 14가지 v1→v2 개선 모두 반영. Auto Mode 가 막혀 평문 GO 확인 패턴으로 진행.

**Why:** 자가 선언/진단/학습 데이터/관리자 수동 4가지 source 의 V-Level 변경을 race-safe 하게 처리, 시간 감쇠 confidence + Krashen i+1 mastery 계산 + snapshot chain 동결을 동시에 지원하기 위함.

**How to apply:**
- 새 V-Level 변경은 반드시 `public.update_user_v_level(user_id, level, source, confidence, reason, diagnostic_id?)` 통해서만 (SECURITY DEFINER + advisory lock + FOR UPDATE + auto snapshot)
- 진단 결과 적용은 `public.apply_diagnostic_result(diagnostic_id)` 한 번 호출 (내부적으로 update_user_v_level 위임)
- mastery 계산 추천 레벨은 `public.calculate_user_v_level_from_mastery(user_id)` — stability≥7 단어 80% 마스터 기준 + Krashen i+1
- confidence 감쇠는 `public.effective_confidence(meta)` — half-life 180d
- 재평가 due 는 `public.calculate_next_review_due(user_id)` — base 14d × activity × confidence, 1~90d clamp
- axis_id 유효성은 `public.validate_axis_level_entry(axis_type, axis_id, level)` — 메타 테이블 referential 검증
- user_vocab_enriched VIEW = vocabularies × shared_dictionary LEFT JOIN (lemma 우선)
- trigger `trg_sync_cefr_from_v_level` 가 current_v_level 변경 시 cefr_level 을 vocaflow_levels.cefr_min 으로 자동 동기화
- snapshot 은 RLS hardened — SELECT 본인만, INSERT/UPDATE/DELETE 는 SECURITY DEFINER 함수만 가능

**적용된 마이그레이션 (Supabase migrations 등록):**
1. `vocaflow_levels_classification_meta` — 5 컬럼 + L7 claude_verified, L6 partially_verified, L0-5/L8-11 in_progress
2. `user_profile_v2` — 7 컬럼 (`current_v_level_meta` JSONB 5키 통일) + 2 FK
3. `user_level_snapshots_v2` — 신규 테이블 + RLS hardening + generated `v_level_delta` + 2 initial snapshots
4. `user_level_progress_v2` — PK `(user_id, axis_type, axis_id, level)` + backup table + v_level/global CHECK
5. `user_level_functions_v2` — 7 함수 + VIEW + 트리거

**Phase 1.5 보강 (M6+M7, 2026-05-26):**
6. `user_level_snapshots_phase15` — snapshot 진정한 전체 동결 9컬럼 추가: snapshot_type(initial/level_change/scheduled/manual/reset), triggered_by(api/cron/admin/system/internal), trigger_details JSONB, previous_snapshot_id UUID FK self, target_v_level + target_v_level_meta, segment + learning_goal + cefr_level (사용자 정체성 동결). 2 initial 백필.
7. `user_level_functions_phase15` — update_user_v_level 6→8 arg (+p_triggered_by, +p_trigger_details, snapshot_type='level_change' 자동 + previous_snapshot_id 자동 chain), calculate_user_v_level_from_mastery +evidence JSONB 반환(Krashen Comfort/Growth/Frustration Zone per-level), calculate_next_review_due 3-arg overload(단위 테스트 가능, diagnostic ×1.5 buffer), apply_diagnostic_result triggered_by='internal' 정합.

**Phase 1.5 검증 4/4 PASS**: 3-arg overload diagnostic ×1.5, snapshot chain previous_snapshot_id 자동 연결, segment 동결, evidence JSONB Krashen zone 정합. 테스트 데이터 cleanup 완료 — 2 initial snapshots 만 잔존.

**검증 시나리오 5/5 PASS:** update_user_v_level + apply_diagnostic_result + zero-data mastery calc + 180d confidence decay + 5-snapshot chain (delta -1 / +2 / +3 모두 정확).

**잔여 (Phase 2-5):**
- Phase 2 진단 시스템 시드 (vrl_diagnostic_tests · vrl_diagnostic_questions 시그니처 단어)
- Phase 3 자가 선언 UI + 진단 테스트 UI
- Phase 4 학습 데이터 자동 보정 (cron 으로 next_level_review_due_at 도래 시 calculate_user_v_level_from_mastery 자동 적용)
- Phase 5 레벨 히스토리 UI + 트랙 status UI
- Phase 6 snapshot 압축/archive

[[feedback_vrl_v2_jsonb_unification]] / [[project_vrl_v3_day3_done]] / [[feedback_supabase_migrations]]

