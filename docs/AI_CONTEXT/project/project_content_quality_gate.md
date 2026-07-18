> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_content_quality_gate.md
> category: project

---

**목적(사용자 강조로 정확히)**: 기능 테스트가 아니라 **학습자에게 나갈 산출물이 "맞는 단어·맞는 뜻·맞는 레벨"로 정확히 뽑혔나**를 결정론 불변식으로 검증 → 관리자 게시 신뢰. 실패=사전DB/파이프라인 수정 신호. 대상=단어추출·LCP·ACP·VCB·사전DB. (v06.271)

**핵심 갭 발견**: `quality_metrics`(nightly jobid=12) 7지표는 전부 **부피·완비율**이고 정확성 검사 0이었음. P0 결함(반의어 바인딩·gated KICE)은 전부 수동 발견 — 자동 감시 부재.

**완료(committed·pushed feat/plan-ui)**:
- **F** `content_quality_gate_fixes_F`(승인·DELETE 포함): **I7 발행세트 노이즈 junk 9건 제거**(xl/mph/bc/cl/ft 약어 — 학습자 노출 중이던 것, 현 로직이면 게이트 제외) + word_count 재동기 + **F.2** 발행도서 resolvable NULL lemma 백필→0(COALESCE로 출력 무변).
- **G1** `run_content_quality_gates(scope, id)` — scope=global|book|article|dict. 불변식: 사전DB(I1 필드완비·I2 per-sense v_level) · 단어추출(I5 바인딩드리프트·I7 노이즈) · LCP(I6 resolvable NULL lemma·I8 book_v_level·**I10 발행세트 SSoT 드리프트**) · ACP(I9 register). critical FAIL=게시차단후보. **교훈: I6는 "모든 NULL"이 아니라 "사전 존재어인데 빈 것"으로 정의(비-사전어 오탐 방지)**.
- **G3** `/admin/quality/gates` — 전역 red/green + 콘텐츠별 게시전 체크(GateCheckClient). AdminSidebar '품질 게이트'(ShieldCheck).
- **G4** cron `content-gate-nightly`(KST 03:25) → `collect_content_gate_metrics` → `quality_metrics(stage='gate')`. `admin_collect_content_gate_metrics` 수동. quality_metrics.stage CHECK 에 'gate' 추가.

**현 상태**: 전역 게이트 critical 전부 PASS(F 후), I2만 WARN 343.

**⚠ 미완/결정 필요**:
- **G2 게시 전 게이트 wire**: publish RPC/Admin 버튼이 critical FAIL 시 차단 — **동작 변경이라 결정 필요**.
- **드리프트 도서 재발행**: 도서 게이트가 **P&P I10 SSoT 드리프트 770 검출** — D1/D4a 개선이 select 출력을 바꿔 발행 세트가 stale. 재발행 필요(publish_book_word_sets는 skip-existing → delete+republish 필요). 대량 배치라 결정 필요. **일반 원칙: 추출 로직 개선 시 전 발행 콘텐츠가 재발행 전까지 stale**.

관련 [[project_ext_quality_p0_harness]](D1 바인딩·D4a freq·D2/D3 하네스) · [[feedback_supabase_migrations]] · [[book_vocab_ssot_unify]].

