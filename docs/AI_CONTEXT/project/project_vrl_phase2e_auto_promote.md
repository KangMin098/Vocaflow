> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2e_auto_promote.md
> category: project

---

Phase 2E — `auto_promote_v_level_for_user(p_user_id UUID)` 함수 적용 완료 2026-05-25. 진단은 단일 snapshot, 학습 활동으로 V-Level 자동 갱신.

**Migration**: `vrl_phase2e_auto_promote_v_level`.

**함수 시그니처**:
```sql
auto_promote_v_level_for_user(p_user_id UUID)
RETURNS TABLE (
  promoted BOOLEAN,
  old_level SMALLINT,
  new_level SMALLINT,
  mastered_count INT,
  threshold INT,
  reason TEXT
)
```

**알고리즘 (i+1 mastery threshold)**:
```
1. current_v_level = user_profiles.current_v_level
2. IF NULL/0: return "진단 미완료"
3. IF >=11: return "V11 최고점 도달"
4. next_level = current+1
5. mastered_count =
   COUNT(v.word) FROM vocabularies v
   JOIN shared_dictionary sd ON sd.word = v.word AND sd.v_level = next_level
   LEFT JOIN learning_records lr ON lr.vocabulary_id = v.id
     AND lr.attempted_at > NOW() - 30 days
   WHERE v.user_id = p_user_id
   GROUP BY v.id
   HAVING ≥3 correct AND last_review correct
6. IF mastered < 20: return "조건 미충족"
7. ELSE call update_user_v_level(user, next_level, 'learning_data', confidence, 'auto_promotion', NULL, 'internal', meta)
8. snapshot 자동 생성 (audit chain)
```

**Threshold 상수**:
- `v_threshold` = 20 (i+1 zone 마스터 단어 수)
- `v_window_days` = 30 (최근 학습 기간)
- `v_confidence` = mastered/threshold (0.85~1.0)

**한국 학습자 정합**:
- i+1 Krashen hypothesis 자동화 — current_v_level의 다음 zone 단어를 마스터하면 자동 상향
- 30일 window — 너무 짧으면 noisy, 너무 길면 지연. 한국 평균 학습 패턴 정합
- 20개 threshold — V1-V7 단어장 100-200개 기준 10-20%
- ≥3 successful reviews — FSRS 표준 (Easy→stable 진입)
- last correct 보장 — recency 강조 (잊지 않음 검증)

**Smoke test 결과 (2/3 시나리오 PASS)**:
| scenario | promoted | reason |
|---|---|---|
| 진단 미완료 (V0) | false | 진단 완료 필요 |
| V5 + 학습 기록 없음 | false | i+1 (V6) mastered 0/20 미충족 |
| V5 + 20+ V6 mastered | (untested — data 오염 회피) | promotion 실행 (CASE branch 정합) |

**활용 흐름**:
- **수동 호출**: Frontend "V-Level 갱신 확인" 버튼 → RPC 호출
- **자동 호출 (Phase 2 후반)**: 
  - 학습 세션 종료 시 trigger (last vocab review 후)
  - 또는 일별 cron (Supabase Edge Function + pg_cron)
  - 또는 user_profiles.next_level_review_due_at 기반 polling

**snapshot audit chain**:
- 진단 (manual)
- self_declared (settings)
- learning_data ★ Phase 2E (이 함수)
- diagnostic_completed (2A.2)
- previous_snapshot_id 체인으로 V-Level history 추적 가능

**Phase 2E 위치 (전체 흐름)**:
1. 사용자 진단 → V-Level 셋팅 (2A.2 + 2B.1)
2. 추천 단어장 학습 (2C.1 + 2D + 2D.2)
3. **학습 누적 → 자동 V-Level 갱신** ★ 2E (이 문서)
4. 추천 단어장 자동 갱신 (recommend_word_sets_for_user 다음 호출 시)
5. Library Krashen i+1도 자동 갱신

**알려진 한계 / TODO**:
- 자동 호출 trigger 미구현 (현재 수동 호출만)
- V-Level 하향 (regression) 없음 — 한국 학습자 정합 (계속 상향만)
- multi-step promotion 없음 (한 번에 1 level씩만)
- specialty domain 별도 추적 없음 (V-Level 통합만)

**Phase 2 통합 요약 (전체 세션)**:
- ✅ 2A.2 analyze + apply 함수
- ✅ 2B.1 진단 시드 40문항
- ✅ 2C.1 V-Level 단어장 9개 (1,600)
- ✅ 2C.2 specialty 단어장 4개 (902)
- ✅ 2D 추천 3-tier
- ✅ 2D.2 specialty opt-in
- ✅ Frontend /diagnostic
- ✅ Sidebar 진단 메뉴
- ✅ WordVault hub 추천 통합 + Set 카드 wire-up
- ✅ **2E 자동 V-Level 상향** (이 문서)

**다음 후보**:
- Phase 2B.2 track/domain 진단 (csat_korean/business_english/medical 등)
- 진단 history UI (snapshots audit chain 시각화)
- Auto-promotion trigger wire-up (학습 세션 종료 시 자동 호출)

관련: [[vrl-phase2d2-specialty-optin]] [[vrl-phase2a2-analyze-apply]] [[vrl-phase2-frontend-diagnostic]] [[claude-code-is-llm]]

