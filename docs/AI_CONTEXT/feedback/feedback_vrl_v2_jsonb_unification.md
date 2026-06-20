> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/feedback_vrl_v2_jsonb_unification.md
> category: feedback

---

VRL Profile v2 의 SSoT 핵심 테이블(user_profiles)에서는 V-Level/Track/Domain/Skill 4축의 신뢰도·source·status·confidence·estimated_at 메타를 반드시 **단일 JSONB 컬럼**(`current_v_level_meta` 등)에 통합한다. `v_level_source` / `v_level_confidence` / `v_level_meta` 식으로 컬럼을 분리해 제안하면 안 됨.

**Why:** v2 설계 원칙 #1 — 4축 메타 구조 통일성이 함수/스냅샷/재평가 로직의 단순성을 좌우. 컬럼 분리 시 1년 후 정정 비용 수개월. 2026-05-26 Migration 2 정정 시 사용자가 명시.

**How to apply:**
- user_profiles 의 4축 메타 신규 추가 → 항상 `<axis>_meta JSONB` 단일 컬럼 형태
- JSONB 표준 키 5종: `level` / `source` / `confidence` / `estimated_at` / `status` (+ optional `diagnostic_result_id`)
- source enum 표준: `system_default` / `self_declared` / `diagnostic` / `learning_data` / `manual_override` (← `system_inferred`/`user_declared` 식 금지)
- status enum 표준: `active` / `dormant` / `disabled`
- 검증 가드에 5키 존재 체크 필수
- vocaflow_levels 같은 비-SSoT 테이블은 컬럼 분리 허용 (이미 Migration 1 에서 수용)

[[project_vrl_v3_day1_done]] / [[project_vrl_v3_day2_done]] / [[project_vrl_v3_day3_done]]

