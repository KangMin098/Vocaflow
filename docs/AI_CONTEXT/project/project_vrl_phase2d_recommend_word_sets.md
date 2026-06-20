> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2d_recommend_word_sets.md
> category: project

---

Phase 2D — `recommend_word_sets_for_user(p_user_id UUID)` 함수 적용 완료 2026-05-25. 진단(2B.1+2A.2) → current_v_level → 단어장(2C.1) 추천 loop 완성.

**Migration**: `vrl_phase2d_recommend_word_sets` + `vrl_phase2d_recommend_word_sets_fix` (UNION ALL ORDER BY 제약 fix).

**함수 시그니처**:
```sql
recommend_word_sets_for_user(p_user_id UUID)
RETURNS TABLE (
  set_id UUID, slug TEXT, title TEXT, category TEXT,
  word_count INT, cover_emoji TEXT,
  recommendation_type TEXT,  -- 'fallback' | 'primary' | 'stretch' | 'review'
  reason TEXT,                -- 한국어 추천 근거
  priority INT                -- 1=highest
)
```

**추천 로직 (3-tier + fallback)**:
| type | logic | priority |
|---|---|---:|
| **fallback** | current_v_level NULL/0 → auto-vlevel-v3 (한국 학습자 평균 entry point) | 1 |
| **primary** | auto-vlevel-v{N} (현재 V-Level) | 1 |
| **stretch** | auto-vlevel-v{N+1} (Krashen i+1) — V9 미만일 때 | 2 |
| **review** | auto-vlevel-v{N-1} (이전 V-Level 보강) — V1 초과일 때 | 3 |

**Edge cases**:
- V11 입력 → V9로 clamp (V10/V11 단어장 미발행)
- V1 → review 없음 (이전 V-Level 단어장 없음)
- V9 → stretch 없음 (V10 단어장 미발행)
- NULL/V0 → fallback (진단 미완료)

**Smoke test 결과 (5/5 PASS)**:
| scenario | primary | stretch | review |
|---|---|---|---|
| NULL/V0 | fallback V3 | — | — |
| V1 | V1 (기초 V1) | V2 (기초 V2) | — |
| V5 | V5 (중학 V5) | V6 (고등 V6) | V4 (중학 V4) |
| V9 | V9 (TOEFL/IELTS) | — | V8 (대학·TOEIC) |
| V11→clamp | V9 | — | V8 |

**한국 학습자 정합**:
- Krashen i+1 hypothesis 자동 적용 (stretch 단어장)
- 3-tier 추천 = 한국 학습자 자율성 + 균형 (primary 집중 + stretch 도전 + review 견고화)
- specialty 단어장은 별도 user opt-in (Phase 2D.2 — 관심 도메인 입력 후 분기 예정)

**활용 흐름 (전체 loop)**:
1. 사용자 진단 시작 → `vrl_diagnostic_tests` (Phase 2B.1, 40 문항)
2. 응답 → `INSERT user_diagnostic_results`
3. `analyze_and_apply_diagnostic_result()` 호출 (Phase 2A.2) → user_profiles.current_v_level UPDATE + snapshot
4. **`recommend_word_sets_for_user()`** 호출 → 3-tier 추천 받음
5. Frontend WordVault hub에서 3개 단어장 카드 표시 (primary/stretch/review)
6. 사용자 자율 선택 → `user_word_set_subscriptions` INSERT
7. Library 단어 추출에서도 Krashen i+1 자동 가중치 ([adaptive-extract.ts](apps/web/src/lib/library/adaptive-extract.ts))

**확장 예정 (Phase 2D.2)**:
- 사용자 관심 도메인 입력 (의학/비즈니스/문학/학술) → specialty 단어장 추천 분기
- track_levels(csat_korean/business_english/academic_english) 기반 분기
- 학습 활동 누적 (learning_records) 기반 V-Level 자동 상향 (FSRS mastery 결합)

**Phase 2 진척**:
- ✅ 2B.1 진단 시드 (40 문항)
- ✅ 2A.2 analyze + apply 함수
- ✅ 2C.1 V-Level별 단어장 9개 (1,600 row)
- ✅ 2C.2 specialty 단어장 4개 (902 row)
- ✅ **2D 단어장 추천 함수** (이 문서)
- ⏳ 2D.2 specialty 추천 (opt-in)
- ⏳ 2B.2 track/domain 진단
- ⏳ Frontend `/diagnostic` 라우트

관련: [[vrl-phase2c1-auto-vlevel-word-sets]] [[vrl-phase2c2-specialty-word-sets]] [[vrl-phase2a2-analyze-apply]] [[vrl-phase2b1-diagnostic-seed]] [[claude-code-is-llm]]

