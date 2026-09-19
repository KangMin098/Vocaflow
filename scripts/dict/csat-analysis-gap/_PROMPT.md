# 수능 기출 결손 낱말 사전 드레인 — Claude Code 작업 지시

`chunk-NN.json` 을 읽고 **같은 폴더에** `chunk-NN.out.json` 을 쓴다.

## 입력 한 줄
```json
{ "word": "upcycling", "seen_in": "…원문 문장…", "csat_years": [2021, 2024], "csat_freq": 3 }
```

## 출력 한 줄 (입력과 **같은 개수·같은 순서**)
```json
{ "word": "upcycling", "meaning_ko": "업사이클링(폐품을 더 가치 있는 물건으로 재탄생시키기)",
  "pos": "noun", "cefr_level": "C1",
  "example_en": "Upcycling turns discarded bottles into furniture." }
```

## 규칙
- `meaning_ko` — 한국 고등학생·수능 응시자 기준 뜻. **`seen_in` 문맥의 뜻을 먼저**, 다른 흔한 뜻은 쉼표로.
- `pos` — noun · adjective · verb · adverb · idiom · phrasal_verb · abbreviation · interjection · preposition · determiner · pronoun · conjunction · prefix · auxiliary · number · other 중 하나(소문자). 새 값을 만들지 않는다.
- `cefr_level` — A1·A2·B1·B2·C1·C2 중 하나. **그 낱말 자체의 난이도**이지 지문 난이도가 아니다.
- `example_en` — 짧고 자연스러운 한 문장. **`seen_in` 을 그대로 옮기지 않는다**(기출 원문 복제 금지).
- 고유명사(인명·지명·상표)·약어 파편·오탈자·영어가 아닌 것은 그 줄을 **빼지 말고** `"skip": true` 를 붙인다.
  빼면 개수가 어긋나 들여오기가 통째로 거부한다.
- `csat_years` 가 길수록 반복 출제어다 — 뜻을 더 신중히 고른다.

## 되돌리기
`delete from shared_dictionary where classified_by='claude_code_opus_5' and source='ai-generated' and created_at > '…'`
