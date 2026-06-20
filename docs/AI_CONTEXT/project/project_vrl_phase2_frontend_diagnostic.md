> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_vrl_phase2_frontend_diagnostic.md
> category: project

---

Phase 2 Frontend `/diagnostic` 라우트 구현 완료 2026-05-25. DB 인프라(2A.2+2B.1+2C.1+2C.2+2D+2D.2) 모두 활성화하는 UI loop.

**신규 파일**:
1. `apps/web/src/app/(main)/diagnostic/page.tsx` — Server Component entry + metadata
2. `apps/web/src/components/diagnostic/DiagnosticClient.tsx` — 3-phase Client Component
3. Sidebar META_ITEMS에 '진단' 메뉴 추가 (Compass 아이콘)

**DiagnosticClient 3-phase 구조**:
| phase | UI | 동작 |
|---|---|---|
| **start** | 진단 소개 + 시작 버튼 | `vrl_diagnostic_questions` fetch (test_id 36b70feb...) order by display_order |
| **question** | 단어 카드 (Lora 48px) + 진행도 bar + 알아요/모릅니다 | 응답 누적 → 마지막 문항 자동 submit |
| **submitting** | spinner | INSERT user_diagnostic_results → RPC analyze_and_apply_diagnostic_result |
| **results** | V-Level 결과 + interests 선택 + 추천 카드 | RPC recommend_word_sets_for_user(user, interests) |

**Frontend ↔ DB 연동**:
1. `supabase.from('vrl_diagnostic_questions').select().eq('test_id', TEST_ID).order('display_order')` — 40 문항 fetch
2. `supabase.from('user_diagnostic_results').insert({user_id, test_id, responses}).select('id').single()` — 응답 저장
3. `supabase.rpc('analyze_and_apply_diagnostic_result', {p_result_id})` — 분석 + apply (2A.2 wrapper)
4. `supabase.rpc('recommend_word_sets_for_user', {p_user_id, p_interests})` — 추천 (2D.2)

**UX 정합 (CLAUDE.md Calm UI + Active Recall)**:
- 단어 카드: Lora serif 48px (영어 학습 폰트 일관)
- 알아요/모릅니다 (Recognition 메타인지) — 정답이 아닌 자가판정 (Karpicke 2008)
- 진행도 1.5px bar (Implicit Progress · v_dur-slow ease-out)
- 결과 Hero: gradient bg (var(--p-dark) → var(--p)) + s2 스케일 V-Level 강조
- Interest 선택: 토글 카드 (의학🩺·비즈💼·문학📚·학술🎓) — SDT 자율성
- 추천 카드: type별 배지 색 (primary=p / stretch=active / review=bg3 / specialty=info-light)
- "WordVault로 이동" CTA — 흐름 이어주기

**활용 흐름 (E2E)**:
1. 사용자 Sidebar에서 '진단' 클릭 → `/diagnostic`
2. 진단 시작 → 40 문항 순차 응답 (5분)
3. 자동 submit → analyze + apply → user_profiles.current_v_level UPDATE
4. V-Level 결과 표시 + 3-tier 추천 자동 fetch
5. (옵션) 관심 도메인 선택 → specialty 추가 추천 실시간 갱신
6. WordVault 이동 → 단어장 구독 → 학습 시작
7. Library 단어 추출도 자동 i+1 활성화 (별도 UI 필요 없음 — 이미 wired)

**의존성**:
- Supabase auth 활성화 (`supabase.auth.getUser()` 필요)
- RLS 정책: user_diagnostic_results INSERT/SELECT 본인 user_id만 (가정)
- RPC 함수 SECURITY DEFINER (search_path=public) — 클라이언트에서 직접 호출 가능

**알려진 한계 / TODO**:
- 진단 응답 재시도 UI 없음 (1회 진단만 — Phase 2 후반에 history 관리)
- Interest 저장 위치 없음 (transient state — user_profiles에 저장 시 영구화 가능, Phase 2D.3)
- 문항 셔플 없음 (display_order 고정 — 학습자가 진단 반복 시 같은 순서)
- 진단 중단/재개 X (sessionStorage 등 활용 시 가능)

**Phase 2 통합 진척 (이 세션 누적)**:
- ✅ 2A.2 analyze + apply 함수
- ✅ 2B.1 진단 시드 40문항
- ✅ 2C.1 V-Level별 단어장 9개 (1,600 row)
- ✅ 2C.2 specialty 단어장 4개 (902 row)
- ✅ 2D 단어장 추천 함수 (3-tier)
- ✅ 2D.2 specialty opt-in (4-tier)
- ✅ **Frontend /diagnostic** (이 문서)

**다음 단계 후보**:
- Phase 2B.2: track/domain 진단 추가
- 학습 활동 누적 기반 V-Level 자동 상향 (FSRS mastery 결합)
- WordVault hub 추천 카드 통합 (현재 진단 결과 페이지에만 노출, hub에서도 표시)
- 진단 history UI (user_level_snapshots audit chain 시각화)

관련: [[vrl-phase2d2-specialty-optin]] [[vrl-phase2d-recommend-word-sets]] [[vrl-phase2c2-specialty-word-sets]] [[vrl-phase2c1-auto-vlevel-word-sets]] [[vrl-phase2b1-diagnostic-seed]] [[vrl-phase2a2-analyze-apply]]

