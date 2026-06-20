> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2_wordvault_recommended_section.md
> category: project

---

WordVault hub Tier 2 신규 — RecommendedSetsSection 통합 완료 2026-05-25. 진단 결과 페이지(/diagnostic) 외에도 hub 진입 시 추천 항상 노출.

**신규 파일**: `apps/web/src/components/wordvault/hub/RecommendedSetsSection.tsx`

**WordVault hub IA 갱신 (v6.20 → +RecommendedSets)**:
| Tier | 변경 |
|---|---|
| Tier 1 | Hero + VaultBar — Identity (변경 없음) |
| **Tier 2 (신규)** | **RecommendedSetsSection — VRL Placement 추천** |
| Tier 3 (기존 2) | BookShelfSection — Source/Level/Smart pivot |
| Tier 4 (기존 3) | CEFRDistribution — Level facet |
| Tier 5 (기존 4) | FindAndMore — 검색 진입 |
| Tier 6 (기존 5) | LearningDimensionSection — module_history 3그룹 |
| Tier 7 (기존 6) | MemoryDecayDistribution + TrendIndicator |
| Footer | WordPeekStrip (md+) |

**RecommendedSetsSection 동작 (3-state)**:
1. **미진단** (`current_v_level NULL/0` OR `diagnostic_completed_at NULL`): CTA 카드 "5분 진단으로 V-Level 추천 받기" → /diagnostic
2. **진단 완료**: `recommend_word_sets_for_user(user_id, NULL)` RPC → 3-tier 카드 그리드
3. **데이터 없음**: null return (sentinel)

**시각 정합 (CLAUDE.md Calm UI)**:
- 미진단 CTA: gradient bg (p-light → bg) + Compass icon + 진단 시작 CTA
- 추천 카드: 작은 grid (1열/2열/3열 반응형) — slim 카드 (28px emoji + truncate title)
- type별 배지 색: primary=p / stretch=active / review=bg3 / specialty=info-light / fallback=bg3
- header: "맞춤 추천" eyebrow + Sparkles + "다시 진단" 링크

**SDT 자율성 정합**:
- 추천은 노출만, 강제 X (클릭 시 set 페이지 진입 — 미구현, 향후 wire-up)
- "다시 진단" 항상 가능 — 사용자 자유
- specialty interests는 hub에서 노출 X — /diagnostic 결과 페이지에서만 (Phase 2D.2 wire-up 적시점)

**데이터 흐름**:
1. Component mount → useEffect:
   - `supabase.auth.getUser()` — userId 획득
   - `supabase.from('user_profiles').select(current_v_level, diagnostic_completed_at)` — 진단 완료 확인
   - `supabase.rpc('recommend_word_sets_for_user', {p_user_id, p_interests: null})` — 추천 fetch
2. State: `hasDiagnostic` boolean + `recommendations[]`
3. 미진단 OR fallback only → CTA / 그 외 → 카드 그리드

**알려진 한계 / TODO**:
- ~~카드 클릭 시 set 상세 페이지 진입 wire-up X~~ → ✅ 해결 2026-05-25: Link to `/library/vocab#set-${slug}` + VocabSetCard에 id + scroll-mt-24 + `target:ring-2` (URL :target pseudo로 자동 highlight)
- specialty interests 옵션 hub에 X — /diagnostic 결과 페이지에서만
- 추천 새로고침 트리거 X — 진단 재완료 시 컴포넌트 remount 필요 (next/navigation `router.refresh()`)
- Real-time 동기화 X — Supabase realtime channel 활용 가능 (Phase 2 후반)

**E2E loop 완성도 (이 세션)**:
- ✅ DB 인프라 (2A.2 + 2B.1 + 2C.1 + 2C.2 + 2D + 2D.2)
- ✅ Frontend /diagnostic 라우트 (3-phase)
- ✅ **WordVault hub 추천 카드 통합** (이 문서)
- ⏳ Sidebar 진단 메뉴 (이미 추가됨)
- ⏳ Set 카드 클릭 → 단어장 페이지 wire-up
- ⏳ 학습 활동 누적 → V-Level 자동 상향

관련: [[vrl-phase2-frontend-diagnostic]] [[vrl-phase2d2-specialty-optin]] [[vrl-phase2d-recommend-word-sets]] [[claude-code-is-llm]]

