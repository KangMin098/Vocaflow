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

## 추가 발견 — `frequency_rank` 가 NULL 이라는 이유만으로 V11 이 붙는다 (2026-08-30)

`ah` 가 **Pride and Prejudice 1장 상위 20 단어**로 학습자에게 나가고 있었다.
`select_book_chapter_vocab` 는 `v_level >= 6` 을 통과한 낱말을 점수순으로 세우는데,
`ah` 의 헤드워드 `v_level` 이 **11** 이었다.

원인은 그 행이 스스로 적고 있다 — `claude_reasoning` 이
`"L10 R9: archaic/jargon (rank>15000 or null, no tags) → V11"`.
**`frequency_rank` 가 NULL 이면 rank>15000 과 같이 취급**하는 규칙이다.
`ah` 는 흔해서 순위표에 안 실린 쪽인데 희귀해서 안 실린 쪽으로 읽혔다.

같은 행 안에서 이미 반증이 나와 있었다:

| 근거 | 값 |
|---|---|
| `meanings_ko[0].v_level` (뜻 수준) | **3** |
| `v_level_rule_v1` (규칙 v1 산출) | 7 |
| 헤드워드 `v_level` (사용되는 값) | **11** |
| 동류 감탄사 | `oh` A1/V1 · `aha` A2/V2 · `ha` A2/V2 · `hmm` A1/V2 |

**고친 것**: `ah` → A2 / V2 (`classified_by = claude_code_opus_5`, 사유를 `claude_reasoning` 에 기록).
V2 는 추출 게이트(V≥6) 아래이므로 학습자 표면에서 빠진다.

**같은 규칙에 걸린 나머지는 고치지 않았다.** 헤드워드 `v_level` 이 자기 뜻 수준보다
3 이상 높은 행이 **376**, 5 이상은 **19** 다. 그중 `manga`(V11 ↔ 뜻 V5) · `origami`(V10 ↔ V5) ·
`oregano` · `brisket` · `bouillon` 처럼 **판단이 갈리는 값**이 대부분이라, 한 번에 내리면
근거 없이 난이도 지형을 바꾸게 된다. `ah` 만 (a) rank 가 NULL 이고 (b) 뜻 수준이 V3 이며
(c) 동류가 전부 V1~V3 이라 **반증이 세 겹**이었다.

⚠️ **분모를 세는 질의**: 헤드워드와 뜻 수준의 어긋남은 아래로 잰다. 다음 배치가 이 목록을
다시 만들 때 같은 기준을 써야 회차 간 비교가 된다.

```sql
select word, v_level,
  (select max((e->>'v_level')::int) from jsonb_array_elements(meanings_ko) e where e ? 'v_level') as sense_v
from shared_dictionary
where meanings_ko is not null and jsonb_array_length(meanings_ko) > 0 and v_level is not null;
-- gap = v_level - sense_v.  gap>=3 → 376행 · gap>=5 → 19행 (2026-08-30 실측)
```

### 곁가지 — 외국어 낱말이 영어 표제어로 앉아 있다

같은 조사에서 나온 것. 기능어·감탄사 중 `v_level >= 9` 이고 register 가 `standard` 인 42개를
훑으니 `moi` · `qui` · `une` · `auf` · `oui` · `et` 는 프랑스어·라틴어이고, `yoo` 는 `yoo-hoo` 의
조각, `shaw` 는 고유명사, `lol` 은 약어다. 같은 부류인 `avec` · `chez` · `dans` · `merci` · `vous` 는
`modern_advanced` 로 잡혀 있어 **같은 성질에 서로 다른 register 가 붙어 있다.**
T5 서브에이전트들도 독립적으로 같은 것을 짚었다 (`avec` · `entre` · `deux` · `eau` · `filles` ·
`limite` · `chaque` · `museo` — "영어 문장에 그 낱말을 섞은 실제 용례가 아니다").

register 를 바꾸면 발행 도서 12권의 추출 결과가 전부 움직이므로 **이 배치에서는 재지 않고 적기만 한다.**
T6 의 동음이의어 오염 판정과 같은 회차에서 다루는 것이 맞다.
