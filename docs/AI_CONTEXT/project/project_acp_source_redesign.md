> AUTO-GENERATED — `scripts/sync-export-memory.mjs` 가 갱신. 손으로 편집하지 말 것.
> source: C:/Users/kille/.claude/projects/c--Users-kille-Vocaflow/memory/project_acp_source_redesign.md
> category: project

---

v06.35 (2026-06-08) — ACP(article) 소스 재설계 구현. 스펙 [docs/ACP_SOURCE_REDESIGN.md](../../../../Vocaflow/docs/ACP_SOURCE_REDESIGN.md). ACP 는 PoC(5건)라 전방 설계.

**적용된 migration 3종**:
- `20260608120000_acp_license_register_gate` — library_articles 에 register/lexical_noise/license_class/display_only 컬럼 + `acp_classify_license(text)` + BEFORE INSERT/UPDATE 트리거(license→license_class→copyright_safe/display_only 자동, 보수적 기본 restricted, NC 차단, CC-BY-ND→display_only).
- `20260608123000_acp_nd_display_only_gate` — `trg_publish_article_word_set`·`subscribe_article_word_set` 가 display_only(ND) 글의 단어세트 발행/구독 SKIP.
- `20260608126000_acp_lexical_noise_gate` — 발행 트리거에 `lexical_noise<=0.08` 추가. 최종 게이트: `published AND NOT display_only AND noise<=0.08` 일 때만 단어세트 발행.

**신규 ingester (packages/library-pipeline/src/ingest-article/)**: `_mediawiki.ts`(공용) + `simple-wikipedia.ts`(CC-BY-SA, A2~B1 설명) + `wikinews.ts`(CC-BY, A2~B2 시사) + `the-conversation.ts`(CC-BY-ND, B2~C1 논증 — HTML 정규식, **라이브 튜닝 필요**). `computeLexicalNoise`(_helpers). enqueue route HOST_TO_SOURCE+dispatch, admin AcpClient 탭(📘📣🗞, URL-only RssFeedTab feeds=[]), register×cefr 매트릭스 섹션.

**arXiv**: 루틴 UI 제거(라이선스 비자유 기본·C2+·LaTeX 오염). ingester/enqueue API 는 격리용 보존.

**핵심 통찰**: article→texts verbatim 복사(start-learning.ts)는 ND 허용, 워크스페이스 단어주석은 library_book 전용이라 article 은 이미 본문+클릭툴팁만 표시 → ND 워크스페이스 수술 불요. 게이트는 "파생 단어세트 배포"만 차단.

**미완/제외 (정직한 재판정)**:
- OpenStax — **§19 설계 완료 (2026-06-28, PR #48, `docs/ACP_OPENSTAX_DESIGN.md`)**. 구조 실측: `github.com/openstax/osbooks-*` → `collections/*.collection.xml`(라이선스 권위) + `modules/m<id>/index.cnxml`(본문). 프로토타입 ingester `ingest-article/openstax.ts`(cnxmlToPlainText: MathML/figure/exercise/equation 제거) — biology m45417 18,544자 클린 산문 noise 0 검증, typecheck 통과. **🔴 결정적 차단: OpenStax 인기 교재 10종 전부 CC-BY-NC-SA(NonCommercial) → `acp_classify_license`='restricted' 차단**(상업 의도 서비스엔 정확). 기술 통합은 완료, 차단은 라이선스 1건 — DB 등록(O1~O5)은 **결정**(CC-BY 타이틀 한정/비상업 commitment/보류) 대기, 마이그레이션 0. ingester 만 대기 머지.
- Smithsonian OA — CC0=소장품 메타(산문 아님), Magazine=유료 → 소스 부적합, 제외.
- NIH→MedlinePlus 분리 — 문서별 article_v_level 실측이 난이도 분리 담당, 별도 source 분리 보류.
- 신규 ingester **라이브 fetch 검증 ✅ 2026-06-28** (read-only, DB write 없음): Simple Wikipedia 3건·The Conversation 1건 실 fetch + curation score 정상 / Wikinews 0건(소스 비활성 — fetch 성공, 30일 신규 없음, 기존 발견 정합). list 경로(외부 소스 연결 + curation spec) 검증됨. **잔여**: full DB-write ingest(공유 prod DB write — 분류기 차단, admin dev-process 또는 명시 승인 필요) · the-conversation articleBody 정규식은 단건 ingestTheConversationArticle 시 검증(list엔 미포함). **C2 는 "마이그레이션 대기" 아님 — 이미 구현·적용·fetch검증 완료** (세션 백로그 framing 오류 정정).

관련: [[book_vocab_ssot_unify]] (도서 쪽 동등 작업), [[feedback_supabase_migrations]].

