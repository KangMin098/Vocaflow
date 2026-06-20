> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_v3_day2_done.md
> category: project

---

VRL v3 Day 2 함수 5종 등록 + over-tagging 패치 적용 완료 — 2026-05-23.

**적용 migrations**:
1. `vrl_v3_functions` — 5 함수 `CREATE OR REPLACE`:
   - `calc_v_level(word)` → SMALLINT 0-11
   - `calc_track_level(word, track_id)` → SMALLINT 1-10 (6 트랙)
   - `calc_domain_level(word, domain_id)` → SMALLINT 1-5 (8 도메인)
   - `calc_skill_level(word)` → SMALLINT 1-5 (v_level 기반 매핑)
   - `analyze_book_vrl(book_id)` → JSONB (Lexile 호환 + 한국 보정, MSL placeholder=12.0)
2. `vrl_v3_calc_v_level_overtagging_patch` — 우선순위 4.5 삽입 (csat-prep AFTER, NAWL/TSL BEFORE):
   ```sql
   IF list_tags && ARRAY['ngsl_gr_1.0','ngsl_1.2']::TEXT[]
      AND cefr_level IN ('A1','A2','B1') THEN
     RETURN CASE cefr_level WHEN 'A1' THEN 2 WHEN 'A2' THEN 3 WHEN 'B1' THEN 4 END;
   END IF;
   ```
   `apple` 류 일반어가 NAWL/TSL/BSL over-tag 로 학술/비즈니스 분기에 빠지던 ~1,254 row 정상화.

**파일**:
- `supabase/migrations/20260525_100000_vrl_v3_functions.sql` (over-tagging 패치 인라인 포함)

**모든 함수 STABLE** (읽기 전용 멱등). NULL 입력 graceful (`RETURN NULL`). 사전 미존재 단어 `IF NOT FOUND` 처리.

**패치 후 V-Level 분포 (UPDATE 미실행, calc 함수 호출 결과)**:
- L0=116, L1=115, L2=350, L3=895, L4=1,030
- L5=965, L6=1,933, L7=3,202, L8=3,254
- L9=9,254, L10=12,149, L11=5,363
- NULL=4 (cefr_level 자체 null — 상류 결손)
- 합계 38,630 ✓
- L11 정상화: 11,333 → 5,363 (목표 6,300 에 -15%)

**Why**: 상류 데이터 over-tagging (apple 같은 일반어가 NAWL/TSL/BSL/NDL/FEL 등 5+ list 보유) 으로 함수가 우선순위대로 학술/비즈니스 분기에 진입 — semantic 오류. 보호막은 low-CEFR (A1/A2/B1) 단어에 한해 NGSL 우선 적용.

**아직 안 한 것**:
- Day 3: shared_dictionary 38,630 row 일괄 UPDATE
  - `v_level` = calc_v_level(word)
  - `track_levels` = 6 키 jsonb
  - `domain_levels` = 8 키 jsonb (NULL 도메인은 키 제외 검토)
  - `skill_type` = CASE primary_pos / multi-word / polysemy
  - `skill_level` = calc_skill_level(word)
  - `vrl_calculated_at` = now()
- Day 4-6: 책 VRL / 진단 시드 / 자동 단어장 / e2e

**How to apply**: VRL 함수 호출 결과는 STABLE. Day 3 UPDATE 후 다시 calc 호출해도 동일 결과. C2 over-tag 영향 0.8% (~300 row) 는 알고리즘 보호막으로 처리됨 — 데이터 cleanup 별도 phase 불필요.

관련: [[vrl-v3-day1-done]]

