# F4b — 강의 낭독 서수 ↔ cue target 불일치 원인 분류 (2026-10-24)

읽기 전용 조사. 강의 JSON·DB는 고치지 않았다. DB는 `jajenrevcbmrpaliomxv` 의 `csat_items.passage` 를 SELECT 로만 읽었다. 스캔 스크립트는 OS temp 에 두었고 저장소에는 쓰지 않았다.

## 0. 결속

- 정본: main `e3e0a6a0e` `apps/web/src/lib/csat/lecture-data/*.json` 29개 파일, 강의 796편. 문지도는 같은 커밋의 `skeleton-data/*.json` 이다.
- blob sha 앞 12자리:

| 파일 | 강의 | blob |
|---|---|---|
| 2014A.json | 23 | `744571882d61` |
| 2014B.json | 23 | `4bf0dcd42297` |
| 2015.json | 28 | `cee17d5ff431` |
| 2016.json | 28 | `1a629d4605c4` |
| 2017.json | 27 | `185a1cf2ee8b` |
| 2018.json | 27 | `675216fcbf94` |
| 2019.json | 28 | `24726293b285` |
| 2020.json | 28 | `31e3ab0bbb97` |
| 2021.json | 28 | `718232b7f91d` |
| 2022.json | 28 | `25fa1308fb9c` |
| 2023.json | 28 | `2e7d5cdcc94a` |
| 2024.json | 27 | `5d34c29813e7` |
| 2025.json | 28 | `fd7a383ce1ff` |
| 2026.json | 27 | `69a70a433f46` |
| M1809.json | 28 | `01b3b852c048` |
| M2006.json | 28 | `084ece565457` |
| M2106.json | 28 | `35dd6e553f39` |
| M2109.json | 28 | `51956b2fbc41` |
| M2206.json | 28 | `313a248cee31` |
| M2209.json | 28 | `e5aefa5bbc40` |
| M2306.json | 28 | `7eeb1f8b54fd` |
| M2309.json | 28 | `49c8e9f8104a` |
| M2406.json | 27 | `701f32140b27` |
| M2409.json | 28 | `82d1533fb32a` |
| M2506.json | 28 | `55aa68177b67` |
| M2509.json | 28 | `51e603ac3bba` |
| M2606.json | 27 | `5210254661fe` |
| M2609.json | 28 | `1c72a8bcbf0e` |
| M2706.json | 28 | `61e39db9cfc1` |

## 1. target 구조와 문장 분할 정본 (main `e3e0a6a0e`)

- cue target: `{kind:'anchor', id:'sentence:k'}` 이고 k 는 **0부터 센다**. 정의는 `lib/csat/lecture/types.ts:44-51`(주석 「k번째 막대, 0부터」)에 있다.
- 가리킬 수 있는 막대 수는 `lecture/targets.ts:55` 가 정한다. 골격 문장 수만큼 `sentence:0..n-1` 이다.
- 문장 분할은 `lib/csat/passage-skeleton.ts:96` `splitSentences` 가 맡는다. 약어 처리, 「대문자·따옴표·괄호·①~⑳」 다음에서만 끊는 규칙이 여기 있다. `scripts/csat/build-skeleton-data.mjs` 가 DB `csat_items.passage` 를 이 함수로 잘라 `skeleton-data/*.json` 을 굽는다. 결과는 문장별 chars와 reveals이며 원문 글자는 들어가지 않는다.
- 화면 라벨은 `lib/csat/theater.ts:80-82` `stepName` 이 만든다. `sentence:k` 를 `${k+1}번째 문장` 으로 보여 주므로 화면은 1부터 센다.
- 분석 블록 cue 는 `lecture/focus.ts:50` `cueFocus`, `:39` `spokenSentenceIndices` 를 쓴다. 말한 「N번째 문장」을 N-1 로 바꿔 지도에 켠다.
- 검사기 `lecture/validate.ts:97-107`(`spokenHereOrdinals`, 「여기 N번째 문장」만 셈)와 `:208-210` legacy `pointing`(`k+1 === n`)이 이미 있다. 하지만 이 검사는 **드레인 import(`scripts/csat-lecture/drain-import.mts:160`)와 `final-checks.mts:99` 에서만** 돈다. 저장소 회귀 테스트에는 들어 있지 않다.
- 현재 저장소 가드 `__tests__/lecture-spoken-ordinal.test.ts` 는 말한 번호가 **문장 수를 넘는지**만 본다. 서수와 target 이 같은지는 검사하지 않는다.
- 드레인 export(`apps/web/scripts/csat-lecture/drain-export.mts:143`)는 대본 작가에게 문장을 `{k, text}`, 즉 0부터 센 번호로 준다. 작가가 1부터 세는 서수로 바꿔 말해야 하는 구조다.

## 2. 전량 스캔 (796강의)

- 방법: ko-KR segment 에서 `(여기)? <수사>(번째)? 문장` 을 1~39까지 찾았다. 「열네·스물세」 같은 수사도 포함한다. anchor cue 가운데 말한 서수 중 하나도 k+1 과 같지 않은 cue 를 후보로 삼았다.
- 「번째 선지·칸·단락·줄」은 따로 셌고 후보에서 뺐다. 「마지막 문장」은 세지 않았다.
- 결과:

| 항목 | 값 |
|---|---|
| anchor cue | 2,590 |
| 「N 문장」 서수가 있는 anchor cue | 2,458 |
| **후보(서수 ≠ k+1)** | **172** |
| 그중 「여기 N」 형이면서 차이 −1 | 142 |
| 문지도 범위 밖 target | 0 |
| 장문 43~45 / 41~42 / 그 밖 | 146 / 3 / 23 |

- drain 재대조(D1ab·D1cd·D1e)의 계수는 약 136이었다. 이번에는 D1f 범위(M2509·M2606·M2609·M2706, 33건)와 「여기」 없는 서수까지 넣었다.

## 3. 원인 분류

판정 기준: DB 지문을 `splitSentences` 와 같은 규칙으로 잘랐다. 정규식 근사이며, 막대 길이가 skeleton chars 와 같은지로 정렬을 확인했다. 그 결과로 target 막대 문장과 낭독 번호 문장 가운데 cue 설명에 맞는 쪽을 봤다.

| 분류 | 수 | 근거 | 신뢰도 |
|---|---|---|---|
| **(B) 음성 서수 오류** — target 은 맞고 낭독 번호가 1 작음 | **143** | 수동 23 + 규칙 120 | 수동 23/23 B. 규칙(장문 · 「여기 N」 · 차이 −1)은 높음 |
| **(A) 문장 분할 차이** — 문지도가 합치거나 쪼갬 | **12** | 수동 5 + 규칙 7 | 2015#34 높음. 안내문(notice) 10은 중간(A/B 경계) |
| (C) 화면 강조 오류 — 낭독은 맞고 target 이 틀림 | **0** | 수동 표본에서 0 | 표본 39건 중 0 |
| **(D) 오탐** — 보조 서수, 단락 안 상대 서수, 「두 문장」 개수 | **17** | 수동 11 + 규칙 6 | 높음 |

**확정 결함은 155건이다(B 143 + A 12).** 수동으로 원문과 대조해 확인한 결함은 28건이다(B 23, A 5). 나머지 127건은 규칙으로 분류했다. 장문 B 143건은 25개 회차에 퍼져 있다. 2014A 9 · 2026 9 · M2609 9 · M2706 10 · M2206 8 · M2506 8 · M2606 8 · 나머지 1~6건씩이다.

### 3-1. (B) 근본 원인 — 번호 옮기기 도구가 대본을 고치지 않았다

`apps/web/scripts/csat-learner/remap-lecture-sentences.mts`(06c43f7f4, 2026-09-25) 머리 주석은 이렇게 적는다. 「쪽 번호가 붙어 한 문장으로 셌던 곳이 두 문장 … 장문 43~45 · 29회차 전부 +1」.

이 도구는 `sentence:k` 만 +1 로 옮겼다. 대본의 「여기 N번째 문장」은 옛 번호 그대로 남았고, `--write` 경로는 `validateLecture` 를 다시 돌리지 않았다. 그래서 import 때는 통과했던 `pointing` 규칙이 지금 적재본에서 142건 깨져 있다.

방증:
- 장문 후보의 차이가 전부 −1 이다. 세트 앞쪽 한 곳에서 문장이 하나 늘었다는 뜻이다.
- `2025#43 c5` 는 「아홉 번째 문장 뒷부분」이라고 말하고, target 은 sentence:9 「(B) Ethan and Grace came back…」이다. 옛 분할에서 두 문장이 한 막대였던 흔적이다.
- `M2706#43 c2` 는 「에이의 끝과 비의 첫머리가 한 칸에 붙어」라고 말한다. 하지만 현재 막대 6 「So, Sally walked closer.」와 막대 7 「(B) The following day…」은 따로 떨어져 있다. 서수뿐 아니라 이 문장 내용도 낡았다.

수동 확인 B 23건. target 막대 문장이 cue 설명과 맞고, 낭독 번호(=k)의 막대는 맞지 않았다.

| cue | target 막대 머리(≤40자) | cue 설명 |
|---|---|---|
| 2014A#43 c4 | (D) My grandmother liked to tell me | 고국 이야기들을 되받죠 |
| 2014A#43 c5 | Right at that moment, it hit upon me | 가르치기로 하죠 |
| 2014A#43 c6 | (C) My efforts were rewarded | 그 노력 |
| 2014A#43 c11 | The morals of (e) her stories | 교훈 |
| 2014A#45 c7 | While listening to the stories, I decided | 결심한 주어 |
| 2015#43 c4 | (C) After graduation, Jeremy joined | 졸업 뒤로 이어받죠 |
| 2017#45 c6 | The pianist looked out at him | 빗속의 에릭을 내다본 |
| 2018#43 c4 | (C) After class, Steve spotted Dave | 수업 뒤 데이브에게 |
| 2018#43 c6 | Looking at Steve, Dave felt the need | 사과해야겠다 |
| 2018#44 c11 | (c) His dad laughed | 소유격 뒤 아빠 |
| 2019#44 c4 | Olivia realized (e) she was right. | 깨달은 주체 |
| 2019#44 c5 | The butterflies help us grow | 나비가 … 키우게 |
| 2019#44 c11 | Relieved, (d) she and Ellie | 안심한 그녀 |
| 2021#45 c5 | Felix was studying science using a video | 영상으로 과학 공부 |
| 2021#45 c11 | He's just watching a funny video. | 웃긴 영상만 본다 |
| 2023#43 c6 | When he opened it, he discovered a pair of gl… | 안경 소개 |
| 2025#43 c5 | (B) Ethan and Grace came back home | 재킷을 들고 귀가 |
| M2606#44 c4 | Meanwhile, Laura found some strawberry jam | 딸기잼 발견 |
| M2609#45 c5 | (B) Several hours later, Mike's favorite | 비 단락 첫머리 |
| M2706#43 c2 | (B) The following day | 시간 표지(+낡은 「붙어」) |
| M2706#43 c4 | Are you going to listen to my performance | 공연 들을 거냐 |
| M2706#45 c5 | Beatrice had said, "You just have no | 베아트리스의 말 |
| 2014A#43 c11/c12 계열 | (위와 같은 세트, 같은 방향) | — |

판정 보류(규칙상 B로 넣음): 2017#45 c12, M2706#45 c11. 머리 45자만으로는 cue 내용(「울림 부족」, 「앉자 연주를 멈추」)이 어느 막대인지 확정되지 않았다.

### 3-2. (A) 문장 분할 차이 12

- **2015#34 c6 · c11**: 막대 4가 264자로 두 문장이 합쳐져 있고, 막대 5는 「(A) (B)」 7자 조각이다. 대본의 「여섯 번째」는 실제 지문의 6번째 문장이다. 알려진 D1a-04 와 같은 건이다.
- **안내문 10** — 2019#28 ×3, M2106#27 ×3, M2109#28 ×4: 안내문의 머리줄·번호 목록이 문장 분할을 흐트러뜨린다.
  - M2106#27: 막대 9가 「Operation 1.」 12자 조각이다. 낭독 「아홉 번째」는 이 조각을 빼고 센 번호이고, target 10 「Play - Touch Tommy's right ear」이 cue 설명과 맞는다.
  - M2109#28: 막대 끝에 「… 3.」 같은 목록 번호가 붙는다.
  - 2019#28: 「Caution: ∙ Do not place…」이 막대 6이다.
  - 이 10건은 target 이 내용과 맞고 서수만 어긋나므로 B로도 볼 수 있다. 다만 원인이 「안내문 줄은 문장이 아니다」라는 분할 규칙에 있으므로 A로 분류했다. 신뢰도는 중간이다.

### 3-3. (D) 오탐 17

- 보조 서수, 즉 다른 문장을 덧붙여 언급한 경우: 2018#44 c12 「스물여섯 번째 문장에는」, M2109#44 c11, M2206#41 c6(「마지막 문장」 = target, 보조 「열한 번째」 = 막대 10 「Historically, privacy was…」 일치), M1809#20 c6.
- 단락 안 상대 서수: 2026#36 c2·c4, M2706#37 c5·c6 「비의 첫 문장」, M2106#44 c12, 2020#20 c7, M2609#38 c5.
- 「여기 N 번째 칸」으로 가리키고 다른 문장 번호를 언급한 경우: 2019#19 c6, M2106#19 c7, M2209#19 c7.
- 개수 표현: 2022#29 c3 「두 문장이 묶여」. 이 cue 는 「일곱 번째 막대」 = k6 으로 일치한다.
- 「여기 마지막 문장」: M2109#41 c11, M2409#41 c12. 마지막 막대가 맞는다.

## 4. 수정 경로 후보 (원본 수정 안 함)

1. **B 143 일괄 정정.** 대본 서수를 target 에 맞춘다. 「여기 N」 → 「여기 (k+1)」로 바꾸되 한 번에 한 cue 씩 한다. M2706#43 c2 처럼 「붙어」 류 낡은 설명 문장도 함께 고친다. 도구는 `remap-lecture-circled-split.mts` 의 패턴을 따른다. 그 도구는 「말한 번호 N-1 이 범위 안이면 그쪽」 규칙으로 target 을 말에 맞춘다. 이번에는 방향을 반대로, 대본을 target 에 맞추도록 확장한다. 바꾼 뒤 `withFocus` 를 다시 계산하고 `validateLecture` 를 돌려야 한다. 수사 생성은 `focus.ts` ORDINALS의 역표를 쓴다.
2. **0/1 기준 통일.** 저장은 0부터(`sentence:k`), 말과 화면은 1부터(`stepName` k+1)로 유지한다. drain-export 청크의 `{k, text}` 에 `n: k+1`(말할 번호)을 함께 실어, 작가가 직접 변환하지 않게 한다.
3. **회귀 가드.** `lecture-spoken-ordinal.test.ts` 옆에 `lecture-pointing.test.ts` 를 둔다.
   - 모든 lecture-data 에 `validateLecture` 의 legacy `pointing`, 즉 「여기 N번째 문장」 ↔ `sentence:N-1` 검사를 그대로 돌린다. 같은 함수를 import 해서 두 벌이 생기지 않게 한다.
   - 원장(PENDING)은 지금 이 문서의 B 143 + A 12 로 시작하고, 양방향으로 지킨다.
   - 번호 옮기기 도구(`remap-*`)는 `--write` 전에 `validateLecture` 를 통과해야 쓰도록 바꾼다. 이번 원인을 직접 막는 조치다.
   - 「여기」 없는 서수는 보조 언급이 많아 오탐 17이 났으므로 가드에 넣지 않는다.
4. **A 12.** 안내문(R-NOTICE류) 분할 규칙에 목록 번호(「1.」 「3.」)와 머리줄을 따로 처리할지는 별도 결정이 필요하다. 2015#34 는 D1a-04 로 이미 추적 중이다.
