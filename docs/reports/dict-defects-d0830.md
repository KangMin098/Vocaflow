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

## 추가 발견 — accent 가 붙은 표제어는 예문 칸이 **영영 빈다** (2026-08-30, 배치 중 수정)

`w0830-senseex.mjs` 의 apply 게이트에 서로 반대 방향의 검사 두 개가 있었다.

| 검사 | 하는 일 |
|---|---|
| `ASCII_OK` | 예문에 ASCII 밖 문자가 있으면 버린다 (한글·CJK·이모지 차단이 목적) |
| `containsWord` | 표제어의 어간이 예문 안에 있어야 통과 |

표제어가 `crèche` 면 **어느 쪽으로 써도 걸린다.**
accent 를 살려 `crèche` 라 쓰면 `ASCII_OK` 에서 `non_ascii`,
ASCII 로 `creche` 라 쓰면 어간이 `crèch` 라 `containsWord` 가 `no_headword` 로 버린다.
게이트가 조용히 버리므로 재실행해도 같은 자리에서 같은 값이 사라진다 — **다시 물어도 못 채우는 칸.**

대상 5낱말: `entrée` · `crèche` · `fainéant` · `crêpe` · `sou’wester`
(`entrée` 는 어간이 `entr` 로 잘려 ASCII `entree` 가 우연히 통과했고, `sou’wester` 는 곡선따옴표에서
토큰이 갈려 `sou` 로 통과했다 — **우연히 통과한 것이지 규칙이 맞은 것이 아니다.**)

**고친 것** (양쪽 다 넓히기만 한다 — 통과하던 것이 막히는 경우는 없다):

1. `containsWord` 가 표제어·예문을 **NFD 분해 후 분음부호를 벗기고** 비교한다.
2. `ASCII_OK` 를 **분음부호를 벗긴 문자열에** 적용한다. `é`·`ê`·`ç` 는 통과하고
   한글·CJK·이모지는 여전히 걸린다(그것들은 벗겨도 ASCII 가 아니다).

실측: `non_ascii` 거부 2 → **0**, `crèche` 두 뜻 모두 예문·해석 적재 확인.

⚠️ **같은 함정이 다른 배치에도 있는지 봐야 한다** — `w0817-colloc` 의 매처가 이 코드의 원본이다.

---

# T6-1 실행 기록 — 동음이의어 오염 판정 (2026-08-30)

파이프라인 `scripts/dict/w0830-homonym.mjs` · 청크 `scripts/dict/w0830-homonym/`

## 대상 고르기

`field_provenance` 에 `wordnet` 이 찍혀 있고 `collocations`·`synonyms`·`antonyms` 중
하나라도 값이 있는 행 **34,195**. 그중 시험 밴드(수능·EBS·교육과정)를 1차 파장으로 잡아
**6,456 낱말 / 323 청크**(20낱말씩).

## 이 배치가 하지 않는 것 — 섞으면 못 가린다

- **대체값을 만들지 않는다.** 비우기만 한다. 채우는 것은 `corefill` 소관이다.
- **`example_en` 을 건드리지 않는다.** 뜻이 어긋난 예문은 `EXAMPLE-QUEUE.json` 으로 넘긴다.
- **`meanings_ko` 갈래 순서를 건드리지 않는다.** 인덱스가 바뀌면 T2 가 채운 예문이 엉뚱한 뜻에 붙는다.

## 안전 장치

| 장치 | 무엇을 막나 |
|---|---|
| `field_provenance.t6_removed` 에 지운 값 보존 | **출처를 모르고 지우는 것** — 되돌릴 수 있다 |
| 청크 입력을 다시 읽어 대조, 없는 문자열은 `not_shown` 거부 | 서브에이전트가 **지어낸 값**을 지우는 것 |
| 현재 배열에 없는 값은 `not_present` 거부 | 다른 세션이 이미 바꾼 행을 덮는 것 |
| 지울 것이 없어도 `t6_homonym` 도장을 찍는다 | "물어봤고 깨끗했다" 와 "아직 안 물어봤다" 가 섞이는 것 |

## 실측 — 시험 밴드 완주 (6,456 낱말 · 323/323 청크)

| | |
|---|--:|
| 판정한 낱말 | **6,456** |
| **오염 없음** | **6,374 (98.7%)** |
| 지운 항목 | 연어 52 · 반의어 63 · 유의어 2 (합 **117**) |
| 통째로 빈 필드 | 연어 11 · 반의어 18 · 유의어 1 |
| `not_shown` / `not_present` 거부 | **0 / 0** |
| `example_mismatch` (T6-3 큐) | 5 |
| 부수 발견 | 361 |

정본 사례는 전부 잡혔다 — `saw`(hand/chain/old saw) · `over`(크리켓) · `march`·`may`(월 이름) ·
`he`(he good/nice/tired) · `stem`(STEM) · `transport`(황홀).

**유의어는 한 건도 지우지 않았다.** 오염은 연어와 반의어에만 나타났다.
반의어 쪽은 대부분 WordNet 의 반의어 사슬을 그대로 들여온 것이다 —
`flat`↔`natural`·`sharp`(악보 기호) · `bear`↔`bull`(증시) · `direct`↔`alternating`(직류/교류) ·
`multiply`↔`singly`(부사 뜻) · `epidemic`↔`ecdemic`(반대편이 아니다).

## 판정하며 드러난 것 — 오염보다 흔한 결함이 따로 있다

시험 밴드에서 WordNet 평탄화 오염은 **1.6%** 로 예상보다 희소했다. 구간마다 서로 다른
서브에이전트가 독립적으로 같은 것을 짚었다:

> **연어가 전부 맞는데, 전부 부차적 뜻에만 붙어 있다.**

`pet`(pet project/peeve/theory — 전부 형용사) · `pin`(전부 두문자어 PIN) · `swallow`(전부 '제비') ·
`sole`(전부 '밑창') · `tender`(전부 '입찰') · `rose`(전부 '장밋빛의') · `bay`(전부 말 털색) ·
`thrust` · `sphere` · `kindly` · `crush` · `spoil` · `bench` · `drain` · `rub` …

**지울 것이 없으니 이 배치로는 못 고친다.** 값이 틀린 게 아니라 대표 뜻이 비어 있는 것이다.
자유 서술로 흘려보내지 않도록 apply 가 `COREFILL-QUEUE.json` 으로 뽑는다 (현재 **77건**).

## 폐기한 수치 하나

`meaning_ko` ↔ `senses` 불일치를 SQL 휴리스틱(앞 4글자 포함 여부)으로 재서 **31,571건**이
나왔으나 **근거로 쓸 수 없다** — 의역 차이에도 걸린다. 이 수치를 인용하지 말 것.

반증 불가능한 지표로 다시 쟀다: 사전이 스스로 `pos_set` 에 적어 둔 품사인데
`meanings_ko` 에 그 품사의 뜻을 하나도 등재하지 않은 행 = **667행**(시험 밴드 21 · top3k 43).

```sql
with s as (
  select word, pos_set,
    (select array_agg(distinct e->>'pos') from jsonb_array_elements(coalesce(meanings_ko,'[]'::jsonb)) e
      where e->>'pos' is not null) as sense_pos
  from shared_dictionary
  where pos_set is not null and array_length(pos_set,1) >= 2
    and meanings_ko is not null and jsonb_array_length(meanings_ko) >= 1
)
select count(*) from s
where sense_pos is not null and exists (select 1 from unnest(pos_set) p where not (p = any(sense_pos)));
```

`it` 이 그 사례다 — `senses[]` 에 대명사 뜻이 없고 **'정보 기술(IT)' 명사 뜻만** 있다.
그래서 `it department`·`it support` 가 규칙상 "정상" 으로 판정돼 살아남았다.
`fell` 도 같다(영국 북부 '산지' 뜻이 등재돼 있어 `fell running` 이 통과).
**이 둘은 T6-1 이 아니라 뜻 갈래 정리(T6-2)의 몫이다.**

## 배치 도중 고친 결함 — 큐가 빈 채로 덮이고 있었다

apply 가 부수 발견을 **`already` 판정 뒤에** 모으고 있었다. 배치가 끝난 뒤 재실행하면
모든 행이 `already` 라 `FLAGGED.json`·큐 파일이 **빈 채로 덮인다**.
실제로 한 번 덮였다(184건 → 83건). 수집을 `already` 앞으로 옮겨 고쳤고,
재실행하니 271건으로 복구됐다. **큐는 이번에 쓴 행이 아니라 배치 전체의 보고서다.**

## 오염률은 구간에 따라 크게 다르다 — 그리고 그게 이 배치의 결론이다

| 구간 | 오염 |
|---|---|
| 기능어·대명사·최고빈도 (chunk-00~02, rank <100) | `he` `saw` `over` `may` — **한 청크에 3~6건** |
| 중빈도 내용어 (rank 2,000~5,000) | 160낱말당 0~2건 |
| 저빈도·파생어·학술어 (rank 8,000~) | 160낱말당 **0건이 흔하다** |

**WordNet 평탄화 오염은 고빈도 짧은 낱말에 몰린다.** 철자가 짧을수록 계보가 다른
동음이의어가 같은 문자열을 공유하기 때문이다. 뒤로 갈수록 낱말이 형태론적으로 투명해져
(`outperform` · `oversimplify`) 동음이의어 자체가 성립하지 않는다.

한 서브에이전트는 스스로 기존 294개 산출물의 삭제율(5,880낱말 중 77 = 1.3%)을 실측해
자기 구간의 0건이 관대함이 아니라 구간 특성임을 확인했다.

⚠️ **따라서 `top`·`rest` 파장의 기대 수확은 낮다.** 4,365 + 23,000 낱말을 같은 비용으로
돌려도 이 배치가 건질 것은 100건 남짓으로 보인다. **다음 배치는 오염이 아니라
아래 두 큐를 향하는 편이 낫다.**

## 곁가지로 확인한 것 — 보이지 않는 문자는 1행뿐이었다

`ready` 의 연어 `ready and waiting` 에 zero-width space(U+200B)가 섞여 있었다.
화면에는 멀쩡히 보이면서 매칭을 조용히 깨뜨리는 값이라 전수 조사했더니 **사전 전체에서 이 1행뿐**
(연어 1 · 유의어 0 · 반의어 0 · `meaning_ko` 0 · `example_en` 0 · 표제어 0). 그 자리에서 제거했다.

```sql
with pat as (select '[' || chr(8203) || chr(8204) || chr(8205) || chr(65279) || chr(160) || chr(8239) || chr(8288) || ']' as re)
select count(*) from shared_dictionary, pat
where exists (select 1 from unnest(coalesce(collocations,'{}')) v where v ~ pat.re);
```

## 남은 것 — 우선순위 순

1. **`COREFILL-QUEUE.json` 97건** — 연어가 전부 맞는데 전부 부차적 뜻에만 붙어 있고
   대표 뜻에는 하나도 없는 낱말. 지울 게 없어 T6-1 로는 못 고친다. **컴포저가 연어를
   목차로 쓰므로 학습자 표면에 직접 닿는다.** `corefill` 이 대표 뜻 연어를 채워야 한다.
2. **T6-2 뜻 갈래 정리** — `it`(대명사 뜻 없이 '정보 기술' 만) · `fell` · `pm`(세 동음이의어를
   한 항목에) · `batter`(반죽+타자) · `count`(셈+백작) · `lead`(/led/ 납 + /liːd/ 이끌다).
   ⚠️ 인덱스를 바꾸면 T2 가 채운 예문이 엉뚱한 뜻에 붙는다 — 예문을 함께 옮겨야 한다.
3. **T6-3 예문 교체** — `EXAMPLE-QUEUE.json` 5건 + 앞서 모은 문장 아닌 예문 142건.
4. `top`(4,365) · `rest`(약 23,000) 파장 — 위 근거로 **후순위**.

---

# T6-1b 실행 기록 — 대표 뜻 연어 보강 (2026-08-30)

파이프라인 `scripts/dict/w0830-repcolloc.mjs` · 청크 `scripts/dict/w0830-repcolloc/`

T6-1 의 `COREFILL-QUEUE.json` **97건**을 받는 배치다. 값은 전부 맞는데 전부 부차적 뜻에만
붙어 있어, **지울 것이 없어 T6-1 이 손대지 못한** 낱말들이다.

## 왜 기존 `corefill` 로 안 되는가

`w0830-corefill` 의 그물은 `empty(r.collocations)` 다 — **배열이 비어 있을 때만** 채운다.
이 건들은 값이 차 있어 그 그물을 통과한다. 반대로 T6-1 이 통째로 비운 낱말(`electric` 등 **4개**)은
corefill 소관이라 이 배치가 건너뛴다 — **같은 칸을 두 배치가 건드리면 무엇이 누구 값인지 못 가린다.**

## 실측

| | |
|---|--:|
| 큐 → 대상 | 97 → **93** (4는 corefill 로) |
| 적재한 낱말 | **91** (skip 2: `however` · `nick`) |
| 더한 연어 | **269** |
| 게이트 거부 | 표제어 없음 0 · 중복 0 · 길이 위반 0 · 비ASCII 0 · 상한 초과 0 |

게이트 거부가 **전 항목 0** 이다 — 서브에이전트가 규칙을 그대로 지켰다.

| 표제어 | 대표 뜻 | 앞에 놓인 새 연어 | 뒤에 남은 기존 값 |
|---|---|---|---|
| `pen` | 펜 | `ballpoint pen` · `pen and paper` · `write in pen` | `sheep pen` · `pig pen` · `playpen` |
| `swallow` | 삼키다 | `swallow a pill` · `swallow hard` · `hard to swallow` | `barn swallow` · `swallow nest` |
| `pin` | 핀 | `safety pin` · `straight pin` · `drawing pin` | `enter pin` · `pin number` |
| `train` | 기차 | `catch a train` · `train station` · `board the train` | `train hard` · `train for` |
| `tender` | 다정한 | `tender meat` · `tender age` · `tender loving care` | `submit a tender` |

**더하기만 한다.** 기존 값을 지우지 않고 새 연어를 **앞에** 놓는다 — 컴포저가 이 배열을
목차로 쓰므로 대표 뜻이 먼저 읽혀야 한다. 더한 값은 `field_provenance.t6_repcolloc_added` 에 남는다.

## 곁가지로 잰 것 — `primary_pos` 가 자기 뜻과 어긋난다

서브에이전트들이 구간마다 반복해 짚었다(`overall` `surround` `combine` `burn` `constant`
`swallow` `rub` `thrust` `roast` `treasure` `whizz` `snaffle` `blinker` `potty` …).
사전이 **스스로 적어 둔 두 값**이 어긋나는 것이라 판단이 개입하지 않는다:

```sql
select count(*) from shared_dictionary
where primary_pos is not null and meanings_ko is not null
  and jsonb_array_length(meanings_ko) >= 1 and meanings_ko->0->>'pos' is not null
  and lower(primary_pos) <> lower(meanings_ko->0->>'pos');
```

**298행** (검사 대상 47,182 중 0.6%) · 시험 밴드 **103** · rank 5,000 이내 **96**.

작지만 학습자에게 닿는다 — 카드가 품사를 표시하고, 컴포저가 품사별 세트를 만든다.
다만 어느 쪽이 맞는지는 낱말마다 다르므로(`treasure` 는 둘 다 실재한다) **자동 수정 대상이 아니다.**
`primary_pos` 를 고칠지 `meanings_ko` 순서를 바꿀지는 뜻 갈래 정리(T6-2)와 같은 회차에서 정해야 한다.
⚠️ **순서를 바꾸는 배치는 T2 가 채운 예문을 함께 옮겨야 한다.**

---

# T6-2 실행 기록 — 뜻 갈래 정리 (2026-08-30)

파이프라인 `scripts/dict/w0830-senses.mjs` · 청크 `scripts/dict/w0830-senses/`

## 예문을 잃지 않게 만든 구조

T2·T5 가 `meanings_ko[].example`·`example_ko` 를 **72,266 뜻**에 채워 놨다.
갈래를 건드리며 인덱스가 밀리면 그 예문이 **엉뚱한 뜻에 붙는다** — 빈칸보다 나쁘다.

그래서 산출물은 "새 배열" 이 아니라 **`from` 이 달린 새 배열**이다.
서브에이전트는 **예문을 보지도 쓰지도 않는다** — `from`(원본 인덱스)만 적고, 옮기는 일은 apply 가 한다.

| 게이트 | 무엇을 막나 |
|---|---|
| 예문 달린 원본은 반드시 `from` 으로 참조되거나 `merged_into` 로 병합처를 밝혀야 한다 | **예문의 조용한 소실** |
| 같은 `from` 을 두 번 쓸 수 없다 | 예문 복제 — 어느 뜻의 것인지 못 가리게 됨 |
| 원본은 참조되거나 `dropped` 에 사유와 함께 있어야 한다 | 갈래의 조용한 소실 |
| 원본 배열 전체를 `field_provenance.t6_senses_before` 에 보존 | **되돌릴 수 없게 되는 것** |
| 안 바뀌어도 도장은 찍는다 | 다음 배치가 같은 낱말을 영원히 다시 묻는 것 |

**구조 게이트 거부는 전량 0** (`bad_from` · `dup_from` · `example_lost` · `orphan` · `empty_meaning`).

## 병합 시 예문이 새던 곳 — 배치 중 발견·수정

첫 드라이런에서 예문이 492 → 412 로 줄었다. 원인을 재 보니
**병합으로 버리는 갈래에 예문이 있는데 합치는 쪽이 비어 있으면 그냥 사라지는** 경로였다.
물려받도록 고친 뒤 다시 재니 — 감소분의 **거의 전부가 "합치는 쪽에 이미 자기 예문이 있는"**
정상 경우였고(중복 갈래 둘이 각자 예문을 갖고 있던 것), 순수 손실은 **1건**뿐이었다.
같은 뜻을 하나로 합치면 예문도 하나가 되는 것이 맞다. 버려진 쪽은 `t6_senses_before` 에 남는다.

## ⚠️ 모집단 선정에 오탐이 있었다 (내 결함)

`pos_set` 에 있는 품사의 뜻이 갈래에 없다 → **667행**으로 세어 배치에 넣었는데,
**품사 표기가 사전 안에서 통일돼 있지 않다**:

| 같은 품사, 다른 표기 | 건수 |
|---|--:|
| `phrasal verb` ↔ `phrasal_verb` | 474 ↔ 475 |
| `n` ↔ `noun` · `adj` ↔ `adjective` · `v` ↔ `verb` | 27 · 15 · 4 |
| `exclamation` ↔ `interjection` · `auxiliary verb` ↔ `auxiliary` | 5 · 8 |

정규화하고 다시 세니 **667 → 134**. **533행(80%)이 오탐**이었다.
서브에이전트 세 팀이 각자 독립적으로 이걸 짚었고("고칠 것이 없다"), 전부 원본 그대로 반환해
피해는 없었다 — 낭비된 것은 판정 시간뿐이다. chunker 에 `POS_ALIAS` 정규화를 넣어 고쳤다.

**교훈**: 사전 안에서 **같은 것을 두 이름으로 부르는지 먼저 확인하지 않고** 비교하면,
그 차이가 통째로 결함으로 둔갑한다. 앞서 폐기한 `meaning_ko`↔`senses` 휴리스틱(31,571건)과 같은 종류의 실수다.

## 실측 (진행 중)

| | |
|---|--:|
| 대상 | 1,317 낱말 / 110 청크 (시험 밴드 364) |
| 적재한 낱말 | **449** |
| 갈래 쪼갬 | 207 · 합침 182 · 순서·표현만 60 |
| 손 안 댐(도장만) | 499 |

## 서브에이전트가 스스로 찾아낸 방법

한 팀이 `scripts/dict/w0830-senseex/chunk-*.out.json` 에서 **갈래별 실제 예문을 대조**해
`from` 을 정했고, 그 덕에 오배정 5건을 막았다:

- `rape` — idx0 예문이 `the Rape of Nanjing`(유린). 겉보기만 보면 '유채'에 `from:0` 을 줄 뻔했다.
- `times` — idx1(`time` 의 복수) 예문이 `Modern times…` 라 '~번' 이 아니라 **'시대'** 로 합쳐야 했다.
- `sitting` · `used` · `restoration` 외 다수.

이 방법을 이후 팀에 전파했다. 대조가 불가능할 때의 기본 규칙은
**세미콜론 묶음의 맨 앞 뜻에 `from` 을 남기는 것**이다(예문이 선두 뜻으로 생성됐을 확률이 가장 높다).

**계보가 다른 갈래는 합치지 않는다** — 한 팀이 `sat` 의 SAT(대입시험) 갈래를 일부러 남겼다.
합쳤다면 `merged_into` 가 그 예문을 '앉았다' 쪽으로 옮겨 학습자가 틀린 짝을 보게 된다.

## T6-2 완주 실측 (110/110 청크)

| | |
|---|--:|
| 판정한 낱말 | **1,317** |
| 갈래를 고친 낱말 | **580** |
| 물어봤고 멀쩡했던 낱말 | 737 |
| 구조 게이트 거부 | `bad_from` 0 · `dup_from` 0 · `example_lost` 0 · `orphan` 0 · `empty_meaning` 0 |
| 예문 (뜻 단위) | 72,266 → **72,082** (−184) |

**−184 는 전부 중복 갈래 병합분이다.** 실행 로그의 "받는 쪽에 이미 있어 둠" 합이 183 —
중복 갈래 둘이 각자 예문을 갖고 있다가 하나로 합쳐진 경우다. 버려진 쪽은 `t6_senses_before` 에 남는다.
(나머지 1은 이 사이 다른 세션의 변경으로 보인다.)

## ⚠️ 게이트가 **기존 오배치를 굳히는** 경로가 있었다

apply 는 "예문 달린 원본 갈래는 반드시 참조돼야 한다" 를 강제한다. 이 규칙은 예문 소실을 막지만,
**원래 예문이 엉뚱한 갈래에 붙어 있던 낱말**에서는 그 오배치를 그대로 굳힌다.

`it` — 갈래가 `정보 기술(IT)` **하나뿐**인데 대명사 예문
(`It arrived yesterday and it is still in the box.`)을 달고 있었다.
서브에이전트가 대명사 갈래를 새로 넣으면서 `from: 0` 을 규칙대로 IT 갈래에 남겼고,
결과적으로 **IT 갈래가 대명사 예문을 보여 주게 됐다.** `he` 도 같은 모양이었다
(갈래가 부사 '아주, 매우' 하나뿐인데 대명사 예문 보유).

전수 조사: 갈래가 늘었고 · 예문이 하나뿐이고 · 그 예문이 첫 갈래에 없는 낱말 = **19건**.
하나씩 읽어 보니 **18건은 정확했다** — 서브에이전트들이 예문을 실제 그 뜻의 갈래에 붙이고
대표 뜻을 앞에 세운 결과였다(`put out` 의 `He was put out at…` → 4번 '짜증나게 하다',
`set off` 의 상쇄 용례 → 4번, `strike out` 의 `struck out on a nasty slider` → 2번 야구).
`it` · `he` 두 건만 오배치였고 그 자리에서 고쳤다.

**교훈**: "잃지 마라" 는 게이트만으로는 부족하다. 원본이 이미 틀린 자리에 있으면
**옳은 자리로 옮기라**고 명시해야 한다. 다행히 서브에이전트 대부분은 스스로 그렇게 판단했다.

후보를 다시 세는 질의:

```sql
with t as (
  select word, meanings_ko,
    jsonb_array_length(meanings_ko) as n_now,
    jsonb_array_length(coalesce(field_provenance->'t6_senses_before','[]'::jsonb)) as n_before,
    (select min(ord) from jsonb_array_elements(meanings_ko) with ordinality e(v,ord) where v ? 'example') as first_ex,
    (select count(*) from jsonb_array_elements(meanings_ko) e where e ? 'example') as n_ex
  from shared_dictionary where field_provenance->>'t6_senses' like 'restructured%'
)
select word from t where n_now > n_before and n_ex = 1 and first_ex > 1;
```

## 다시 확인한 정본 사례

| 표제어 | 갈래 (예문 위치) |
|---|---|
| `it` | 그것(**예문**) · 비인칭 주어 · 정보 기술(IT) — 대명사 뜻이 없던 것이 채워졌다 |
| `fell` | 베어 넘어뜨리다(**예문**) · fall 과거형(**예문**) · 영국 북부 산지(**예문**) — 세 낱말이 갈렸고 예문도 각자 제자리 |
| `pull out` | 뽑아내다(**예문**) · 빠져나오다 · 철수하다 — 예문이 가리키던 뜻을 새로 세워 제자리를 찾아 줬다 |
| `sally` | 출격·돌진(**예문**) · 재치 있는 말 · 힘차게 나서다(**예문**) |
