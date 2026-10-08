# 영역 감사: 콘텐츠 파이프라인 (2026-10-09, origin/main a7c986469)

근거: DB SELECT 실측(아래 수치) + `apps/web/src/app`·`lib` 비관리자 grep. 깊이는 표면 수준(코드 실행 검증 없음) — 상태 판정은 "DB 산출물 + 학습자 소비 경로 존재" 기준.

## 공통 수치 (DB 실측 2026-10-09)
- library_books 401: published 312 · archived 83 · queued 6
- library_articles 91,793: ready 84,715 · archived 3,655 · queued 3,165 · published 250 · failed 7 · analyzing 1
- shared_word_sets 11,312 · library_chapter_quiz 2,453 · shared_dictionary 49,244 · texts 278
- shared_words ~681k(추정) · pending_words 26,322 · lexicon_clean ~455k · lexicon_frequencies ~8.4k
- pd_comic_issues 969 · pd_comic_series 101 · pd_comic_panels ~4.8k · comic_books 2 · comic_pages ~90
- csat_items 3,714 · csat_item_analyses ~7.3k · csat_dcp_items ~834k(추정) · csat_source_eligibility ~64k(+history ~162k) · csat_type_reports ~98
- knowledge_items 157 · methodology_claims 18 · methodology_sources ~64
- topic_corpus_docs 7,713 · topic_corpus_queue ~97k · topic_word_stats ~100k
- video_jobs 73(전부 stage=published) · video_requests ~1
- vrl_diagnostic_tests 5 · vrl_diagnostic_questions ~185
- textbook_* 테이블은 textbook_shelf_stats_meta·textbook_volume_renders(~19)뿐 — 교재 본문은 다른 테이블/파일 기반.

## 파이프라인별

| 파이프라인 | 코드/진입 | DB | 학습자 도달 | Admin help | 상태 |
|---|---|---|---|---|---|
| LCP 도서 큐레이션 | packages/library-pipeline, scripts/lcp, apply-book-difficulty.mjs 등 | library_books 312 발행 / chapters_master ~11k / book_vocabularies ~1.68M | /library/books, /text, /comics/adapted | curation.ts | VERIFIED_WORKING |
| ACP 기사 수집 | scripts/acp/collect-daily.mjs, check-acp-feeds.ts | articles ready 84,715 vs published 250 | /library/scripts 등 | articles.ts | PARTIAL — **공급 99.7% 미도달**(ready 적체) |
| VCB 어휘 | packages/vcb-core·vcb-curate-core, `pnpm vcb:*` 01~08, compose | shared_words ~681k, word_sets 11,312 | /library/vocab, /arcade, flashcard 등 | vocab.ts | VERIFIED_WORKING (shared_words 대비 소비 규모 미측정) |
| 단어세트/챕터퀴즈 | vcb:compose, scripts/lcp | word_sets 11,312, chapter_quiz 2,453 | /library/vocab, /scriptquiz | vocab.ts/curation.ts | VERIFIED_WORKING |
| VRL 분류·진단 | scripts/lcp(분류), vrl_* | diagnostic_tests 5 / questions ~185 / integrity_concerns ~82 | /diagnostic (DiagnosticClient) | vrl.ts | IMPLEMENTED_UNVERIFIED |
| WLP | packages/wlp, `pnpm test:wlp` | 전용 테이블 확인 안 됨 | 미확인 | 없음 | UNKNOWN |
| 사전 채움 | scripts/dict*, dict-fill, dict-quality, seed-dictionary, skill dict-enrich | shared_dictionary 49,244 (meaning_ko 100% — AGENTS 통계) | /text/[id] word-enrichment, api/vocab | quality.ts | VERIFIED_WORKING |
| pending_words 드레인 | /pending-words-drain | pending_words 26,322 잔량 | 간접(사전 편입) | quality.ts? | PARTIAL — 큰 잔량 |
| Lexicon / freq | scripts/lexicon, lexicon-v2.2, freq-corpus, cefrj-import | lexicon_clean ~455k | lib/textfit, vcb/compose 내부 사용 | 없음 | VERIFIED_WORKING(내부 자원) / lexicon-v2.2 와 lexicon 중복 의심 |
| Topic corpus (TCP) | scripts/topic-corpus, `pnpm tcp:drain`, api/topic-corpus | docs 7,713 / queue ~97k / word_stats ~100k | 학습자 화면 소비자 없음(api만) | topic-corpus.ts | PARTIAL — **학습자 미도달, 큐 대량 적체** |
| CCP 도서→만화 | scripts/comic, comic_gen_* | comic_books 2 · pages ~90 | /comics/adapted | comic.ts | EXPERIMENTAL |
| PDCP PD 만화 복원 | scripts/comic(pdcp) | issues 969 · series 101 | /comics/restored/[slug] | pd-comics.ts | PARTIAL — 969 이슈 중 발행 규모 별도 확인 필요 |
| 교재 팩토리 (TBP) | scripts/textbook(adapt-drain, authored-sweep), textbook-corpus, `pnpm tbp:*` | textbook_volume_renders ~19 | /library/textbooks/* | textbook.ts | IMPLEMENTED_UNVERIFIED (최근 커밋 활발: 추출→입학 드래프트 브리지) |
| CSAT 원문 수집·감사·판정 | scripts/csat, csat-sources-audit, docs/source-check | source_eligibility ~64k, snapshots ~60 | 간접(분석 지문) | csat.ts / kice.ts | PARTIAL — criteria 회차 운영 중 |
| CSAT 문항 분석 드레인 | csat-item-analyst 에이전트 | items 3,714 · analyses ~7.3k · reviews ~13k runs | /csat/item/[slug], lib/csat/browse | csat.ts | VERIFIED_WORKING |
| CSAT DCP 팩토리 | generate-article-dcp/book-dcp.mts, verify-dcp-health | csat_dcp_items ~834k | lib/csat/factory* → /csat | csat.ts | PARTIAL — 834k 대비 학습 사용(trap_attempts ~57) 극소 |
| CSAT 진단(dx)·오답원인(ec)·학습지도(map) | csat:atlas/drill | dx_response ~90, ec_* 대부분 0, map_node 72 | /csat/* | csat-diagnosis.ts | dx·map IMPLEMENTED_UNVERIFIED, ec EXPERIMENTAL(0행) |
| 강의/TTS | scripts/csat 일부 | 전용 테이블 미확인 | 미확인 | — | UNKNOWN |
| 영상 팩토리 | packages/video-factory, `pnpm video` | video_jobs 73(published) | /video (marketing, lib/video/catalog 정적) | video.ts | VERIFIED_WORKING(마케팅 면) — 학습 모듈 도달 아님 |
| Methodology/Knowledge 레지스트리 | scripts/methodology, scripts/knowledge, docs/methodology | knowledge_items 157, methodology_claims 18 | lib/knowledge → /csat/item 일부 | knowledge.ts | PARTIAL; methodology-vnext/knowledge-vnext 두 브랜치 분기(메모리) → 일부 UNMERGED |
| 저작 지문 / SE 난이도 | scripts/textbook/authored-sweep, compose | texts 278 | /text | compose.ts | IMPLEMENTED_UNVERIFIED |
| 아케이드 오디오 | scripts/arcade | 파일 자산 | /arcade, /play/* | — | VERIFIED_WORKING(정적 자산) |
| 삽화(Tines) | public/illustrations/tines | 파일 | 허브/마케팅 | — | EXPERIMENTAL(재생성 진행 중, 미커밋 변경 다수) |

## 은퇴/중복/미도달 플래그
- **은퇴**: 고전 PD 도서(Gutenberg·Standard Ebooks) — archived 83권 상당. arXiv ACP 소스 제거(마이그레이션 20260614240000, CHECK 제약) — DEPRECATED.
- **공급 미도달**: ACP ready 84,715(발행 250), topic_corpus queue ~97k/docs 7.7k(학습자 소비자 없음), csat_dcp_items ~834k(학습 시도 수십 건), pd_comic_issues 969 대비 발행 comic_books 2, pending_words 26k 잔량.
- **수요 대비**: 가입자 4명·학습기록 672건 — 모든 공급 파이프라인이 수요를 압도(PLATFORM_AUDIT 실패 모드 "공급망 비대" 그대로).
- **중복 의심**: scripts/lexicon vs lexicon-v2.2 · dict-* 루트 스크립트 vs scripts/dict·dict-fill · CCP(comic_gen) vs PDCP 두 만화 트랙 · generate-article-dcp/book-dcp(루트) vs scripts/csat.
- 미확인(UNKNOWN): WLP 데이터 경로, CSAT 강의/TTS 테이블, methodology_* 다수 테이블 통계 미수집(reltuples -1).
