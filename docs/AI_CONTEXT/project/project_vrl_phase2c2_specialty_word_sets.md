> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2c2_specialty_word_sets.md
> category: project

---

Phase 2C.2 — specialty 단어장 발행 완료 2026-05-25. V8-V11 specialty proper (V1-V7 중복 회피).

**4 sets 생성 (한국 전공·전문 영역)**:
| slug | title | category | qty | emoji | tag | 한국 시장 |
|---|---|---|---:|---|---|---|
| specialty-medical | 의학 영어 (의대·보건대학원) | themed | 200 | 🩺 | moel_1.0 | 의대생 / 보건전문 |
| specialty-business | 비즈니스 영어 (TOEIC·BSL 전문) | themed | 250 | 💼 | bsl_1.20 | 직장인 / TOEIC 고득점 |
| specialty-literary | 영문학 (원서·전공) | themed | 250 | 📚 | bel_1.0 | 영문학 전공 |
| specialty-academic | 학술 영어 (대학원·유학 핵심) | themed | 202 | 🎓 | nawl_1.2 | 대학원 / TOEFL/IELTS |
| **합계** | | | **902** | | | |

**선정 SQL**:
```sql
shared_dictionary
WHERE list_tags @> ARRAY[<tag>]
  AND v_level BETWEEN 8 AND 11 (specialty proper)
  AND skill_level = 3
  AND meaning_ko IS NOT NULL AND LENGTH(meaning_ko) > 0
  AND LENGTH(word) >= 3
  AND word ~ '^[a-z]+$'
  AND pos IN ('noun','verb','adjective','adverb')
ORDER BY frequency_rank ASC NULLS LAST, word ASC
LIMIT qty
```

**중요한 발견 — fel tag ≠ finance 정정**:
- 초기 Phase 2C.2 v1에서 `fel_1.2` tag을 finance로 가정 → specialty-finance(169 row) 생성
- 사용자 sample 확인: pin/wow/rub/simultaneously/fighter — finance 무관
- 추가 검증: publish/aspect/client/acid/dynamic/bicycle/dose/spiritual/feedback/prayer/organ/bow/apple/fitness — 일반/건강/종교/신체/소비 영역 혼합
- → **fel ≠ finance** 확정 (추정 First/Family/Food English Lexicon 일반 보조 리스트)
- 조치: specialty-finance DELETE (CASCADE로 shared_words 자동 정리) → specialty-business (bsl_1.20) 재생성
- bsl_1.20 = Business Service List (TOEIC/비즈니스 영어 핵심) — 진짜 한국 비즈니스 영역

**Round 8 fel template 영향 (low priority)**:
- Round 8 Step 2 (L9 specialty)에서 fel tag 77 row에 "C2 금융 specific (fel)" template 적용 — track:business_english=5, domain:business=5 셋팅
- 실제 fel 단어는 finance 무관 → V10 archaic이고 활용도 낮으나 정밀화 시 fel rows를 일반 V10 template으로 재처리 검토 가능
- 우선순위 낮음 (V10 archaic 영역 = 한국 사용자 도달 거의 X)

**Sample 검증**:
- 의학(moel): sperm/ward/autonomy/syndrome/hormone ✓ 의학 정합
- 비즈니스(bsl): fiscal/redemption/defendant/inspector/interface/correspondent/coalition/activist ✓ TOEIC/비즈니스 정합
- 문학(bel): redemption/beam/flame/pit/raid ✓ 문학/biblical 정합
- 학술(nawl): sperm/beam/interface/thereby/matrix ✓ TOEFL/IELTS 학술 정합

**활용 흐름**:
- 사용자가 진단 후 specialty 관심 영역 선택 (예: 의대 진학 준비)
- WordVault에서 specialty-medical 구독 → 200 의학 단어 학습
- Library 도서 (의학 텍스트) 단어 추출 시 V-Level + 도메인 weight 결합 가능 (Phase 2D)

**Phase 2C.1 + 2C.2 통합 단어장 현황**:
- V-Level별: V1-V9 = 9 sets · 1,600 row
- Specialty별: 4 sets · 902 row
- 기존: 필수2000(1) + KICE auto(5) = 6 sets · 3,487 row
- **총 19 sets · 약 5,989 row** 사용자 노출 가능

**다음 단계**:
- Phase 2B.2: track/domain 진단 추가 (csat_korean/business_english/medical/academic 등)
- Phase 2D: 진단 결과 → 단어장 자동 추천 함수
- Frontend `/diagnostic` 라우트 + WordVault 추천 UI

관련: [[vrl-phase2c1-auto-vlevel-word-sets]] [[vrl-phase2b1-diagnostic-seed]] [[vrl-phase2a2-analyze-apply]] [[vrl-v3-round8-l9-done]] [[claude-code-is-llm]]

