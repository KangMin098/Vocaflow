# 어휘 학습 데이터 계층 — Cold / Warm / Hot (P6.5)

> 상태: **통합 완료·검증 (2026-06-28)** — 세 계층이 기능적으로 일관됨을 read-only 진단으로 확인. 본 문서는 암묵적이던 계층 계약을 명문화해 향후 drift 를 차단한다.
> 모든 함수·컬럼·조인 키는 DB direct query + 코드 grep 으로 검증.

P6 (책 구독 i+1 필터) 의 마지막 단계 P6.5. C6 결함(책 enroll 시 V-level 무관 일괄 import)에서 출발한 P6.1~P6.4 + SRS 영속화(A1/A2) + 자동 승급(Phase 2E/G) 이 누적되며 세 계층이 실질적으로 완성됐다. 본 문서는 그 결과를 모델로 고정한다.

---

## 계층 정의

| 계층 | 정의 | 저장소 | 키 |
|---|---|---|---|
| **Cold** | 전역 공유 어휘 (모든 사용자 공통, 사전 계산) | `shared_dictionary`(45K · v_level/lemma 권위) · `shared_words` · `shared_word_sets` · `library_book_vocabularies` | `word` (정본) |
| **Warm** | 사용자 개인 단어장 — import 됐으나 미시작 | `vocabularies` (`review_count = 0`) | `(user_id, word)` UNIQUE |
| **Hot** | 활성 FSRS 세션 — 학습 진행 중 | `vocabularies` FSRS 컬럼 (`review_count > 0` · `next_review_at`) + `learning_records` (audit) | `(user_id, word)` |

**Warm↔Hot 은 같은 `vocabularies` 행** — `review_count` / `last_review_at` 값으로 구분되는 *상태*이지 별도 테이블이 아니다. 상태 4색(stable/shaky/risk/new)은 `R(t)=exp(ln0.9·t/S)` 동적 계산 — `memory_state` 컬럼 저장 금지(CLAUDE.md).

---

## 계층 전이 (connectors) — 전부 `word` 키 기반

| 전이 | 경로 | 종류 | V-level 게이트 |
|---|---|---|---|
| **Cold→Warm** | `_enroll_book_subscribe_word_sets` (책 구독) | DB func | hard band i+1 `[N-1,N+1]` (P6.1) · V0=미진단 fallback (P6.6) |
| Cold→Warm | `subscribe_article_word_set` (글 구독) | DB func | display_only/noise 게이트 (ACP §18) |
| Cold→Warm | `extract_vocabulary_for_user_v2` → `ExtractionPanel` upsert | RPC + client | soft Gaussian v_proximity composite (P3A) |
| **Warm→Hot** | `flushPendingSrsResults` (`lib/srs/flush-actions.ts`) | client server action | — (서버 권위 FSRS 재계산 · `applyReview`) |
| **Hot→V-level** | `auto_promote_v_level_for_user` / `_track_` (pg_cron) | DB func | i+1 zone mastery ≥ 임계 (Phase 2E/G/H) |

**일관성 검증 (P6.4 + P6.5)**:
- Cold→Warm 의 hard band(enroll)와 soft Gaussian(extract)은 둘 다 `current_v_level` 중심 — 맥락별 메커니즘 차이일 뿐 drift 없음.
- Warm→Hot→V-level 은 전부 `vocabularies.word = shared_dictionary.word` 조인 (lemma 아님). `auto_promote_v_level_for_user`·`auto_promote_track_level_for_user` 모두 word-keyed 확인.
- 상태 분류는 `lib/srs/state.ts` `getMemoryState()` 단일 SSoT — browse/study/review/hub 모든 페이지 공유.

---

## 검증된 현황 (2026-06-28 실측)

```
vocabularies origin별 (warm = review_count 0 / hot = review_count > 0)
  shared_set : warm 6,132 · hot 2   (lemma null 4,885)
  library    : warm   285 · hot 0   (lemma null 285)
  manual     : warm    56 · hot 2   (lemma null 48)
```

Hot 계층이 작은 것은 dev 환경 학습 데이터 부재일 뿐 구조 문제 아님.

---

## 보류된 폴리시 (저가치 — 의도적 defer)

| ID | 항목 | 판정 |
|---|---|---|
| G1 | `vocabularies.lemma` NULL 80~100% 백필 | **skip** — 핵심 경로(전이·승급) 전부 `word` 키, lemma 는 `calculate_user_v_level_from_mastery` 의 COALESCE fallback 에서만 참조 → vestigial. Cold 계층 `library_book_vocabularies.lemma`(추출 차단 원인)와 **별개**. 앱 타입에도 미포함(drift). 백필해도 unblock 되는 깨진 경로 없음 |
| G3 | 통합 layer read view (`v_user_vocab_layers`) | **선택(deferred)** — 상태 계산은 이미 중앙화(`getMemoryState`), fetch 만 페이지별 ad-hoc. view 는 순수 DX 개선이지 기능 gap 아님 |
| G4 | `origin` taxonomy 정규화 (extract 가 `'manual'` 라벨) | **선택(deferred)** — cosmetic provenance, 동작 영향 없음 |
| — | Warm→Hot DB 함수화 | **거부** — 현 client server action(`flushPendingSrsResults`)이 서버 권위 재계산으로 충분. DB 함수화는 이득 없이 복잡도만 증가 |

---

## 결론

P6.5 "Layer 통합" 은 **별도 재설계 없이 P6.1~P6.4 + A1/A2 + Phase 2E/G 의 누적으로 이미 달성**. 본 문서가 그 계약을 명문화하므로, 향후 어휘 파이프라인 변경 시 (1) 전이는 `word` 키 유지, (2) V-level 게이트는 `current_v_level` 중심, (3) 상태 분류는 `getMemoryState` SSoT 경유 — 이 세 불변식을 깨지 않으면 계층 정합이 보존된다.

관련: 메모리 [[project-p6-handoff-pending]] · [[project-srs-persistence-a1]] · [[project-lbv-lemma-null-breaks-extraction]](Cold 계층 lemma — 별개 이슈) · `docs/LEARNING_MODEL.md`
