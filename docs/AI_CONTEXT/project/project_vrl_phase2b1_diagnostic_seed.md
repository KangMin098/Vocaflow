> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2b1_diagnostic_seed.md
> category: project

---

Phase 2B.1 — VRL Placement v1 진단 시드 발행 완료 2026-05-25. shared_dictionary 100% 분류 완성 직후 첫 활용 시스템 진입.

**Test record**:
- test_id: `36b70feb-1d5c-4034-ae68-749180d00b73`
- name_ko: "VRL Placement v1 — V-Level 12단계 진단"
- test_type: 'base_v_level' (CHECK 제약: base_v_level/track/domain/comprehensive)
- target_axis: 'v_level'
- question_count: 40
- estimated_minutes: 5
- is_active: true

**문항 분포 (40 row, V-Level별 정합)**:
| V | qty | 단어 (frequency_rank ASC + NGSL + substantive POS + length≥3 + alphabetic) |
|---|---:|---|
| V1 | 5 | were, are, been, being, was (be 동사 변형 frequency_rank=2 top tier) |
| V2 | 5 | saying, canned, outing, takings, backing |
| V3 | 4 | travel, round, park, enter |
| V4 | 4 | reasoning, parenting, relationship, quality |
| V5 | 4 | accounting, therefore, funding, vote |
| V6 | 4 | accord, thus, defining, administration |
| V7 | 4 | birding, birthing, branding, casting |
| V8 | 4 | narrows, sperm, spelt, fiscal |
| V9 | 3 | solicitor, empirical, glow |
| V10 | 2 | beam, matrix |
| V11 | 1 | concertacion (도달 확인용) |

**선정 기준 SQL**:
```sql
v_level BETWEEN 1 AND 11
AND skill_level = 3 (single word)
AND meaning_ko IS NOT NULL AND LENGTH(meaning_ko) > 0
AND LENGTH(word) >= 3 (skip 1-2 letter artifacts)
AND word ~ '^[a-z]+$' (alphabetic only)
AND (list_tags @> ARRAY['ngsl_1.2'] OR v_level >= 9)
AND pos IN ('noun','verb','adjective','adverb')
ORDER BY frequency_rank ASC NULLS LAST
ROW_NUMBER per V-Level
```

**difficulty_weight**: linear v_level/11 = 0.09 (V1) ~ 1.00 (V11)

**한국 학습자 정합**:
- V1-V2 (10) = 유아-초3 NGSL 핵심 (be 동사 + A2 inflected forms)
- V3-V4 (8) = 초4-중1
- V5-V7 (12) = 중2-수능 (한국 학습자 cohort 핵심 영역)
- V8 (4) = 대학 영어 진입
- V9-V10 (5) = 대학원/전문
- V11 (1) = 도달 확인용 (대부분 사용자 미도달)

**사전 INSERT 검토**:
- V1 5개 모두 be 변형 — 다양성 부족하지만 frequency_rank=2 top tier 정합. 대안: NGSL 더 확장 시 cat/run/big 등 추가 가능 (현재 단순 SELECT는 frequency_rank=2 5개를 모두 선정)
- V11 "concertacion" — 외래어 (Spanish-origin), 일반 학습자 거의 모름 → 도달 확인 용도 적합

**활용 흐름**:
1. 사용자가 진단 시작 (test_id 호출)
2. 40 문항 순차 표시 (display_order ASC)
3. 각 문항에 대해 "알아요/모릅니다" 응답 → user_diagnostic_results 저장
4. 응답 분석:
   - 각 V-Level 권역 정답률 계산
   - 마지막 정답률 ≥70% V-Level → current_v_level 셋팅
5. user_profiles.current_v_level 갱신
6. Library 단어 추출에서 Krashen i+1 가중치 즉시 활성화 ([adaptive-extract.ts:122-134](apps/web/src/lib/library/adaptive-extract.ts#L122-L134))

**Why**: VRL v3 100% 분류 완성 후 첫 활용 시스템 진입. 진단 시드 없이는 사용자 V-Level 측정 불가 → Krashen i+1 비활성 → Library 단어 추출 단순 base_learning_value만 사용. 진단 시드 = 활용 시스템의 시작점.

**How to apply**:
- Frontend: `/diagnostic` 라우트 신규 또는 `/onboarding` flow 통합
- API: vrl_diagnostic_tests 조회 → questions 순차 표시 → user_diagnostic_results INSERT → current_v_level 계산 + user_profiles UPDATE
- UX: 5분 짧은 진단, "알아요/모릅니다" 2지선다 (Recognition 메타인지)
- Phase 2 다음: results 분석 함수 + UI 구현

**다음 단계 후보**:
- **Phase 2A.2 wiring**: 진단 결과 분석 + user_profiles.current_v_level UPDATE 함수
- Phase 2C.1: 자동 단어장 발행 (V-Level별)
- Phase 2C.2: specialty 단어장 (의학/금융/영문학)
- Phase 2B.2: track/domain별 진단 추가 (csat_korean/business_english/etc)

관련: [[vrl-v3-round10-l11-done]] [[vrl-v3-day1-done]] [[claude-code-is-llm]]

