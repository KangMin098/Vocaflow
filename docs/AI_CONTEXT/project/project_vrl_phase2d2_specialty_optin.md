> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2d2_specialty_optin.md
> category: project

---

Phase 2D.2 — `recommend_word_sets_for_user(uuid, text[])` 시그니처 확장 완료 2026-05-25. 진단(V-Level) + 관심 도메인(specialty) 통합 추천.

**Migration 시퀀스**:
1. `vrl_phase2d2_recommend_with_specialty_optin` — 2-arg 버전 추가 (CREATE OR REPLACE 안됨, 다른 시그니처)
2. `vrl_phase2d2_drop_old_overload_explicit_go` — 사용자 명시 GO 옵션 A로 Phase 2D 1-arg DROP (overload 모호 해결)

**함수 시그니처 (최종)**:
```sql
recommend_word_sets_for_user(
  p_user_id UUID,
  p_interests TEXT[] DEFAULT NULL  -- 'medical','business','literary','academic'
)
RETURNS TABLE (
  set_id, slug, title, category, word_count, cover_emoji,
  recommendation_type,  -- 'fallback' | 'primary' | 'stretch' | 'review' | 'specialty'
  reason, priority      -- specialty = priority 4
)
```

**4-tier 추천 로직** (Phase 2D 3-tier + specialty):
| type | logic | priority |
|---|---|---:|
| fallback | current_v_level NULL/0 → auto-vlevel-v3 | 1 |
| primary | auto-vlevel-v{N} | 1 |
| stretch | auto-vlevel-v{N+1} (Krashen i+1) | 2 |
| review | auto-vlevel-v{N-1} | 3 |
| **specialty** | **specialty-{interest} (medical/business/literary/academic)** | **4** |

**Backward compat**:
- `recommend_word_sets_for_user('uuid')` — 1-arg 호출 → DEFAULT NULL → 기존 3-tier만 (Phase 2D 호환)
- `recommend_word_sets_for_user('uuid', ARRAY['medical'])` — 2-arg → 3-tier + specialty

**Smoke test 결과 (모두 PASS)**:
| scenario | output rows |
|---|---|
| V5 + ARRAY['medical','business'] | 5 (primary V5 + stretch V6 + review V4 + specialty business + specialty medical) |
| V5 (no interests, 1-arg) | 3 (primary V5 + stretch V6 + review V4) |

**한국 학습자 정합**:
- specialty 4 도메인 모두 한국 시장 정합 (의대/TOEIC/영문학/유학)
- opt-in 방식 — 사용자 자율성 보존 (SDT)
- 진단 미완료라도 관심사가 있으면 specialty 추천 가능 (fallback V3 + specialty)
- 진단 완료 + interests → 5+ 추천 균형

**E2E 흐름 완성 (Phase 2 통합)**:
1. 사용자 진단 시작 → `vrl_diagnostic_tests` (2B.1, 40 문항)
2. INSERT user_diagnostic_results
3. `analyze_and_apply_diagnostic_result()` (2A.2) → user_profiles.current_v_level UPDATE
4. Frontend: 관심 도메인 선택 UI (medical/business/literary/academic 다중 선택)
5. **`recommend_word_sets_for_user(user_id, interests)`** → 3-tier + specialty 추천 받음
6. WordVault hub에서 카드 표시
7. 자율 구독 → user_word_set_subscriptions
8. Library 단어 추출 Krashen i+1 활성화 ([adaptive-extract.ts](apps/web/src/lib/library/adaptive-extract.ts))

**Phase 2 진척 (DB 인프라 완료)**:
- ✅ 2A.2 analyze + apply 함수
- ✅ 2B.1 진단 시드 40문항
- ✅ 2C.1 V-Level별 단어장 9개 (1,600 row)
- ✅ 2C.2 specialty 단어장 4개 (902 row)
- ✅ 2D 단어장 추천 함수 (3-tier)
- ✅ **2D.2 specialty opt-in 확장** (이 문서)
- ⏳ 2B.2 track/domain 진단 (옵션)
- ⏳ Frontend `/diagnostic` 라우트
- ⏳ WordVault hub 추천 카드 UI

**다음 단계**:
- Frontend 구현 (`/diagnostic` 40문항 + WordVault hub 추천 카드)
- 또는 Phase 2B.2 (track/domain 진단 — csat_korean/business_english/medical 등 축별)
- 또는 학습 활동 누적 기반 자동 V-Level 상향 (FSRS mastery 결합)

관련: [[vrl-phase2d-recommend-word-sets]] [[vrl-phase2c1-auto-vlevel-word-sets]] [[vrl-phase2c2-specialty-word-sets]] [[vrl-phase2a2-analyze-apply]] [[vrl-phase2b1-diagnostic-seed]] [[claude-code-is-llm]]

