# D5 — 듣기 분류 248 × 전사 272 결속 감사

> 연구 산출물(읽기 전용). 작성: Claude 서브에이전트 D5, 2026-10-24. 내부 검토만, 공식 독립 수용 아님.
> 기준 문서: `37f8b7219:…/09_TYPE_F_LISTENING.md`(이하 09) §0·§1, `03_VERSION_AND_DATA_CONTRACTS.md`(이하 03) §46·§48·§59.

## 0. 두 집합의 정의 (실측)

| 집합 | 파일 (main 작업트리 = 37f8b7219 blob 동일 경로) | 정의 | 필드 |
|---|---|---|---|
| **C248** 분류 | `scripts/csat/data/classified.json` `rows` 630행 중 `type` 이 `L-` 로 시작 | 14회(수능 2014A·2014B·2015~2026), 문항 248 | `exam,no,stem,high_score,section,from_block,stem_truncated,type,hit_count,hits` — 발문만 |
| **T272** 전사 | `scripts/csat/data/listening-all.json` `items` | 16회 × 17 = 272 (`rejected=[]`, `failed=[]`) | `exam,no,stem,turns[{who,text}],script,words,nTurns,speakers,isDialogue,typeGuess,typeGuessAll` |
| **A102** 승인(참고) | `scripts/csat/map/source/listening-approved.json` (approvedAt 2026-10-02) | 6회 × 17 = 102, `verifiedType` 14종, sha256만 | 대본·음원 없음 |
| DB | `csat_exams`·`csat_items` (SELECT) | 듣기 구간(`no<=listening_end`) 행 수 | 아래 §3 |

## 1. 비교 계산 (재현 명령)

스크립트: 스크래치 `a.mjs`(작성자 OS temp, 저장소 밖). 결속 키 = `exam + '#' + no`. 핵심 로직:

```js
const C=classified.rows.filter(r=>String(r.type).startsWith('L-'));
const L=listeningAll.items; const key=r=>r.exam+'#'+r.no;
// 교집합·차집합, 발문 앞 15자(공백 제거) 일치, typeGuess===type
```

| 수치 | 값 |
|---|---|
| C248 고유 키 | 248 (중복 0) |
| T272 고유 키 | 272 (중복 0) |
| **C ∩ T** | **119** |
| C − T (분류만, 전사 없음) | **129** |
| T − C (전사만, 분류 행 없음) | **153** |
| 교집합 발문 일치 | 119/119 (불일치 0) |
| 교집합 `typeGuess === type` | 119/119 |
| A102 ∩ C | 34 (2025·2026) — `type→verifiedType` 매핑 14쌍 전부 일관(예 `L-MAIN→요지` 2, `L-RESPONSE→대화 응답` 8) |
| A102 ∩ T | **0** |

회차 분포: C = 2014A 22 · 2014B 22 · 2015~2026 각 17. T = 2017~2023 각 17 + M1906·M1909·M2109·M2206·M2209·M2306·M2309·M2406·M2409 각 17.
→ 교집합 119 = 수능 2017~2023 7회 × 17. **09 §0-3 의 119/129 를 재현함 = KNOWN(09 §0)**.

## 2. 불일치 원인 분류

| ID | 원인 | 규모 | 근거 | 심각도 | 신규/KNOWN |
|---|---|---|---|---|---|
| D5-01 | **회차 범위 차이(대본 미확보)**: 수능 2014A·2014B·2015·2016·2024·2025·2026 은 전사 없음 | 129 | §1 회차 분포 | P2(콘텐츠 준비도) | KNOWN(09 §0-3) |
| D5-02 | **분류 범위 차이**: 모평 9회 전사 153문항은 classified 에 행이 없음(classified scope 가 수능만) → 유형은 `typeGuess`(정규식 추정)뿐 | 153 | §1 | P2 | 신규(수치) |
| D5-03 | **번호 체계 1-22 vs 1-17**: 2014A/B 는 듣기 1~22(`listening_end=22`), 18~22 의 10행이 classified 에서 `section:'독해'` 로 표기 | 10 | C section 분포 듣기 238 / 독해 10, `no>17` 목록 2014A·B #18~22 | P2(번호 17 하드코딩 시 누락·오분류) | KNOWN(09 §0 표) |
| D5-04 | **같은 문항 다른 ID**: 교집합에서 키 충돌·발문 불일치 0건. ID 체계는 세 소스 모두 `exam`(예 `2017`, `M2109`) + `no` 로 동일 | 0 | §1 | — | 신규(부재 확인) |
| D5-05 | **분류 체계 3종 불일치**: classified 18종(L-*) · listening-all `typeGuess` 17종(L-MENTIONED 없음) · approved 한국어 14종 | — | typeGuess 분포 L-FAVOR 1·L-TOPIC 1·L-MAIN 2 | P2 | KNOWN(09 §0-4, AT23) |
| D5-06 | **회차가 DB 에 없음**: T272 의 M1906·M1909(34문항)는 `csat_exams` 에 id 없음 → DB 결속 불가 | 34 | csat_exams SELECT 결과 | P2 | 신규 |
| D5-07 | **DB 듣기 문항 행 0**: 모든 회차에서 `csat_items` 중 `no<=listening_end` 행 0 → 선지·정답·type_id 결속 대상이 DB 에 없음 | 전 회차 | §3 SQL | P1(듣기 제품화 전제 부재, 격리 환경 아닌 실 DB) | 신규(DB 실측) — 09 §0-7 의 "선지·정답 0"을 DB 로 확인 |
| D5-08 | **화자 미상 턴**: `who:'?'` 턴 57개(57문항), 대부분 지문 표기. 화자 M 1,030 / W 1,030 | 57 | §1 스크립트 | P3 | KNOWN(09 §1 C, L-G5) |

## 3. DB 실측 (SELECT)

```sql
select e.id, e.listening_end,
  count(i.id) filter (where i.no<=e.listening_end) li,
  count(i.id) filter (where i.no<=e.listening_end and i.answer is not null) ans
from csat_exams e left join csat_items i on i.exam_id=e.id group by 1,2;
```
결과: 회차 136개 전부 li=0·ans=0. `listening_end` 22 는 2014A·2014B 뿐(KNOWN 09 §0). M1906·M1909 행 없음.

## 4. 항목별 결속 속성 (교집합 119 기준)

| 속성 | 상태 |
|---|---|
| 문항 ID·회차 | 일치(`exam#no`) — 확인 |
| 원문 출처 | 전사 = 평가원 PDF 추출로 추정, 출처 URL·해시 필드 없음 → NOT_VERIFIED |
| 전사 | 있음 119 (검수 기록 없음, NOT_VERIFIED) |
| 화자·발화 구간 | 턴 단위 `who/text`만. **시간 코드 0** → 구간은 턴 idx 로만 |
| 정답·선지 | 파일 0 · DB 0 → DATA_GAP |
| 원음 | `apps/web/public/audio` = `games`·`sfx`뿐 → 0, DATA_GAP(AUDIO) KNOWN(09 §0-6) |
| 권리·공개 | 문서·필드 없음 → DATA_GAP(RIGHTS) KNOWN(03 §59 BLOCKED) |
| 교수설계 구현 범위 | 전사 기반 턴 지목·전사 대조까지만 가능(내부 실험). 시험조건 청취·정답 채점·오답 근거는 불가 |

## 5. 듣기 18유형 — 설계 상태 × 콘텐츠 준비도

설계 상태 = 09 §2 이후 유형 절에서 다뤘는지(09 는 18유형을 묶음 F1~F7 으로 설계). 준비도 = 문항 수. 전사 열은 C∩T, `?턴` = 그중 `who:'?'` 포함 문항.

| 유형 | C 문항 | 설계 상태(09) | 전사 | ?턴 | 선지 | 정답 | 원음 |
|---|---|---|---|---|---|---|---|
| L-RESPONSE | 58 | 설계됨(응답 묶음) | 28 | 14 | 0 | 0 | 0 |
| L-PURPOSE | 15 | 설계됨 | 7 | 0 | 0 | 0 | 0 |
| L-PICTURE | 15 | 설계됨(이미지 DATA_GAP) | 7 | 0 | 0 | 0 | 0 |
| L-ANNOUNCE | 15 | 설계됨 | 7 | 1 | 0 | 0 | 0 |
| L-REASON | 14 | 설계됨 | 7 | 2 | 0 | 0 | 0 |
| L-MONEY | 14 | 설계됨 | 7 | 0 | 0 | 0 | 0 |
| L-TABLE | 14 | 설계됨(표 이미지 DATA_GAP) | 7 | 0 | 0 | 0 | 0 |
| L-SITUATION | 14 | 설계됨 | 7 | 6 | 0 | 0 | 0 |
| L-SET-NOT | 14 | 설계됨 | 7 | 0 | 0 | 0 | 0 |
| L-OPINION | 13 | 설계됨 | 7 | 0 | 0 | 0 | 0 |
| L-NOTMENTION | 13 | 설계됨 | 7 | 1 | 0 | 0 | 0 |
| L-SET-TOPIC | 13 | 설계됨 | 7 | 0 | 0 | 0 | 0 |
| L-TODO | 12 | 설계됨 | 6 | 0 | 0 | 0 | 0 |
| L-RELATION | 11 | 설계됨 | 7 | 1 | 0 | 0 | 0 |
| L-TOPIC | 5 | 설계됨(표본 0) | **0** | 0 | 0 | 0 | 0 |
| L-FAVOR | 4 | 설계됨 | 1 | 0 | 0 | 0 | 0 |
| L-MAIN | 3 | 설계됨(표본 0) | **0** | 0 | 0 | 0 | 0 |
| L-MENTIONED | 1 | 설계됨(경계 표본 DATA_GAP) | **0** | 0 | 0 | 0 | 0 |
| 합계 | 248 | 18/18 | 119 | 34 | 0 | 0 | 0 |

"설계됨"은 09 문서에 유형 절이 있다는 뜻일 뿐이고, 원음·정답이 없어 학습자 검증은 0건이다. T−C 153(모평) 은 `typeGuess` 만 있어 위 표에 넣지 않았다(분류 미검증).

**판정**: 전사·선지·정답·원음 4개를 모두 갖춘 문항은 **0/248**. 내용 추정·생성은 하지 않았다.

## 조사 범위(실제로 본 개수)

- classified rows 630 중 L-* 248 전수 · listening-all items 272 전수 · approved items 102 전수.
- DB: `csat_exams` 136회 × `csat_items` 듣기 구간 집계 SELECT 1회 + 컬럼 조회 1회.
- 09 §0·§1, 03 의 듣기 관련 줄 읽음. 전사 본문 의미 대조는 하지 않음(키·발문 앞 15자만).

## 완료/부분/미완료

- 완료: 교집합·차집합 수치, 원인 분류, 18유형 표, DB 결속 확인.
- 부분: 화자 귀속 정확도(`?` 수만 셈, M/W 오귀속은 판정 안 함).
- 미완료: 원음·권리 자료 저장소 밖 탐색(다른 worktree 는 `public/audio` 만 확인 안 함).

## 미검증

- 전사 텍스트의 원문 일치(PDF 대조) — NOT_VERIFIED.
- 모평 153문항 `typeGuess` 정확도 — NOT_VERIFIED.
- 평가원 음원 이용 권리 — UNKNOWN.
