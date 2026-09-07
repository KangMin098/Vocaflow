# 콘텐츠 품질 게이트 — 사용 가이드 (런북)

> 학습자에게 나갈 산출물이 **맞는 단어·맞는 뜻·맞는 레벨**로 정확히 뽑혔는지 자동 검증하는 시스템.
> 목적: 관리자가 **믿고 게시**. 실패 = 코드 버그가 아니라 **사전DB/파이프라인을 고쳐야 한다는 신호**.
> 대상 4 파이프라인: **LCP**(도서) · **ACP**(아티클) · **VCB**(단어장) · **사전DB**. v06.271.

---

## 1. 한눈에 — 루프 구조

```
소스 GET → 큐레이션(ingest·추출·분석) → [ready] ─게이트─▶ 게시(G2 가드) → [published]
                                          ▲                                    │
                                          └────── 매일 자동 검사(G4 cron) ◀──────┘
   추출 로직 개선 시 → I10 드리프트 감지 → republish 로 학습자 반영
```

---

## 2. 관리자 UI (가장 쉬운 방법)

### `/admin/quality/gates` — 품질 게이트 화면
- **전역 red/green**: 파이프라인별 불변식 PASS/FAIL/WARN + "critical FAIL N건" 요약 배너. allGreen = 게시 신뢰 가능.
- **콘텐츠별 게시 전 체크**: 도서/아티클 선택(드롭다운에 `[ready]`·`[queued]` 미발행 포함) → "게이트 실행" → "게시 신뢰 가능 / 차단 후보" 판정.
  - 소스 GET → 추출 완료(ready) 콘텐츠를 **게시 전에** 검증하는 게 핵심 용도.

### `/admin/quality` — 품질 지표 대시보드
- nightly 수집 지표 + 추이 스파크라인. 게이트 결과도 `stage='gate'`로 여기 추이 적재됨.

---

## 3. SQL 로 직접 (MCP / psql / admin)

```sql
-- 전역 (플랫폼 전체 정확성)
SELECT pipeline, invariant, verdict, fail_count
FROM run_content_quality_gates('global') WHERE severity='critical';

-- 도서 게시 전 체크
SELECT * FROM run_content_quality_gates('book', '<book_id>');

-- 아티클 게시 전 체크
SELECT * FROM run_content_quality_gates('article', '<article_id>');

-- VCB 단어장 체크
SELECT * FROM run_content_quality_gates('word_set', '<set_id>');

-- 게시 가능 여부 (boolean · critical FAIL 있으면 false, I10 드리프트 제외)
SELECT content_gate_publishable('book', '<book_id>');
```
> scope: `global` | `book` | `article` | `word_set` | `dict`. 함수 statement_timeout 60s(관리자 도구).

---

## 4. 큐레이션 end-to-end (소스 GET → 게시)

### LCP (도서) — CLI
```bash
# 1) dry-run: ingest+segment 확인 (DB 무변경)
pnpm dlx tsx scripts/lcp/reprocess-book.mjs <book_id>
# 2) 큐레이션 커밋: 추출+분석 → ready + book_v_level/CEFR/coverage
pnpm dlx tsx scripts/lcp/reprocess-book.mjs <book_id> --commit
# 3) 게이트 검증
#    SELECT * FROM run_content_quality_gates('book','<book_id>');
# 4) 게시 (관리자) — /admin 또는 publish RPC (G2 가드가 게이트 통과 요구)
```
> queued(소스 GET) 도서를 위 흐름으로 curation → ready → 게이트 → 게시.

### ACP (아티클)
- `/api/acp/dev-enqueue`(소스 GET) → `/api/acp/dev-process`(ingest→추출→ready) → `/api/admin/articles/force-publish`(발행).
  (구 `/api/acp/dev-publish` 는 force-publish 와 같은 requireAdminApi + service_role 로직인데 dev 전용이라 2026-09-06 삭제.)
- ingesters: `packages/library-pipeline/src/ingest-article/*`(nasa/voa/wikipedia/the-conversation…) + `analyzeArticle`.

### VCB (단어장)
- seed→enrich→publish (vcb 스킬: `/vcb-seed-list`·`/vcb-batch-enrich`·`/vcb-curate-compare`). 발행 세트는 `word_set` scope로 게이트.

---

## 5. 불변식별 의미 + 실패 시 대응

| 불변식 | 무엇 | FAIL 시 고칠 곳 |
|---|---|---|
| **I1** 사전 필드완비 | classified 표제어 meaning/pos/v_level/cefr | 사전DB 해당 표제어 채움(dict-* 스크립트) |
| **I2** per-sense v_level (warn) | 다의어 sense별 v_level | kaikki-sense enrich (비-critical) |
| **I5** 바인딩 드리프트 | 표면형이 자체 표제어인데 lemma가 딴 데 (반의어 노출 위험) | `select_*_vocab` surface-first 바인딩 확인 / 재발행 |
| **I6** resolvable NULL lemma (warn) | 사전 존재어인데 lemma 빈 것 | `backfill_book_lemmas(book_id)` |
| **I7** 노이즈 register | 약어/고어 등이 산출물에 누출 | 재발행(SSoT 재동기) 또는 해당 단어 register 재분류 |
| **I8** book_v_level 결측 | 발행 도서 레벨 미산정 | `compute_book_vrl(book_id)` |
| **I9** article register 결측 | 발행 아티클 register 미산정 | ACP 재처리(analyzeArticle) |
| **I10** SSoT 드리프트 | 발행 세트 ≠ 현 추출 로직 (stale) | **재발행** (아래 §6) |
| **I11** 아티클 라이선스 | copyright_safe_in_kr ≠ true | 라이선스 재확인 / display_only 전환 |
| **I12** 발행세트 예문 공백 | 사전에 example_en 이 있는데 발행 세트가 비어 있음 (발행은 스냅샷이라 나중에 채운 예문이 반영 안 됨) | `SELECT sync_published_set_examples()` — 재발행 아님, 빈 칸만 채우는 멱등 재동기화 |
| 추출 비어있음 | select 산출 0단어 | 추출/레벨 재점검 (게시 불가) |

---

## 6. 추출 로직 바꾼 뒤 — 재발행 (중요 원칙)

**`select_*_vocab`(추출) 로직을 개선하면 전 발행 콘텐츠가 재발행 전까지 stale** → I10 드리프트로 잡힘.
`set_id` 보존(구독/진행 안전)하며 `shared_words`만 현 산출로 교체:
```sql
SELECT republish_book_word_sets('<book_id>');       -- 도서 1권
SELECT republish_article_word_set('<article_id>');  -- 아티클 1개
-- 전체(게이트 통과분만) — 대형 도서는 select 무거우니 개별/소배치로:
SELECT republish_book_word_sets(id) FROM library_books
 WHERE status='published' AND content_gate_publishable('book', id);
```
> ⚠ 한 statement에 대형 도서 여러 권 = statement_timeout·롤백 위험 → 큰 책은 1권씩.

---

## 7. 자동화 (사람 개입 없이)

- **nightly cron** `content-gate-nightly` (KST 03:25): `collect_content_gate_metrics()` → `quality_metrics(stage='gate')`에 불변식별 fail_count 적재 → `/admin/quality` 추이.
- **게시 가드(G2)**: `publish_book_word_sets`·`publish_article_word_set`·`republish_*`가 `content_gate_publishable` FAIL 시 게시 차단.
- 수동 재수집: `SELECT admin_collect_content_gate_metrics();`

---

## 8. 테스트 (게이트 자체 검증)

```bash
# 게이트 자체 테스트 (계약·회귀·결함검출 11 케이스) — SERVICE_ROLE_KEY(.env.local) 필요
pnpm --filter web test content-quality-gate
# 전체 단위 (integration 포함 · CI는 키 부재로 integration skip)
pnpm --filter web test
```
- `content-quality-gate.integration.test.ts`: 결함(노이즈·뜻결측·빈세트)을 **주입 → 게이트가 FAIL로 잡는지** 검증. 게이트 로직/파이프라인 변경 시 회귀 방어.
- ⚠ 통합 테스트는 공유 dev DB 사용 → `fileParallelism:false`로 직렬 실행(경합 방지).

---

## 9. 새 불변식 추가하는 법

1. `run_content_quality_gates`에 `RETURN QUERY SELECT '<pipeline>','<Ixx 이름>','critical|warning', count(*), CASE…, jsonb_build_object(...) FROM … WHERE <결함조건>;` 추가 (해당 scope 블록).
2. 마이그레이션으로 `CREATE OR REPLACE`(사용자 승인 후 apply).
3. `content-quality-gate.integration.test.ts`에 **결함 주입 → FAIL 검증** 케이스 추가.
4. `docs/DB_SCHEMA.md`·본 런북 갱신.

---

## 관련 파일

- 함수: `run_content_quality_gates` · `content_gate_publishable` · `republish_*` · `collect_content_gate_metrics`
- 마이그레이션: `supabase/migrations/2026071810005*~0013*` (게이트·재발행·성능)
- UI: `apps/web/src/app/admin/quality/gates/` (page + GateCheckClient)
- 테스트: `apps/web/src/lib/library/__tests__/content-quality-gate.integration.test.ts`
- 근거: `docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md`
