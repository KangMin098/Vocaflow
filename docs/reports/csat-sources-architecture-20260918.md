# CSAT 원문 적격 실제 구조 — 2026-09-18

## Gate 0 — PASS

`collect-daily`·소스별 수확기 → `library_articles` → `process-queue` 본문 정규화/어수/CEFR/V-Level/구문 →
`gate-{book,article}-export` → 에이전트 판정 청크 → `gate-drain-validate` → `gate-import` →
`csat_fit.gate` → 문항 제작/`csat_dcp_items` → `volume-pool` → `render-volume`.
CEFR는 내용 판정 뒤에 생기는 별도 단계가 아니라 ACP 분석 결과다. 발췌창은 `csat_fit.make.windows`다.

| 영역 | 실제 구현 / 사실 |
|---|---|
| 원문·분석 | `library_articles`: content, content_hash, article_v_level, word_count, register, cefr_level, syntax_score |
| 내용 판정 | `csat_fit.gate`: purpose, verdict, genre, codes, publishable, blockedBy, rv, at, by |
| 게시 판정 | `scripts/csat/gate-rules.mjs:decide` — raw 분기는 verdict보다 먼저 반환 |
| 원문 적격 | `packages/library-pipeline/src/textbook/source-eligibility.ts:judgeSource` — 7축, 6등급 |
| 관리자 | `sources/page.tsx` 관리자 가드 후 로컬 JSON 캐시를 읽음. 원문별 실시간 판정은 없음 |
| 적격 캐시 | `source-eligibility-scan.mjs` → `source-eligibility-snapshot.json`, DB의 대체 원장이 아닌 재생성 가능한 캐시 |
| 재고 캐시 | `source-inventory-scan.mjs` → 전체 상태·원천 집계 |
| 품질 후보 | `extraction-defect.ts` → 별도 전수 스캔. 적중은 검토 신호이며 확정 오류 아님 |
| 문항 | `csat_dcp_items`: kind, ref_id, payload, answer_key, v_level. article 참조는 원문 UUID |
| 조판 | `volume-pool.mjs`: 법적/제목/CEFR 선별 후 judgeSource + 문항별 위생·유형·검수 |
| 조판 기록 | `textbook_volume_renders`: series/band별 마지막 기록을 덮어씀. 현재 colophon은 원문/문항 manifest를 보존하지 않음 |
| 연습 | `lib/learner/dcp-actions.ts` → `textbook_practice_items`·`prescribe_today` RPC. 정답은 `grade_dcp_item`만 반환 |
| 실제 시도 | `csat_item_attempts.dcp_item_id`로 연결 가능. 기록 없음은 열람 없음의 증거가 아님 |
| 별도 기출 | `csat_items_public`은 평가원 기출 csat_items의 안전 뷰. 이번 기사/DCP 적격과 섞지 않음 |

## 중복·불일치 판정

1. scan에는 CEFR 상한이 없고 volume-pool은 `cefrFitsBand`를 별도로 적용한다.
2. raw 게시 차단 예외가 reject를 통과시킨다. `judgeSource`는 내용 verdict 존재만 검사한다.
3. 발췌창만 있는 원문도 excerpt로 분류하나 조판은 저장 문항을 인쇄한다.
4. learner RPC는 ready/published·표시 전용 등 일부 조건만 적용하고 source eligibility를 사용하지 않는다.
5. 온라인 연습의 문항 길이 정책은 의도적으로 지면 상한을 적용하지 않는다. 이 차이는 유지하되 명시적 context 정책으로 둔다.
6. 원문 전체 품질과 최종 문항 지문 품질을 혼동하지 않는다. 논문 본문 일부에 결함이 있다고 모든 발췌를 자동 삭제하지 않는다.

## 확인 한계

DB 함수 원문은 `.agent-logs/*-before.sql`에 보존했다. 과거 조판 원문 manifest 부재는 실제 구조적 한계다.
이름·권수·로컬 파일 경로만으로 과거 노출을 0이라고 보고하지 않는다. 미래 조판에는 manifest가 필요하다.
DB를 삭제하거나 덮어쓰는 작업은 Gate 0에서 수행하지 않았다.
