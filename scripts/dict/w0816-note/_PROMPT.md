# T9 — `korean_learner_note` 채우기

플래시카드에서 뜻 아래 한 줄로 붙는 **한국인 학습자 전용 주의사항**입니다.
**뜻을 다시 말하면 안 됩니다** — `meaning_ko` 가 이미 바로 위에 있습니다.
**한국인이 이 단어에서 실제로 틀리는 지점**을 짚습니다.

## 유형 — 그 단어에 실제로 해당하는 것 하나

| # | 유형 | 실제로 쓰인 사례 |
|---|---|---|
| 1 | 혼동어 | `affect/effect` · `principal/principle` · `epistle/apostle` · `specie/species` |
| 2 | 한국어 직역 함정 | "파이팅!"은 영어로 안 통함(→Good luck!) · "우리 남편"→`our husband`(x) · 이메일 첨부는 `enclosure` 가 아니라 `attachment` · `counter-productive` 는 "무익"이 아니라 "반대 결과" |
| 3 | 연어 제약 | `make a decision`(o)/`do a decision`(x) · `play the piano` vs `play chess` · `heavy drinker` |
| 4 | 가산·불가산 / 단복수 | `advice` · `information` · 공항 세관은 늘 `customs` · `a pair of boots` |
| 5 | 전치사 고정 | `depend on` · `dissuade from` · `discuss about`(x) · `arrive at/in` |
| 6 | 자동사/타동사 | `marry with`(x) · `trespass the land`(x) · `encircle`·`woo` 는 전치사 금지 |
| 7 | 어순·구조 | `enough` 후치 · `I know him for ten years`(x)→현재완료 · `so/such` |
| 8 | 격식·시대 제약 | 고어(`-eth`·`thou` 계열) / 문어 전용 / 현대 대체형 / 멸칭 위험 |
| 9 | 발음·강세 | `colonel`=`kernel` · `record` 명사/동사 강세 · `singer` 는 `finger` 와 달리 g 무음 |

## 규칙
- **한국어로**, 10~140자. 한 문장 또는 짧은 두 문장.
- 뜻(`meaning_ko`)을 그대로 복사하면 게이트가 거부합니다.
- **구체적일 것.** "자주 틀리니 주의하세요" 같은 빈 말 금지 — **틀린 형태와 맞는 형태를 실제로 보여주세요.**
- 어투: 담담하고 도움이 되게. 비난·압박 금지 (Vocaflow 는 학습 중 자극을 최소화합니다).
- `cefr`·`v`(V-Level 0~11)에 수준을 맞추세요. A1/A2 단어에 C1 문법 용어를 쓰지 마세요.

## skip
한국인 특유의 함정이 **정말로** 없으면 `"skip": true`. 억지 note 는 skip 보다 나쁩니다 —
카드 공간을 낭비하고 학습자 신뢰를 깎습니다.
다만 **skip 은 마지막 수단입니다.** 초기 배치에서 240단어 중 203개를 skip 한 에이전트가 있었는데
과했습니다. **동사·형용사·전치사·구동사는 대부분 짚을 것이 있습니다.**
진짜로 없는 건 학명 · 문화 고유명사 · 순수 전문용어 · 자명한 구체명사뿐입니다.

## 부수 발견 — `note_defect` 에 (자동 수정 안 함)
`meaning_ko` 오류·잘림 · `pos` 오기(예문과 품사 불일치) · 오철자·비표준형 표제어
(`androcentricism`→androcentrism · `conservativism`→conservatism · `flewed`= 아동 오류형) ·
난이도(cefr↔v) 불일치 · 표제어가 영어 단어가 아님(`le`).

## 출력
입력과 **같은 순서·같은 개수**의 배열:
```json
{ "word": "<입력 word 그대로>", "korean_learner_note": "…", "note_defect": "(선택)" }
```
skip: `{ "word": "...", "skip": true }`

**청크 하나를 끝낼 때마다 즉시 그 `.out.json` 을 쓰세요.**

검증: JSON 파싱 OK · 입력과 단어 수·순서 일치 · 모든 note 10~140자 + 한글 포함 ·
`meaning_ko` 그대로 복사한 것 0건. DB·git 은 건드리지 마세요.

## 보고 (한국어)
`note NN-MM: 작성 N · skip M` · 유형(1~9) 분포 · **가장 값어치 있는 note 5개**(왜 그 단어에서
한국인이 틀리는지) · `note_defect` 목록.
