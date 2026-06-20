> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2b3_business_academic_tracks.md
> category: project

---

Phase 2B.3 — Business + Academic track 진단 2개 추가 완료 2026-05-25. Phase 2B.2 mechanism (analyze_track_diagnostic_result) 공유.

**Migration**: `vrl_phase2b3_business_academic_track_diagnostics`.

**신규 2 tests**:
| target_track_id | name_ko | question_count | tag 강제 | V-Level 범위 |
|---|---|---:|---|---|
| business_english | TOEIC·비즈니스 영어 진단 | 32 | bsl_1.20 | V3-V9 |
| academic_english | TOEFL·IELTS 학술 영어 진단 | 32 | nawl_1.2 | V4-V10 |

**전체 4 diagnostics 현황** (135 questions):
| 진단 | type | qty | 한국 시장 |
|---|---|---:|---|
| VRL Placement v1 | base_v_level | 40 | 일반 V-Level 측정 |
| CSAT 빈출 어휘 | track (csat_korean) | 31 | 수능 학습자 |
| TOEIC·비즈니스 | track (business_english) | 32 | 직장인 |
| TOEFL·IELTS 학술 | track (academic_english) | 32 | 유학/대학원 |

**Business sample** (V3-V4): countryside / architect / horror / celebrity
**Academic sample** (V4): vowel / destination / homework / syllable

**품질 메모**:
- BSL coverage가 광범위 — 일반 영어시험 단어 (countryside/horror) 포함, 순수 비즈니스 X
- NAWL는 학술 vocabulary 정확 (vowel/syllable — 음운학, destination/homework — 일상 학술)
- 두 tag 모두 한국 시장 정합 (TOEIC/TOEFL 학습자에게 유용한 단어)

**모든 track 진단 공통 mechanism**:
- `analyze_track_diagnostic_result(p_result_id)` — track_id 동적 추출, 모든 track 사용
- `analyze_and_apply_track_diagnostic_result(p_result_id)` — user_profiles.current_track_levels JSONB merge (다른 track 보존)
- threshold 70%, weighted avg confidence

**활용 흐름**:
1. 사용자 base V-Level 진단 완료 (Phase 2B.1)
2. /diagnostic 에서 추가 track 진단 선택 (UI wire-up 필요)
3. 진단 → analyze_and_apply_track → current_track_levels = `{"csat_korean":5, "business_english":3, ...}`
4. (Phase 2 후반) recommend_word_sets_for_user 확장 — high track 단어장 우선 추천
5. 진단 history도 표시 가능 (Phase 2 후반)

**향후 확장**:
- 도메인 진단 (medical/literary) — domain_levels JSONB 측정
- comprehensive 진단 (모든 axis 결합) — test_type='comprehensive'

**Phase 2 진척 (이 세션 누적)**:
DB:
- ✅ 2A.2 / 2B.1 / 2B.2 / **2B.3** (이 문서) / 2C.1 / 2C.2 / 2D / 2D.2 / 2E

Frontend:
- ✅ /diagnostic (3-phase, base_v_level만) / Sidebar / WordVault hub 추천 + Set wire-up / VLevelPromotionCheck / history timeline / 통합

**Frontend 미구현 (track 진단)**:
- /diagnostic에서 track 진단 선택 UI 없음 — 현재 base_v_level test_id hardcoded
- 향후: 진단 list 화면 (어떤 진단을 받을지 선택) → 각 진단으로 라우팅

관련: [[vrl-phase2b2-csat-track-diagnostic]] [[vrl-phase2b1-diagnostic-seed]] [[claude-code-is-llm]]

