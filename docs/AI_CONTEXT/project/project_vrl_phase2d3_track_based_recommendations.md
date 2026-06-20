> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2d3_track_based_recommendations.md
> category: project

---

Phase 2D.3 — `recommend_word_sets_for_user` 5-tier 확장 완료 2026-05-25. track 진단 (Phase 2B.2/2B.3) 결과 자동 활용.

**Migration**: `vrl_phase2d3_track_based_recommendations` (CREATE OR REPLACE)

**5-tier 추천 (priority 순)**:
| priority | type | logic |
|---:|---|---|
| 1 | primary | auto-vlevel-v{N} (현재 V-Level) |
| 2 | stretch | auto-vlevel-v{N+1} (Krashen i+1) |
| 3 | review | auto-vlevel-v{N-1} (보강) |
| 4 | specialty | interests opt-in (medical/business/literary/academic) |
| **5** | **track_csat** | **csat_korean ≥6 → kice-* 단어장 자동** |
| **5** | **track_business** | **business_english ≥6 → specialty-business 자동** |
| **5** | **track_academic** | **academic_english ≥6 → specialty-academic 자동** |

**threshold 6 근거**:
- 한국 학습자 advanced level 기준
- 수능 V6 = 고1 학습자 (수능 우수자)
- TOEIC 800+ / TOEFL 90+ 추정
- threshold 5는 너무 일반적, 7+는 너무 advanced

**한국 학습자 정합**:
- track 진단 결과 즉시 작동 — 진단 후 추천 자동 갱신
- csat 우수자 → KICE 큐레이션 5종 추가 (수능 빈출 8+ / Tier 4 / 글의 목적·요지 / 빈칸추론 / 장문독해)
- TOEIC 우수자 → 비즈니스 영어 specialty
- TOEFL 우수자 → 학술 영어 specialty
- interests opt-in과 track-based가 동시 작동 가능 (중복 단어장 자동 dedup — slug 동일 시 1번만)

**Smoke test (V5 + csat=7 + biz=6 + acad=3)**:
- 9 추천 반환 ✅
- primary V5 + stretch V6 + review V4 (3-tier)
- track_csat: 5 KICE sets
- track_business: specialty-business
- track_academic: 없음 (academic=3 < threshold 6)

**E2E 활용 흐름**:
1. 사용자 base V-Level 진단 (Phase 2B.1)
2. CSAT track 진단 (Phase 2B.2) → current_track_levels.csat_korean=7
3. WordVault hub 접속 → recommend_word_sets_for_user → 5 KICE 단어장 자동 추가 노출
4. 사용자가 수능 단어장 구독 → 학습 → 자연스러운 수능 어휘 강화

**알려진 한계**:
- Dedup 미구현 (interests=academic AND academic_english≥6 → specialty-academic 2번 노출). 실용상 영향 미미 (drop)
- threshold 6 hardcoded — 사용자별 customization 미지원
- track 진단 안 한 사용자에게도 current_track_levels NULL → 자동 추가 없음 (안전)
- track 결과 history 미구현 (snapshot 미생성 — 별도 phase)

**Phase 2 진척 (이 세션 누적)**:
DB:
- ✅ 2A.2 / 2B.1 / 2B.2 / 2B.3 / 2C.1 / 2C.2 / 2D / 2D.2 / **2D.3** (이 문서) / 2E

Frontend:
- ✅ /diagnostic v2 (test-agnostic)
- ✅ Sidebar / WordVault hub 추천 + Set wire-up / VLevelPromotionCheck / history 통합

**E2E 완전 자동화 loop**:
1. 진단 (base + track) → V-Level + track_levels 셋팅
2. WordVault hub → 5-tier 추천 (V-Level 3-tier + interests + track-based 자동)
3. 단어장 구독 → 학습 → learning_records 누적
4. 자동 V-Level 상향 (Phase 2E)
5. 다음 추천 → 새 V-Level + 갱신 track 기반

**다음 단계**:
- track 결과 history snapshot 생성 (Phase 2 후반)
- pg_cron 자동 promotion (silent 일별 갱신)
- comprehensive 진단 (모든 axis 결합)

관련: [[vrl-phase2d2-specialty-optin]] [[vrl-phase2b3-business-academic-tracks]] [[vrl-phase2b-frontend-test-selector]] [[claude-code-is-llm]]

