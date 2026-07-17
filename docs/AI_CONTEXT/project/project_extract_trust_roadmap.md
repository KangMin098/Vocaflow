> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_extract_trust_roadmap.md
> category: project

---

학습자 신뢰용 "완벽한 단어추출" 전략. 순서 = **새는 곳 막기 → 틀려도 고칠 수 있게 → 채우기 → 자랑하기** (완벽 선증명 대신 교정가능성 우선).

- **0단계 세보기** ✅ — 검증범위 = 실사용 표제어 22,086개(45k 아님), 실사용 다의어 6,849.
- **1단계 새는 곳 막기(경로 통합)** ✅ — 3 추출경로(책 `select_book_chapter_vocab`·글 `select_article_vocab`·BYO `extract_vocabulary_for_user_v2`)를 공유 `resolve_dict_headword`(direct→cluster→규칙역굴절→파생strip) + `infer_form_pos`(형태→POS sense 선택)로 통합. 마이그 `20260713150000`~`172500`. 전후 diff=0(helper refactor 회귀검증). **굴절/파생형도 추출 + 그 형태의 POS 뜻 표시**(children→child 뜻 아닌 아동복수, ransomed→동사 뜻).
- **2단계 틀려도 고칠 수 있게** ✅ (2026-07-16, v06.248) — `word_familiarity` 테이블(**lemma 단위**·RLS) + `set_word_familiarity` RPC + `word_mislevel_signal` 뷰(과대/과소난이도 신호). BYO 추출이 `verdict='known'` 제외. `ExtractionPanel` 알아요/몰라요 버튼(낙관적·known 페이드). 저장은 lemma+`extracted_surface`(SRS 형태별쪼갬 방지). 마이그 `20260713180000`/`180500`. commit `07f3124` feat/plan-ui.
- **3단계 채우기** ✅ 기반 완성 (2026-07-16 검증) — 추출 대상 40,355: **meaning/pos/cefr/sense별 pos = 100%**(뜻·POS 안 틀림), example 95.5%. 다의어 병렬세션 수렴. [[project_dict_context_sense_matching]] 계열. **잔여=정밀도 백로그(Phase B, 비차단)**: 다의어 7,420개 sense별 v_level 결측 → flat 폴백(난이도 근사, 뜻 아님). 우선순위 실사용∩multi-POS 5,170. 신규 툴 명세 = `scripts/dict/SENSE_COMPLETION_MULTISESSION.md` §Phase B. 사용자 판단(2026-07-16): 기반 완성 선언, 정밀도는 백로그.
- **4단계 자랑하기** ✅ (2026-07-16, v06.249) — 추출 근거 카드. `buildReasons(r)` 순수헬퍼가 `score_breakdown`→사람 말투 근거(트랙빈출·i+1난이도·빈도·형태해소). ExtractionPanel: 인라인 절제(generic 제외) + expand "왜 추천했어요?" 카드. commit `66df002`.

잔여 deferred: winkNLP를 BYO /text 라이브 RPC에 연결(context_pos parity — 현재 배치 스크립트에만). "문맥 뜻 먼저 보여주기".

⚠️ 규칙 대량 표제어 생성 금지(abashederness 쓰레기 롤백 교훈) — 런타임 해소만. [[project_extraction_coverage_design]]

