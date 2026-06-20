> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2h_track_auto_promote.md
> category: project

---

Phase 2H — track levels 학습 기반 자동 상향 함수 + cron wrapper 확장 완료 2026-05-25. base v_level + 3 tracks 모두 자동 갱신.

**Migrations**:
1. `vrl_phase2h_cron_wrapper_drop_replace` — DROP old (3 cols) + 새 시그니처 (4 cols) [사용자 OK]
2. `vrl_phase2h_track_auto_promote_func` — auto_promote_track_level_for_user 함수

**신규 함수**: `auto_promote_track_level_for_user(user_id, track_id)`
- Pool: v_level = current_track+1 AND track-specific tag
  - csat_korean → csat-prep-core-2k OR csat-prep-ext-1.8k
  - business_english → bsl_1.20
  - academic_english → nawl_1.2
- Mastery: ≥3 successful + last correct (30일 window)
- threshold: 15 (base 20보다 적음 — track 풀이 좁음)
- 상향 시 user_profiles.current_track_levels JSONB UPDATE + snapshot (scope=track, source=track_auto_promotion)

**Cron wrapper v2 (4-col)**: `cron_auto_promote_all_users()`
- 진단 완료 사용자 순회 (current_v_level > 0)
- base v_level (V11 미만) auto_promote
- 3 tracks (csat/business/academic) 각각 (L10 미만) auto_promote_track
- 예외 isolated per call
- 반환: `(total_users, base_promoted, track_promoted, failed)`

**Smoke test PASS**:
- 진단 미완료 사용자 → "track 진단 미완료" 정합 메시지
- cron wrapper: total=1 (V11+csat=6 사용자), base 0 (V11 skip), track 0 (학습 데이터 없음), failed 0
- 함수 분기 + JOIN 정확 작동

**기존 pg_cron job**: 'vrl-auto-promote-daily' (jobid=8, `0 18 * * *`) — wrapper 시그니처만 바뀌었으므로 job 그대로 작동

**한국 학습자 정합**:
- base + 3 tracks 자동 상향 = 다축 학습 진척 자연 반영
- threshold 15 = track 풀 좁음 반영 (base 20보다 낮음)
- snapshot scope=track + source=track_auto_promotion = audit chain 명확
- 새벽 KST 03:00 일별 실행 = 학습 시간 안 침범

**E2E 자동화 완전 통합**:
1. 진단 (base + 3 tracks) → V-Level + track_levels 초기값
2. 추천 단어장 (5-tier 자동: V + interests + track-based)
3. 학습 누적 → learning_records (다양한 V-Level + track tag)
4. **매일 새벽 03:00 KST — cron wrapper**:
   - base v_level i+1 mastery check → promote if ≥20
   - csat_korean i+1 check (csat-prep tagged) → promote if ≥15
   - business_english i+1 check (bsl tagged) → promote if ≥15
   - academic_english i+1 check (nawl tagged) → promote if ≥15
5. 갱신된 levels → 다음 접속 시 새 추천 + history snapshot

**Phase 2 통합 완성 (13 layer DB + 8 frontend)**:
DB:
- ✅ 2A.2 / 2B.1 / 2B.2 / 2B.3 / 2C.1 / 2C.2 / 2D / 2D.2 / 2D.3 / 2E / 2F / 2G / **2H**

Frontend:
- /diagnostic v2 (test-agnostic) / Sidebar / WordVault hub 추천 + Set wire-up / VLevelPromotionCheck / history timeline + 통합 + track scope 분기

**모니터링 권장 (Phase 3)**:
- cron.job_run_details 일별 통계 → admin dashboard
- promoted 사용자 알림 (push/email — 의미있는 상향 시)
- track별 promotion 추세 시각화

**다음 후보**:
- comprehensive 진단 (모든 axis 통합 single test)
- Admin dashboard (cron 통계 + snapshot 분포)
- Auto-promotion UI 갱신 (current 버튼이 base만 — track도 표시)

관련: [[vrl-phase2e-auto-promote]] [[vrl-phase2g-pg-cron-promotion]] [[vrl-phase2f-track-snapshot-chain]] [[claude-code-is-llm]]

