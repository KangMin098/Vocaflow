> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_day3_done.md
> category: project

---

VRL v3 Day 3 일괄 분류 완료 — 2026-05-23 10:31 UTC.

**Migration**: `vrl_v3_classify` — 클라이언트 timeout 났지만 서버 단일 TX 정상 완료 (단일 timestamp 38,626 row).

**파일**: `supabase/migrations/20260526_100000_vrl_v3_classify.sql`

**적재된 4축 분포**:

V-Level 12단계 (38,626; cefr_level NULL 4 row 제외):
- L0=116, L1=115, L2=350, L3=895, L4=1,030
- L5=965, L6=1,933, L7=3,202, L8=3,254
- L9=9,254, L10=12,149, L11=5,363

Track 6 (모두 fallback 으로 38,630 매핑, literary 만 7,704):
- csat_korean / business_english / academic_english / general_proficiency / conversational = 38,630 each
- literary = 7,704

Domain 8 (function 이 CEFR gate 적용 — tag 보유보다 적음):
- general 12,184 / literature 7,704 / business 1,092
- academic 889 / entertainment 456 / news_media 241
- science_tech 0 / travel_culture 0 (data 미적재)

Skill 5 (catchall 'single_word' 로 NULL 없음):
- single_word 32,216 (83%) / idiom 991 / phrasal_verb 460
- collocation 4,096 / polysemy 867

**적재 컬럼**:
- `shared_dictionary.v_level` (SMALLINT 0-11)
- `shared_dictionary.track_levels` (JSONB — 6 키, 모든 단어 보유)
- `shared_dictionary.domain_levels` (JSONB — 8 키, 미해당 도메인은 value=null)
- `shared_dictionary.skill_type` (TEXT enum — NULL 0건)
- `shared_dictionary.skill_level` (SMALLINT 1-5)
- `shared_dictionary.vrl_calculated_at` (TIMESTAMPTZ)

**메타 재집계 완료** (Day 1 시드 추정치 → 실측):
- `vocaflow_levels.cumulative_word_count` / `new_words_in_level` 실측
- `vocaflow_tracks.total_words` / `vocaflow_domains.total_words` / `vocaflow_skills.total_words` 실측

**알려진 한계**:
- Track total_words 5 종이 모두 38,630 — fallback (`ELSE 10`) 이 모든 단어에 트랙 값 부여. 알고리즘 정확하나 메트릭 변별력 약함. 향후 `core_words` 컬럼 신설로 fallback 제외 카운트 별도 보관 가능.
- 4 row 가 v_level NULL — cefr_level 자체 NULL (상류 데이터 결손).
- Domain 메트릭이 tag 보유 카운트보다 적음 (academic 889 vs nawl/tsl 1,521) — calc_domain_level 이 CEFR gate 적용 (예: NAWL+B1 은 academic 미인정). 의도된 동작.

**클라이언트 timeout 해법**: 단일 statement UPDATE 가 MCP execute_sql / apply_migration timeout 초과해도 **서버 TX 는 계속 실행** 후 commit. 멱등 guard (`WHERE vrl_calculated_at IS NULL`) 덕분에 재실행 안전. 같은 패턴 향후 활용 가능.

**Why**: 38,630 row × 16 함수 호출 = ~618k function evaluations — apply_migration MCP 의 ~2분 timeout 한계 근접. 향후 대형 UPDATE 는 LIMIT 2,000 배치로 분할 권장.

**다음 (Day 4-6)**:
- Day 4: `scripts/vrl/calculate-book-vrl-v3.ts` — library_books 책 VRL 산출 (`analyze_book_vrl` 호출)
- Day 5: 진단 시드 + 자동 단어장 85개 (V-Level 12 + Track×Level 60 + Domain 8 + Skill 5)
- Day 6: 검증 + e2e

관련: [[vrl-v3-day1-done]] [[vrl-v3-day2-done]]

