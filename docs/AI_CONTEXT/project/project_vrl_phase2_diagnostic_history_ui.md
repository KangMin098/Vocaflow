> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2_diagnostic_history_ui.md
> category: project

---

진단 history UI 완료 2026-05-25. user_level_snapshots audit chain 시각화 — 진단·학습·수동 갱신 시간 순.

**신규 파일**:
1. `apps/web/src/app/(main)/diagnostic/history/page.tsx` — Server Component (RLS 본인 fetch)
2. `apps/web/src/components/diagnostic/HistoryTimeline.tsx` — Client timeline

**Timeline 시각**:
- vertical timeline (좌측 dot + connector + 우측 카드)
- dot: taken_reason별 아이콘 + 색
  - diagnostic_completed: Compass + var(--p) 보라
  - auto_promotion: Sparkles + var(--active) 앰버
  - self_declared: Settings + var(--info) 시안
  - learning_data: Brain + var(--success) 초록
  - manual_override: Activity + var(--warning) 주황
- 카드: 배지(reason) + 날짜 + V{prev}→V{curr} + delta(+1/-1) + confidence%

**데이터 흐름**:
1. /diagnostic/history → Server Component fetch user_level_snapshots
2. RLS 정책: user_id = auth.uid() (본인만)
3. ORDER BY taken_at DESC
4. HistoryTimeline 렌더 → 시각

**Empty state**:
- snapshots 없음 → "/diagnostic 완료 시 첫 snapshot 생성" 안내

**진입점**:
- /diagnostic 결과 phase 하단 "V-Level 변천사 보기 →" 링크
- **/diagnostic start phase 하단 INLINE timeline** (2026-05-25 통합 — Sidebar 별도 메뉴 → /diagnostic 페이지 내부 통합 · 사용자 명시 요청)
- /diagnostic/history sub-route 보존 (deep link 가능)
- ~~Sidebar '내 변천사' 메뉴~~ → 제거 (진단 페이지 통합)

**통합 변경 (2026-05-25)**:
- Sidebar METAITEMS '내 변천사' 제거 (Activity 아이콘 import도 제거)
- DiagnosticClient에 `HistorySnapshot` interface + `snapshots` state + start phase fetch 추가
- start phase 하단에 `<HistoryTimeline snapshots={snapshots} />` inline (최근 10건)
- 진단 페이지 1곳에서 진단 시작 + 변천사 둘 다 가능

**한국 학습자 정합**:
- vertical timeline = 시간 순 자연 흐름
- color-coded by source = 시각 빠른 파악
- delta 표시 = 성장 visualization (Implicit Progress 정합)
- confidence % = 메타인지 보조 (학습자가 진단 신뢰도 인지)

**Phase 2 전체 완료 자산 (이 세션)**:
DB:
- ✅ 2A.2 analyze + apply
- ✅ 2B.1 진단 시드 40문항
- ✅ 2C.1 V-Level 단어장 9개 (1,600 row)
- ✅ 2C.2 specialty 단어장 4개 (902 row)
- ✅ 2D 추천 3-tier
- ✅ 2D.2 specialty opt-in
- ✅ 2E auto_promote 함수

Frontend:
- ✅ /diagnostic 라우트 (3-phase)
- ✅ Sidebar 진단 메뉴
- ✅ WordVault hub 추천 통합 + Set wire-up
- ✅ Phase 2E wire-up UI (VLevelPromotionCheck)
- ✅ **/diagnostic/history (이 문서)**

**다음 후보**:
- Phase 2B.2 track/domain 진단 (csat/business/medical 등 축별)
- pg_cron 자동 promotion (silent 일별 갱신)
- Sidebar에 history 메뉴 추가

관련: [[vrl-phase2-frontend-diagnostic]] [[vrl-phase2e-promotion-check-ui]] [[vrl-phase2a2-analyze-apply]]

