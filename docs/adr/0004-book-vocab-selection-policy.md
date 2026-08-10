# ADR 0004 — 도서 어휘 선정 정책 v2 (레벨 상대 밴드 + 게이트 분리)

- **Status**: **Accepted (2026-08-10)** — D1·D2·D3·D6 적용 완료(마이그레이션 `20260810113051`, `20260810113116`, `20260810115121`, `20260810115154`). D4·D5 미적용(아래 §5)
- **Scope**: `select_book_chapter_vocab` 레벨 게이트 · `_extract_composite_score` 랭킹 · `noise_blacklist` 의 역할 · 책 고유 어휘 트랙
- **Relates to**: [ADR 0001](./0001-dictionary-derivational-enrichment.md) · [ADR 0002](./0002-rescue-first-noise-policy.md)(같은 결함을 진단했으나 승인 대기 상태로 미적용) · [ADR 0003](./0003-classic-retelling-work-edition.md)
- **정합**: 학습 과학 원칙 ①Active Recall ③Desirable Difficulty ⑤Context-Dependent ⑥Cognitive Load · i+1(Krashen)

---

## 1. Context — 측정된 결함 3개

### C1. 레벨 게이트가 책 레벨과 무관한 절대값이다

`select_book_chapter_vocab` 의 유일한 레벨 조건:

```sql
WHERE COALESCE(cs.sense_v, sd.v_level) >= 6   -- 하드코딩 V6 바닥, 상한 없음
```

`book_v_level` 은 게이트에 **전혀 쓰이지 않는다**. `_extract_composite_score` 의 `p_unit_v_level` 인자로만 들어가는데, 거기서도 `skill_level=4 AND unit_v_level<6 → -0.10` 이라는 사실상 비활성 항 하나뿐이다. 밴드 보너스도 `V6~9 = 1.0` 절대 고정이다.

카탈로그는 V2~V11 에 걸쳐 있다 (2026-08-10 실측 40권):

| book_v_level | 권수 |
|---|--:|
| 2 | 10 |
| 3 | 9 |
| 4 | 2 |
| 6 | 5 |
| 7 | 4 |
| 8 | 7 |
| 9 | 1 |
| 11 | 1 |

**19권(48%)이 V2~4 인데 바닥이 V6** 이다. 결과:

| 도서 | bvl | 현행 후보 | 실제 선정된 단어의 V 분포 |
|---|--:|--:|---|
| Bed-Time Stories | 2 | **0** | 세트 생성 자체가 불가 |
| The Race | 2 | 1 | V7 1개 |
| The Mango Tree | 2 | 1 | **V10** 1개 |
| How Many? | 3 | 2 | V9, V10 |
| Ammachi's Amazing Machines | 2 | 5 | V6·V7·**V11** 포함 |

V2 학습자용 그림책이 V10~11 단어를 준다 = **i+8**. 반대편에서는 Gibbon(V11)에 V6~7 단어 2,179개가 들어간다 = 독자 수준보다 한참 아래.

커버리지가 이를 확증한다 (`lexical_coverage`, 토큰 가중):

| Ammachi (bvl 2) | V1 | V2 | V3 | V4 | V5 | V6 |
|---|--:|--:|--:|--:|--:|--:|
| 누적 커버리지 % | 51.9 | 63.0 | 64.8 | 81.5 | 88.9 | 94.4 |

이 책을 읽게 만드는 단어 = 63% → 94% 를 메우는 **V3~V6** 이다. 현행 게이트는 그 전부를 버리고 V6 이상만 남긴다.

### C2. `shared_dictionary` 등재 여부가 단일 게이트다 — 그리고 그 게이트가 오염돼 있다

`select_book_chapter_vocab` 은 `shared_dictionary` 를 조인한다. 등재 안 되면 학습 세트에 못 들어간다. 그런데 등재 경로(`stage_book_dict_candidates`)가 `noise_blacklist` 를 배제 조건으로 쓴다:

```sql
AND NOT EXISTS (SELECT 1 FROM noise_blacklist nb WHERE nb.form = ac.word)
```

`noise_blacklist` 실측 (24,327행):

| source / category | 총 | `lexicon_clean(lang='en')` 실재 = **실제 영단어** |
|---|--:|--:|
| `final-sweep` / foreign_word | 4,672 | **3,883 (83%)** |
| `auto-tail` / foreign_word | 11,002 | 3,019 (27%) |
| `auto-latin-broad` / foreign_word | 4,563 | 340 (7%) |

Treasure Island 표본: 미결합 80건 중 63건이 블랙리스트, 그 중 **39건이 실제 영단어**. `mutineer`(22회 — 이 책의 주제어) · `insubordinate` · `nimbleness` · `slyness` · `raggedness` · `unaccounted` · `repaint` 이 `category='foreign_word'` 로 등록돼 **영구히** 사전 등재 큐에 오르지 못한다.

`archaic_candidates.classification='person_noise'` 도 777건 중 **373건(48%)** 이 실제 영단어다. Treasure Island 의 `hisself`·`mought`·`sperrits`·`dooties`·`jine`·`thanky`·`wot` — 인명이 아니라 Long John Silver 의 eye-dialect 다.

이는 [ADR 0002](./0002-rescue-first-noise-policy.md) 가 이미 진단한 "구제 못한 것은 폐기" 구조의 결과다. 그 ADR 은 승인 대기 상태로 미적용이고, 이후 `final-sweep`/`auto-tail` 일괄 sweep 이 오히려 반대 방향으로 갔다.

### C3. 책을 특징짓는 어휘가 통째로 빠진다

Treasure Island 의 `crosstrees`·`keelhaul`·`dogwatch`·`afterdeck`·`grogshop`·`keelson` — 항해 어휘 18건은 `lexicon_clean` 으로 **뜻이 해석되고 읽기 중 탭하면 정상 표시**되지만, `shared_dictionary` 미등재라 학습 세트·플래시카드·ScriptQuiz 대상에서 전부 빠진다.

원칙 ⑤ Context-Dependent(학습한 맥락에서 인출) 관점에서 이 어휘야말로 이 책의 학습 자산이다. 동시에 "항해 전문어를 한국 고등학생 어휘 목표에 넣는다"는 것도 틀렸다. → **목표 어휘와 읽기 지원 어휘를 분리하지 않은 것**이 결함이다.

---

## 2. Decisions

### D1 — 레벨 게이트를 `book_v_level` 상대 밴드로

```sql
-- 변경 전
WHERE v_level >= 6

-- 변경 후
WHERE v_level BETWEEN greatest(book_v_level - 1, 1)
                  AND least(book_v_level + 3, 11)
```

근거:
- **하한 `-1`**: `book_v_level` 은 어휘 타입의 p75 라 학습자 기준선보다 높다. 바로 아래 한 칸은 아직 불안정한 회상 대상이라 포함한다(원칙 ①·③).
- **상한 `+3`**: i+4 이상은 맥락 추론이 불가능해 작업기억을 초과한다(원칙 ⑥). 현행은 상한이 아예 없다.

측정된 효과 (챕터당 후보 평균 / 빈 챕터 수):

| 도서 | bvl | 현행 | 제안 |
|---|--:|--:|--:|
| Bed-Time Stories | 2 | **0.0 / 1빈** | 20.0 / 0빈 |
| The Race | 2 | 1.0 | 16.0 |
| Ammachi's | 2 | 5.0 | 42.0 |
| When Will Amma Be Back? | 2 | 4.0 | 58.0 |
| Winnie-the-Pooh | 4 | 22.8 | 38.5 |
| Treasure Island | 7 | 60.4 | 56.6 |
| Pride and Prejudice | 8 | 36.4 | 28.3 |
| Dialogues | 9 | 293.2 | 184.0 |
| **Gibbon** | 11 | 94.2 | **22.5** |

저레벨 책은 세트가 살아나고, 고레벨 책은 수준 미달 단어가 걷힌다. 챕터 cap 40 을 채우지 못하는 책이 늘지만 그건 정상이다 — 그림책 한 권에 40 단어를 짜내는 것이 원래 잘못이었다.

**폴백**: 밴드 후보가 챕터당 5개 미만이면 상한을 `+4` 까지 1회 확장한다 (Les Misérables 364장 중 4장이 해당).

### D2 — 밴드 보너스를 절대값에서 i+1 거리로 교체

```sql
-- 변경 전 (0.15 가중)
CASE WHEN v_level BETWEEN 6 AND 9 THEN 1.0
     WHEN v_level = 10 THEN 0.6
     WHEN v_level = 11 THEN 0.4 ELSE 0 END

-- 변경 후 (0.15 가중) — 목표는 book_v_level + 1
GREATEST(0, 1.0 - ABS(v_level - (book_v_level + 1))::numeric / 4)
```

정확히 i+1 인 단어가 1.0, 4칸 이상 벌어지면 0. 나머지 3축(전역빈도 0.40 · 챕터내빈도 0.35 · 검증 0.10)은 그대로 둔다 — 이들은 레벨과 독립이고 현재 잘 작동한다.

### D3 — `noise_blacklist` 를 선정 게이트에서 제거, 진단 라벨로 강등

`stage_book_dict_candidates` 의 `NOT EXISTS (noise_blacklist)` 조건을 삭제한다. 노이즈 판정의 SSoT 는 이미 있는 `shared_dictionary.word_register`(`proper_noun`·`abbreviation`·`brand`·`phrase_unit`·`archaic_literary`·`period_cultural`) + `archaic_candidates.classification` 이다. 등재 시점에 register 를 붙이면 `select_book_chapter_vocab` 의 기존 register 배제가 그대로 걸러낸다.

즉 **배제는 "등재 전 차단"이 아니라 "등재 후 register 로 분류"** 로 옮긴다. ADR 0002 D1(적극 매칭된 것만 noise)과 같은 방향이다.

동시에 오분류를 회수한다:
- `noise_blacklist` 에서 `source IN ('final-sweep','auto-tail')` + `category='foreign_word'` + `lexicon_clean(lang='en')` 실재 → 해제 (약 6,900건)
- `archaic_candidates.classification='person_noise'` 중 `lexicon_clean(lang='en')` 실재 373건 → `pending` 으로 되돌려 재분류

**샘플 100건 수동 검수 후 일괄 적용** — 규모가 커서 무검증 적용은 반대 방향 오류를 만든다.

### D4 — eye-dialect 를 `dialect_map` 으로 이관

`person_noise` 오분류 중 방언 표기(`hisself`→`himself` · `mought`→`might` · `sperrits`→`spirits` · `em`→`them`)를 `dialect_map(variant, standard)` 에 넣는다.

현재 이들은 `coverage-clean` 티어에서 **틀린 뜻**을 준다:

| 단어 | 맥락상 의미 | 현재 학습자가 보는 뜻 |
|---|---|---|
| `em` | 'em = them | 인쇄에 사용되는 선형 단위(1/6인치) |
| `mought` | might | 5월의. |
| `sperrits` | spirits | 정념 (프랑스어 `sperrit` 로 오해석) |
| `wot` | what | 1차 및 3차 인원. 노래하다. 대가… |

`dialect_map` 은 `lookup_word_meaning` 에서 `coverage-clean` 보다 **앞 티어**라 이관만으로 교정된다. `jine`→`join`, `thanky`→`thank` 는 이미 `spelling` 티어가 맞게 처리하고 있다 — 같은 방식이다.

### D5 — 책 고유 어휘를 "읽기 지원" 2차 세트로 분리

`shared_dictionary` 미등재이나 `lookup_word_meaning` 이 해석하는 책 특징어(Treasure Island 항해어 18건 등)를 별도 카테고리 `library_book_support` 로 발행한다.

- **학습 목표 아님** — FSRS 스케줄·ScriptQuiz·Dictation 대상에서 제외. 회상 훈련을 하지 않는다.
- **읽기 전 훑어보기 + 읽는 중 참조** 용도. Progressive Disclosure(철학 ②)에 따라 기본 접힘.
- 이렇게 하면 "이 책을 읽는 데 필요한 말"과 "외워야 할 말"이 분리되어, 둘 다 정직해진다.

### D6 — `shared_words` 에 `v_level` 컬럼 추가

현재 발행된 세트는 `cefr_level` 만 갖고 `v_level` 이 없다. 학습자 개인 레벨에 따른 하위 필터링(같은 세트를 V6 학습자와 V9 학습자가 다르게 소비)이 불가능하다. 선정 시점의 `v_level` 을 그대로 적재한다.

---

## 3. 적용 범위와 재발행

D1·D2 는 `select_book_chapter_vocab` / `_extract_composite_score` 변경이므로 **이미 발행된 세트에는 소급되지 않는다**(`publish_book_word_sets` 은 세트가 있으면 `CONTINUE`). 전체 도서 적용에는 재발행이 필요하다.

재발행은 학습자 진도에 영향을 주므로 **미발행(ready) 도서 → 발행 도서 순**으로 단계 적용한다:

1. `ready` 21권 — 신규 발행이라 소급 영향 0. D1 효과를 여기서 먼저 검증.
2. `published` 13권 — 기존 세트 보존 + 신규 밴드 세트를 `version=3` 으로 추가 발행 후 전환. 사용자 진도(`user_word_progress`)가 걸린 세트는 삭제하지 않는다.

---

## 4. 적용 결과 (2026-08-10, `select_book_chapter_vocab` 실측)

| 도서 | bvl | 이전 후보 (V 범위) | 이후 후보 (V 범위) |
|---|--:|---|---|
| Bed-Time Stories | 2 | **0** | **20** (V1~V5) |
| The Mango Tree | 2 | 1 (**V10**) | **18** (V1~V4) |
| Ammachi's Amazing Machines | 2 | 5 (V6·V7·**V11**) | **43** (V1~V5) |
| Winnie-the-Pooh | 4 | 228 (V6~V11) | 406 (V3~V7) |
| Treasure Island | 7 | 2,053 (V6~V11) | 1,719 (V6~V10) |
| Gibbon | 11 | 6,687 (V6~V11) | 1,552 (**V10~V11**) |

`shared_words.v_level` 백필 32,966행 100% 완료. 재발행 1단계(`ready` 25권) — 509세트 / 10,676단어, 밴드 이탈 0건.

### D3 적용 (마이그레이션 `20260810115121`·`20260810115154`)

`noise_blacklist` 에 `is_blocking boolean` + `released_reason` 추가. **DELETE 가 아니라 플래그** — 판정 근거를 지우면 되돌릴 수도 감사할 수도 없다.

대상은 신뢰도 낮은 두 sweep(`final-sweep` 83% 오탐 · `auto-tail` 27%)에서 `lexicon_clean(lang='en')` 에 뜻이 있는 6,902건. 그 중 고어 표지 81 · 방언 표지 18 · 코퍼스 대문자전용(고유명사) 20 을 제외한 **6,783건 해제** (잔여 차단 17,544). `auto-latin` 계열(오탐 2.8~7.5%)은 손대지 않았다.

게이트 2곳이 `is_blocking` 을 존중하도록 변경 — `stage_book_dict_candidates`(등재 큐), `find_unbound_book_lemmas`(진단 라벨).

Treasure Island 재분류:

| | 이전 | 이후 |
|---|---|---|
| `mutineer`(22회) · `repaint` · `pickax` | 노이즈 | **보조사전 해석** (등재 큐 진입 가능) |
| `nimbleness` · `slyness` · `foolhardiness` · `circumspectly` | 노이즈 | **형태 회수** |
| `em` · `hisself` · `sperrits` · `jine` | 노이즈 | 노이즈 (D4 `dialect_map` 이관 대상) |

---

## 5. 미해결 / 검증 필요

- `book_v_level`(타입 p75)과 `lexical_coverage`(토큰 가중)가 저레벨 책에서 불일치한다 (Ammachi: bvl 2, V6 커버리지 94.4%). 밴드 앵커를 `book_v_level` 로 할지 "커버리지 95% 달성 레벨"로 할지는 D1 적용 후 A/B 로 판정한다. 본 ADR 은 기존 필드를 쓰는 `book_v_level` 앵커로 시작한다.
- D3 회수 6,900건의 오분류율 — 샘플 100건 검수 결과가 전제.
- Adventures of Huckleberry Finn 은 `book_v_level` 이 NULL 이라 밴드 계산 불가 → `compute_book_vrl` 선행 필요.
