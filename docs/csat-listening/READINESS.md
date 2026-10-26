# CSAT 듣기 18유형 — 자료 준비도 감사 (I1 · I2 · I9)

> 생성: `node scripts/csat/listening/audit-readiness.mjs --at <ISO>` → [readiness.json](./readiness.json) (기계 판독 정본).
> 확인만: `--check` · 테스트: `node scripts/csat/listening/__tests__/audit-readiness.test.mjs`.
> 이 문서의 수치는 2026-10-24 실행 결과다. 다시 돌리면 JSON 이 기준이다.

## 1. 집합과 단위 (재조정)

| 집합 | 파일 | 문항 | 단위·내용 |
|---|---|---|---|
| 분류 248 | `scripts/csat/data/classified.json` rows `type L-*` | 248 | 수능 14회(2014A/B 각 22 · 2015–2026 각 17). 발문만, 유형 18종 |
| 전사 272 | `scripts/csat/data/listening/*.json` (= `listening-all.json`) | 272 | 수능 2017–2023 7회 + 모평 M1906·M1909·M2109·M2206·M2209·M2306·M2309·M2406·M2409 9회 × 17 |
| 승인 102 | `scripts/csat/map/source/listening-approved.json` | 102 | M2706·2026·M2609·M2606·2025·M2509 × 17, 한글 `verifiedType` 14종, 본문 없음 |
| 정답 | `scripts/csat/data/answers.json` (+ `answers-manual.json` 2025) | 수능 14회 × 45 | 듣기 번호의 공식 정답·배점 포함. 모평 정답 없음 |
| 선택지 | — | **0** | 로컬 어디에도 듣기 선택지 없음 |
| 음원 | — | **0** | 저장소에 원음 없음(`public/audio` 는 games·sfx) |

- 합집합 **469** 문항(id 형식 `<exam>-L<NN>`, 예 `2023-L01`). 분류∩전사 **119**(2017–2023 수능), 분류∩승인 34(2025·2026).
- 이전 연구의 "248 · 272 · 18유형"은 실측과 일치. "listening_end" = `scripts/csat/lib-exam-id.mjs` `listeningEndOf` (2014 수능 22, 그 외 17) — DB `csat_exams.listening_end` 와 같은 값.
- 이전 연구 기록 위치: `D:/workspace/Vocaflow-AI-Control/runtime/g3-transfer-20261024/snapshots/research/docs/csat-learner/all-types-research-20261024/09_TYPE_F_LISTENING.md`(DATA_GAP L-G1~G10).
- 유형 체계 3종은 같은 목록이 아니다: 분류 18종 코드 · 전사 `typeGuess` 17종 · 승인 한글 14종. 대조는 `APPROVED_TO_CODE` 표로만 한다(요지→L-MAIN 등).

## 2. DB 상태 (읽기 전용, 2026-10-24)

- `csat_items` 중 `no <= listening_end` **0행**, `section='듣기'` **0행**(존재 section: 독해·장문, min(no)=18), `csat_types` 듣기 **0행**.
- 쓰기 없음. `csat_items` 에는 `choices`·`answer`·`answers`·`points` 컬럼이 있어 적재 자리는 있다.

## 3. I1 교차 대조 — 불일치

| 종류 | 건수 | 내용 |
|---|---|---|
| TYPE_CLASSIFIED_VS_TYPEGUESS | 0 | 교집합 119 에서 분류 유형 = 전사 typeGuess |
| TYPE_CLASSIFIED_VS_APPROVED | 0 | 2025·2026 34문항에서 분류 = 승인(코드 환산) |
| STEM_CLASSIFIED_VS_TRANSCRIPT | 0 | 정규화 발문 접두 일치 |
| **MEASURE_PERNO_TYPE** | **74** | `listening-measure.json perNo` 는 번호→유형을 신형(1=목적)으로 고정. 구형 배치(1·2=짧은 응답, 3=목적…) 회차 2017·2018·2019·2020·M1906·M1909 각 12건 + M2406·M2409 각 1건. **perNo 유형을 문항 유형으로 쓰면 안 된다** |
| SECTION_LABEL | 10 | 2014A/B 18–22번이 classified 에 `section:'독해'` 로 저장 — `listening_end=22` 로 듣기 |
| STEM_SPILL_INTO_TURNS | 6 | 발문 꼬리("고르시오.")가 `who:'?'` 첫 턴에 들어감: 2017-L11 · 2020-L15 · M1909-L15 · M2109-L09 · M2309-L09 · M2406-L15 |
| 정답 자동/수기 충돌 | 0 | |

- 정답 형(홀/짝) 결속: 2017–2022 정답은 **짝수형**, 2014–2016·2023·2024·2026 홀수형, 2025 단일/수기 짝수형. 전사 원본의 형은 기록 없음 → 모든 정답 `formBinding: UNVERIFIED`. 선택지가 없어 정답 번호가 어느 선택지인지 대조 불가.

## 4. I2 음원·전사 출처·권리·검수

- 전사: 출처 = 평가원 대본 PDF(`ingest-listening.mjs` pdftotext 추출, 원본은 저장소 밖). 파일 sha256 은 `readiness.json.inputs`, 문항별 `turns` sha256 은 `items[].transcript.sha256`. 검수 = **NOT_VERIFIED**(사람 대조 기록 없음). 권리 = 평가원 저작물, 서비스 노출 권리 **unverified**.
- 음원: 전 문항 `present:false · rights:"unverified" · status:DATA_GAP`. 평가원·교육청 원음은 우리가 재배포할 수 없다. 내려받지도 커밋하지도 않았다.

## 5. I9 18유형 준비도

규칙: READY_TRANSCRIPT = 전사+공식정답 ≥3 · PARTIAL = 전사 있음, 그 미만 · BLOCKED_EVIDENCE = 전사 0. **선택지·음원은 전 유형 0** 이라 READY_TRANSCRIPT 도 "UI 완성 가능"이 아니다.

| 유형 | 문항 | 전사 | 정답 | 전사+정답 | 선택지 | 음원 | DB | 상태 |
|---|---|---|---|---|---|---|---|---|
| L-PURPOSE 목적 | 28 | 16 | 15 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-OPINION 의견 | 25 | 15 | 13 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-MAIN 요지 | 9 | 2 | 3 | 0 | 0 | 0 | 0 | PARTIAL |
| L-TOPIC 주제 | 6 | 1 | 5 | 0 | 0 | 0 | 0 | PARTIAL |
| L-RELATION 관계 | 18 | 14 | 11 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-PICTURE 그림 | 28 | 16 | 15 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-TODO 할 일 | 25 | 15 | 12 | 6 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-FAVOR 부탁 | 4 | 1 | 4 | 1 | 0 | 0 | 0 | PARTIAL |
| L-MONEY 금액 | 27 | 16 | 14 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-REASON 이유 | 27 | 16 | 14 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-NOTMENTION 언급 안 됨 | 26 | 16 | 13 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-MENTIONED 언급됨 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | BLOCKED_EVIDENCE |
| L-ANNOUNCE 담화 불일치 | 28 | 16 | 15 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-TABLE 도표 | 27 | 16 | 14 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-RESPONSE 응답 | 110 | 64 | 58 | 28 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-SITUATION 상황 | 27 | 16 | 14 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-SET-TOPIC 세트 주제 | 26 | 16 | 13 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |
| L-SET-NOT 세트 불일치 | 27 | 16 | 14 | 7 | 0 | 0 | 0 | READY_TRANSCRIPT |

("문항"에는 정답만 있는 수능 2014–2016·2024–2026, 승인표만 있는 모평 4회가 포함된다.)

### BLOCKED_EVIDENCE · 사실상 차단

- **L-MENTIONED** — 전사 0(2014A-L13 하나, 대본 미확보).
- **L-MAIN · L-TOPIC** — 전사는 있으나(MAIN 2: 모평, TOPIC 1) 정답과 겹치는 문항 0.
- **L-FAVOR** — 전사+정답 1(2019-L07) 뿐, 경계 표본 부족.
- **전 유형 공통 차단**: 선택지 0 · 음원 0 · 음원 권리 unverified · 전사 검수 NOT_VERIFIED · 정답 형 결속 UNVERIFIED · L-PICTURE/L-TABLE 은 그림·표 이미지 0.
- 대본 미확보: 수능 2014A·2014B·2015·2016·2024·2025·2026, 모평 M2509·M2606·M2609·M2706.

## 6. DB 적재 후보 (적용 안 함 — 별도 사용자 승인 필요)

- 후보 **119** 문항 = 전사+공식정답(수능 2017–2023 × 17). id 목록 `readiness.json.dbLoadCandidates.ids`.
- 지금 넣으면 `choices` 는 NULL 이고 `section='듣기'` · `csat_types` 듣기 18행이 먼저 필요하다. 적재 전 선택지를 평가원 문제지에서 받아 적는 단계(드레인)가 선행돼야 의미가 있다.

## 7. 첫 실제 UI 대표 유형

선택지가 전 유형 없으므로 "검증 전사+선택지+정답" 조건을 만족하는 유형은 **현재 0**. 선택지 확보가 가장 작고 전사가 깔끔한 둘을 고른다.

1. **L-PURPOSE (목적)** — 1턴 독백(≈94어절), 선택지는 한글 5개라 받아 적기 쉽다. 후보 7: 2017-L03 · 2018-L03 · 2019-L03 · 2020-L03 · 2021-L01 · 2022-L01 · 2023-L01.
2. **L-RESPONSE (대화 응답)** — 표본 최다 28, 마지막 발화 → 응답 판단이 전사만으로 성립. 2021–2023 신형 11–14번 12문항 우선(2021-L11…2023-L14).

선행 조건: 위 문항의 선택지를 정답표와 **같은 형**의 문제지에서 확보, 전사 사람 대조, 음원 대신 사용할 합법 음성(자체 TTS 등) 결정.
