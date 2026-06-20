> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2f_track_snapshot_chain.md
> category: project

---

Phase 2F — `analyze_and_apply_track_diagnostic_result` 함수가 snapshot audit chain 생성하도록 확장 완료 2026-05-25.

**Migration 시퀀스** (CHECK constraints 5차례 만나며 발견):
- v1: snapshot_id RETURN 추가 → return type 변경 차단
- v2: 시그니처 유지 + INSERT
- v3: v_level_delta GENERATED column → INSERT 제외
- v4: snapshot_type='diagnostic' 차단 (CHECK: initial/level_change/scheduled/manual/reset)
- v5: taken_reason='track_diagnostic_completed' 차단 (CHECK: initial/diagnostic/self_declared/mastery_calc/scheduled/manual_override)
- v6: triggered_by='diagnostic_track_apply' 차단 (CHECK: api/cron/admin/system/internal)
- **v7: v_level_meta required keys 추가 (level/source/confidence/estimated_at/status)** ✅ 최종

**최종 INSERT 구조**:
```sql
user_level_snapshots (
  user_id, v_level (=current), v_level_meta (5 required keys + track_id),
  previous_v_level (=current), -- delta는 GENERATED 자동 계산
  track_levels (JSONB merged),
  taken_reason='diagnostic',
  diagnostic_result_id,
  snapshot_meta={test_id, track_id, est_level, prev_level, delta, confidence, per_level, scope='track'},
  snapshot_type='level_change',
  triggered_by='internal',
  trigger_details={caller, result_id, track_id},
  previous_snapshot_id (chain)
)
```

**HistoryTimeline 확장**:
- REASON_STYLES에 track_diagnostic_completed 추가 (Target icon + p-dark) — 사용 X (taken_reason='diagnostic')
- 실제 구분: snapshot_meta.scope === 'track' 또는 snapshot_meta.track_id 존재 시 track 모드 렌더
- track 모드: L{prev}→L{est} + track_id 라벨 (V-Level 대신)
- DiagnosticClient + /diagnostic/history 모두 snapshot_meta 필드 select 추가

**Smoke test PASS** (CSAT track V2-V6 100%, V7-V8 0%):
- est=6 (V≤6 100% correct → ≥70% threshold)
- snapshot.taken_reason='diagnostic'
- snapshot.scope='track' (snapshot_meta)
- snapshot.track_levels={csat_korean:6}
- HistoryTimeline에 표시 가능

**한국 학습자 정합**:
- 진단(base) + 진단(track) + 자동상향 + 수동조정 audit chain 단일 timeline
- track 진단별 변천사 추적 (csat 발전, business 발전 등)
- 미래 학습 데이터(2E) + 추천(2D.3) + history 통합

**E2E loop 완성 (Phase 2 모든 axis snapshot 기록)**:
1. base 진단 → snapshot (v_level 변경, scope unset)
2. track 진단 → snapshot (v_level 유지, track_levels 변경, scope=track)
3. 자동 상향 → snapshot (v_level 변경, taken_reason=mastery_calc — Phase 2E)
4. 수동 조정 → snapshot (taken_reason=manual_override)
5. /diagnostic/history + /diagnostic start inline 두 위치에서 표시

**Frontend 갱신**:
- DiagnosticClient.tsx: snapshot_meta column select 추가
- /diagnostic/history/page.tsx: snapshot_meta column select 추가
- HistoryTimeline.tsx: snapshot_meta interface 추가 + track 모드 분기 렌더

**Phase 2 진척 (이 세션 누적)**:
- ✅ 2A.2 / 2B.1 / 2B.2 / 2B.3 / 2C.1 / 2C.2 / 2D / 2D.2 / 2D.3 / 2E / **2F** (이 문서)
- Frontend: /diagnostic v2 + Sidebar + WordVault hub 추천 + Set wire-up + VLevelPromotionCheck + history 통합

**알려진 한계**:
- CHECK 제약 단계별 발견 — 초기 schema design 단계에서 enum 명세 부재 (학습 효과)
- track 진단마다 snapshot 생성 → snapshots row 증가 (acceptable, audit 용)
- HistoryTimeline에서 track snapshot이 V-Level과 같은 timeline에 섞임 (의도된 통합)

**다음 단계**:
- pg_cron 자동 promotion (silent 일별)
- comprehensive 진단 (모든 axis 결합)

관련: [[vrl-phase2a2-analyze-apply]] [[vrl-phase2b2-csat-track-diagnostic]] [[vrl-phase2-diagnostic-history-ui]] [[claude-code-is-llm]]

