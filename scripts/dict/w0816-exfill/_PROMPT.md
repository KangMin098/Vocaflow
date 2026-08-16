# T10 — `example_en` 이 아예 없는 표제어에 예문 쓰기

`shared_dictionary.example_en` 은 학습자 플래시카드 뒷면에 노출됩니다. 담당 청크의 항목들은 이 값이
NULL 이라 **카드 뒷면이 한국어 뜻 한 줄뿐**입니다. 문맥 없이 뜻만 외우는 건 Vocaflow 가 피하려는
학습 방식입니다(맥락 의존 인출 원칙).

## 할 일
각 항목의 `meaning_ko` · `all_meanings`(sense 목록) · `pos` · `synonyms` · `cefr` · `v`(V-Level 0~11)를
근거로 **그 뜻을 보여주는 자연스러운 영어 예문 한 문장**을 씁니다.

### 규칙 — 전부 필수. 어기면 apply 게이트가 거부합니다
1. **표제어가 문장에 실제로 등장할 것.** 굴절형 허용. 구동사·복합명사는 통째로.
   표제어가 `a/b` 슬래시 변이형이거나 `(...)` 괄호 선택항이면 **변이형 하나만 골라** 자연스럽게 쓰세요
   — 게이트는 토큰 하나만 맞아도 통과합니다.
2. **대문자로 시작**하고 `.` `!` `?` 중 하나로 끝날 것.
3. **20~160자.**
4. **아포스트로피 금지** — ASCII `'` 도 곡선 `’` 도 안 됩니다. `don't` → `do not`.
   소유격이 표제어의 핵이면(`adam's apple`·`devil's advocate`) 아포스트로피 없는 표기로 쓰고 `note` 에 남기세요.
5. `Near-synonyms:` 같은 **관계 라벨로 시작 금지.**
6. **`meaning_ko` 가 가리키는 그 뜻**을 보여줄 것. 다른 sense 로 쓰면 안 됩니다.
7. 난이도를 `cefr`/`v` 에 맞출 것. **예문에 쓰는 다른 단어들은 표제어보다 쉬워야** 합니다 —
   어려운 단어를 어려운 단어로 설명하면 카드가 무용해집니다.
8. 학습자 카드용으로 적절할 것 — 폭력·성·마약·차별 소재 금지.
9. 사전 뜻풀이가 아니라 **용례**일 것. `A boat is a small vessel for travel on water.` 는 정의문이라 반려.
   그 단어가 실제로 쓰이는 상황을 보여주세요.

### skip
표제어 자체가 학습자 카드에 실려선 안 되는 것(인종·성소수자·장애 멸칭, 노골적 성기·성행위 비속어,
마약 은어)이면 `"skip": true` + `note` 에 이유. 억지로 예문을 쓰지 마세요.

### 부수 발견 — `note` 에 (자동 수정 안 함, 사람 검토용)
앞선 청크에서 **계통적으로** 반복 확인된 유형입니다. 보이면 적으세요:

| 유형 | 실제 사례 |
|---|---|
| 오철자가 표제어 | `humourous`(→humorous) · `mocassin` · `theoretic` · `boney` · `conservativism` · `gismo` |
| 굴절·복수형만 등재 | `evanishes`(원형 부재) · `gaspings` · `forbore` · `passersby` |
| 중복 등재 (난이도까지 갈림) | `drunk driving`(B2/v6) ↔ `drunken driving`(C1/v9) · `gen x` ↔ `generation x` |
| 고유명사·약어 소문자화 | `fbi` · `european union` · `chinese new year` · `gmt` |
| 표제어에 `™`·곡선 아포스트로피 | `dms™` · `grand marnier™` · `devil’s advocate` |
| `meaning_ko` 오류·오염 | `frowst`("콧가람" — 없는 단어) · `handphone`(뜻풀이에 "Piper SF" 출처 메모 유출) |
| `pos` ↔ `all_meanings` 불일치 | `cwt`(abbreviation vs interjection) · `ent`·`etd` |
| cefr ↔ v 불일치 | `dental floss` C2/v11 · `elementary school` B2/v3 |
| 표제어가 영어 단어가 아님 | `le` · `behe` · `dre` · `brustly` (시드 토큰 오염) |

## 출력
입력과 **같은 순서·같은 개수**의 배열:
```json
{ "word": "<입력 word 그대로>", "example_en": "Sentence using the word.", "note": "(선택) 레코드 결함" }
```
skip: `{ "word": "...", "skip": true, "note": "…" }`

**청크 하나를 끝낼 때마다 즉시 그 `.out.json` 을 쓰세요.** 세션이 끊겨도 앞 청크는 남습니다.

작성 후 검증하세요: JSON 파싱 OK · 입력과 단어 수·순서 일치 · 규칙 1~5 전수 통과
(Bash/node 로 직접 세어 확인). DB·git·입력 파일은 건드리지 마세요.

## 보고 (한국어)
`exfill NN-MM: 작성 N · skip M` · **주목할 만한 것 5개** · `note` 목록.
