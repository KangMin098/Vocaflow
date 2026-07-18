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

- **G2** `content_gate_publishable(scope,id)`(critical FAIL 있으면 false·I10 제외) → `publish_book_word_sets`·`publish_article_word_set`·`republish_*` 가드. broken 콘텐츠 게시 차단.
- **재발행 완료** `republish_book_word_sets`·`republish_article_word_set`(**set_id 보존**·shared_words만 교체=구독/진행 안전) → 전 발행 도서 20권+아티클 135세트 SSoT 재동기. **I10 전량 해소(P&P 770→0)**. D1/D4a 학습자 반영. ⚠배치는 도서당 select 다중호출로 무거움 → 큰 책 개별 실행(한 statement 타임아웃=전체 롤백).

**최종 상태**: 전역 critical(I1·I5·I7·I8·I9·I11) 전부 PASS · 도서 I10 PASS · I2만 WARN 343. **루프 완성: 정확성 자동검증(G4 cron)→게시전 차단(G2)→게시후 재발행(republish)**.

**4 파이프라인 전체 커버(`gate_acp_vcb_coverage`)**: scope=global|book|article|**word_set**|dict.
- **LCP** book scope + end-to-end 실증: 소스GET(Ozma of Oz queued)→`reprocess-book.mjs --commit`(ingest→추출2785→v7/B1→ready)→게이트 PASS→G2 publishable. 큐레이션 CLI=reprocess-book.mjs(LCP)·ACP는 `/api/acp/dev-process`(dev서버).
- **ACP** article scope + 전역 **I11 라이선스**(copyright_safe_in_kr). ingesters=packages/library-pipeline/src/ingest-article/*(nasa/voa/wikipedia…)+analyzeArticle.
- **VCB** 전역 I5/I7 을 **전 발행 세트**로 broaden(큐레이션 세트 41: themed/csat/high/…) + **word_set scope**. 즉시 '중등 기본어휘' technic(archaic) 검출→`vcb_noise_cleanup` 전세트 노이즈 정리.
- G3 게시전 체크 드롭다운=published+ready+queued(미발행 소스GET 노출). ⚠ G3 GateCheckClient 는 book/article 만 — word_set(VCB) UI 토글 미추가(함수는 지원).

**일반 원칙(중요)**: 추출 로직(select_*_vocab)을 개선하면 **전 발행 콘텐츠가 재발행 전까지 stale** — I10 게이트가 이를 가시화. 로직 변경 후엔 republish 배치 필요.

관련 [[project_ext_quality_p0_harness]](D1 바인딩·D4a freq·D2/D3 하네스) · [[feedback_supabase_migrations]] · [[book_vocab_ssot_unify]].

