# VCB 재설계 — 레시피 컴포저 (v1 설계·실측 근거)

> 목표: **시중에 존재하는 모든 유형의 단어장을 어드민에서 만들 수 있고**, 그 위에
> **이 플랫폼만 만들 수 있는 유형**을 추가한다. 만들고 → 평가하고 → 고치는 루프를 코드로 고정한다.
>
> 작성 2026-08-14 · 모든 수치는 DB direct query 실측 (추정치는 `est` 로 표기)

---

## 0. 왜 재설계인가 — 실측된 구조 결함

단어장을 만드는 코드가 **5곳**에 있고, 서로 다른 `curation_query` dialect 를 쓴다:

| 생성기 | 산출 | `curation_query` 형태 | 세트 수 (실측) |
|---|---|---|--:|
| VCB 8-step (`vocab_runs` → `08-publish`) | `high` cast-2000 | **null** (기록 없음) | 1 |
| `scripts/lcp/publish-list-word-set.ts` | 교육과정 초·중·고 | `{source:'shared_dictionary', filters:{list_tags}, chapter_size, chapter_count, order, generated_by}` | 3 |
| `scripts/dict/roots-publish-set.mjs` | 어원 | `{org:'root', source:'word_root_links', filters:{cap, per_root_cap, v_level}, version}` | 1 |
| `scripts/dict/topics-publish-set.mjs` | 주제 18종 | `{org:'topic', theme, source:'dictionary_word_categories', filters:{per_set, per_chapter, v_level}, version}` | 18 |
| KICE 기출 | 수능 문항유형 | `{source_key:'kice_csat', filters:{question_nos, min_years}}` | 4 |
| 챕터/글 자동 세트 | `library_book` 1,129 · `library_article` 135 | (별도 경로) | 1,264 |

**결함 3개** (전부 같은 원인 — 공통 계약이 없다):

1. **재현 불가** — cast-2000 은 `curation_query=null` 이라 무엇으로 뽑았는지 코드 아닌 곳에 남지 않았다.
2. **평가 없음** — 5 생성기 중 어느 것도 "이 단어장이 좋은가"를 수치로 답하지 못한다. 지금
   `topic-appearance` 의 한국어 제목이 `외모`(오타: 외모→외모/외양) 인 것도 검수 지표가 없어서 남았다.
3. **유형 확장 불가** — 새 유형(혼동어·연어·다의어·N일 완성)을 원하면 6번째 스크립트를 쓰게 된다.
   현재 어드민 위저드는 **평면 필터 8종 → 정렬 4종 → 개수 제한** 뿐이므로, 목차가 필터로
   표현되지 않는 유형(어원 챕터·의미장·짝 대조·페이싱)은 어드민에서 만들 수 없다.

그래서 **하나의 선언적 레시피 스키마 + 하나의 컴포저 + 하나의 평가기**로 통합한다.

---

## 1. 자산 실측 (2026-08-14) — 무엇으로 만들 수 있나

### shared_dictionary 45,688행 필드 충전율

| 필드 | 충전 | 필드 | 충전 |
|---|--:|---|--:|
| `meaning_ko` | **100%** (45,688) | `senses` | **100%** |
| `v_level` | **100%** | `example_en` | 92% (42,133) |
| `ipa` | 81% (36,793) | `rhyme_key` | 63% (28,989) |
| `related_terms` | 63% (28,582) | `synonyms` | 57% (26,176) |
| `frequency_band` | 84% (38,444) | `antonyms` | 32% (14,678) |
| `derived_forms` | 31% (14,313) | `collocations` | 31% (13,992) |
| `list_tags` | 30% (13,491) | `verified` | 27% (12,182) |
| `korean_learner_note` | 27% | `homophones` | 11% (5,224) |
| `mnemonic_ko` | 11% (5,062) | `base_word` | 7% (3,234) |
| `derivation_suffix` | 6% (2,921) | `cefrj_domain_tags` | 4.5% (2,054) |
| **`image_url`** | **0%** | **`audio_url`** | **0%** |

### 관계·코퍼스 자산

| 자산 | 규모 | 쓰임 |
|---|--:|---|
| `word_roots` / `word_root_links` | 181 / 2,767 | 어원·접사 챕터 |
| `dictionary_categories` / `dictionary_word_categories` | 566 / 28,079 (472 카테고리) | 의미장·주제 챕터 |
| `library_books` / `library_book_vocabularies` | 401 / ~1.68M est (1.1GB) | 도서·챕터 코퍼스. 표본 1권 = 4,516행 / 61챕터 / `first_sentence` 100% / `lemma` 93% |
| `texts` | 275 est | 사용자 본문 |
| `csat_dcp_items` | 1,374 | 수능 기출 문항 |
| `lexicon_frequencies` / `lexicon_clean` | 6,305 / 455K est | 빈도 보강 |
| `word_familiarity` · `vocabularies`(FSRS) | 소규모(dev) | 학습자 기지 어휘 차감 |
| `list_tags` 12종 | ngsl(3)·csat(2)·bsl·ndl·tsl·bel·nawl·moel·fel + kcurr2022(3) | 시험·분야 모집단 |

**결손 2건이 유형 2종을 막는다**: `image_url` 0 → 그림 단어장, `audio_url` 0 → 오디오 단어장.
(브라우저 `speechSynthesis` 는 이미 5개 화면에서 쓰이므로 **소리 재생 자체는 가능** —
사전 녹음 자산이 없다는 뜻이고, 평가기는 이를 `tts_fallback` 등급으로 정직하게 낮춰 기록한다.)

---

## 2. 시중 단어장 유형 분류 — 26종

분류 축은 **"무엇이 목차를 결정하는가"**다. 컴포저가 구현해야 하는 것이 정확히 그것이기 때문에,
출판사·타깃 같은 마케팅 축으로 나누지 않는다.

### A. 모집단이 목차를 결정 (list-driven) — 7종

| # | 유형 | 시중 예 | 자산 | 판정 |
|--:|---|---|---|:-:|
| 1 | 빈도순 N,000 | NGSL/COCA 3000 | `frequency_band`·`ngsl_sfi` | ✅ |
| 2 | 시험 빈출 | 수능/토익/공무원 보카 | `list_tags` csat/bsl | ✅ |
| 3 | 교육과정 학년별 | 교과서 기본어휘 | `kcurr2022_*` | ✅ |
| 4 | 학술 어휘 | AWL/NAWL | `nawl_1.2` | ✅ |
| 5 | 등급별(CEFR/V) | A1~C2 단계 보카 | `cefr_level`·`v_level` | ✅ |
| 6 | 분야 전문 | 의학·금융·여행·뉴스 | `moel/fel/tsl/ndl`·`domain_levels` | ✅ |
| 7 | 기출 문항 기반 | 수능 기출 유형별 | `csat_dcp_items` | ✅ |

### B. 어휘 내적 구조가 목차를 결정 (structure-driven) — 11종

| # | 유형 | 시중 예 | 자산 | 판정 |
|--:|---|---|---|:-:|
| 8 | 어원·어근·접사 | Word Power Made Easy·어원편 | `word_root_links` 2,767 | ✅ |
| 9 | 파생어 family | word family 보카 | `derived_forms` 31% + `base_word` 7% | ⚠️ 부분 |
| 10 | 품사별 | 동사·명사 집중 | `primary_pos` | ✅ |
| 11 | 의미장·주제 | 주제별 그림/테마 보카 | `dictionary_word_categories` 28,079 | ✅ |
| 12 | 유의어 클러스터 | 유의어 대조 보카 | `synonyms` 57% | ✅ |
| 13 | 반의어 대조쌍 | 반대말 보카 | `antonyms` 32% | ✅ |
| 14 | 혼동어·유사철자 | Confusing Words | `homophones` 11% + 편집거리 | ✅ |
| 15 | 연어 중심 | Collocations in Use | `collocations` 31% | ✅ |
| 16 | 구동사·관용어 | Phrasal Verbs in Use | `primary_pos` idiom/phrasal_verb | ✅ |
| 17 | 다의어 | 다의어 정복 | `senses` 100% | ✅ |
| 18 | 라임·발음 | phonics·라임 카드 | `rhyme_key` 63% | ✅ |

### C. 콘텐츠가 목차를 결정 (corpus-driven) — 4종

| # | 유형 | 시중 예 | 자산 | 판정 |
|--:|---|---|---|:-:|
| 19 | 원서 도서별 | "해리포터 단어장" | `library_book_vocabularies` | ✅ |
| 20 | 챕터별 부록 | 리더스 챕터 단어 | 동 (chapter_idx) | ✅ |
| 21 | 시사·뉴스 기사별 | 뉴스 보카 | ACP article word set | ✅ |
| 22 | 영상·스크립트 | 미드 영어 | `texts`(사용자 입력) | ⚠️ 부분 |

### D. 학습 방법이 목차를 결정 (delivery-driven) — 4종

| # | 유형 | 시중 예 | 자산 | 판정 |
|--:|---|---|---|:-:|
| 23 | N일 완성 페이싱 | 30일/60일 완성 | (조직 규칙) | ✅ |
| 24 | 연상·스토리 | 해마학습법 | `mnemonic_ko` 11% | ⚠️ 부분 |
| 25 | 그림 단어장 | picture dictionary | `image_url` **0** | ❌ 자산 결손 |
| 26 | 오디오 단어장 | 듣기 보카 | `audio_url` **0** | ❌ 자산 결손 |

**합계 26종 — 완전 지원 20 · 부분 3 · 불가 2 · (22 부분)**. 목표는 `✅ + ⚠️` 24종을
어드민 한 화면에서 만드는 것이고, ❌ 2종은 **자산 수집 과제**로 분리해 명시한다 (설계로 못 메운다).

---

## 3. 이 플랫폼만 만들 수 있는 유형 — 5종

지면 단어장이 원리적으로 불가능한 이유를 각각 명시한다. "좋다"가 아니라 **"구조상 불가"**여야
고유성이다.

### U1. `unlock` — 콘텐츠 해금 최적 단어장

목표 콘텐츠(도서·챕터 집합·글)의 **토큰 커버리지**를 목표치(예 95%)까지 올리는 데 필요한
**최소 단어 집합**을 한계 기여도 탐욕(greedy marginal coverage)으로 고른다. 학습자가 이미 아는
단어(`word_familiarity` known · FSRS stable)는 차감한다.

- 필요 조건 3개: ① 콘텐츠별 토큰 빈도 ② 개인 기지 어휘 ③ 한계 커버리지 계산
- **지면 불가 이유**: ①은 책마다 다르고 ②는 사람마다 다르다 → 인쇄 시점에 목차를 확정할 수 없다.
- 검증 가능한 우위: 같은 단어 수에서 **빈도순 대비 커버리지 %p 우위**. (Round 1 실측 §7)

### U2. `recycle` — 재등장 우선 단어장 (narrow reading)

`LEARNING_FRAMEWORK.md` 의 `ENCOUNTERS_FLOOR = 8`을 **인공 반복이 아니라 읽기로** 채운다.
같은 도서의 다음 N챕터에 재등장하는 단어를 우선 선택해, 학습 직후 자연 노출이 보장되게 한다.

- **지면 불가 이유**: "이 단어가 앞으로 몇 번 더 나오는가"는 그 책의 챕터 토큰 분포를 알아야 나온다.
- 지표: 선택 단어의 **평균 향후 재등장 횟수**(빈도순 대비).

### U3. `facet-ladder` — 6면 보장 단어장

각 항목이 `FACETS`(F1 Recognize · F2 Spell · F3 Sound · F4 Build · F5 Use · F6 Fluency) 중
어느 면까지 **실제로 훈련 가능한지** 데이터로 검증하고, 세트가 면별 준비도를 선언한다.

- **지면 불가 이유**: 지면은 재인(F1)만 지원한다. 면별 인출 형식(TAP)을 보장할 수 없다.
- 지표: 선언 면의 요구 필드 결측 0.

### U4. `confusion` — 실오답 기반 혼동 세트 (데이터 게이트)

학습자의 실제 오답에서 혼동쌍을 만든다. dev 환경 학습 데이터가 얕아 **데이터 게이트**로 표시하고,
자산이 쌓이면 자동 활성된다. (지면 불가 이유는 자명 — 오답은 인쇄 후에 생긴다.)

### U5. `uncovered` — 미수록 어휘 (Round 4 추가)

이미 발행된 세트 **전체를 빼고** 남은 어휘. 평가기가 매 유형마다 "기존 세트와 73~99% 겹침" 을
경고했는데, 그 경고를 손쓸 수 있는 능력으로 바꾼 것이다 (`population: except[dictionary, published]`).

- **지면 불가 이유**: 우리 카탈로그가 이미 무엇을 덮고 있는지는 우리만 안다. 출판사는 자기 목록의
  중복은 알아도 **이 플랫폼의 1,300 세트**에 대한 차집합은 계산할 수 없다.
- 지표: novelty = 1.00 (구성상 보장). Round 4 실측 400단어 · 총점 1.00.

---

## 3.5 5 방언 대체 — 파리티 실측 (2026-08-15)

레시피가 기존 생성기를 **표현할 수 있다**는 것과 **같은 결과를 낸다**는 것은 다르다. 그래서 각
legacy 세트를 컴포저로 다시 뽑아 개수를 맞춰 봤다. 맞지 않으면 대체가 아니라 교체다.

| legacy 산출 | 개수 | 컴포저 명령 | 개수 | 판정 |
|---|--:|---|--:|:-:|
| `etymology-core` (roots-publish-set) | 1,500 | `--blueprint root-etymology --count 1500` | **1,500** | ✅ 일치 (181 어근 챕터) |
| `topic-travel` (topics-publish-set) | 500 | `--blueprint topic-field --theme 여행 --count 500` | **500** | ✅ 일치 (5 챕터) |
| `curriculum-2022-mid` (publish-list-word-set) | 1,183 | `--blueprint curriculum-grade --tag kcurr2022_2` | 1,210 | ⚠️ +27 — legacy 가 content POS·길이≥3 를 추가로 걸렀다 |
| `kice-q31-34-blank` (RPC) | 430 | `--blueprint exam-items --questions 31,32,33,34` | **430** | ✅ 일치 |
| `kice-q18-24-purpose` (RPC) | 361 | `--questions 18,22,23,24` | **361** | ✅ 일치 |
| `kice-q41-43-long` (RPC) | 234 | `--questions 41,42,43` | **234** | ✅ 일치 |
| `kice-frequent-tier4` (RPC) | 362 | `--tier-min 4` | **362** | ✅ 일치 |
| `cast-2000` (VCB 8-step) | 1,998 | — | — | 보강 경로 — 컴포저 대상 아님 |

세 스크립트 헤더에 **SUPERSEDED** 와 대체 명령을 적었다. 새 유형이 필요할 때 파일을 복사하면
6번째 방언이 생기므로, `blueprints.ts` 한 항목으로 늘리도록 그 자리에서 안내한다.

### KICE 문항유형 데이터 구조 — 고아를 구조했다

파리티를 맞추다 **살아 있는 결함**을 찾았다:

`regenerate_curated_word_set` RPC(4 KICE 세트의 재생성 경로)는 `word_lexicon` 을 읽는데, 그 테이블은
`20260719161409_drop_unused_empty_tables` 가 CASCADE 삭제했다 (CLAUDE.md 가 추적 중인 "없는 테이블을
참조하는 RPC 8개" 중 하나). **즉 그 4 세트는 지금 재생성 버튼을 누르면 실패한다.**

더 나쁜 것은 데이터였다. 문항유형 정보(`question_history` = {연도: [문항번호]})는 `lexicon_source_tags`
(5,421행)에만 있고 그 테이블은 `lexicon_id` 로만 키를 잡는데, `lexicon_id` → 단어를 잇던 유일한
테이블이 `word_lexicon` 이었다. 남은 다리는 **`shared_words.lexicon_id`** 하나뿐이었고, 그 4 세트를
재발행하면 그 다리도 사라져 데이터가 영구 소실된다.

| 조치 | 결과 |
|---|---|
| 다리로 이을 수 있는 lemma 를 `lexicon_frequencies.metadata.question_history` (lemma 키·생존 테이블)로 옮김 | **673 lemma 구조** |
| 이을 수 없는 것 | 5,421 중 **87% 영구 소실** — 그 4 세트에 없던 단어의 문항 이력은 복구 불가 |
| 컴포저 `exam_items` 에 `question_nos`·`frequency_tier_min`·`raw_count_min` 필터 추가 | 4 세트 **전부 정확 재현**(430·361·234·362) |

구조한 673 개가 마침 그 4 세트의 합집합이라 재현이 정확한 것이고, **새 문항유형 세트(예: 37~39번)는
만들 수 없다** — 그 단어들의 이력은 이미 없다. `lexicon_frequencies.metadata` 에
`question_history_rescue` 표시를 남겼으니, `scripts/lexicon-v2.2/kice-csat-seed.ts` 를 다시 돌려
metadata 를 덮어쓰면 구조한 것도 함께 날아간다는 점만 지키면 된다.

---

## 4. Recipe v3 스키마 — 4단 선언

```
Recipe = meta + population(모집단) + select(선별) + organize(조직) + present(표현)
```

`shared_word_sets.curation_query` 에 그대로 저장한다 (**마이그레이션 불필요** — 기존 컬럼
`curation_query jsonb` · `auto_curated boolean` 재사용). 5 dialect 는 v3 로 흡수된다.

| 단 | 무엇을 정하나 | 주요 값 |
|---|---|---|
| `population` | 어디서 뽑나 | `dictionary` · `list` · `roots` · `topics` · `corpus` · `exam_items` · `learner` · `union/intersect/except` |
| `select` | 무엇을 남기나 | 필터(레벨·빈도·품사·태그·register) · 필수 필드 · **objective**(`count` \| `coverage` \| `all`) · 기지 어휘 차감 · family 접기 |
| `organize` | 목차를 어떻게 짜나 | `group_by` 13종 · `order_within` 6종 · 그룹/세트 cap · `pacing{days, per_day}` |
| `present` | 무엇을 보장하나 | 보장 면(`facets`) · 카드 필드 · 대조쌍(`antonym`/`confusable`/`sense`) |

**핵심 발명 — 면(facet) → 요구 필드 매핑.** 세트가 "이 면을 훈련할 수 있다"고 선언하면
평가기가 그 필드의 결측을 센다. 4지선다로 익힌 단어를 "말할 수 있다"로 표기하는 것을
데이터가 막는다 (`axes.ts` 의 `retrieval` 계약과 동일한 근거).

| 면 | 요구 필드 | 비고 |
|:-:|---|---|
| F1 Recognize | `meaning_ko` | 100% 충전 → 항상 가능 |
| F2 Spell | `meaning_ko` + 단어 길이 ≥ 2 | 철자 생산 단서 |
| F3 Sound | `audio_url` \| `ipa` | audio 0% → `ipa`면 **tts_fallback** 등급 |
| F4 Build | `base_word` \| `derivation_suffix` \| `derived_forms` \| root link | 형태소 조립 |
| F5 Use | `example_en` (+`collocations` 가점) | 문맥 인출 |
| F6 Fluency | F1 요구 + `frequency_band` | 속도 대역은 세션 산물 |

---

## 5. 평가 — Scorecard 7지표

각 세트는 **레시피와 함께 점수를 들고 있다** (`curation_query.scorecard`). 지표는 blueprint별
가중치로 합산하고 **0.80 이상을 통과선**으로 둔다.

| 코드 | 지표 | 무엇을 잡나 |
|---|---|---|
| `fill` | 선언 면 요구 필드 충전율 | "Use 세트인데 예문이 없다" |
| `level_fit` | 목표 레벨 밴드 적합 + 분포 | "초급 세트에 V10이 섞였다" |
| `noise` | register 잡음·중복·고유명사 | `archaic_literary`·`proper_noun` 혼입 |
| `novelty` | 기존 발행 세트와 비중복 | "이미 있는 세트의 재판" |
| `organize` | 그룹 균형·원리 적합 | "어원 세트인데 root link 없는 단어" |
| `blueprint_fit` | 유형 고유 조건 | unlock=커버리지 달성 · recycle=재등장 · confusable=짝 보유 |
| `value` | 빈도 가중 학습 가치 | 희귀어만 모인 세트 감점 |

---

## 6. 목표 (달성 판정 기준)

| ID | 목표 | 측정 |
|---|---|---|
| **G1** | 시중 26종 중 **24종** 생성 가능 (❌ 2종은 자산 과제로 분리) | blueprint 카탈로그 × 실 DB 드라이런 |
| **G2** | 모든 blueprint scorecard **≥ 0.80** | `pnpm vcb:compose-eval` |
| **G3** | 선언 면 요구 필드 결측 **0** | `fill = 1.0` |
| **G4** | `unlock` 이 같은 단어 수에서 빈도순 대비 커버리지 **우위** | 실측 비교 (§7) |
| **G5** | 회귀 무해 — 신규 테스트 통과 + 기존 vitest 유지 | `pnpm --filter web test` |
| **G6** | 생성 가능한 모든 유형이 **같은 유형의 시중 베스트**에 16 요소 중 어느 것도 지지 않음 | `market.ts` 경쟁 루브릭 |
| **G7** | 목표 초과 — 남은 동률이 전부 상한(1.00) 또는 해당 없음(0 vs 0) | 동 |

---

## 7. Round 기록 (실측)

평가 러너: `apps/web/src/lib/vcb/compose/__tests__/compose-eval.integration.test.ts`
매트릭스 전문: [docs/reports/vcb-compose-eval.md](./reports/vcb-compose-eval.md) (러너가 매 실행마다 덮어쓴다)

| Round | 통과 / 대상 | 무엇이 바뀌었나 |
|---|:-:|---|
| 1 | 9 / 27 | 첫 드라이런. 실패가 **설계 결함 3건**을 드러냈다 (아래) |
| 2 | 20 / 27 | 결함 3건 수정 |
| 3 | **28 / 28** | 그룹 인지 선별 + 평가기 부당 감점 3건 수정 → 전 유형 통과 |
| 4 | 28 / 28 | 통과선은 유지하되 **남은 한계 3건**을 능력으로 전환 (아래 §Round 4) — 그 과정에서 결함 1건 추가 발견 |
| 5 | **28 / 28** + U5 1.00 | 결함(부분집합 재조직) 수정 → `word-family` 35 → 300 |

### Round 1 이 드러낸 결함 3건 (전부 실측이 원인을 특정)

| # | 증상 | 원인 | 수정 |
|---|---|---|---|
| 1 | `unlock` 해금 문장 **155 vs 빈도순 155** (우위 0) | 개수로 먼저 자른 뒤 순서만 바꿨다 → 같은 200개의 순서만 다름 | 해금을 **선별 전략**으로 승격 (`compose.ts`) — 풀 전체에서 예산만큼 고른다 |
| 2 | `recycle` 향후 재등장 **0.00 vs 0.00** | `library_book_vocabularies` 는 **책당 단어 1행**(UNIQUE 제약)이라 챕터별 재등장 행이 애초에 없다 | `frequency_in_book − frequency_in_chapter` 로 계산 (첫 챕터 밖 등장) |
| 3 | 0.9x 점수인데 18종이 미달 판정 | `novelty` 를 하드 blocker 로 뒀다 — 시험 어휘가 여러 세트에 겹치는 것은 정상 | novelty 는 점수·경고로만, blocker 에서 제외 |

### Round 2 가 드러낸 결함 4건

| # | 증상 | 원인 | 수정 |
|---|---|---|---|
| 4 | 주제 '여행' 이 5 챕터인데 결과 **2 챕터** · 짝 유형 300개 중 126개가 짝 없음 | 개수 목표를 **그룹 구성 전에** 잘라 빈도 상위가 몰린 그룹만 살아남았다 | **그룹 인지 선별** — 목차를 먼저 짜고 그룹에서 예산을 채운다(짝 유형은 그룹 단위 통째로) + `min_group_size` 미달 그룹 제거 |
| 5 | `phrasal-idiom` noise **0.56** | 그 유형이 **일부러 허용한** `phrase_unit` 을 기본 잡음 목록으로 셌다 | 잡음 판정을 레시피의 `exclude_registers` 기준으로 |
| 6 | `phrasal-idiom` value **0.05** | `phrase`·`compound` 대역을 학습 가치 없음으로 셌다 | 두 대역을 가치 있는 대역에 포함 |
| 7 | `unlock` level_fit **0.49** · 원서 세트 0.70 | 코퍼스 세트에 레벨 응집도를 요구했다 — 책에 나오는 단어 레벨은 퍼지는 것이 정상 | 코퍼스 모집단 + 밴드 미선언이면 "콘텐츠가 레벨을 정한다" 로 판정 제외 |

### Round 3 최종 (2026-08-14 실측)

- 카탈로그 **30종** — ready 24 · partial 3 · asset_gap 2 · data_gate 1
- **생성 가능 28종 전부 통과** (총점 0.88 ~ 0.98) · 테스트 39/39
- 자산 결손 2종(`picture-dict`·`audio-only`)은 **0건**을 냈다 — 설계 결함이 아니라 자산 결손임을 테스트가 고정한다

**고유 유형 우위 증거 (같은 예산·대조군은 일반 빈도순)**

| 유형 | 우리 | 빈도순 | 배수 |
|---|--:|--:|--:|
| **U1 unlock** — 200단어로 완전히 읽히게 된 문장 (전체 1,769) | **201** | 23 | **8.7×** |
| **U2 recycle** — 선택 단어의 평균 향후 재등장 (모집단 평균 32.2) | **143.4** | 94.1 | **1.5×** |

`unlock` 의 8.7배가 이 재설계의 핵심 결과다 — 같은 200단어를 배웠을 때 실제로 읽히는 문장이
8.7배라는 것이고, 인쇄 단어장은 학습자의 기지 어휘를 모르므로 이 순서를 만들 수 없다.

### Round 4 — 남은 한계를 능력으로 (2026-08-14)

Round 3 은 통과했지만 세 가지가 "정직한 한계" 로 남아 있었다. 그중 둘은 **설계로 닫을 수 있는
것**이었다 — 자산이 없어서가 아니라 우리가 덜 짜서 남은 것이었기 때문이다.

| 한계 | 무엇이 문제였나 | 어떻게 닫았나 | 결과 |
|---|---|---|--:|
| `word-family` 56개 | `base_word` 7% 만 보고 묶었다 | `derived_forms` 31% 를 **역인덱스로 뒤집었다** — 같은 관계를 반대 방향으로 들고 있는 컬럼 | **300개 / 131 묶음** |
| novelty 73~99% 경고가 매 유형에 | 겹침을 경고만 하고 손쓸 방법이 없었다 | `published` 모집단 + `except` → **U5 `uncovered`**("아직 어느 단어장에도 없는 말") | novelty **1.00** · 총점 **1.00** |
| `unlock` 이 "몇 개" 로만 지시 가능 | 학습자가 원하는 것은 "이 책의 몇 %" 이고 필요한 단어 수는 책마다 다르다 | 커버리지 목표를 해금 순서에 연결 (개수 대신 토큰 커버리지가 멈춤 조건) | Pride and Prejudice **90% = 1,691단어** (해금 문장 1,434 vs 빈도순 450) |

**Round 4 가 새로 드러낸 결함 1건** — 개선이 오히려 숫자를 떨어뜨렸다(56 → 35). 원인은 역인덱스가
아니라 그 앞에 있던 구조였다:

> 그룹 키가 **입력 집합에 누가 있느냐**에 의존한다. `attention·attendance·attendant` 가 한 계열인
> 것은 `attend` 가 풀에 있어서다. 그런데 컴포저가 예산만큼 단어를 뽑은 뒤 **다시 조직**하고 있었고,
> 그 부분집합에 `attend` 가 없으면 묶음이 전부 1인 그룹으로 흩어져 `min_group_size` 에 걸려 사라졌다.
> → 1차 조직 결과를 정본으로 삼고 재조직을 없앴다 (`pickGroups`).

이 결함은 **개선을 측정했기 때문에** 잡혔다. 지표 없이 역인덱스만 넣었다면 "파생어 단어장을
개선했다" 고 커밋하고 결과는 나빠졌을 것이다.

### 최종 상태 (Round 5)

- 카탈로그 **31종** — ready 25 · partial 3 · asset_gap 2 · data_gate 1
- **생성 가능 28종 전부 통과** (0.88 ~ 1.00) · 신규 테스트 43 · 전체 vitest 703 통과

**정직하게 남는 한계**

| 유형 | 결과 | 사실 |
|---|--:|---|
| `confusion-log` | 6개 | dev 학습 기록이 얕다 (data_gate — 오답이 쌓이면 자동으로 커진다) |
| `rhyme-phonics`·`facet-ladder`·`script-media` | fill 0.90~0.95 | Sound 면이 녹음 자산 0% 라 TTS fallback (0.7 가중) — 숨기지 않고 감점으로 기록 |
| `picture-dict`·`audio-only` | 0개 | `image_url`·`audio_url` 0% — **자산 수집 과제**. 설계로 못 메운다 |
| `word-family` | 300개 | `partial` 유지 — 사전 전체(45,688)에 비하면 형태소 관계가 있는 행이 여전히 31% 다 |

### Round 6~19 — 시중 베스트와 요소별로 겨룬다 (2026-08-15)

§5 의 7지표는 **우리 기준 내부 품질**(선언한 것을 지켰나)이다. 그것이 1.00 이어도 "시중 책보다
나은가" 에는 답하지 못한다. 그래서 두 번째 루브릭을 만들었다 — `lib/vcb/compose/market.ts`.

**공정성 규칙**: 경쟁 상대는 **그 유형의 베스트**다. 빈도순 세트를 어원편과 비교하면 어원 점수에서
부당하게 진다. 13 경쟁 프로필(능률 VOCA · 해커스 보카 · Word Power Made Easy · Collocations in Use ·
Phrasal Verbs in Use · 30일 완성 · 원서 부록 · 파닉스 카드 …)을 두고 blueprint 마다 상대를 지정했다.

**16 요소** — 지면이 잘하는 12 (뜻·예문·발음·어원·유의반의·연어·암기장치·목차·분량·시험근거·오류·유형충실도)
+ 지면이 구조상 못 하는 4 (개인화·적응복습·콘텐츠연결·갱신). 기준선은 **그 매체가 지면에서 제공하는
상한**으로 잡았다 — 뜻·발음·오류는 1.00(편집자 교열), 우리에게 가장 불리한 가정이다.

| Round | 전 요소 우위/동률 | 무엇을 고쳤나 |
|---|:-:|---|
| 6 | 2 / 28 | 첫 측정 |
| 7 | 14 / 28 | 뜻 오염 항목 배제(`meaning_clean`) · 챕터 30개 분할 · 구는 발음 분모에서 제외 |
| 9 | 23 / 28 | IPA 요구(비-구·비-코퍼스) · 페이싱 분기 층화 누락 수정 · 유형 고유 기억장치 인정 |
| 11 | 24 / 28 | **표제어 선정 결함** — 기능어·1~2자·굴절 중복 배제 |
| 14 | 27 / 28 | 불규칙 굴절 예문 판정(`inflected_forms`) · 챕터 분할을 선별 뒤로 |
| 16 | **28 / 28** | 사전식 변형 표제어 배제 · 구 머리동사 굴절 부착 |
| 19 | **28 / 28 목표 초과** | 남은 동률이 전부 상한(1.00) 또는 해당 없음임을 판정에 반영 |

**Round 6~19 가 잡은 진짜 결함 5건** (전부 "우리가 시중보다 못한 지점"이었다):

| # | 증상 | 실제 원인 | 수정 |
|---|---|---|---|
| 8 | 거의 모든 유형이 뜻 품질에서 지면에 짐 | 한국어 뜻 자리에 영단어가 남은 행 1,642건 | 모든 레시피에 `meaning_clean` 요구 |
| 9 | 분량 설계 열위 | 500개짜리 챕터 — 목차가 있으나 마나 | `max_group_size` 30 분할 (`V5 (1/3)`) |
| 10 | **빈출 2000 세트에 `is·am·s·m·d·comes·went`** | 표제어 선정에 기능어·굴절 중복·1~2자 필터가 없었다 | `content_pos_only` · `min_word_length` · `drop_pool_inflections` |
| 11 | 원서 세트 예문 6% 가 "표제어 없음" 판정 | come/came 같은 **불규칙 굴절** — 어간 자르기로는 못 잡는다 | `inflected_forms`(15,217행) 로 판정 |
| 12 | "빈출 구동사" 세트가 `(as) sick as a parrot` 류로 채워짐 | ① 사전식 변형 표제어 ② 챕터 분할이 **선별보다 먼저** 일어나 라운드로빈이 빈도 전 구간을 흩뿌림 | `exclude_variant_headwords` · `require_frequency_rank` · 분할을 선별 뒤로 |

**콘텐츠도 채웠다** (측정이 "데이터가 없다" 를 가리킨 자리):

| 대상 | 채운 것 | 왜 |
|---|--:|---|
| 고빈도 내용어 | 연상 60건 | 연상 보카 기준선(0.1~0.2)에 미달이었다 |
| 여행 주제 어휘 | 연상 48건 | 주제 보카 기준선 0.2 미달 |
| 상위 구동사·관용어 | 연상 21건 + 연어 34건 + 유의어 34건 | 구동사 책이 파는 요소인데 우리 구 데이터가 비어 있었다 |

house style 은 기존 5,062건과 같은 `어근(뜻) → 연결 → 최종 뜻` 이다. 작성 중 오타 1건
(`分analyse`)을 스스로 잡아 고쳤다 — 이 루브릭의 `error_free` 가 잡는 바로 그 종류다.

**G7(목표 초과)는 정의가 틀렸다가 고쳤다.** 처음엔 "동률이 하나도 없을 것" 으로 뒀는데, 뜻·발음·
오류는 양쪽 다 1.00 이 상한이라 원리적으로 초과가 불가능하고, 개인화·콘텐츠 연결은 그 유형이 쓰지
않으면 0 vs 0 이다. 그래서 동률을 **깰 수 있는 동률**과 **상한/해당 없음**으로 나눴다 — 지금은
깰 수 있는 동률이 0 이다.

전체 매트릭스: [reports/vcb-compose-eval.md](./reports/vcb-compose-eval.md) (러너가 매 실행 갱신)

### 학습자 동선 — 발행된 것이 읽으려는 자리에서 만나진다 (2026-08-15)

발행은 절반이다. `unlock` 세트는 **그 책을 읽으려는 사람**에게 가장 값나가는데, 처음에는
`/library/vocab` 테마별에서만 발견됐다. 도서 상세에는 v06.31 부터 비어 있던 자리가 있었다:

> Tier 2 "보조 단어장 (선택)" — *"이 도서와 연관된 추가 단어장은 아직 준비되지 않았어요"*

새 섹션을 만들지 않고 **그 약속을 지켰다** (내비 표면을 늘리지 않는다):

| 구현 | 내용 |
|---|---|
| `fetchBookComposerSets` (`lib/library/books/queries.ts`) | `curation_query->>source_book_id` 로 이 책의 컴포저 세트를 찾는다. `book_id` 키는 챕터 세트 판정 전용이라 침범하지 않는다 |
| `composerSetWhy` | 어드민 지표를 **학습자 말**로 옮긴다 — "이 200단어를 알면 이 책의 문장 201개가 온전히 읽혀요" |
| `BookDetailClient` Tier 2 | 세트가 있으면 카드, 없으면 종전 안내 유지 |

**문구에서 한 번 되돌린 것**: `recycle` 의 실측 평균 재등장(143.4)을 그대로 쓰면
"앞으로 평균 143번 더 만나요" 가 된다. 산술은 맞지만(고빈도 책 단어) 과장처럼 읽히고 숫자 게이지
금지에 어긋나므로, 수치를 빼고 *"책이 대신 복습해 줘요"* 로 바꿨다. 그 선은
[book-composer-sets.test.ts](../apps/web/src/lib/library/__tests__/book-composer-sets.test.ts) 6건이
고정한다(대조군 수치·압박 어휘 노출 금지 포함).

### Round 20~26 — 구조 보완 (2026-08-15)

앞 라운드는 "레시피를 고쳐 점수를 올린" 것이었다. 여기서는 **데이터·게이트·판정 규칙 자체가
틀린 곳**을 고쳤다 — 레시피로 우회하면 같은 결함이 다음 유형에서 다시 나온다.

| # | 무엇이 틀렸나 | 실측 | 구조 보완 |
|---|---|---|---|
| 20 | `meaning_clean` 이 **정상 항목 1,640건**을 뺐다 | 영문 4자 규칙에 `dispose 처리하다 (dispose of)` 가 걸렸다. 한국어가 아예 없는 건 2건뿐 | 규칙을 "한국어를 포함 · 80자 이내 · 깨진 글자 없음" 으로 재정의 + **필터 생존율 경고**(단일 사유가 절반 이상을 걸러 내면 리포트에 남긴다) |
| 21 | `require_frequency_rank` 가 구동사를 200→10 으로 붕괴시켰는데 **7지표는 전부 1.00** 이었다 | 남은 10개가 전부 완벽했으므로 평균은 만점 | 필터 제거 + **규모 미달 blocker**(요청의 30% 미만이면 실패) — 점수는 "얼마나 좋은가" 만 보고 "얼마나 만들었나" 를 안 봤다 |
| 22 | 구동사 유형이 사전에서 **보이지 않았다** | `primary_pos` 가 `'phrasal verb'`(공백)인 15행 — 하필 내가 앞 라운드에 채운 고빈도 구들 | 표기 정규화 → `phrasal_verb`. 유형 필터가 자기가 만든 데이터를 놓치고 있었다 |
| 23 | KICE 기출 lemma 673개가 **어느 테이블에도 연결되지 않은 채** 떠 있었다 | `question_history` 에만 있고 `lexicon_frequencies` 엔 없다 | 기출 빈도를 `lexicon_frequencies.metadata` 로 편입 → `exam-items` 유형이 실제 출제 근거로 뽑힌다 |
| 24 | `base_word` 백필이 `enforce_base_word_depth1` 트리거에 반복 차단 | 체인 2단(`happily→happy→happiness`) | 체인 평탄화 + 같은 문장에서 갱신된 행 제외 → 179행. 형태소 커버리지는 34.7% 그대로 — **효과가 작다는 것도 실측으로 남긴다** |
| 25 | 프로젝트 게이트 **I7 이 내 발행물에서 노이즈 52건**을 잡았다 | `cat-phrasal` 90단어 중 52건이 `word_register='phrase_unit'` | 게이트가 `phrase_unit` 을 **전 세트 공통 노이즈**로 하드코딩한다. 구동사 단어장에서는 그게 산출물이다 → 유형별 예외 적용([20260815120000](../supabase/migrations/20260815120000_i7_phrase_unit_carveout.sql), 사용자 승인 후). `blueprint='phrasal-idiom'` 세트의 `phrase_unit` **한 종류만** 면제 · global·word_set 두 scope 동시 수정 · `cat-phrasal` 재발행 |
| 26 | **오디오 유형이 "만들 수 없음"으로 분류돼 있었다** | `audio_url` 0% 를 근거로 `asset_gap` | 오판이었다 — WordVault 흘려듣기 큐(`useListenQueue`)는 이미 런타임 TTS 로 돈다. 판정 규칙을 `all_have_field: audio_url` → `audio_playable`(녹음 **또는** TTS)로 바꾸고 목차를 듣기 회차로 잘랐다 → `partial` 0.92 · 발행 `cat-audio-listen` 300단어 |

Round 26 뒤 **G6 29/29 · G7 29/29(목표 초과) · 파라미터 스윕 55/55**. 남은 미생성 2종은
`picture-dict`(진짜 자산 결손)과 `confusion-log`(학습자 오답 데이터가 쌓여야 하는 게이트)다.

### Round 28 — 오디오 전달 방식 확정: 브라우저 TTS (2026-08-15)

**제품 결정**: 단어 소리는 녹음 자산이 아니라 **브라우저 TTS** 로 낸다. 그 결정이 평가와 코드
두 곳을 바꿨다.

| 무엇이 | 전 | 후 | 왜 |
|---|---|---|---|
| Sound 면 등급 | `fallback`(0.7 가중) | `full` | 확정된 전달 방식을 결핍으로 계속 세면 그 유형은 영원히 감점된 채 남는다 |
| Sound 면 요구 | `audio_url` 또는 `ipa` | **`speakable`**(라틴 문자 표제어) | 재생을 지탱하는 것은 파일도 표기도 아니라 TTS 다. `audio_url` 은 요구·가산·선호에서 전부 뺐다 — **대체 경로를 남겨 두면 다음 사람이 "오디오를 고치려면 파일부터" 로 되돌린다** |
| 적합 규칙 문구 | "녹음 0 · TTS 합성 300" | "브라우저 TTS 로 전량 재생 가능 (300건)" | 두 경로를 비교하는 문장 자체가 대체 경로를 전제한다 |
| `발음 표기` 요소 | IPA **또는** audio_url | IPA 만 | 지면과 겨루는 요소는 표기다. 재생은 지면이 아예 못 하는 것이라 print_impossible 쪽 이야기다 |
| D26 상태 | `partial` | `ready` | 카탈로그 ready 26 · partial 3 · asset_gap 1 · data_gate 1 |
| 오디오 세트 총점 | 0.92 | **0.98** | fill 0.85 → 1.00 |

**결정이 새 실패 지점을 만들었다.** 재생이 브라우저에 달렸으므로 브라우저가 못 하면 상품이 없다.
[useSpeech](../apps/web/src/components/wordvault/hooks/useSpeech.ts) 를 실측해 보니 둘 다 열려 있었다:

1. **음성을 안 골랐다** — `utter.lang='en-US'` 만 주고 `voice` 를 비워 두면 브라우저는 설치된
   아무 음성으로 읽는다. 한국어 시스템에서 한국어 음성이 영단어를 읽으면 발음 학습에는
   침묵보다 나쁘다. → en-US 우선으로 직접 고르고(`en_US` 표기 차이 흡수),
   없으면 `englishVoice: false` 를 노출해 듣기 화면이 한 줄로 알린다.
2. **실패하면 큐가 멈췄다** — 미지원·음성 없음·합성 오류에서 `onEnd` 가 불리지 않아
   흘려듣기가 그 자리에 섰다. 화면에는 아무 표시도 없다. → `onerror` 도 완료로 통지하고
   중복 통지는 막는다(두 번 부르면 단어 하나를 건너뛴다).

회귀 7건 — [speech-delivery.test.ts](../apps/web/src/components/wordvault/hooks/__tests__/speech-delivery.test.ts).

### Round 27 — 혼동 세트가 오답을 안 보고 있었다 (2026-08-15)

`confusion-log` 는 "내가 실제로 틀린 짝" 을 판다. 그런데 모집단이
`vocabularies.next_review_at`(FSRS 복습 예정)을 읽고 있었다 — 그건 **곧 잊을 때가 된 단어**지
틀린 단어가 아니다. 화면은 멀쩡히 세트를 뱉으므로 아무것도 빨개지지 않고, 학습자만 남의 함정을
자기 함정으로 배운다.

파고드니 결함이 두 겹이었다.

| 겹 | 실측 | 고친 것 |
|---|---|---|
| 읽기 | 실오답은 `learning_records` 에 **331건 / 183단어** 로 이미 있었고 컴포저가 안 읽었다 | `learner` 모집단에 `state: 'wrong'` 추가 — 틀린 횟수 내림차순 |
| 쓰기 | 그 331건 중 **"그때 무엇을 골랐나" 는 0건**. WordBlitz 는 고른 보기를 손에 쥐고도(같은 함수에서 `isNearMiss` 에 쓴다) `onWrong` 에서 버렸다 | `chosen` 을 `learning_records.metadata` 까지 배선. 정답일 때·시간 초과일 때는 담지 않는다(담으면 짝 집계가 자기 자신으로 반쯤 찬다) |

그래서 **짝을 철자 이웃으로 만들던 것도 고쳤다**. `confusable` 은 사전이 만든 함정이고
이 유형이 파는 것은 그 학습자가 실제로 빠진 함정이다 — 실측으로도 오답 119단어 중 이웃 짝이
성립한 것은 4개뿐이었다. 새 `confusion_pair` 는 **기록된 짝만** 묶고, 기록이 없으면 짝을 짓지
않는다(지어내면 유형이 거짓이 된다).

지금 이 유형은 여전히 `data_gate` 이고 **0건을 낸다 — 그게 정답이다**. 과거 오답에는 `chosen`
이 없고, 기록은 오늘부터 쌓인다. 달라진 것은 "영원히 활성화되지 않는 상태" 에서 "플레이하면
활성화되는 상태" 로 바뀐 것이다. 두 경로 모두 회귀로 고정했다 —
[confusion-capture.test.ts](../apps/web/src/lib/srs/__tests__/confusion-capture.test.ts) 4건(쓰기 계약) +
[confusion-log.integration.test.ts](../apps/web/src/lib/vcb/compose/__tests__/confusion-log.integration.test.ts) 3건(기록을 심고 짝 키가 양쪽에 같게 붙는지).

**게이트 예외를 넓히지 않는 장치** — Round 25 의 위험은 예외 자체가 아니라 **예외가 유형을 안 가리고
번지는 것**이다. 그러면 낱말 단어장에 `(as) sick as a parrot` 이 섞여도 게이트가 조용해진다.
실데이터로는 증명이 안 된다(발행 세트 중 `phrase_unit` 을 가진 건 구동사 세트 하나뿐이라 대조군이
없다). 그래서 **같은 단어를 유형만 바꿔 두 세트에 넣는** 회귀 2건을 두었다 — 구 유형이면 PASS,
빈도 유형이면 FAIL.

### 발행 카탈로그 (2026-08-15 실측)

컴포저가 발행한 세트 **30개 · 15,788단어 · 유형 27종**. 전부 `curation_query` 에 레시피·채점표·
시중 대비 매트릭스를 함께 싣는다 — 나중에 "이 세트가 왜 이렇게 뽑혔나" 를 세트만 보고 답할 수 있다.

| 계열 | 세트 |
|---|---|
| 목록 기반 7 | 수능 필수 2,000(1,828) · 빈출 2,000(1,753) · 교육과정 중등(1,182) · 학술 NAWL(628) · 레벨 V4-V7(800) · 의학 MOEL(457) · 수능 빈칸추론(430) |
| 구조 기반 11 | 어원 1,500 · 파생어 300 · 동사 300 · 여행 주제 500 · 유의어 400 · 반대말 300 · 헷갈리는 짝 300 · 연어 400 · 다의어 300 · 라임 300 · 구동사와 관용어 90 |
| 원서 기반 2 | Pride and Prejudice 500 · 같은 책 1~3장 60 |
| 전달 기반 3 | 30일 완성 600 · 연상 500 · **듣는 단어장 300(신규)** |
| 플랫폼 고유 7 | Fables 해금 300 · Pride 해금 200 · Pinocchio 재등장 80 · Pride 재등장 80 · 여섯 면 500 · 여섯 면 300 · 미수록 600 |

평균 총점 0.94 · 최저 0.888(동사 300) · 최고 1.000(미수록 600).

**자산 수집 과제 (설계 밖 — 하나 남았다)**

| 과제 | 막고 있는 유형 | 현재 자산 |
|---|---|---|
| 단어 이미지 | D25 그림 단어장 | `image_url` 0 / 45,688 — 대체 재생 경로가 없어 설계로 못 메운다 |

단어 발음 녹음은 **과제에서 내렸다** — 브라우저 TTS 가 유일한 재생 경로로 확정됐다(Round 28).
대체 경로는 만들지 않는다: 컴포저에서 `audio_url` 을 요구·가산·선호·비교 문구에서 전부 제거해
파일 기반 경로가 다시 자라날 자리를 없앴다.
