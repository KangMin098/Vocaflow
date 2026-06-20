> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2a2_analyze_apply.md
> category: project

---

Phase 2A.2 — 진단 결과 분석 + user_profiles.current_v_level UPDATE 인프라 완료 2026-05-25.

**Migration**: `vrl_phase2a2_analyze_diagnostic_result` (apply_migration 적용).

**기존 인프라 보존 결정**:
- Day 2 시점에 `apply_diagnostic_result(p_diagnostic_id UUID) RETURNS uuid` 이미 존재 (update_user_v_level 헬퍼 호출 패턴)
- 기존 시그니처 `RETURNS uuid` 변경 시 dependent code 충돌 가능 → **DROP 안함, 신규 함수만 추가**

**신규 함수 2개**:

1. **`analyze_diagnostic_result(p_result_id UUID)`** — 응답 분석만
   - Input: `user_diagnostic_results.responses` JSONB `[{question_id, knew}]`
   - JOIN `vrl_diagnostic_questions` → V-Level별 정답률 집계
   - estimated_v_level: ≥70% accuracy 마지막 V-Level
   - confidence: weighted avg (total correct / total questions)
   - per_level: V-Level별 {correct, total, accuracy} JSONB
   - SECURITY DEFINER + search_path='public'

2. **`analyze_and_apply_diagnostic_result(p_result_id UUID)`** — 편의 wrapper
   - 1) analyze 호출
   - 2) UPDATE user_diagnostic_results SET estimated_v_level, confidence
   - 3) call existing apply_diagnostic_result (user_profiles + snapshot via update_user_v_level)
   - Frontend 진단 종료 시 1 호출만으로 전체 처리

**Smoke test 결과** (2026-05-25):
- mock 사용자 (V1-V5 100% / V6 50% / V7-V11 0%)
- 출력:
  - estimated_v_level = **5** (V6 0.50 < 0.70 threshold)
  - confidence = 0.600 (24/40)
  - per_level 정확 집계 ✓
- 한국 placement 70% threshold 정확 작동

**한국 학습자 정합**:
- 70% threshold = 한국 placement test 표준 (어휘 인지 70% 이상 → 해당 V-Level 마스터)
- V0 empty 보존 (default fallback V1)
- weighted avg confidence — V-Level별 문항 수 불균형(V1=5, V11=1) 자연 정합

**활용 흐름** (Frontend):
1. 사용자 진단 시작 → vrl_diagnostic_tests 조회 → questions 순차 표시
2. 응답 수집: `[{question_id, knew}, ...]`
3. INSERT `user_diagnostic_results` (user_id, test_id, responses)
4. Call `analyze_and_apply_diagnostic_result(result_id)` → snapshot_id + estimated_v_level 반환
5. Frontend: "당신의 V-Level은 V5입니다" 결과 표시
6. **Library 단어 추출 Krashen i+1 즉시 활성화** ([adaptive-extract.ts:122-134](apps/web/src/lib/library/adaptive-extract.ts#L122-L134))

**검증 호출 예시**:
```sql
-- 사용자 진단 응답 INSERT 후
SELECT * FROM analyze_and_apply_diagnostic_result('<result_id>');
-- snapshot_id, estimated_v_level, confidence, per_level 반환

-- user_profiles 확인
SELECT user_id, current_v_level, current_v_level_meta, diagnostic_completed_at
FROM user_profiles WHERE user_id = '<user_id>';

-- snapshot chain 확인
SELECT v_level, previous_v_level, v_level_delta, taken_reason, taken_at
FROM user_level_snapshots WHERE user_id = '<user_id>' ORDER BY taken_at DESC;
```

**다음 단계**:
- **Frontend `/diagnostic` 라우트** 구현 (40 문항 UI + 응답 수집 + API 호출)
- **Phase 2B.2**: track/domain 축 진단 추가 (csat_korean/business_english/medical 등)
- **Phase 2C.1**: V-Level별 자동 단어장 발행 (분류된 38,598 row 활용)
- **Phase 2C.2**: specialty 단어장 (의학/금융/영문학)

**Why**: 진단 시드 (Phase 2B.1) 발행 직후 분석 함수 추가 — 진단이 단순 데이터 수집에서 끝나지 않고 **자동으로 user_profiles.current_v_level 셋팅 + snapshot audit chain 기록 + Library Krashen i+1 활성화**까지 1 호출에 완성.

관련: [[vrl-phase2b1-diagnostic-seed]] [[vrl-v3-round10-l11-done]] [[claude-code-is-llm]]

