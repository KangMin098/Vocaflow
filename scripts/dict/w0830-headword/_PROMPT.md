# D0830-T7 — 표제어 판정

앞 배치들(예문·갈래·연어)이 **"이건 예문으로는 못 고친다"** 며 넘긴 낱말들이다.
예문을 아무리 잘 써도 **표제어 자체가 틀렸으면** 그 문장이 틀린 낱말을 가르친다.

## ⚠️ 이 배치는 아무것도 지우지 않는다

**판정만 한다.** 지우는 것은 사람이 정한다 — 이 낱말들은 이미 **발행 단어장에 실려 있고**
(실측 160개 / 발행 세트 1,331개), 지우면 학습자 화면의 단어장에 구멍이 난다.

당신의 일은 **무엇이 진짜 결함인지 확정하는 것**뿐이다.

## 판정값 (`verdict`)

| 값 | 뜻 | 예 |
|---|---|---|
| `ok` | **결함이 아니다.** 멀쩡한 표제어다 | `awake` · `environment` · `crop` |
| `misspelling` | 오철자 | `epicopal`(episcopal) · `clich`(cliché) · `beseige` · `nickle` · `miniscule` |
| `fragment` | 관용구·합성어의 조각. 홀로 안 쓰인다 | `nilly`(willy-nilly) · `pocus`(hocus-pocus) · `topsy`·`turvy` · `bona`(bona fide) |
| `foreign` | 영어 낱말이 아니다 (라틴·프랑스어 등) | `casus` · `mutandis` · `infinitum` · `laissez` · `qui` · `vous` |
| `inflection` | 굴절형이 표제어로 올라 있다 | `marched` · `slagged` · `smelted` · `beefed` |
| `ocr` | 스캔 오독으로 생긴 없는 낱말 | `eduldamer` · `peles` |
| `unusable` | 낱말은 맞지만 **학습자에게 낼 수 없다** | `klux` (인종차별 단체명 조각) |

## ⚠️ `ok` 를 아끼지 마라 — 모집단에 오탐이 섞여 있다

`why` 는 앞 배치들의 **자유 서술에서 기계로 뽑은 것**이라 정확하지 않다.
실제로 `acclaim` · `agency` · `apply` 같은 멀쩡한 낱말이 섞여 들어온 적이 있다.

**낱말을 보고 판단하라. `why` 는 참고일 뿐이다.**
영어 사전에 표제어로 실릴 만한 낱말이면 `ok` 다.

경계에서는 **`ok` 쪽으로.** 잘못 `ok` 하면 결함이 남을 뿐이지만,
잘못 결함 판정하면 **멀쩡한 낱말이 학습자 단어장에서 빠질 후보가 된다.**

### `ok` 로 봐야 하는 것들

- **영어에 정착한 외래어** — `apex` · `genera` · `papillae` · `via` 처럼 영어 문장에서 그냥 쓰이면 `ok`.
  (`casus` · `mutandis` 처럼 라틴어 구 안에서만 나타나면 `foreign`)
- **드물지만 실재하는 낱말** — `acclivity`(오르막) · `admix` · `fulminate` 는 어렵지만 영어다.
- **전문 용어** — `anorectal` · `optoelectronic` · `strabismus` 는 학술 영어다.
- **영국·방언 용법** — `bevvy` · `bodge` · `stonk` 는 비격식이지만 영어다.

## `correct` — 고칠 형태를 아는 경우만

`misspelling` 이면 옳은 철자를, `inflection` 이면 원형을 적는다. 모르면 생략한다.

```json
{ "word": "beseige", "verdict": "misspelling", "correct": "besiege", "reason": "i 와 e 순서가 바뀐 오철자" }
{ "word": "marched", "verdict": "inflection", "correct": "march", "reason": "march 의 과거형" }
```

## `reason` — `ok` 가 아니면 반드시

왜 결함인지 한 줄. **사유 없는 결함 판정은 apply 가 거부한다** — 근거 없이
학습자 단어장에서 낱말을 빼자고 제안할 수는 없다.

## 출력

`chunk-NN.json` 옆에 `chunk-NN.out.json`. 배열 하나. JSON 만.
**입력의 모든 낱말에 한 줄씩** (`ok` 도 한 줄이다).

```json
[
  { "word": "epicopal", "verdict": "misspelling", "correct": "episcopal", "reason": "s 가 빠진 오철자" },
  { "word": "nilly", "verdict": "fragment", "reason": "willy-nilly 안에서만 나타난다" },
  { "word": "laissez", "verdict": "foreign", "reason": "프랑스어. laissez-faire 구 안에서만" },
  { "word": "awake", "verdict": "ok" },
  { "word": "klux", "verdict": "unusable", "reason": "낱말이 아니라 인종차별 단체명 조각. 중립 예문이 존재할 수 없다" }
]
```

- `verdict` 는 위 7개 중 하나. 다른 값은 apply 가 거부한다.
- 입력에 없는 낱말을 추가하지 마라. 앞뒤 설명 문장 금지.
