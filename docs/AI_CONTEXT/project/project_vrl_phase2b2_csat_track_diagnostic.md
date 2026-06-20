> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2b2_csat_track_diagnostic.md
> category: project

---

Phase 2B.2 — CSAT Korean track 진단 신규 + track 축 분석 함수 인프라 완료 2026-05-25.

**Migration 시퀀스**:
1. `vrl_phase2b2_csat_korean_track_diagnostic` — test + 32 questions + analyze_track + analyze_and_apply_track 함수
2. `vrl_phase2b2_csat_questions_strict_filter` — questions 품질 개선 (csat-prep tag 강제)

**Test record**:
- name_ko: 'CSAT 빈출 어휘 진단 (csat_korean track)'
- test_type: 'track'
- target_axis: 'csat_korean'
- target_track_id: 'csat_korean'
- question_count: 32
- estimated_minutes: 4

**문항 분포 (V-Level 기반 난이도, csat-prep tag 강제)**:
| V | qty | sample |
|---|---:|---|
| V2 | 4 | cost, decide, comment, positive |
| V3 | 3 | career, architecture, fiction |
| V4 | 5 | reasoning, parenting, relationship, fund, measure |
| V5 | 5 | (B1 CSAT 핵심) |
| V6 | 5 | (B2 CSAT) |
| V7 | 5 | (수능 핵심) |
| V8 | 4 | (수능 고난도) |
| 합계 | 32 | |

**선정 SQL (strict filter)**:
```sql
v_level BETWEEN 2 AND 8
AND skill_level = 3
AND meaning_ko present
AND length >= 3 AND alphabetic
AND pos substantive
AND list_tags @> ['csat-prep-core-2k'] OR ['csat-prep-ext-1.8k']
ORDER BY frequency_rank ASC NULLS LAST
ROW_NUMBER per v_level
```

**Semantic 결정**:
- `target_track_level` 컬럼에 V-Level (2-8) 저장 — csat-prep tag 강제 + V-Level은 한국 학습자 cohort 난이도 proxy
- Round 8 fel template 영향으로 track_levels.csat_korean 값 자체가 noisy → 직접 사용 회피
- Phase 2 후반에 track_levels 정밀화 시 csat_korean=1-10 직접 사용 가능

**신규 함수 2개**:

1. **`analyze_track_diagnostic_result(p_result_id UUID)`**:
   - target_track_level별 정답률 집계
   - estimated_track_level = ≥70% accuracy 마지막 level
   - confidence = weighted avg
   - per_level JSONB
   - track_id = test의 target_track_id (응답에 포함, frontend 활용)

2. **`analyze_and_apply_track_diagnostic_result(p_result_id UUID)`** — 편의 wrapper:
   - 1) analyze 호출
   - 2) UPDATE user_diagnostic_results SET estimated_track_levels = `{<track_id>: <level>}`
   - 3) **UPDATE user_profiles.current_track_levels JSONB ||= `{<track_id>: <level>}`** (merge — 다른 track 보존)
   - snapshot 미생성 (track 축은 V-Level과 별개 측정)

**Smoke test PASS**:
- mock V2-V5 100% / V6 40% / V7-V8 0% → estimated=5, confidence=0.613, per_level 정확
- 70% threshold 정확 작동
- track_id='csat_korean' 반환

**한국 학습자 정합**:
- CSAT (한국 수능) = 최강 한국 시장 정합 트랙
- csat-prep tag 강제로 진단 정확도 확보
- V-Level 기반 난이도 분포 = 초3-고2 수능 학습자 자연 흐름
- 4분 단축 진단 (40문항 base_v_level 5분보다 짧음)

**활용 흐름**:
1. 사용자 base_v_level 진단 완료 (Phase 2B.1)
2. /diagnostic 페이지에 "CSAT 빈출 진단" 추가 옵션 (UI wire-up Phase 3)
3. 진단 → analyze_and_apply_track → user_profiles.current_track_levels.csat_korean 셋팅
4. (Phase 2 후반) recommend_word_sets_for_user 확장 — csat_korean ≥6 사용자에게 KICE 단어장 우선 추천
5. 다른 track (business_english, academic_english) 동일 패턴 가능

**확장 가능 영역 (Phase 2B.3+)**:
- Business English track (bsl 강제) — TOEIC/OPIc
- Academic English track (nawl 강제) — TOEFL/IELTS
- Domain 진단 (medical/finance/literary) — 도메인별 측정
- analyze_and_apply_track 함수는 모든 track 공통 사용 가능 (track_id 동적)

**Phase 2 진척 (이 세션 누적)**:
- ✅ 2A.2 / 2B.1 / 2C.1 / 2C.2 / 2D / 2D.2 / 2E
- ✅ Frontend: /diagnostic + Sidebar + WordVault hub 추천 + Set wire-up + Phase 2E UI + history timeline + history 통합
- ✅ **2B.2 CSAT track 진단 + analyze_track 함수** (이 문서)
- ⏳ track 진단 frontend wire-up (별도 phase)
- ⏳ pg_cron 자동 promotion

관련: [[vrl-phase2b1-diagnostic-seed]] [[vrl-phase2a2-analyze-apply]] [[vrl-v3-round8-l9-done]] [[claude-code-is-llm]]

