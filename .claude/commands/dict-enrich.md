---
description: shared_dictionary 5 컬럼 빠른 채움 (dict-fill sprint Phase 1/2/3 용)
argument-hint: <input-jsonl-path>
allowed-tools: Read, Write, Bash(node:*)
---

# /dict-enrich — Dictionary Fill batch

**모델:** Claude Opus 4.7 (feedback_best_model 메모리 정합)
**청크 크기:** 50 단어 / prompt
**출력 필드:** example_en, synonyms, antonyms, ipa, collocations

---

## 입력 (JSONL)

`$ARGUMENTS` 의 첫 번째 토큰을 input 파일 경로로 사용. 각 라인:

```json
{"word":"abandon","pos":"verb","cefr":"B2","meaning_ko":"버리다","meanings_ko":[{"pos":"verb","meaning":"버리다, 포기하다"}],"frequency_rank":1965}
```

---

## 출력 (JSONL)

같은 디렉토리에 input 파일명의 `input` → `output` 치환한 파일 생성.
- `p1-input-01of11.jsonl` → `p1-output-01of11.jsonl`

각 라인:
```json
{"word":"abandon","pos":"verb","ok":true,"data":{"example_en":"She abandoned her old car by the roadside.","synonyms":["desert","forsake","leave"],"antonyms":["keep","retain"],"ipa":"/əˈbændən/","collocations":["abandon hope","abandon ship","abandon a plan"]}}
```

오류 라인:
```json
{"word":"...","pos":"...","ok":false,"error":"이유"}
```

---

## 출력 규칙

### `example_en`
- 1 문장
- word 또는 inflection 포함 필수 (R3 룰 정합)
- 50~100 자
- 학습자 친화 어휘

### `synonyms`
- 0~3 개, 같은 pos
- word 자체 (lemma) 포함 금지 (R8 룰 정합)

### `antonyms`
- 0~2 개, 같은 pos
- 명확한 반의어만 (없으면 빈 배열)
- word 자체 포함 금지

### `ipa`
- 미국식 발음 (General American)
- 슬래시 wrap: `/.../`
- 표준 IPA

### `collocations`
- 0~3 개
- 빈출 결합 표현 (예: "abandon hope", "make a decision")

### Avoidance
- "sat" (past of "sit") 회피 — 외부 denylist regex 충돌
- 비속어 / 브랜드명 미포함

---

## Few-shot (3 단어)

### 입력
```jsonl
{"word":"abandon","pos":"verb","cefr":"B2","meaning_ko":"버리다","meanings_ko":[{"pos":"verb","meaning":"버리다, 포기하다"}],"frequency_rank":1965}
{"word":"ability","pos":"noun","cefr":"A2","meaning_ko":"능력","meanings_ko":[{"pos":"noun","meaning":"능력"}],"frequency_rank":412}
{"word":"abstract","pos":"adjective","cefr":"B2","meaning_ko":"추상적인","meanings_ko":[{"pos":"adjective","meaning":"추상적인"}],"frequency_rank":1834}
```

### 출력
```jsonl
{"word":"abandon","pos":"verb","ok":true,"data":{"example_en":"She abandoned her old car by the roadside.","synonyms":["desert","forsake","leave"],"antonyms":["keep","retain"],"ipa":"/əˈbændən/","collocations":["abandon hope","abandon ship","abandon a plan"]}}
{"word":"ability","pos":"noun","ok":true,"data":{"example_en":"He has the ability to solve complex problems.","synonyms":["skill","capacity","talent"],"antonyms":["inability"],"ipa":"/əˈbɪləti/","collocations":["natural ability","ability to","develop the ability"]}}
{"word":"abstract","pos":"adjective","ok":true,"data":{"example_en":"Her painting is too abstract for me to understand.","synonyms":["theoretical","conceptual"],"antonyms":["concrete","tangible"],"ipa":"/ˈæbstrækt/","collocations":["abstract concept","abstract art","in the abstract"]}}
```

---

## 작업 흐름

1. `Read` 로 input JSONL 파일 읽기
2. 50 단어 처리 (위 규칙 + few-shot 패턴)
3. `Write` 로 output JSONL 작성 (UTF-8, BOM 없음, LF only)
4. `Bash(node scripts/dict-fill/02-validate-output.mjs <output-path>)` 검증 실행
5. validation 결과 (passed/failed/skipped) + output 경로 보고

---

## 최종 보고 형식

```
chunk: p1-input-01of11
input: 50 lines
output: 50 lines (ok=true: 48, ok=false: 2)
validation: PASS — codes: []
output: <absolute path>
validation_report: <absolute path>
```

---

## 메모리 정합

- ✅ vendor 명 미사용 (Anki/Oxford 등)
- ✅ profanity / brand denylist 룰 회피
- ✅ Opus 4.7 사용 (feedback_best_model)
