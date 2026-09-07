# D0830-T4 — 어족(word family): `base_word` · `derivation_suffix`

시중 "word family 보카" 가 통째로 파는 것이 `nation / national / nationality / nationalize` 한 묶음이다.
우리는 그 묶음을 만들 키(`base_word`)가 48,962 중 3,414(7%)뿐이라, 컴포저의 파생어 세트가
후보 4,639 개를 `undersized_group` 으로 버리고 299항목으로 쪼그라들어 있다.

담당 청크의 낱말은 **파생 접미사로 끝나 보이는** 낱말들이다. 실제로 파생어인지 판단하는 것이 일이다.

## 낱말마다 답할 것

```json
{ "word": "happiness", "base_word": "happy", "derivation_suffix": "-ness" }
```

- **`base_word`** — 이 낱말이 어디서 나왔나. **표제어보다 길지만 않으면 된다**(같은 길이는 정상이다 —
  접미사가 어간을 깎으며 붙는다: `anxious → anxiety` · `enter → entry` · `anger → angry` ·
  `young → youth` · `quality → qualify` · `technique → technical` · `possible → possibly`).
  그리고 **우리 사전에 있는 흔한 낱말**이어야 한다.
- **`derivation_suffix`** — 붙은 접미사. `-` 로 시작하는 소문자. **표제어가 실제로 그 철자로 끝나야 한다.**
  `happiness` → `-ness` (o) · `-iness` (x, 철자는 `ness` 로 끝난다)

## 철자가 바뀌는 것들 — 여기가 규칙으로 안 되는 지점

| 표제어 | base_word | 왜 |
|---|---|---|
| happiness | happy | y → i |
| business | busy | 뜻이 멀어졌어도 형태 계보는 busy |
| depth | deep | 모음 교체 |
| strength | strong | 모음 교체 |
| pronunciation | pronounce | 어간이 줄어든다 |
| decision | decide | -de → -sion |
| description | describe | -be → -ption |
| maintenance | maintain | -ain → -en |
| explanation | explain | 같은 갈래 |
| curiosity | curious | -ous → -osity |
| ability | able | -le → -ility |
| stability | stable | 같은 갈래 |

**형태가 안 보여도 계보가 확실하면 쓴다.** 반대로 형태가 비슷해도 계보가 아니면 쓰지 않는다.

## `skip` — 파생어가 아닐 때

`"skip": true` 와 짧은 사유. **억지 분해가 빈칸보다 나쁘다** — 그 카드가 학습자에게 틀린 어원을 가르친다.

여기 해당하는 것들:
- **끝이 접미사처럼 보일 뿐인 낱말** — `city`(-y 아님) · `very` · `story` · `money` · `enemy` ·
  `army` · `family` · `body` · `study` · `country` · `energy` · `industry`
- **라틴·그리스에서 통째로 들어온 낱말** — 영어 안에 기본형이 없다. `education` 은 영어에 `educate` 가
  있으니 파생이지만, `nation` 의 `nate` 는 영어 낱말이 아니다 → skip.
- **기본형이 우리 사전에 없을 것 같은 것** — 있어야 키가 닿는다. 확신이 없으면 skip 하라.
- **굴절형**(복수·과거·비교급)은 파생이 아니다 — `books` · `walked` · `bigger` 는 skip.
  (`-er` 는 `teacher`(행위자)일 때만 파생이고 `bigger`(비교급)는 아니다)
- **복합어**(`something`, `however`) — 접미사 파생이 아니다.

## 판단 기준 하나

> 학습자에게 **"이 낱말은 X 에 __ 를 붙인 것"** 이라고 말해 줄 때
> 그 말이 **뜻을 이해하는 데 도움이 되는가?**

`happiness = happy + -ness` (도움됨) · `city = cit + -y` (틀렸고 해롭다) · `books = book + -s` (파생 아님)

## 부수 발견 — `note` 에

`meaning_ko` 오류 · `pos` 오기 · 표제어가 영어 낱말이 아님 · 오철자 · 같은 낱말 중복 등재.
고치지 말고 적기만 하라.

## 출력

`chunk-NN.json` 옆에 `chunk-NN.out.json`. 배열 하나. JSON 만. **모든 낱말에 대해 한 줄씩** 낸다.

```json
[
  { "word": "happiness", "base_word": "happy", "derivation_suffix": "-ness" },
  { "word": "nationality", "base_word": "national", "derivation_suffix": "-ity" },
  { "word": "city", "skip": true, "note": "-y 는 접미사가 아니다 (라틴 civitas 차용)" },
  { "word": "teacher", "base_word": "teach", "derivation_suffix": "-er" },
  { "word": "bigger", "skip": true, "note": "비교급 굴절 — 파생이 아니다" }
]
```

- ⚠️ **`base_word` 는 계열의 뿌리(root)를 가리킨다 — 한 단계 위가 아니다.**
  DB 트리거 `enforce_base_word_depth1` 이 "기본형이 다시 파생어면" 거부한다.
  `nationality` → **`nation`**(o) / `national`(x — 그것도 파생어다)
  `leadership` → **`lead`**(o) / `leader`(x) · `effectively` → **`effect`**(o) / `effective`(x)
  즉 **더 이상 쪼갤 수 없을 때까지** 내려간 낱말을 쓴다.
- 입력에 없는 낱말을 추가하지 마라. 앞뒤 설명 문장 금지.
