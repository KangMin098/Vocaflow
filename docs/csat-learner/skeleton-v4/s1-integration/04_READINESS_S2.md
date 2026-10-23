# 구현 준비도 · 우선순위 · S2 제한 착수 후보 (G5)

T-0138 · DRAFT — 독립 검증 전. 산출물 8·10.

## 상태 정의 (구현·학습 효과 PASS와 다름)

| 상태 | 뜻 | 부여 조건 |
|---|---|---|
| `DESIGN_ACCEPTED` | 설계가 공식 독립 수용됨 | AI-Control 리뷰어의 ACCEPT/COMPLETED 기록 있음 |
| `READY_FOR_SCOPED_IMPLEMENTATION` | 범위를 정한 구현 착수 가능 | DESIGN_ACCEPTED + 필요한 데이터 존재 + 미승인 콘텐츠 비사용 + 파일 소유 충돌 없음 |
| `CONDITIONAL` | 설계·구현 근거는 있으나 명시한 조건 충족 전 | 조건을 표에 적음 |
| `BLOCKED_EVIDENCE` | 데이터·권한·실측 증거 없이는 진행 불가 | 해제 증거를 표에 적음 |
| `CONTENT_REVIEW_REQUIRED` | 기능과 무관하게 콘텐츠 감수·승인 필요 | — |
| `NOT_VERIFIED` | 실행·관찰하지 않음 | RLS·실계정·TTS·PDF·스크린리더·색 대비·학습 효과 |

이번 T-0138은 아직 독립 수용 전이므로, 아래에서 `DESIGN_ACCEPTED`는 **이전 공식 수용(T-0136)** 근거가 있는 항목에만 쓴다.

## 1. 기능 준비도 (F01~F10)

| F | 기능 | 상태 | 근거 / 조건 |
|---|---|---|---|
| F01 | 발문·한정 → 근거 | **READY_FOR_SCOPED_IMPLEMENTATION**(2026-34, 공개 후) | T-0136 DESIGN_ACCEPTED · 데이터 있음 · 이관 명세 2단계 |
| F03 | 근거 ↔ 선지 왕복, UNREGISTERED | **READY_FOR_SCOPED_IMPLEMENTATION**(2026-34) | 동일 · 이관 명세 3단계 |
| F04 | 완성 명제 비교(3값) | **READY_FOR_SCOPED_IMPLEMENTATION**(2026-34) | 동일 · ② unknown 보존 |
| F05 | 원리·적용 한계 | **READY_FOR_SCOPED_IMPLEMENTATION**(2026-34) | 동일 · 원리는 `when_not` 포함 |
| F07 | 강의 재생·탐색 독립 | **CONDITIONAL** | 설계 DESIGN_ACCEPTED(T-0136) · 상세 계약 G3(T-0137 ACCEPT). 구현 후보 `feat/lecture-learner-control`@`0e36138e3`(main 미통합). 조건: start()의 암묵 따라가기·본문 click→jump·following 중 details 재열림·pickScene 일시정지 보완 · AnalysisTheater 장착 하네스 · 실계정 E2E(계정 없음, BLOCKED) · 독립 재검증 · 사용자 main 통합 확인 |
| F07b-연구 | 강의 cue 공개 수준 연구 자료 | **CONDITIONAL** | sidecar v1 @`810a463ac` 존재·원본 결속 확인·경계 전 2,849 cue 2인 검수(일치 0.8498 < 0.85, κ 0.701). 불일치 428·누적 UNKNOWN 739·조기 공개 후보 34(05 §2) |
| F07b-내용 | cue별 공개 의미 정확성·안전 구간 | **CONTENT_REVIEW_REQUIRED** | 불일치 재판정·근거 인용 품질 보완·결정성 재검토 4 · `promoted` 1,888은 승인 아님 |
| F07b-제품 | 공개 게이트 제품 적용(05 §3) | **CONDITIONAL**(실행 게이트 BLOCKED_EVIDENCE) | sidecar 승인 · 투영 loader · 전 채널 경계 · 런타임 노출 이력 · jump/skip 검증 전 READY 아님. 현재 제품은 sidecar를 읽지 않음 |
| F07b-효과 | 학습 효과 | NOT_EVALUATED | — |
| F08 | 작업면 배치 | **CONDITIONAL**(미선정) | F08_EVALUATION v1.0 실측: 실제 로컬 PDF · 정상 인증 · 사용자 4명 |
| F02 | 원문·의미(로컬 PDF) | **BLOCKED_EVIDENCE** | 원지 sha·크롭 좌표·정상 권한·가독성 화면 |
| F06 | 실기출 비교 | **BLOCKED_EVIDENCE** | 실계정 HTTP/RLS 비공개 차단 관측 · source_hash 결속 · 비교 주장 검수 |
| F09 | 학습지도 왕복 | **BLOCKED_EVIDENCE** | 정상 계정 왕복 · 활동 전후 숙달 불변 DB 조회 |
| F10 | 듣기 | **BLOCKED_EVIDENCE** | 권리 확인 원음 · 선지·정답 · 전사·화자·시간 결속 |
| — | 화면 상태 6종(01 F4) | **CONDITIONAL** | 설계는 T-0136 명세에 포함(수용). 302·3 실측 반영. 조건: 이관 1단계 서버 DTO와 함께 구현 |
| — | 기록 분리(01 E) | **CONDITIONAL** | 현재 저장 구조 조사(NOT_VERIFIED) → 스키마 변경이면 SQL 승인 |

## 2. 유형 준비도와 우선순위

순위 근거는 데이터 준비도·기존 검수 자산·충돌 수다. **학습 효과 우위가 아니다.**

| 순위 | 유형 | 상태 | 조건 / 차단 |
|---|---|---|---|
| 1 | R-BLANK(2026-34 한 문항) | READY_FOR_SCOPED_IMPLEMENTATION | 공개 후 범위 · 강의 34 c4~c10 공개·감수 계약 미구현 상태로는 강의 결합 금지 |
| 2 | R-GIST · R-TOPIC · R-TITLE · X-TITLE · R-CLAIM · R-PURPOSE | CONDITIONAL | 설계 연구(R05)만 있음, 공식 수용 없음. 조건: T-ROLE 도구 설계 수용 · 22③ 내용 감수(Q4) |
| 3 | R-INSERT · R-ORDER | CONDITIONAL + CONTENT_REVIEW_REQUIRED(2026-38 ⑤) | T-SEAM 수용 · C1 승인 전 38⑤ 학습자 보류 · 2026#38 choices 데이터 보정 |
| 4 | R-IMPLY · R-IRRELEVANT · X-REFER | CONDITIONAL | 표본 1~소수 → 대표·경계 분석 보강 |
| 5 | R-FACT · X-FACT · R-NOTICE · R-VOCAB · X-VOCAB | CONDITIONAL | 선지↔근거 정렬 · 밑줄 낱말 추출 데이터 |
| 6 | R-MOOD | CONDITIONAL | 상세설계(R13) 있음 · 전환점·단서 span 주석(검수 필요) · 하위형 분리 · 공식 수용 없음 |
| 7 | R-SUMMARY · R-GRAMMAR | BLOCKED_EVIDENCE(부분) | bodyOK 29/130 · 밑줄 경계 — 데이터 보정(DB 쓰기 승인) |
| 8 | R-CHART | BLOCKED_EVIDENCE | 도표 이미지·수치 0 |
| 9 | 듣기 18 | BLOCKED_EVIDENCE | F10 |
| — | retired 4 · 미분류 16 | 보관 / 승인 대기 | Q6 · DB 재분류 승인 |

콘텐츠 감수 대상(`CONTENT_REVIEW_REQUIRED`): 2026-38 ⑤(C1) · 2026-34 강의 c7·c10(진위) · 6+6 강의 수정 후보 · 22③ 진위 · 전 회차 강의 마무리 원리(과잉 일반화 일괄 미측정).

미검증(`NOT_VERIFIED`): 정상 로그인·RLS · 실제 로컬 PDF · 실제 TTS · 색 대비 · 스크린리더 · 전체 키보드 경로 · 학습자 사용성 · 이해·전이·성적 효과.

## 3. S2 제한 착수 후보

S1 설계 수용(T-0138 독립 검증) 후에 사용자 승인으로 범위를 정한다. 아래는 후보이며 승인이 아니다.

| 후보 | 범위 | 선행 조건 | 하지 않는 것 |
|---|---|---|---|
| S2-a 강의 학습자 제어 main 반영 | `feat/lecture-learner-control`@`0e36138e3`(main 위 6커밋·5파일) + G3 §5 잔여 보완 4건 | 보완 후 독립 재검증 · AnalysisTheater 장착 하네스 · 실계정 E2E(계정 비밀번호 필요) · 사용자 main 통합 확인 | 공개 게이트·대본 수정 |
| S2-b 2026-34 공개 후 4기능 | G3 DELTA §8 단계 0·3·4(결속, F01·F03, F04·F05) | S2-a 확정 이후 같은 파일 위에서 · 화면 상태 6종 동시 · `LectureStage`를 바꾸는 단계 1은 S2-a 채택 판단 뒤 | F08 배치 확정 · 강의 공개 게이트 · 38번 |
| S2-c **기존 cue sidecar의 품질 보완·독립 검수·승인·제한적 제품 적용** | ① `810a463ac` sidecar·원본 blob·cue hash·정답 출처 고정 → ② 불일치 428·누적 UNKNOWN 739·비승격 961·결정성 재검토 4 재판정, 근거 인용 보완, 조기 공개 패턴(05 §2) 검출 추가 → ③ 일치율 원비율로 재판정(0.85 기준이면 현재 0.8498 미충족, 사후 기준 완화 금지) → ④ 5값·4단계·누적·노출 이력 단일 계약(05 §3) → ⑤ 승인된 투영만 제한 적용, 원본 변경·해시 불일치·jump/skip·READ/TTS/강조/ARIA 경계 검증 | 기존 2,849 검수분은 재사용, 10,131 cue 전수 재태깅은 하지 않음(품질 평가 후 필요 범위만) · 승인 · 적용은 코드 작업이라 별도 범위 승인 | 원본 대본 JSON 키 추가(필수 아님) · 대본 문구 수정 · main 통합 자동 승인 |
| S2-d 유형 준비도 SELECT 정례화 | 44유형 행·0의 원인 표시(읽기 전용 산출) | 없음(DB SELECT만) | DB 쓰기 |

착수 불가: S2 전체 · main 통합(S2-a 조건 충족 전) · F02/F06/F09/F10 · R-CHART · 듣기 · 38⑤ 학습자 노출 · 미승인 강의 문구 반영 · DB 재분류·데이터 보정(승인 전).
