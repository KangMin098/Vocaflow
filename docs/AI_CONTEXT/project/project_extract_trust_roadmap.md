> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_extract_trust_roadmap.md
> category: project

---

학습자 신뢰용 "완벽한 단어추출" 전략. 순서 = **새는 곳 막기 → 틀려도 고칠 수 있게 → 채우기 → 자랑하기** (완벽 선증명 대신 교정가능성 우선).

- **0단계 세보기** ✅ — 검증범위 = 실사용 표제어 22,086개(45k 아님), 실사용 다의어 6,849.
- **1단계 새는 곳 막기(경로 통합)** ✅ — 3 추출경로(책 `select_book_chapter_vocab`·글 `select_article_vocab`·BYO `extract_vocabulary_for_user_v2`)를 공유 `resolve_dict_headword`(direct→cluster→규칙역굴절→파생strip) + `infer_form_pos`(형태→POS sense 선택)로 통합. 마이그 `20260713150000`~`172500`. 전후 diff=0(helper refactor 회귀검증). **굴절/파생형도 추출 + 그 형태의 POS 뜻 표시**(children→child 뜻 아닌 아동복수, ransomed→동사 뜻).
- **2단계 틀려도 고칠 수 있게** ✅ (2026-07-16, v06.248) — `word_familiarity` 테이블(**lemma 단위**·RLS) + `set_word_familiarity` RPC + `word_mislevel_signal` 뷰(과대/과소난이도 신호). BYO 추출이 `verdict='known'` 제외. `ExtractionPanel` 알아요/몰라요 버튼(낙관적·known 페이드). 저장은 lemma+`extracted_surface`(SRS 형태별쪼갬 방지). 마이그 `20260713180000`/`180500`. commit `07f3124` feat/plan-ui.
- **3단계 채우기** 🔶 — 다의어 sense 완성은 병렬세션(V1~V11)으로 대량 수렴(~9,903 multi-sense; 잔여=legit 단일POS). [[project_dict_context_sense_matching]] 계열 참조. 잔여: 22,086 실사용 표제어로 **범위 좁힌** 검증.
- **4단계 자랑하기** ⬜ — 추출 근거 카드(왜 이 단어인가: V-Level·threshold·track). score_breakdown jsonb 이미 반환 중, UI 미노출.

잔여 deferred: winkNLP를 BYO /text 라이브 RPC에 연결(context_pos parity — 현재 배치 스크립트에만). "문맥 뜻 먼저 보여주기".

⚠️ 규칙 대량 표제어 생성 금지(abashederness 쓰레기 롤백 교훈) — 런타임 해소만. [[project_extraction_coverage_design]]

