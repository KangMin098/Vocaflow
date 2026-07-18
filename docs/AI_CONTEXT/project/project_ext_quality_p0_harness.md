> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_ext_quality_p0_harness.md
> category: project

---

추출 품질 심층 평가(v06.270) — "최고 수준" 측정 명제화. 리포트=`docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md`.

**🔴 최대 발견 — 표제어 바인딩 결함(신규, Q1 미커버 축)**: `select_*_vocab` 가 pre-stem 된 `bv.lemma`(파생/부정접두 과잉 축약)를 바인딩 → 학습자에게 **반대 뜻** 노출(imprudent→prudent, insincere→진심의, forbearance→조상). 발행 782 오바인딩·654 POS·36 반의어 플립. 기존 "추출신뢰 40,355 표제어 100% 검증"은 *표제어*를 검증했지 *표면→표제어 바인딩*을 안 함. 판정 하네스로도 안 잡힘(이미 바인딩된 단어 판정).

**완료(committed·pushed, feat/plan-ui)**:
- **D1** migration `fix_extraction_surface_headword_binding`: `select_book_chapter_vocab`·`select_article_vocab` JOIN — 표면형이 자체 quality 표제어면 그것으로 바인딩(아니면 `resolve_dict_headword` 폴백). resolver 는 이미 exact-first라 근본은 호출부. 782/782 재바인딩·+143 회수·발행세트 refresh 불요·`bv.lemma` 원본 무수정.
- **D2** `extraction_judgments` 테이블(composite/sort_order 스냅샷 보존).
- **D3** `/admin/quality/judge` blind 판정 하네스: `get_judgment_sample`(in-cap 8+경계 8 셔플·출처은닉) + `save_extraction_judgment`(저장시점 SSoT 재조회로 스냅샷 서버-권위=blind보존) + RLS `ej_admin_all`. 절대/쌍대 모드·precision/recall reveal. typecheck0·RPC 실데이터 검증. **런타임 UI 스모크 미실시**(admin 세션 필요·전용 e2e spec 권장).

**pending(사용자 결정 필요)**:
- **D4 freq_rank 백필**: working set 20,678 중 freq_rank 30%(6,204) 결측(composite 0.40 가중 사장 → expository rank_lift 1.22 최약). 단 **4,816(77%)은 무신호=rare tail(NULL이 사실상 정당)**, ~1,388만 신호보유(freq_band 1,349·list_tags 525·KICE 238). → 소스 결정 필요(kaikki freq? 외부corpus 확장? or 신호보유분만 proxy 매핑).
- **D5 V6 게이트 register-인식화**: 고정 v_level≥6 게이트가 수능-코어 저V어 배제(P&P ch18 KICE 30개 gated). 수능-track 콘텐츠엔 게이트 완화? 단 리터러리는 유지. **"수능 트랙" register 콘텐츠는 현재 0건**(수능=준거 리스트지 register 아님).

기타 확정: Phase B per-sense v_level 백로그 사실상 종결(전역 343·ws 68 — 설계의 "5,170"은 stale). KICE 코어=`lexicon_frequencies` source_id=1 tier≥3=1,394. 관련 [[project_extract_trust_roadmap]] [[project_dict_field_completeness]] [[feedback_handoff_workflow]].

