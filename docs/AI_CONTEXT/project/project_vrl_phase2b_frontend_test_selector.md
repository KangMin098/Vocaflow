> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2b_frontend_test_selector.md
> category: project

---

DiagnosticClient 전체 refactor — test-agnostic 다축 진단 wire-up 완료 2026-05-25.

**변경**: `apps/web/src/components/diagnostic/DiagnosticClient.tsx` 전면 재작성

**Before (v1)**:
- TEST_ID hardcoded (VRL Placement v1만)
- target_v_level만 처리
- analyze_and_apply_diagnostic_result만 호출

**After (v2)**:
- start phase: vrl_diagnostic_tests fetch → 모든 active test 카드 list
- selectedTest state로 동적 처리
- Question 인터페이스에 target_v_level + target_track_level 둘 다
- submit: test_type 분기 (base_v_level → analyze_and_apply_diagnostic_result / track → analyze_and_apply_track_diagnostic_result)
- results: isTrack 분기 (V-Level vs track L# 표시)
- base_v_level만 interests + 추천 (track은 향후 별도 추천 로직)
- track 결과 → "다른 진단 받기" CTA (재진단 흐름)
- base 결과 → "WordVault로 이동" CTA (기존 흐름)

**Test selector UI**:
- 각 test가 카드 (test_type emoji + 이름 + 설명 + 문항수·시간·track_id 배지)
- TEST_TYPE_EMOJI: base_v_level=🧭, track=🎯, domain=🩺, comprehensive=📊
- 카드 hover: -translate-y-0.5 + border-p
- 클릭 → startTest(test) → 즉시 question phase

**4 진단 모두 지원**:
1. VRL Placement v1 (40q, 5분, base_v_level)
2. CSAT 빈출 어휘 진단 (31q, 4분, track csat_korean)
3. TOEIC·비즈니스 영어 진단 (32q, 4분, track business_english)
4. TOEFL·IELTS 학술 영어 진단 (32q, 4분, track academic_english)

**RPC 분기**:
```ts
const rpcName = selectedTest.test_type === 'track'
  ? 'analyze_and_apply_track_diagnostic_result'
  : 'analyze_and_apply_diagnostic_result'
```

**Result 분기**:
```ts
const lvl = isTrack ? result.estimated_track_level : result.estimated_v_level
const levelLabel = isTrack ? `${target_track_id} L${lvl}` : `V${lvl}`
```

**한국 학습자 정합**:
- 사용자가 자기 목표(수능·TOEIC·TOEFL)에 맞는 진단 선택 가능 (SDT 자율성)
- track 결과는 별도 추천 X (현재 base만 추천) → Phase 2D 확장 시 track 기반 추천 가능
- 변천사 inline 통합 보존 (base 진단 결과는 snapshot 생성, track은 user_profiles.current_track_levels 셋팅)

**E2E 흐름**:
1. /diagnostic → 4 진단 카드 + 변천사 표시
2. 사용자 진단 선택 (예: CSAT)
3. 31문항 응답 → analyze_and_apply_track → current_track_levels.csat_korean 셋팅
4. 결과: "당신의 track 수준은 csat_korean L5" + "다른 진단 받기"
5. 재방문 시 변천사에 CSAT 진단 기록은 보이지 않음 (snapshot 미생성 — track 진단은 base와 별개 측정)

**알려진 한계 / TODO**:
- track 진단 결과 history 표시 X (snapshot 미생성)
- track 기반 단어장 추천 미구현 (Phase 2D 확장 필요)
- comprehensive test_type 미지원 (현재 base+track만)
- domain test_type 미지원 (의학/문학 진단 미구현)

**Phase 2 진척 (이 세션 누적)**:
DB:
- ✅ 2A.2 analyze + apply
- ✅ 2B.1 base_v_level 진단 40q
- ✅ 2B.2 CSAT track 진단 + analyze_track 함수
- ✅ 2B.3 Business + Academic track 진단
- ✅ 2C.1 V-Level 단어장 9 / 2C.2 specialty 4
- ✅ 2D 추천 3-tier / 2D.2 specialty opt-in
- ✅ 2E auto_promote

Frontend:
- ✅ /diagnostic + DiagnosticClient v1 (Phase 2B.1)
- ✅ Sidebar 진단 메뉴
- ✅ WordVault hub 추천 + Set wire-up + VLevelPromotionCheck
- ✅ history timeline + /diagnostic 통합
- ✅ **DiagnosticClient v2 test-agnostic refactor** (이 문서) — 4 진단 모두 wire-up

관련: [[vrl-phase2b3-business-academic-tracks]] [[vrl-phase2b2-csat-track-diagnostic]] [[vrl-phase2-frontend-diagnostic]] [[claude-code-is-llm]]

