# `library_article_vocabularies` 보관 범위 — 측정과 계획 (2026-09-24)

> 방법: Supabase MCP 읽기 전용 질의 + 저장소 grep. **문서의 수치는 근거로 쓰지 않았다.**
> 이 리포트는 측정·기록 단계다. **DB 는 한 행도 바꾸지 않았다.** 삭제는 데이터 손실이라 따로 승인받는다.

## 0. 질문

이 표는 DB 의 약 66%(9,968 MB, 2026-09-23 감사)다. 읽는 쪽 용도가 「발행 단어장 · 사전 채굴 ·
Admin 검수 · 교재 조판」이라면 **모든 글의 모든 행을 늘 들고 있을 필요가 있는가.**

## 1. 행은 누구 글의 것인가 — 전수

`library_article_id` 첫 16진 자리로 16조각을 나눠 전부 셌다. 한 번에 세면 MCP 가 시간 초과로 끊는다.
앞서 뽑은 0.5% 표본(`TABLESAMPLE SYSTEM`)의 추정과 소수점 한 자리까지 맞았다.

| 글 상태 | 글 | 행 | 비율 | 편당 |
|---|---:|---:|---:|---:|
| `ready` | 63,848 | 31,648,011 | **98.60%** | 496 |
| `archived` | 3,488 | 373,125 | 1.16% | 107 |
| `published` | 250 | **77,096** | **0.24%** | 308 |
| `failed` | 1 | 19 | 0.00% | 19 |
| 합계 | 67,587 | 32,098,251 | | |

- 세 상태 모두 **본문(`content`)이 빠진 글이 0편**이다 → 어느 행이든 본문에서 다시 만들 수 있다.
  (재현성은 `20260901040000_lav_drop_dead_columns` 에 실측이 있다 — 6편 2,565행 비트 일치 · 편당 46.5 ms.)
- `article_v_level` 은 이미 `library_articles` 에 있다(ready 2편 · archived 1편만 NULL).
- 2026-09-23 감사: 7.4일 창에 삽입 12,400,558 / 삭제 12,382,935 — **대부분 발행되지 않을 글을
  지웠다 다시 쓰는 비용**이다(재분석은 `analyzeArticle` 이 글의 행을 전량 삭제 후 재삽입).

## 2. 누가 읽는가 — 전수

`pg_proc` 에서 이 표를 읽는 함수는 8개(`commit_article_analysis` · `compute_article_vrl` ·
`count_article_vocab_prunable` · `prune_article_vocab_sentences` · `repair_vocab_first_sentences` ·
`select_article_coverage` · `select_article_vocab` · `select_extraction_residual`). 코드는 grep 전수.

| 소비자 | 실제로 읽는 범위 | 행이 늘 있어야 하나 |
|---|---|---|
| 발행 트리거 `trg_la_publish_word_set` → `publish_article_word_set` → `select_article_vocab` | 발행하는 글 1편 | **발행 순간에만.** 이후 학습자는 `shared_words` 사본을 읽는다 |
| Admin 미리보기 `/admin/articles/preview/[id]` (`select_article_vocab`) | 연 글 1편 | 아니다 — 필요할 때 계산 가능 |
| `compute_article_vrl` | 분석 직후 1회 | 아니다 — 결과가 `library_articles` 에 저장된다 |
| 교재 조판 `volume-pool.mjs` · `build-unit.mjs` | **단원에 실제로 쓰인 글만**(`usedRefs`) | 아니다 — 옛 「800만 행」 경로는 이미 걷혔다 |
| Admin 가공 콘솔 `/admin/compose` | 가공 글의 행 **개수**만 표시 | 표시용 |
| `select_extraction_residual` · `select_article_coverage` | — | **호출자 0.** 코드 0곳 · git 이력에 호출자가 생긴 적 없음 · `pg_stat_statements`(2026-09-23 06:11 리셋 이후) 호출 0 |
| 사전 드레인 `scripts/dict/drain-article-lemmas.mjs` | — | **이 표를 안 읽는다** — 본문을 직접 다시 추출한다 |

**결론:** 늘 있어야 하는 것은 발행 글 250편의 **77,096행(0.24%)** 이다. 나머지 3,202만 행은
분석 순간과 발행 순간에만 쓰이고, 결과(V-Level·단어장)는 이미 다른 표에 저장된다.
처음에 「예외」로 봤던 사전 채굴·조판도 전량이 필요하지 않았다.

## 3. 어휘 행이 없는 글을 발행하면 — 조용히 비지 않고 **시끄럽게 막힌다** (정정)

> ⚠️ 이 절의 첫 판(커밋 `75559124`)은 「빈 단어장이 조용히 공개된다」고 적었다. **틀렸다.**
> `publish_article_word_set` 본문만 읽고, 첫 줄에서 부르는 게이트 `content_gate_publishable` 을 안 읽었다.

실측(2026-09-24 · 롤백되는 DO 블록 안에서 `ready` 글 하나의 어휘 행 597개를 지우고 호출):
`run_content_quality_gates` 의 critical 항목 **「추출 비어있음(0단어)」** 이 `select_article_vocab` 출력
(`_gsel`)이 0이면 FAIL 을 내고, 두 함수(`publish_article_word_set` · `republish_article_word_set`) 모두
**첫 줄에서** 그 게이트로 멈춘다 → 트리거 안의 예외라 status 갱신까지 롤백된다. 빈 글 단어장은 실제로 0개(279개 중).

그래서 줄였을 때의 실제 위험은 반대쪽이다 — **2단계(발행 전 재분석)가 들어가기 전에 행을 지우면
그 글들의 발행이 전부 「콘텐츠 품질 게이트 FAIL」로 실패한다.** 원인이 어휘 부재라는 게 메시지에 안 나온다.

1단계로 적용한 가드(`20260923232916_article_word_set_require_vocab`)는 게이트 **뒤에** 있어 지금은 도달하지 않는다.
게이트 항목이 완화될 때를 위한 이중 장치일 뿐이다.

## 4. 계획 (순서가 중요하다)

| 단계 | 내용 | 되돌리기 |
|---|---|---|
| 1 | **가드** — ✅ 적용(2026-09-24 · `20260923232916`). 단, §3 정정대로 기존 게이트가 이미 막고 있어 **이중 장치**다 | [rollback](../AI_CONTEXT/rollback/20260923232916_article_word_set_require_vocab-rollback.sql) |
| 2 | **발행 전 재분석** — ✅ 2026-09-24. `ensureArticleVocab`(`packages/library-pipeline/src/analyze/ensure-article-vocab.ts`)가 행이 없을 때만 배치 경로 설정(`joinHyphenLineBreaks:false` · `skipLlm:true`)으로 `analyzeArticle` → `compute_article_vrl`. 붙인 곳: `force-publish` 라우트(검수 목록·미리보기의 「게시」가 모두 이리 온다). 나머지 경로 전수: 시드 스크립트 2종(`publish-article-seeds` · `publish-voa-seeds`)은 발행 직전 이미 분석한다 · `reprocess.mjs` 는 분석 경로다 · 가공 콘솔 ⑦은 **화면이 품질 게이트 FAIL 이면 버튼을 잠가**(`publish-gate.ts`) 액션까지 오지 않는다 → 붙이지 않고 6 에서 제외한다 | 코드 |
| 3 | **Admin 미리보기** — ✅ 2026-09-24. `/admin/articles/preview/[id]` 가 행이 없으면 `ensureArticleVocab` 로 만들어 **저장**한다. 보여주기만 하지 않는 이유: 선별은 `select_article_vocab`(SQL)이 표를 읽어 하므로 JS 로 흉내 내면 미리보기와 발행이 갈린다. 결과적으로 검수한 글만 행이 남는다 | 코드 |
| 4 | **조판** — ✅ 2026-09-24. `fetchArticleVocab`(`volume-pool.mjs`)이 받은 결과에서 행이 없는 지문만 `ensureArticleVocab` 로 만들고 그것만 다시 받는다. `volume-pool` · `build-unit` 둘 다 이 함수를 쓴다. 한 번에 500편 상한(밴드 전체 비교 손잡이 대비) · 실패·상한 초과는 수를 찍는다. 회귀 `scripts/textbook/__tests__/fetch-article-vocab.test.mjs` 4건 | 코드 |
| 5 | **가공 콘솔** — 불필요. 콘솔이 세는 것은 가공 글(`source='original'`)뿐이고 그 글들은 6 에서 제외하므로 행이 사라지지 않는다 | — |
| 6 | **정리 함수 + 예행**: `ready` 글 행 삭제를 배치 함수로. **`source = 'original'`(가공 글 · ready 631편)은 제외** — 가공 콘솔이 행이 없으면 발행 버튼을 잠근다(2 참조)(2026-09-23 gutenberg 퇴출 때 이 표의 조인 DELETE 가 회당 평균 49초였다 — `pg_stat_statements`). 예행에서 지울 행 수를 먼저 찍는다 | ⚠ **데이터 손실 — 사용자 확인 필수.** 본문에서 재생성 가능하지만 되돌리는 데 6.4만 편 × 46.5 ms ≈ 50분 |
| 7 | **재분석 정책**: `process-queue.mjs` · `reprocess.mjs` 가 발행 안 할 글의 행을 다시 쓰지 않게(V-Level 만 갱신) — 안 하면 6 을 해도 다시 찬다 | 코드 |
| 8 | 디스크 회수: 행을 지워도 파일은 안 줄어든다 — `VACUUM FULL` 또는 `pg_repack`(psql 필요 · 잠금) | 운영 작업 |

1~5 는 행이 **있든 없든** 같게 동작하므로 먼저 넣어도 무해하다. 6 은 1~5 와 7 이 들어간 뒤에만.

### 결정이 필요한 것

- `archived` 3,488편(373,125행)도 지울지 — 되살리기(`revert`) 경로가 있으면 2 번과 같은 재분석이 필요하다.
- 3 번 미리보기가 계산 결과를 **저장할지** — 저장하면 검수한 글만 캐시가 남는다(자연스러운 보관 범위).
- `select_extraction_residual` · `select_article_coverage` 를 지울지 — 호출자 0 이지만 SQL 편집기에서 손으로 쓰는지는 저장소로 알 수 없다.

## 5. 이 턴에 고친 것

`scripts/lexicon/oov-orphan-import.ts` 의 `lemmaBackfill` 이 이 표의 `lemma`·`id` 를 읽고 있었다.
두 열은 2026-09-01 에 삭제됐는데, 오류 건너뛰기가 `/does not exist/i` 여서 「열 없음」(42703)까지
「표 없음(-1)」으로 보고하며 조용히 넘어갔다. 표를 목록에서 빼고, 건너뛰기를 표 부재
(`42P01` · `PGRST205` · `relation … does not exist`)로만 좁혔다. 나머지 세 표(`shared_words` ·
`vocabularies` · `library_book_vocabularies`)는 `id`·`lemma` 가 실재함을 확인했다.
