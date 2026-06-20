> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2i_comprehensive_diagnostic.md
> category: project

---

Phase 2I — Comprehensive 진단 완료 2026-05-25. 단일 50문항으로 base V-Level + 3 tracks 동시 측정.

**Migration**: `vrl_phase2i_comprehensive_diagnostic`.

**Test record**:
- name_ko: 'Comprehensive 진단 (base + 모든 track 동시)'
- test_type: 'comprehensive'
- target_axis: 'all'
- question_count: 50
- estimated_minutes: 6
- emoji: 🌐

**문항 분포**:
- V1-V10 × 5 questions = 50
- 선정: NGSL tag 강제 (모든 V-Level coverage) + skill_level=3 + frequency_rank ASC
- target_v_level만 셋팅 (track 정보는 shared_dictionary.list_tags JOIN으로 추출)

**신규 함수**: `analyze_and_apply_comprehensive_diagnostic_result(p_result_id UUID)`
- 단일 응답을 4번 분석:
  1. base V-Level: target_v_level별 정답률 ≥70% threshold
  2. csat_korean: list_tags has csat-prep-* AND v_level별 정답률 ≥70%
  3. business_english: list_tags has bsl_1.20 AND v_level별 정답률 ≥70%
  4. academic_english: list_tags has nawl_1.2 AND v_level별 정답률 ≥70%
- 4축 동시 UPDATE: user_profiles.current_v_level + current_track_levels JSONB
- 단일 snapshot 생성 (scope=comprehensive, v_level + track_levels 모두 기록)

**Smoke test PASS** (V≤6 100%, V7-V10 0%):
- estimated_v_level = 6
- estimated_track_levels = {csat_korean:6, business_english:0, academic_english:0}
- confidence = 0.6
- csat=6: 저-중급 NGSL 단어들이 csat-prep 태그 보유 → 자연스러운 측정
- biz/academic=0: BSL/NAWL는 V8+에 분포 → 50q 샘플에서 측정 못함 (V1-V10 NGSL 강제 + 5q/level은 BSL/NAWL coverage 부족)

**알려진 한계**:
- BSL/NAWL 측정 underestimate — V1-V10 NGSL 강제이지만 BSL/NAWL는 V8+에 분포
- 개선 방향 (Phase 2 후반): NGSL OR BSL OR NAWL 혼합 sampling으로 모든 track 측정 강화
- 또는 comprehensive를 longer (80q)로 확장 + 의도적으로 track tag 다양화

**Frontend wire-up (DiagnosticClient v3)**:
- RPC 분기에 'comprehensive' 추가 → analyze_and_apply_comprehensive_diagnostic_result
- 추천 fetch: base + comprehensive 모두 호출 (track-based 자동 포함 by Phase 2D.3)
- 결과 표시: base와 동일 UX (estimated_v_level + recommendations), track_levels은 DB에만 저장 (UI 미표시)
- emoji: 🌐 (모든 axis 통합 의미)

**E2E 활용 흐름**:
1. 사용자 /diagnostic 진입 → 5 진단 카드 (base + csat + biz + acad + **comprehensive**)
2. comprehensive 선택 → 50q 6분 응답
3. analyze_and_apply_comprehensive → base + 3 tracks 동시 셋팅
4. 결과: V-Level + 추천 단어장 (5-tier 자동 — Phase 2D.3 track-based 즉시 활성화)
5. user_profiles 4축 완성 → 모든 후속 자동화 (auto_promote, recommend) 작동

**한국 학습자 가치**:
- 첫 진단 사용자 추천: comprehensive 1번으로 4축 셋팅 (편의)
- 기존 base/track 진단보다 짧음 (50q vs 40+31+32+32=135q)
- 단점: 측정 정밀도 낮음 (각 axis 5-10q씩만)
- 추천: 정밀 측정은 axis별 별도 진단, 빠른 측정은 comprehensive

**Phase 2 통합 완성 (이 세션 최종)**:
DB (14 layer):
- ✅ 2A.2 / 2B.1 / 2B.2 / 2B.3 / 2C.1 / 2C.2 / 2D / 2D.2 / 2D.3 / 2E / 2F / 2G / 2H / **2I**

Frontend (9 자산):
- /diagnostic v3 (5 진단 wire-up) / Sidebar / WordVault hub 추천 + Set wire-up / VLevelPromotionCheck / history timeline + 통합 + track scope

**다음 후보**:
- Admin dashboard (cron 통계 + snapshot 분포)
- comprehensive 측정 정밀화 (BSL/NAWL coverage 강화)
- 5 진단 활용도 분석 (사용자 선호 패턴)

관련: [[vrl-phase2h-track-auto-promote]] [[vrl-phase2g-pg-cron-promotion]] [[vrl-phase2b-frontend-test-selector]] [[claude-code-is-llm]]

