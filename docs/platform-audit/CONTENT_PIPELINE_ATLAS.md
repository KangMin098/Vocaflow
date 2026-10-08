# CONTENT_PIPELINE_ATLAS — 콘텐츠 발굴·수집·분석·각색·생성·검수·발행

> 기준 a7c986469 · DB SELECT 2026-10-09 · 상세: [_raw/area-content.md](./_raw/area-content.md)
> 판정 질문은 하나다: **「산출물이 DB 에 있고, 학습자 화면이 그것을 읽는가」**. 화면 실행 확인은 하지 않았다.

## 1. 파이프라인 지도

| ID | 파이프라인 | 단계 | 주 코드 | 산출 테이블 · 실측 | 학습자 도달 | 상태 |
|---|---|---|---|---|---|---|
| P1 | **LCP** 도서 큐레이션 | 9 외부 소스 → 정규화 → 분할 → 4축 난이도 → auto_curate 게이트 | `packages/library-pipeline` · `scripts/lcp` | `library_books` 401(published 312 · archived 83 · queued 6) | `/library` 읽기 | VERIFIED_WORKING(산출) — 읽기 완료 0 |
| P2 | **ACP** 기사 수집 | 14 소스 → 분석 → 발행 | `scripts/acp/collect-daily.mjs` | `library_articles` 91,793 — **ready 84,715 · published 250** · archived 3,655 · queued 3,165 · failed 7 | 250편만 | **PARTIAL** — 99.7% 적체, collect-daily 예약 없음 |
| P3 | **VCB** 어휘 사전 구축 | seed → enrichment → shared_words(cast-2000 audit) | `packages/vcb-core` · `vcb-curate-core` · `scripts/vcb` | shared_words 약 681k · `shared_word_sets` 11,312 · `library_chapter_quiz` 2,453 | 단어장·퀴즈 | VERIFIED_WORKING |
| P4 | **VRL** 4축 분류 + 진단 | V-Level 0-11 · Track 6 · Domain 8 · Skill 5 | `scripts/vocab` 등 | `vrl_diagnostic_tests` 5 · 문항 185 | 진단 화면 | IMPLEMENTED_UNVERIFIED |
| P5 | 사전 채움 | 외부 시드 → 뜻·품사 채움 → 품질 검사 | `scripts/dict*` · `dict-fill` · `dict-quality` | `shared_dictionary` 49,244 · meaning_ko 100% | 단어 팝업 전반 | VERIFIED_WORKING |
| P6 | pending_words 드레인 | 미등재어 → 판정(add/noise/…) | `/pending-words-drain` | `pending_words` 26,322 | 간접 | PARTIAL(잔량 큼) |
| P7 | lexicon · freq · topic corpus | 레벨 맵·빈도·주제 코퍼스 | `scripts/lexicon` · `lexicon-v2.2` · `freq-corpus` · `topic-corpus` | lexicon_clean 약 455k · `topic_corpus_docs` 7,713 · 큐 약 97k | TextFit 등 내부 자원 / topic 은 소비처 없음 | lexicon VERIFIED_WORKING · topic PARTIAL |
| P8 | WLP | **공급원이 아니라 NLP·QA 공용 패키지**(`processText`) | `packages/wlp` | 소비처: `library-pipeline/src/analyze/extract-lemmas.ts:280` · `vcb-curate-core/src/method-a.ts:376` · VCB QA | 간접(분석 단계) | IMPLEMENTED_UNVERIFIED(공용 라이브러리) |
| P9 | **CSAT 원문** 발굴·적격·내용 판정 | 소스 감사 → 적격(`evaluateSource`) → 내용 판정 드레인 | `scripts/csat` · `docs/source-check` | `csat_source_eligibility` 약 64k | CSAT 세션 | PARTIAL — 일일 감사 워크플로 최근 3회 실패 |
| P10 | **CSAT 문항 분석** | 출제자·오답·학습자 3층위 + 3인 리뷰 | `csat-item-analyst` | `csat_items` 3,714 | `/csat/item` | VERIFIED_WORKING(산출) |
| P11 | **CTP/DCP**(일반 기사 기반 구문 연습 문항 생성) | 발행 기사·도서 → 문항 대량 생성 | `scripts/generate-article-dcp.mts:3` · `generate-book-dcp.mts` | `csat_dcp_items` 약 834k(테이블 접두사만 csat) | Practice(`lib/learner/dcp-actions.ts:249`) | PARTIAL — 접근 가능하나 시도 20. **CSAT 기출 공급과 별개** |
| P11b | CSAT 기출 세션 원문 | 학습자가 가져온 PDF(`PaperDrop.tsx`) → 세션 | `api/csat/session/record/route.ts:41` | `csat_session_attempts` 1 | `/csat` 세션 | IMPLEMENTED_UNVERIFIED |
| P12 | 교재 공장(textbook factory) | **main**: 창작 집필(`scripts/textbook/write-drain-export.mjs:31` — 시중 교재 입력 없음) · 각색 드레인 · 문항 · 해설 · 조립. **미병합**: 시중 교재 PDF 추출→초안→승인(phase1, 마이그레이션 5건 DB 적용·main 밖) | `scripts/textbook*` | `textbook_*` 2테이블(약 19행) | `/library/textbooks`(연습은 생성형 9유형 미지원) | main 부분 PARTIAL · 추출 확장 UNMERGED |
| P13 | 저작 지문 · SE 난이도 확장 | 진입 밴드용 지문 저작 | `docs/reports/authored-passage-*` | — | 라이브러리 | IMPLEMENTED_UNVERIFIED |
| P13b | **Compose 재저작 파이프라인** | 소스·취재 → 사건 → 사실 원장 → 발주·작성 → 독립성 검수 → 가공 → 발행 | `app/admin/compose/page.tsx:2` · `lib/admin/help/compose.ts:25` · `scripts/compose`(28파일) | 미측정 | 라이브러리(발행 시) | IMPLEMENTED_UNVERIFIED — 단계별 산출량 미조사(누락 감사 §2) |
| P14 | **CCP** 도서→만화 | 장면 추출 → 이미지 생성 | `scripts/comic` | `comic_books` 1~2 | `/comics` | EXPERIMENTAL |
| P15 | **PDCP** PD 만화 현대화 | 스캔 → OCR → 리스타일·대사 레이어 | `scripts/comic` · `/api/pdcp` 22개 | `pd_comic_issues` 969 | `/comics/restored` | PARTIAL — ADR 0007(Accepted)이 제거를 결정했는데 코드가 남아 있다 |
| P16 | 영상 팩토리 | 요청 → 설계 드레인 → 렌더 | `packages/video-factory` · `video-request-designer` | `video_jobs` 73(전부 published) | `/video`(마케팅) | VERIFIED_WORKING(산출) — 학습 루프 미연결 |
| P17 | CSAT 강의 · TTS | 강의 대본 → 재생 | `lib/csat/lecture/store.ts:38` · `components/csat/lecture/LectureStage.tsx:140` | 커밋된 대본 · 저장 오디오 없음 | `/csat` 강의(Web Speech/무음 하이라이트) | 재생 IMPLEMENTED_UNVERIFIED · 서버 음성 생성 DESIGN_ONLY |
| P18 | 학습 원리 등록부 | 원리 → 주장 → 학습 행동 | `scripts/methodology` · `scripts/knowledge` | `knowledge_items` 157 · reviews 171 · `methodology_claims` 18 · methodology_* 10개 중 8개 0행 | `csat/item` PrinciplePanel 등 | PARTIAL · 두 계보(knowledge-vnext/methodology-vnext) |
| P19 | 아케이드 오디오 · 삽화 | 실음원 루프 · Tines 삽화 | `scripts/arcade` · `public/illustrations` | 파일 | 게임·화면 | 오디오 VERIFIED_WORKING · 삽화 EXPERIMENTAL(재생성 중) |

## 2. 은퇴 · 중복 · 미도달

- **DEPRECATED**: 고전 PD 도서(Gutenberg·Standard Ebooks, 2026-09-24 gutenberg 40,519행 삭제) · ACP arXiv(`20260614240000_acp_remove_arxiv_source`). 단, 도서 API 에 Gutenberg 미리보기가 남아 있다.
- **중복 의심**: `scripts/lexicon` ↔ `lexicon-v2.2` · 루트 `dict-*.mjs` ↔ `scripts/dict` · `dict-fill` · CCP ↔ PDCP · 루트 `generate-*-dcp.mts` ↔ `scripts/csat` · knowledge_* ↔ methodology_*.
- **공급이 학습자에게 닿지 않는 곳** — 세 종류를 구분한다.
  - 미발행: ACP ready 84,715 / 전체 91,793(**92.3%**) · published 250(0.27%).
  - 접근 가능하나 사용 없음: CTP/DCP 약 834k(시도 20) · 도서 312권(완료 0).
  - 소비처 없음: topic 큐 약 97k.
  - 만화는 계통이 둘이다 — CCP `comic_books` 1~2 · PDCP `pd_comic_issues` 969(PDCP 카탈로그 발행량은 미측정).

## 3. 운영 방식

- 드레인 export/import 쌍 11개 · 서브에이전트 7개 · 슬래시 명령 14개. **전부 사람이 Claude Code 세션을 열어야 돈다.**
- 자동으로 도는 것은 DB pg_cron 15개 중 14개뿐이다(최근 14일 실패 0, `library-pipeline-worker` 만 비활성). job 이름으로 마이그레이션을 대조하면 13개는 정의가 있고, **`purge-cron-history-7d` · `vrl-auto-promote-daily` 2개만 마이그레이션에 없다**(관리자 원자료의 「10개」는 재계수로 정정).
