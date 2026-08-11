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

`archaic_candidates.classification='person_noise'` 에도 Treasure Island 의 `hisself`·`mought`·`sperrits`·`dooties`·`jine`·`thanky`·`wot` 처럼 인명이 아니라 Long John Silver 의 eye-dialect 인 것이 섞여 있다.

> **정정 (2026-08-10)**: 초안은 "`person_noise` 777건 중 373건(48%)이 실제 영단어"라고 적었다. `lexicon_clean(lang='en')` 실재를 근거로 삼았는데, **Wiktionary 는 인명·지명 항목을 포함**하므로 그 근거가 성립하지 않는다. 373건의 실제 내용은 `abraham`·`achilles`·`aesop`·`parker`·`potter` 등 **대부분 진짜 고유명사**였고 `person_noise` 분류가 맞았다. 코퍼스 대문자 검증으로 다시 재면 `noise_kind='person_noise'` 159단어 중 대문자전용(고유명사) 74 · 소문자전용(방언 후보) 46 · 혼재 2 이고, 그 46건도 소유격 9건은 `normalized` 티어가, `jine`·`thanky`·`chapling`·`a-going` 은 `spelling` 티어가 이미 맞게 처리한다. **실제 오역은 십수 건 규모**다. → D4 를 아래 §5 처럼 재정의한다.

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

### D4 (재정의, 2026-08-10) — 읽기 중 오역 제거

초안 D4("`person_noise` 373건 일괄 `dialect_map` 이관")는 위 정정대로 **실행하면 고유명사를 방언으로 등록**하게 되어 폐기한다. 조사 과정에서 더 큰 문제가 나왔다 — `coverage-clean` 티어가 **문맥과 무관한 동음이의어**를 준다.

`coverage-clean` 으로 해석되는 3,520단어(15,190 출현) 중 **91단어 / 3,582 출현(23.6%)** 이 코퍼스에서 대문자로만 등장하는 고유명사인데 동음 일반명사 뜻을 받는다:

| 학습자가 탭한 단어 | 책 맥락 | 보이는 뜻 |
|---|---|---|
| `Louis` (Les Misérables 56회) | 프랑스 금화 / 인명 | "12년간 세계 헤비급 챔피언이었던 미국…" (권투선수 Joe Louis) |
| `Davy` (Treasure Island) | Davy Jones | "전기화학의 선구자이자 나트륨·칼륨을 발견한…" (화학자 Humphry Davy) |
| `Pierre` | 인명 | "사우스다코타 주의 주도" |
| `des` (Les Misérables 184회) | 프랑스어 관사 | "에스트로겐 특성을 지닌 합성 비스테로이드" (DES 약물) |

읽기 중 단어 탭은 학습자가 직접 보는 기능이라 **뜻이 없는 것보다 나쁘다**.

**적용 (마이그레이션 `20260810135205`)** — `proper_noun_forms` 154행 등재, 가드 91단어 발동.

| 단어 | 이전 | 이후 |
|---|---|---|
| `thee` | "번창하기 위해; 번영하기 위해" | **너, 당신** (dialect) |
| `hast` | ", 2d 당. 노래하다. 대가. 의." | **가지다, 소유하다** (dialect) |
| `didst` | ", 2D 사람. 노래하다. 꼬마 도깨비." | **하다** (dialect) |
| `spake` | "꼬마 도깨비. ~의" | **말하다, 이야기하다** (dialect) |
| `elizabeth` · `mary` · `gardiner` | 동음 일반명사 뜻 | **이름이에요 (인명·지명)** |
| `crosstrees` · `mutineer` | 정상 | 정상 (오탐 없음) |

**미해결**: `louis` · `davy` · `pierre` 는 코퍼스에서 소문자로도 등장해(`twenty louis` 금화 등) 보수적 판정 규칙에 안 걸린다. 규칙을 "대문자 비율 우세"로 완화하면 잡히지만 실단어 오탐이 늘어 보류. `thy` · `hisself` 는 `dialect_map` 의 standard(`your` · `himself`)가 `shared_dictionary` 정식 표제어가 아니라 dialect 티어를 못 타고 `normalized-coverage` 로 빠진다 — 뜻 자체는 방향이 맞아 급하지 않다.

- **D4a** — `lookup_word_meaning` 에 고유명사 가드. 근거를 추측이 아니라 **코퍼스 대문자 증거로 물질화**(`proper_noun_forms` 테이블)해 `coverage-clean` 티어 앞에서 차단하고 `match_via='proper_noun'` 로 응답한다. 문장 첫머리 대문자 오탐을 피하려 표면형 대문자 여부가 아니라 "코퍼스 전체에서 소문자로 한 번도 안 나온 형태"만 등록한다.
- **D4b** — `coverage-clean` 의 언어 오배정. fr 422 · la 132 · it 44 · de 15 · es 13 · nl 8 단어가 `lang='en'` 항목으로 해석된다.
- **D4c** — 검증된 eye-dialect 만 `dialect_map` 수기 등록.

**D4c 적용 (마이그레이션 `20260810232100`)** — 후보 251건(coverage-clean 해석 중 + `spelling_norm` 표준형 존재 + 표준형이 사전 정식 표제어 + 고유명사 아님)을 현재 뜻 vs 표준어 뜻으로 나란히 놓고 **14건만** 선별 등록.

| variant → standard | 이전 (틀린) 뜻 |
|---|---|
| `whilst` → while (263회) | "황제가 안디옥에 누워 있는 동안" |
| `em` → they (90회) | "인쇄에 사용되는 선형 단위(1/6인치)" |
| `dat` → that | "소리를 녹음한 디지털 테이프(DAT)" |
| `dern` → darn | "문기둥 또는 문설주" |
| `lak` → like | "라크족 (다게스탄 남부 민족)" |
| `hookey` → hooky | "고리 던지기 게임" |
| `sperrit` → spirit | 프랑스어 `sperrit` 로 오해석 "정념" |
| `mought` → might | "5월의" |
| `wot` → what | "1차 및 3차 인원. 노래하다…" |
| `sich`→such · `der`→there · `ter`→to · `yo`→you · `inclosure`→enclosure | — |

제외: `de`→the(프랑스어 관사)·`al`→all·`les`→less·`ha`→would·`ing`→king 등 짧은 파편·외국어(근거 없음) / `slue`·`greave`·`banquette`(현재 뜻이 실제로 맞음) / `hee`→he(웃음소리 가능) / `es`→is(독·스페인어 혼동).

재계산 후 `dialect` 티어 6단어 93출현 → **43단어 935출현**, `proper_noun` 가드 130단어 3,930출현, 전체 해석률 99.62%.

**별건 결함**: `shared_dictionary` 에 주격 대명사(`i`·`you`·`he`·`she`·`it`·`we`·`they`·`myself`·`itself`)는 있는데 목적격·소유격·재귀형(`him`·`her`·`his`·`their`·`them`·`your`·`himself`·`herself`)이 **없다**. `thy`→`your`, `hisself`→`himself` 가 dialect 티어를 못 타는 이유이고, `em` 은 `them` 대신 주격 `they` 로 우회했다. 대명사 굴절 계열 등재는 VCB 소관.

### D4 (초안, 폐기) — eye-dialect 를 `dialect_map` 으로 이관

`person_noise` 오분류 중 방언 표기(`hisself`→`himself` · `mought`→`might` · `sperrits`→`spirits` · `em`→`them`)를 `dialect_map(variant, standard)` 에 넣는다.

현재 이들은 `coverage-clean` 티어에서 **틀린 뜻**을 준다:

| 단어 | 맥락상 의미 | 현재 학습자가 보는 뜻 |
|---|---|---|
| `em` | 'em = them | 인쇄에 사용되는 선형 단위(1/6인치) |
| `mought` | might | 5월의. |
| `sperrits` | spirits | 정념 (프랑스어 `sperrit` 로 오해석) |
| `wot` | what | 1차 및 3차 인원. 노래하다. 대가… |

`dialect_map` 은 `lookup_word_meaning` 에서 `coverage-clean` 보다 **앞 티어**라 이관만으로 교정된다. `jine`→`join`, `thanky`→`thank` 는 이미 `spelling` 티어가 맞게 처리하고 있다 — 같은 방식이다.

### D5 — 책 고유 어휘를 "읽기 지원" 으로 분리

**적용 (마이그레이션 `20260810234335`) — 초안의 word set 방식은 폐기.**

초안은 `library_book_support` 카테고리의 word set 발행이었다. 그런데 `shared_word_sets` 의 의미론 자체가 "구독 가능한 학습 목록"이다 — `user_word_set_subscriptions` 로 구독되고, 구독하면 `vocabularies` 로 들어가 FSRS 를 탄다. D5 의 요구는 정확히 그 반대(외울 대상 아님)라, set 으로 만들면 `/library/vocab` 목록·추천 RPC·구독 액션 **세 곳에 "set 이지만 set 처럼 굴면 안 됨" 예외**를 달아야 한다. 모델과 싸우는 구조다.

→ **읽기 전용 RPC `list_book_support_vocab(uuid,int)` + 책 상세의 접힌 패널**(`BookSupportVocabPanel`). 새 테이블·세트 행·예외 가드 0.

뜻이 `lexicon_clean` 자동 번역이라 그대로 노출할 수 없어 품질 게이트를 뒀다 — 길이 4자 이상(2자 토큰 `ho`→"홀뮴", `un`→"국제연합" 오역 제거) · 책 내 2회 이상 · `resolved_via='coverage-clean'` + `lang='en'` · `noise_kind` 없음 · 뜻 4~90자 + 한글 포함 + 구두점 시작 아님 + 다의어 나열 아님.

결과: Sociology 277 · Dialogues 148 · Les Misérables 133 · Gibbon 103 · Twenty years after 29 · Tom Sawyer 28 · **Treasure Island 27**(`mutineer` 22회 · `cutlas` 15 · `deadlight` · `crosstrees` · `handspike` · `keelhauling` · `oilskin` · `pannikin` · `afterdeck`). 패널 표시 상한 60.

**한계**: 게이트 후에도 거친 번역이 ~18% 남는다 (`seafaring`→"물로 여행하다" · `superintend`→"보고 직접" · `downhill`→"트레일을 따라 내려가는 스키 경주"). 암기 대상이면 반려할 수준이지만 참고 목록으로는 쓸 만하다 — UI 문구를 "외울 단어가 아니라 읽을 때 참고하세요" 로 명시하고 기본 접힘으로 뒀다.

### D5 (초안, 폐기) — 책 고유 어휘를 "읽기 지원" 2차 세트로 분리

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

1. **`ready` 25권 — 완료.** 신규 발행이라 소급 영향 0. 509세트 / 10,676단어, 밴드 이탈 0.
2. **`published` 13권 — 완료 (마이그레이션 `20260810233306`).** 기존 `republish_book_word_sets(uuid,int)`(`20260718100070`)를 확장해 in-place 갱신했다. 새 함수를 만들지 않은 이유는 거의 같은 함수가 둘이면 정본이 흐려지기 때문.

**세트 행을 유지하고 `shared_words` 만 교체**한 근거:
- `user_word_set_subscriptions.set_id` 가 **ON DELETE CASCADE** — 세트를 지우면 구독이 사라진다.
- `vocabularies.shared_set_id` 는 SET NULL — 지우면 출처 링크 269행이 끊긴다.
- FSRS 진도는 안전. `difficulty`/`stability`/`next_review_at` 은 학습자 자신의 `vocabularies` 행에 있고 **`shared_words` 를 가리키는 FK 는 존재하지 않는다**(실측). 세트는 카탈로그이지 진도가 아니다.

확장 3가지: ① `v_level` 적재(D6) ② 설명·`curation_query` 에 밴드 기록 + `version=3` ③ **신규 선정 0 챕터는 건드리지 않음** — 기존 구현은 책 전체 `shared_words` 를 먼저 DELETE 한 뒤 새 선정만 INSERT 해서 선정 0 챕터가 빈 세트로 남았다(현 13권엔 해당 없으나 밴드가 좁아지는 고레벨 책에서 언제든 발생).

| 도서 | bvl | 이전 | 이후 | 밴드 |
|---|--:|--:|--:|---|
| Ammachi's Amazing Machines | 2 | **4** | **40** | V1~V5 |
| Tell Me, What is a Drone? | 2 | **5** | **40** | V1~V5 |
| Winnie-the-Pooh | 4 | 174 | **366** | V3~V7 |
| Fables | 6 | 1,029 | 1,309 | V5~V9 |
| The Adventures of Pinocchio | 6 | 1,005 | 1,120 | V5~V9 |
| Peter and Wendy | 6 | 670 | 678 | V5~V9 |
| The Mysterious Affair at Styles | 6 | 520 | 520 | V5~V9 |
| Children's Stories | 7 | 342 | 342 | V6~V10 |
| A Christmas Carol | 8 | 194 | 182 | V7~V11 |
| Introduction to Sociology | 8 | 895 | 882 | V7~V11 |
| Pride and Prejudice | 8 | 1,786 | 1,550 | V7~V11 |
| Twenty years after | 8 | 2,703 | 2,387 | V7~V11 |
| **Gibbon** | 11 | 2,450 | **1,355** | **V10~V11** |

검증: 구독 274건 보존 · `vocabularies.shared_set_id` 1,541행 보존 · `shared_words.v_level` NULL 0건 · 전 세트 `version=3`.

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

---

## 6. D7 — L1/L2 계층 분리 (2026-08-11 추가, 79권 실측 근거)

### 문제: cap 40 이 두 역할을 겸하고 있었다

D1~D6 은 "어떤 단어를 뽑을 것인가"(콘텐츠 품질)를 다뤘다. 79권(2,496챕터·878만 단어)까지
규모를 키우고 **전달 경로**를 추적하니, 같은 챕터 세트가 경로마다 다른 정책으로
학습자에게 도달하고 있었다.

| 경로 | 분량 | 레벨 밴드 | 기보유 제외 | 챕터 연동 | 근거문장 |
|---|---|---|---|---|---|
| enroll (`_enroll_book_subscribe_word_sets`) | 책 전체 **50개** | v±1 | ✔ | ✘ | ✔ |
| 세트 구독 버튼 (`library/vocab/actions.ts`) | 세트 **전량** | ✘ | ✘ | 챕터별 | ✔ |
| 리더 i+1 패널 (`extract_vocabulary_for_user`) | auto_n 5~30 | 가우시안 i+1 | ✔ | ✔ | ✘ |

- enroll 50 은 챕터 진행을 못 따라간다 — Les Misérables 364챕터를 등록해도 평생 50단어.
- 구독 버튼은 개인화가 없다 — V6 학습자가 V8 도서 세트를 구독하면 V11 단어까지 받는다.
- **가장 좋은 로직(가우시안 i+1)이 표시 전용**이라 FSRS 경로와 끊겨 있다.

그리고 `publish_book_word_sets(p_cap=40)` 은 챕터 길이를 무시한다. 993챕터 실측:

```
밀도 2% 초과(과부하)  241 (24%)   ← Nation 98% coverage 위반
밀도 0.3% 미만(희박)  130 (13%)   ← 학습 자극 없음
cap 40 에 걸림        252 (25%)
중앙 1.14%  ·  p95 4.66%
1,000단어 챕터 22.6개/1000  vs  12,000단어 챕터 1.4개/1000  = 16배 격차
```

인지부하(Sweller)와 이해 커버리지(Nation)는 **개수가 아니라 밀도**로 결정되는데,
정책은 개수만 보고 있었다.

### 결정: 콘텐츠 계층과 전달 계층을 나눈다

| 계층 | 무엇 | 사용자 의존 | 캐시 |
|---|---|---|---|
| **L1 콘텐츠** | `shared_words` = 챕터 정제 **후보 풀** (D1~D6 그대로) | ✘ | ✔ |
| **L2 전달** | `deliver_chapter_vocab(book, chapter, commit)` — 학습자별 분량·선별 | ✔ | ✘ (매 호출 재계산) |

L2 는 두 엔진의 **합성**이다 — `select_book_chapter_vocab` 의 정제·근거문장·context_pos sense 와
`extract_vocabulary_for_user` 의 i+1 가우시안·트랙 부스트·고어 페널티를 함께 쓴다.
점수 공식은 후자와 **동일하게** 유지한다 (두 화면이 다른 순서를 보이면 안 된다).

**분량 공식** `target = clamp(round(chapter_word_count / 1000 × 8), 8, 30)`

- 0.8%/1000단어 — 실측 중앙 밀도 1.14%보다 낮게 잡아 과부하 241챕터를 걷어낸다.
- 하한 8 — p10(477단어) 챕터도 학습 가치를 남긴다.
- 상한 30 — `extract_vocabulary_for_user` 의 `auto_n` 상한과 같은 값. UI 의 `DAILY_NEW=22` 안내와도 어긋나지 않는다.

검산 (실측 챕터 분포):

| 챕터 길이 | 현행 | 신규 | 신규 밀도 |
|---|--:|--:|--:|
| p10 477단어 | 15.3 | 8 | 1.68% |
| p50 1,706 | 31 | 14 | 0.82% |
| p75 3,264 | 34 | 26 | 0.80% |
| p90 6,110 | 34 | 30 | 0.49% |
| p99 28,983 | 25 | 30 | 0.10% |

실측 (Les Misérables): ch1 1,067단어→9 · ch20 2,141→17 · ch100 6,425→30 · ch50 316→8(하한).

**개인화 확인** — Treasure Island(bvl 7) 챕터1, 같은 40단어 풀에서:

| 학습자 | 1위 | 판정 | 전달량 |
|---|---|---|--:|
| 미진단 (도서 폴백 V7) | `grumbling` (V8) | i+1 — 지금 딱 한 걸음 | 18 (풀 27) |
| V11 | `magistrate` (V9) | 쉬운 편 — 빈틈 메우기 | 18 (풀 38) |

풀 차이(27 vs 38)는 기보유 제외가 작동한 결과다.

### 적용 범위 (마이그레이션 `20260811132640`)

함수만 추가하고 **기존 세 경로는 건드리지 않았다**. `p_commit=false`(기본)는 읽기 전용,
`true` 는 `ON CONFLICT DO NOTHING` 이라 재실행 안전. 되돌리기는 `DROP FUNCTION` 한 줄.

### 남은 일

- UI 배선 — `VocabSetPreviewModal` 이 세트 40개를 flat 하게 보여주는 대신 L2 결과를 우선 노출하고,
  전체 풀은 "이 챕터 어휘 전체" 로 접어 둔다 (Progressive Disclosure).
- 배선 후 기존 세 경로를 L2 로 수렴 — enroll 은 첫 챕터만, 구독 버튼은 L2 경유.
- L1 cap 확대 검토 — 전달량이 L2 에서 결정되므로 풀은 넓을수록 개인화 여지가 커진다.
  다만 UI 배선 이후에 해야 압도적으로 보이지 않는다.

### D7 후속 — 배선하며 드러난 것 (2026-08-11)

**① 개인화 패널이 읽는 자리에 없었다.** `ChapterLevelWords` 는 `BookContentReader` 안에만
있었고, 그 리더는 `/library/books/[bookId]`(enroll **전** 미리보기)와 admin 검수 전용이다.
enroll 하면 `/text/[id]` 로 리다이렉트되므로 **읽기 시작하는 순간 패널이 사라졌다.**
학습 인사이트 패널(`InsightPanel`)로 옮겼다 — 그 패널을 여는 버튼은 라벨이 이미
"챕터 단어장 N/M" 이었는데 정작 안에 단어가 없었으니, 라벨이 약속하던 자리를 채운 셈이다.

**② 쓰기 경로가 조용히 실패했다.** `deliver_chapter_vocab(p_commit=true)` 는 런타임에
`42702 column reference "word" is ambiguous` 로 터졌다 — `RETURNS TABLE(word …)` 의 출력
파라미터가 `INSERT … ON CONFLICT (user_id, word)` 의 컬럼과 구별되지 않는다. 그런데 UI 가
예외를 삼키고 "담았어요" 를 표시했다. **이 기능이 없애려던 "표시 전용" 결함을 스스로
재현한 것이다.**

교훈이 두 가지다:
- 쓰기는 출력 파라미터가 없는 별도 함수로 (`commit_chapter_vocab`, 마이그레이션 `20260811135625`).
  `#variable_conflict` 로 덮으면 같은 함정이 다음 사람에게 남는다.
- **삽입 건수를 반환하고 호출부가 그것을 확인**해야 한다. 건수가 없으면 UI 는 낙관적으로
  성공을 표시할 수밖에 없다. 클라이언트도 실패(-1)와 0을 구분하도록 고쳤다.

두 결함 모두 화면만 보면 정상으로 보였다 — `tests/e2e/16-chapter-vocab-delivery.spec.ts`
의 **DB 단언**이 잡았다. 담은 행은 finally 에서 지운다 (기보유 제외 때문에 남기면 다음
실행의 전달 목록이 줄어 테스트가 스스로를 무력화한다).
