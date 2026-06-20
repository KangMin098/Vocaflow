> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_day1_done.md
> category: project

---

VRL v3 (Vocaflow Reading Level) Day 1 인프라 적용 완료 — 2026-05-23.

**적용 내용** (migration `vrl_v3_infrastructure` on vocaflow-dev):
- 메타 테이블 4 신설: `vocaflow_levels` (12 row, level 0-11), `vocaflow_tracks` (6 row 영역 중립 ID), `vocaflow_domains` (8 row), `vocaflow_skills` (5 row)
- `shared_dictionary` +6 컬럼: `v_level` smallint(0-11), `track_levels` jsonb, `domain_levels` jsonb, `skill_type` text, `skill_level` smallint(1-5), `vrl_calculated_at`
- `library_books` +6: `book_vrl_score` (200-1500), `book_v_level`, `lexile_measure`, `lexile_source`, `vrl_components` jsonb, `vrl_calculated_at`
- `texts` +4 (text_vrl_score/text_v_level/vrl_components/vrl_calculated_at)
- `user_profiles` +8 (current/target × v_level/track_levels + domain/skill + learning_goal + diagnostic_completed_at)
- 신규 테이블 4: `user_level_progress` + 진단 3 (`vrl_diagnostic_tests`/`_questions`/`user_diagnostic_results`) — 모두 RLS own-data
- 인덱스 9 + GIN 2 (track/domain jsonb)
- 파일: `supabase/migrations/20260524_100000_vrl_v3_infrastructure.sql`

**핵심 결정 반영**:
- Track ID 영역 중립화 (N2): `csat_korean` `business_english` `academic_english` `general_proficiency` `conversational` `literary` — TOEIC/TOEFL/IELTS 등 trademark 는 `external_test_hints TEXT[]` 별도 컬럼에 격리, UI 표시용만
- KICE tier wording: tier 2 가 최상위 (tier 1 부재)
- C2=56% 재라벨링: Day 6 후 별도 phase 로 보류
- Level 11 overshoot: C2+band-NULL+무태그 6,154 row → L10 으로 재라우팅 (Day 2 함수에서 반영 예정), NAWL/TSL C1 → L8

**아직 안 한 것**:
- Day 2: `calc_v_level` / `calc_track_level` / `calc_domain_level` / `calc_skill_level` / `analyze_book_vrl` 함수
- Day 3: shared_dictionary 38,630 row 일괄 분류 UPDATE
- Day 4: 책 VRL 산출 (`scripts/vrl/calculate-book-vrl-v3.ts`)
- Day 5: 진단 시드 + 자동 단어장 85개
- Day 6: 검증 + e2e

**Why**: 4축 다차원 분류 (V-Level / Track / Domain / Skill) 로 한국 학습자 정합 + 글로벌 호환. 5-7세 ~ 원어민 전문 12단계 + 6 시험 트랙 × 10단계 + 8 도메인 × 5 + 5 스킬 × 5.

**How to apply**: VRL 관련 후속 작업 (함수 작성·분류 UPDATE·UI 노출) 진행 시 위 컬럼/테이블 그대로 사용. 메타 시드 word_count 는 Day 3 분류 후 재집계 트리거 별도 추가 예정. Track ID 는 절대 벤더명으로 변경 X — ASSERT 가드 설치됨.

