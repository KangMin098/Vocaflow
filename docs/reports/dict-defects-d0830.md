# 사전 결함 목록 — D0830 배치 부수 발견

생성: 2026-08-30 · 출처: `scripts/dict/w0830-review/ALL-FLAGGED.json`

D0830 드레인(T2 뜻별 예문 · T3 코어밴드 결손 · T5 예문 해석)은 낱말을 **한 줄씩 실제로 읽는다.**
읽는 김에 "이 항목은 이래서 못 쓴다" 를 적게 했고, 그것이 여기 모였다.
**아무것도 자동으로 고치지 않았다** — 판단이 갈리는 것들이라 사람이 정해야 한다.

집계는 배치가 진행되는 동안 계속 늘어난다. 아래 수치는 **집계 시점의 스냅숏**이다.

## 갈래별 (499건 · 중간 집계)

| 갈래 | 건수 | 무엇이 문제인가 |
|---|--:|---|
| **예문이 문장이 아님** | 142 | `say` idx2 = `To have a say` · `good` idx0 = 세미콜론으로 이은 두 조각. WordNet 용례를 그대로 들여온 자리다. 학습자에게 보여 줄 문장이 아니다 |
| 기타 | 128 | 개별 사안 (`mean` 에 가장 흔한 뜻 '의미하다' 가 아예 없음 등) |
| **한 항목에 여러 뜻** | 64 | `down` idx1 = '솜털'+'침체기' · idx3 = '격추하다'+'단숨에 마시다'. **예문 하나로는 변별이 안 된다** — 다의어 학습의 전제가 깨진다 |
| **뜻 갈래 중복** | 52 | `up` idx1 '오른'이 idx2 '(가격이) 오른'과 겹침. 같은 것을 두 번 외우게 한다 |
| 난이도 불일치 | 31 | `canned` 예문 속 `cardoon`(카르둔)이 표제어보다 어렵다 — 예문이 아니라 새 문제가 된다 |
| **뜻↔예문/연어 어긋남** | 26 | `raise` 뜻은 '(아이를) 키우다' 인데 예문은 닭 · `love` idx1 에 '(테니스) 0점' 이 붙어 있음 |
| meaning_ko 결함 | 23 | `saw` 의 meaning_ko 는 'see의 과거형' 인데 연어는 `hand saw`·`chain saw` (톱) |
| 품사 오기 | 19 | `in` primary_pos=adverb 인데 예문의 in 은 전치사 · `care` noun 인데 예문은 동사 |
| 오타·비문 | 14 | `mother` 예문 `I am visiting my mother any moment.` · `sale` 예문 `the sale of company` |

## 뿌리는 하나다 — WordNet 유래 동음이의어 오염

가장 자주 나온 갈래는 이름이 달라도 **같은 사고**를 가리킨다.
`shared_dictionary.field_provenance` 가 `synonyms`·`derived_forms`·`related_terms` 의 출처를
`wordnet-3.1` 로 적고 있다. WordNet 은 **표제어를 동음이의어별로 나누지 않고** 한 문자열 아래
모든 synset 을 매단다. 그것을 낱말 단위로 평탄화해 들여오면 이렇게 된다:

| 표제어 | meaning_ko 가 말하는 것 | 딸려 들어온 것 |
|---|---|---|
| `it` | 대명사 '그것' | 연어 `it department` · `it support` (정보기술 IT) |
| `saw` | 'see 의 과거형' | 연어 `hand saw` · `chain saw` (톱) |
| `transport` | '수송, 교통' | 연어 `transport of joy` · `transport of rage` (황홀) |
| `he` | 대명사 | 반의어 `slightly` · 연어 `he good` / `he nice` (실재하지 않는 용법) |
| `over` | 부사 '넘어' | 예문·연어가 전부 크리켓 명사 `over` |
| `march` | '행진하다' | senses·연어가 전부 3월 March |
| `stem` | '줄기' | `pos: abbreviation` — STEM 두문자어가 오염 |
| `fell` | 'fall 의 과거형' | 연어가 영국 구릉 `fell running` · `Cumbrian fell` |

**왜 위험한가**: 이건 빈칸이 아니라 **틀린 값**이다. 빈칸은 학습자가 아무것도 안 배우지만,
틀린 연어는 학습자가 **외운다**. 그리고 컴포저의 `collocation`·`synonym-cluster` 블루프린트가
이 값을 그대로 목차로 쓴다.

## 다음 배치 (T6) — 제안

1. **동음이의어 오염 판정** — `meaning_ko` 와 `collocations`/`synonyms`/`antonyms`/`example_en` 이
   같은 뜻을 가리키는지 낱말마다 판정한다. 어긋난 항목만 **비운다**(대체값을 만들지 않는다 —
   그건 T3 가 이미 하는 일이고, 두 배치를 섞으면 무엇이 지워지고 무엇이 채워졌는지 못 가린다).
2. **뜻 갈래 정리** — 한 항목에 묶인 여러 뜻을 가르고, 중복 갈래를 합친다.
   ⚠️ `meanings_ko` 의 **인덱스가 바뀌면** T2 가 채운 `example`·`example_ko` 가 엉뚱한 뜻에 붙는다.
   갈래를 건드리는 배치는 반드시 **예문을 함께 옮겨야** 한다. 순서를 바꾸는 배치는 T2 완료 후에.
3. **예문 교체** — 문장이 아닌 예문 142건 + 비문 14건. `example_en` 을 덮는 유일한 배치이므로
   기존 값을 `field_provenance` 에 남기고 바꾼다.

## 원본

`scripts/dict/w0830-review/ALL-FLAGGED.json` — `{batch, word, note, kind}`.
갈래(`kind`)는 키워드 휴리스틱이라 **정확하지 않다** — 판정이 아니라 분류 힌트로만 쓸 것.

## 추가 발견 — 굴절형이 파생형으로 등재돼 있다 (2026-08-30)

`base_word` 를 가진 6,763행 중 **549행이 `derivation_suffix` 없이** 기본형만 가리킨다.
그중 실물로 확인된 것: `rose → rise` · `dice → die`. 굴절형(과거형·복수형)을 파생 관계로
적어 둔 것이라 **그 낱말을 기본형으로 삼는 진짜 파생어가 막힌다** —
`roseate → rose` 와 `dicey → dice` 가 깊이-1 트리거에 걸려 들어가지 못했다.

굴절은 `inflected_forms`·`inflections` 가 이미 담당한다. `base_word` 는 **파생**의 축이다.
두 축을 한 컬럼에 섞으면 어족 묶기가 조용히 좁아진다.

⚠️ 이 549행은 D0830 배치가 만든 것이 아니다(이 배치는 접미사를 함께 적는다).
어느 파이프라인이 넣었는지 확인한 뒤에 정리해야 한다 — **출처를 모르고 지우면 되돌릴 수 없다.**
