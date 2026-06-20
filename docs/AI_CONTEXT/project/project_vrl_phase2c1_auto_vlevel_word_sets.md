> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2c1_auto_vlevel_word_sets.md
> category: project

---

Phase 2C.1 — V-Level별 자동 단어장 7개 발행 완료 2026-05-25. shared_dictionary 100% 분류 활용 첫 단어장 발행.

**Migration**: `vrl_phase2c1_auto_vlevel_word_sets_v2` (UNIQUE(slug, version) 정합 후 적용).

**7 sets 생성 (한국 학습자 cohort 핵심)**:
| slug | title | category | qty | emoji | cohort |
|---|---|---|---:|---|---|
| auto-vlevel-v1 | 기초 어휘 V1 (유아·초1) | elementary | 100 | 🌱 | 유아-초1 |
| auto-vlevel-v2 | 기초 어휘 V2 (초2-3) | elementary | 150 | 🌿 | 초2-3 |
| auto-vlevel-v3 | 기초 어휘 V3 (초4-6) | elementary | 150 | 🌳 | 초4-6 |
| auto-vlevel-v4 | 중학 영어 V4 (중1) | middle | 200 | 📘 | 중1 |
| auto-vlevel-v5 | 중학 영어 V5 (중2-3) | middle | 200 | 📗 | 중2-3 |
| auto-vlevel-v6 | 고등 영어 V6 (고1) | high | 200 | 📕 | 고1 |
| auto-vlevel-v7 | 수능 핵심 V7 (고2) | high | 200 | 📖 | 고2 수능 |
| auto-vlevel-v8 | 대학·TOEIC 진입 V8 | eng_test | 200 | 🎓 | 직장인 영어시험 (★ v2 추가) |
| auto-vlevel-v9 | TOEFL·IELTS V9 (대학원/유학) | eng_test | 200 | 🌐 | 유학/대학원 (★ v2 추가) |
| **합계** | | | **1,600** | | |

**v2 확장 근거 (사용자 지적)**: V7까지 한정은 "한국 수능까지"라는 좁은 시각 — 한국 영어 학습 시장은 수능 후가 훨씬 큼 (TOEIC/OPIc/TOEFL/IELTS). V8(직장인 TOEIC) + V9(유학 TOEFL/IELTS) 추가. V10은 Phase 2C.2 specialty(의학/금융/영문학)로 분기, V11 제외 정당.

**V8/V9 선정 tag 확장**:
- V8: `ngsl_1.2` OR `bsl_1.20` (대학 영어 + 비즈니스)
- V9: `ngsl_1.2` OR `bsl_1.20` OR `nawl_1.2` (학술 academic 추가)

**V8 sample** (sort_order 1-12): narrows/sperm/spelt/fiscal/gendered/lent/gearing/redemption/maturation/defendant/inspector/interface — TOEIC/대학 영어 정합

**선정 SQL 기준**:
```sql
shared_dictionary
WHERE v_level = <target>
  AND skill_level = 3 (single word)
  AND meaning_ko IS NOT NULL AND LENGTH(meaning_ko) > 0
  AND LENGTH(word) >= 3
  AND word ~ '^[a-z]+$' (alphabetic only)
  AND pos IN ('noun','verb','adjective','adverb')
  AND (list_tags @> ['ngsl_1.2'] OR ['csat-prep-core-2k'] OR ['csat-prep-ext-1.8k'])
ORDER BY frequency_rank ASC NULLS LAST, word ASC
LIMIT qty
```

**Set 속성**:
- `auto_curated = true` (manual curation 사용 시 'cast-2000'와 구분)
- `is_published = true` (즉시 사용자 노출)
- `cefr_level = NULL` (V-Level이 더 정확 — CEFR 부분 noise)
- `curation_query` JSONB: source/v_level/qty/criteria/generated_at 기록 (재생성 추적용)
- `version = 1` (default — 향후 재큐레이션 시 +1 가능)
- `description`: "VRL v3 V-Level N 자동 큐레이션 단어장. 한국 학습자 정합 — frequency_rank 상위 + NGSL/csat-prep tag + meaning_ko 보유 단어 N개."

**V7 sample 검증** (sort_order 1-15):
- birding, birthing, branding, casting, polling, prof, milking, borrowing, distinguished, splitting, criterion, betting, premise, premises, leaning
- B1-B2 NGSL 영역, 한국 고2-수능 정합

**의의**:
- shared_dictionary 38,598 row 분류 → **첫 사용자 노출 자산** 1,200 row
- WordVault hub에서 사용자가 즉시 자기 V-Level 단어장 구독 가능
- 진단 (Phase 2A.2 + 2B.1) 결과 → current_v_level → 해당 단어장 자동 추천 가능 (Phase 2D)
- Library Krashen i+1 가중치와 결합 시: 사용자 V5 → V5 단어장 + V6 stretch 단어 추출

**활용 흐름**:
1. 사용자 진단 완료 (V5 확정)
2. Frontend: "당신의 V-Level은 V5 — 중학 영어 V5 (중2-3) 단어장 추천" 표시
3. 사용자가 단어장 구독 (user_word_set_subscriptions INSERT)
4. WordVault에서 200 단어 학습 시작
5. Library 단어 추출도 V5+V6 i+1 zone 우선

**확장 가능 영역**:
- V8-V10 단어장 (대학/대학원/전문) — eng_test/themed 카테고리 매핑
- V11 단어장 제외 (한국 학습자 도달 거의 X)
- track-별 단어장 (csat_korean·business_english·academic_english) — Phase 2D
- domain-별 단어장 (의학·금융·영문학) — Phase 2C.2 specialty

**다음 단계**:
- Phase 2C.2: specialty 단어장 (의학 moel + 금융 fel + 영문학 bel)
- Phase 2B.2: track/domain 진단 추가
- Phase 2D: 진단 결과 → 단어장 자동 추천 함수

관련: [[vrl-v3-round10-l11-done]] [[vrl-phase2b1-diagnostic-seed]] [[vrl-phase2a2-analyze-apply]] [[claude-code-is-llm]]

