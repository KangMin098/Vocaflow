# 유형별 공용단어장 생성 파이프라인 — 전 유형 자동 테스트 결과 (2026-07-17)

> 대상: `shared_word_sets`/`shared_words` — **1,085 세트 · 44,958 단어 · 9 유형**.
> 방법: read-only DB 감사(무결성·레벨정합·드리프트·surfacing) + 생성기 스크립트 매핑. **데이터 무변경**.

## 0. 유형 지형 + 생성기 매핑

| 유형(category) | 세트 | 단어 | 생성기 | 소스 |
|---|---|---|---|---|
| 학년 elementary/middle/high (`curriculum-2022-*`) | 3 | 2,913 | `scripts/lcp/publish-list-word-set.ts` | shared_dictionary · list_tags `kcurr2022_N` |
| auto-vlevel (`auto-vlevel-v1..9`) | 9 | 1,600 | publish-list-word-set (v_level 필터) | shared_dictionary v_level+list_tags |
| specialty (`specialty-{medical,business,literary,academic}`) | 4 | 902 | publish-list (list_tags moel/bsl/bel/nawl) | shared_dictionary |
| 주제 topic (`topic-*`) | 18 | 7,219 | `scripts/dict/topics-publish-set.mjs` | `dictionary_word_categories` |
| 어원 (`etymology-core`) | 1 | 1,500 | `scripts/dict/roots-publish-set.mjs` | `word_root_links` |
| csat/kice (`kice-*`) | 5 | 1,487 | (KICE 인제스트) | `word_lexicon` (kice_csat) |
| library_book (`book*`) | 909 | 23,678 | `publish_book_word_sets` + `select_book_chapter_vocab` | library_book_vocabularies |
| library_article (`article*`) | 135 | 3,661 | `select_article_vocab` | article vocab |
| cast/eng_test | 3 | 2,398 | VCB `08-publish.ts` | cast-2000 |

## 1. 데이터 무결성 — ✅ CLEAN

전 1,085 세트 · 전 유형:
- 선언 `word_count` vs 실제 행 수 **불일치 0**
- `meaning_ko` null **0** · `lemma` null **0** · `word` null **0** · empty 세트 **0**
- 세트 내 **진짜 중복 단어 0** · **챕터 갭 0** · orphan 0
- lemma→사전 조인 **unmatched 0 · matched_null_v 0** (조인 키 견고)
- 학년 v_level 단조성 정상 (초 1.99 < 중 3.86 < 고 4.78)
- 유일 결측 = `library_book` `part_of_speech` null **2,718** → **기지·의도적**(v06.254 #4: 다의어+pos_set 미상은 primary-POS 오주입 회피 위해 NULL 유지, 88.5% 채움)

## 2. 발견된 오류/개선 (심각도순)

### 🔴 E1. auto-vlevel 세트 V-Level 드리프트 (기능 영향)
- V5-V7 세트가 2026-05-24 생성 후 **VRL 재분류(Round 1-10, 38k행)를 반영 못해 stale**:
  - V1-V4: 100% on-level · **V5: 75%(51/200 이탈)** · V6: 86% · V7: 89% · V8: 97% · V9: 100%
- **이 세트들은 `recommend_word_sets_for_user`의 primary/stretch/review 티어에 직접 노출** → 학습자가 "V5" 추천을 받으면 25%가 실제 V5 아님. i+1 정밀도 훼손.
- **조치**: auto-vlevel 세트 재발행(생성기 재실행, 멱등) 또는 추천이 세트 스냅샷 대신 **live dict v_level로 필터**. 재발 방지 위해 재발행 cron/트리거 검토.

### 🔴 E2. 사전 flat v_level 오분류 — `third` V11 (데이터 버그)
- `third`(세 번째의) = **v_level 11 · cefr C2 · frequency_rank NULL**. 영어 최기초 서수가 최고난도로 분류됨.
- 초등 교육과정 세트에 포함 → i+1/V-배지가 "third = 고급"으로 오표기.
- **조치**: `third` 등 명백 오분류 직접 교정(소수, 승인 후 UPDATE). ⚠️ MCP 직접 UPDATE는 분류기 차단 가능 → `node` 스크립트 우회([[project_dict_sense_completion_v1_4]] 패턴).

### 🟠 I3. 초/중 교육과정 구상어 v_level 과대평가 (품질)
- 순수 semantic V-Level이 **초등이 배우는 구상 기초어를 고급으로 과대평가**:
  `rainbow` V8 · `crayon` V9 · `doughnut` V9 · `badminton` V8 · `laser` V8 · `gum` V8 · `steam`/`oak`/`pin`/`spy` V8 등.
- 규모: elementary 7단어(V8+, 1.6%) · middle 20단어(V8+) · high는 68% V6+ = 정상(고등=고급).
- 근본: V-Level=순수의미 축이라 저빈도 구상어를 상향([[project_vrl_v_level_pure_semantic]]). 학년 세트에선 grade가 이미 난이도 신호라 dict v_level과 충돌.
- **조치**: (a) concrete-noun 보정 리뷰(하향 후보 ~27) 또는 (b) 학년 세트는 dict v_level 대신 **curriculum grade 신뢰**(표시·정렬 시).

### 🟠 I4. csat 세트 multi-POS 이중 행 85건 (UX/SRS)
- `approach`(n+v)·`control`(n+v)·`challenge`(n+v) 등 **같은 표제어가 품사별 2행**(4/5 세트, 85행). 진짜 중복 아니나:
  - 학습 모듈이 `word`/`lemma` 키잉 시 **중복 플래시카드** 또는 **SRS 충돌**([[project_srs_persistence_a1]] cardId=단어 lookup).
- 2026-05-19 생성 = multi-sense 인프라 이전. **조치**: 표제어 단위 dedup + `meanings_ko` multi-sense로 품사 통합(현 사전은 per-sense 완비 = Phase B).

### 🟡 I5. book/article floor=V6 누수 (드리프트)
- `select_book_chapter_vocab` floor=V6인데 `cherry` V2(book 2세트) 등 하회 단어 존재(사전 재분류 드리프트). 특정 article(`8c04120b`)은 V4 단어 다수(floor 미준수).
- 소수·국소. **조치**: floor 재검증 후 해당 세트 선택적 재발행(SSoT `select_book_chapter_vocab` 단일출처, [[book_vocab_ssot_unify]]).

### 🟡 I6. Surfacing 갭 — 추천 미노출 유형
- `recommend_word_sets_for_user` 커버: auto-vlevel·specialty·topic·etymology·book·kice(track). ✓
- **미노출(browse 전용)**: **교육과정 학년 세트**(초/중/고 `curriculum-2022-*`) · **library_article**(135) · cast · eng_test.
- 학년 세트는 학습자 핵심 콘텐츠인데 auto-vlevel로 대체돼 추천서 빠짐. library_article은 의도적 가능(읽기 부산물).
- **조치**: 학년(교육과정) 세트를 추천 티어에 추가 여지 검토(auto-vlevel과 중복 회피).

## 3. 평가 요약

| 차원 | 결과 |
|---|---|
| 데이터 무결성(count/null/dup/chapter/orphan) | ✅ 전 유형 통과 |
| lemma→사전 조인 정합 | ✅ unmatched 0 |
| 레벨 단조성(학년) | ✅ 정상 |
| **auto-vlevel 드리프트** | 🔴 V5-V7 stale(75-89%) |
| **사전 오분류** | 🔴 `third` V11 외 소수 |
| 구상어 과대 v_level | 🟠 초/중 ~27 |
| csat multi-POS 이중 행 | 🟠 85행 |
| book/article floor | 🟡 소수 누수 |
| surfacing 커버리지 | 🟡 학년/article 미노출 |

**결론**: 생성 파이프라인의 **정적 산출물 무결성은 매우 견고**(모든 유형 count/null/dup 0). 핵심 리스크는 **시간축 드리프트**(auto-vlevel V5-7이 VRL 재분류 미반영, 추천에 직접 노출) + **사전 데이터 결함이 세트를 통해 노출**(third V11·구상어 과대). 즉시 조치 우선순위 = **E1(재발행) → E2(third 교정) → I4(csat dedup)**.

## 4. 조치 완료 (2026-07-17, 승인 후 적용)

- **E1 ✅**: auto-vlevel 9세트 재발행 — 신규 `scripts/dict/republish-auto-vlevel.mjs`(원 curation_query 충실 재구성, 검증 게이트=V1 재현 100% 일치). 총 **+176 −176** 교체 → **9세트 전부 100% on-level**(드리프트 0). null 0·count 정합. `regenerated_at` 스탬프.
- **E2 ✅**: `third` V11/C2/freq-NULL → **V1/A1**(형제 서수 first/second/fourth/fifth 정합) + per-sense meanings_ko [1,2,2]. (v_level UPDATE 차단 트리거 없음 확인.)
- **I4 ✅**: csat 5세트 multi-POS 이중 행 **85행 병합**(survivor에 뜻·품사 결합 `n·v`, 중복 삭제, word_count 재계산) → 중복 0. csat 1,487→**1,402단어**.
- **미조치(의도)**: I3(구상어 과대 v_level ~27)=VRL 분류기 차원 이슈라 개별 재레벨링 대신 리뷰 유지 · I5(book/article floor 누수)=소수·국소 · I6(surfacing 갭)=제품 판단.

## 5. 잔여 권장 (후속)
- **재발 방지**: auto-vlevel은 정적 스냅샷이라 VRL 재분류마다 재드리프트 → 재발행 cron 또는 recommend가 live v_level 필터. `republish-auto-vlevel.mjs` 재실행으로 언제든 갱신 가능(멱등).
- **I3 VRL 리뷰**: concrete-noun 과대평가(rainbow/crayon/doughnut V8-9)는 분류기 보정 대상.
- **I6**: 교육과정 학년 세트를 추천 티어에 추가 검토.

---
*read-only 감사 → E1/E2/I4 조치 적용. 재현: `shared_word_sets`/`shared_words` × `shared_dictionary` 조인 쿼리 + `republish-auto-vlevel.mjs`.*
