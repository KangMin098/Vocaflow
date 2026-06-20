> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2e_promotion_check_ui.md
> category: project

---

Phase 2E `auto_promote_v_level_for_user` 함수 frontend wire-up 완료 2026-05-25. 사용자 명시 trigger로 학습 누적 V-Level 갱신 확인.

**신규 파일**: `apps/web/src/components/wordvault/hub/VLevelPromotionCheck.tsx`

**통합 위치**: `RecommendedSetsSection` 카드 그리드 하단 (진단 완료 사용자만 노출)

**3-state UI**:
| state | 표시 |
|---|---|
| 초기 | "갱신 확인" 버튼 + 설명 "최근 30일 학습으로 다음 단계 진입 여부 확인" |
| 미진단 결과 | "진단 미완료 — /diagnostic 진단 완료 필요" 메시지 |
| not yet (조건 미충족) | mastered/threshold 진행도 bar + reason 텍스트 |
| **promoted** | **축하 메시지 V{old} → V{new} + Sparkles + active 컬러 + 1.2초 후 router.refresh()** |

**자동 trigger 회피 이유 (UX)**:
- mount-on-call 자동 호출 시 사용자 혼란 (V-Level 갑자기 변경)
- 명시 클릭 = 사용자 자율성 + 통제감 (SDT 정합)
- 단, promotion 시 router.refresh() → 추천 자동 갱신 (Phase 2D.2)

**한국 학습자 정합**:
- Sparkles + active(앰버) 색 = 성취 보상 (도파민 — 과한 폭죽 X, Calm UI)
- 진행도 bar = Implicit Progress
- "V5 → V6" 시각 표시 = 명확한 단계 변화

**E2E loop 완성 (Phase 2 마지막 단계)**:
1. 진단 (1회) → V-Level 초기값
2. 추천 단어장 학습 누적
3. **WordVault hub 진입 → 추천 카드 아래 "갱신 확인" 버튼**
4. 클릭 → auto_promote RPC
5. promoted → 축하 + 새 V-Level + 추천 자동 갱신 (router.refresh)
6. Library Krashen i+1도 자동 갱신

**대안 trigger (Phase 3 가능)**:
- 학습 세션 종료 시 silent 자동 호출 (FlashcardSession/SpellForge complete handler)
- pg_cron 일별 모든 사용자 자동 promotion 체크
- WordVault hub mount 시 silent 호출 (debounced, 일별 1회 제한)

**Phase 2 통합 완료 (이 세션 누적)**:
- ✅ 2A.2 analyze + apply 함수
- ✅ 2B.1 진단 시드 40문항
- ✅ 2C.1 V-Level 단어장 9개 (1,600)
- ✅ 2C.2 specialty 단어장 4개 (902)
- ✅ 2D 추천 3-tier + 2D.2 specialty opt-in
- ✅ Frontend /diagnostic (3-phase)
- ✅ Sidebar 진단 메뉴
- ✅ WordVault hub 추천 통합 + Set 카드 wire-up
- ✅ 2E auto_promote 함수
- ✅ **2E wire-up UI** (이 문서)

**다음 후보**:
- Phase 2B.2 track/domain 진단 (csat/business/medical 축별)
- 진단 history UI (snapshots audit chain 시각화)
- pg_cron 자동 promotion (Edge Function)

관련: [[vrl-phase2e-auto-promote]] [[vrl-phase2-wordvault-recommended-section]] [[claude-code-is-llm]]

