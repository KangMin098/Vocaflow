# 충돌 해결 · 34번 이관 차이분석 · 독립 검증 근거와 이견

T-0138 · DRAFT — 독립 검증 전. 산출물 6·7·9.

## 1. 연구 ↔ 기존 제품·문서 충돌 해결 기록

판정 원칙: 사용자 결정 > 공식 독립 수용 기록 > 이번에 직접 재확인한 사실 > 연구 문서 인용. 연구 문서 원문은 고치지 않고 이 표로 정본을 정한다.

| # | 충돌 | 해결 | 근거 |
|---|---|---|---|
| K1 | 정답 공개: R12 §4-A 「LOCKED→COMMITTED→REVEALED」 강제 순서 vs 사용자 결정 1 | **결정 1 채택.** 순서 강제 없음, 공개는 학습자 선택. `COMMITTED`는 공개 단계가 아니라 기록 사건(`independent_attempt`)으로 흡수 | R14 결정 1 |
| K2 | 공개 단계 이름: v4 `RELATION_FEEDBACK` · v6 `RELATION_EXPLANATION` · R12 3단 | v6 4단계 이름으로 통일 | v6 §4.2 |
| K3 | main에 자동 장면 전환이 있는가: R00 "main에는 없음" vs R12 E1 "있음" | **있음.** main `e3e0a6a0e`의 `AnalysisTheater.tsx:851`, `LectureStage.tsx:303` 이번에 직접 확인. R00의 "main"은 design/replica-first 브랜치였음 | git grep(2026-10-24) |
| K4 | 정답 직접 낭독 범위: 3 cue vs 전 회차 | **전 회차.** main 강의 대본 29개 모두 「정답은」 23~30회 — 이번에 직접 계수 | git show 계수 |
| K5 | 공개 분석 없는 문항: S0 183 vs 302 | **302**(분석 없음 119 + in_review만 183). 3은 STALE | R03 · R12 §2 |
| K6 | 34 선지 전문 "미확보"(S1 LECTURE_CONTRACT) vs DB 5개 | "DB 보유 · 공식 원지 대조·학습자 노출 미검증"으로 읽는다. T-0136 R1에서 공식 문제지·정답표 해시 대조는 수행(정답 34③) | R02 CC-08 · T-0136 |
| K7 | 듣기 전사 S0 "UNKNOWN" vs 272 | **272 존재**, 검수·권리 NOT_VERIFIED | R00 §1.2 c |
| K8 | R-CHART·R-GRAMMAR 준비도(R01 DESIGNABLE vs R08) | **R08 채택**: CHART BLOCKED, GRAMMAR PARTIAL. body_ok는 도표·밑줄 자산 유무를 재지 않음 | R00 §1.2 g·h |
| K9 | `csat_items_public.answer` authenticated 노출: R03 P1 "결함 의심" vs 사용자 결정 2 | **정책 부합으로 종결.** UI 표시 통제는 별도 계약(01 B7) | R14 결정 2 |
| K10 | F08: R04 C1~C12 판정표 vs T-0136 F08_EVALUATION v1.0 | **T-0136 절차가 정본**(공식 수용). R04 C1~C12는 측정 항목 입력으로 참조. 공통 결론: IMPROVE는 기존 Shell을 실제 고친 구현으로 측정해야 함 | T-0136 R2 ACCEPT |
| K11 | 26 교수 모델 = 유형별 판단 도구? | **아니다.** 화면은 relation 1문장 + 불리언 2개만 소비. 모델은 도구 설계의 데이터 입력이며, 재사용 여부는 F01~F05 결정에서만 다룸 | R04 §1.1 · R12 P0-5 |
| K12 | 강의 스크롤: T-0136 이관 명세 "자동 cue 스크롤 억제" vs LC 구현 "재생 시작 시 따라가기 켜짐" | **run 2 정정: 기본 수동.** 재생 시작·계속·재시도는 따라가기를 암묵적으로 켜지 않는다. 따라가기는 학습자의 명시 선택만. LC의 `start()`→following은 보완 대상(run 1의 조건부 허용 판단 철회) | G3 §5(T-0137 ACCEPT) · 01 C2 |
| K13 | 34② 진위: 분석 `unknown` vs 강의 c7·c10 "거짓"류 | 분석 우선, 강의 cue는 감수 대기. 정답 기준 변경 없음 | R12 §4-C |
| K14 | 38⑤ these 범위 | C1 후보(4~7 포괄)는 두 독립 판독과 공식 원문 대조로 지지되나 콘텐츠 승인 전. 표시 계약은 T-0136 D1 | R02 · T-0136 |
| K15 | 단계형 세션(`SessionRunner` 고정 순서·`scrollTo(0,0)`) vs v6 "장면은 필수 절차 아님" | 세션 러너가 문항 분석 경로와 별도인지 **DATA_GAP**. 이 계약은 `/csat/item/[slug]` 분석 경로에 적용 | R04 §2 |
| K17 | 강의 공개 태그: run 1 "태그 0, 신규 전수 태깅" vs G1 sidecar v1 존재 | **sidecar 존재 인정, 제품 미승인.** 연구 자료 CONDITIONAL·내용 CONTENT_REVIEW_REQUIRED·제품 CONDITIONAL로 분리, S2-c를 기존 sidecar 보완·승인·적용으로 변경 | 공식 반려 T138-CUE-01 · 05 §1 |
| K18 | 자동 공개 경계(R1/R2/R7) = 정답 전 구간? | **아니다.** 경계보다 앞선 2인 합의 DECISIVE/ANSWER 34 cue — 단일 지목·한 cue 소거 완결·역할 순서 낭독 등. 34개 모두 OFFICIAL_ANSWER 동급 경계 | T138-CUE-02 · 05 §2 |
| K19 | 공개 수준 3값 vs 5값, UNKNOWN 처리 | **5값 + UNKNOWN fail-closed + 런타임 노출 이력**. 콘텐츠 수준과 학습자 공개 단계는 다른 축 | T138-CUE-03 · 05 §3 |
| K16 | 삽입·순서·무관 공통화 | 삽입·순서만 이음매 공통, 무관 제외, X-ORDER UNDETERMINED | R12 §4-B |

## 2. 34번 제품 이관 차이분석

기준: T-0136 수용 `PRODUCT_TRANSFER_2026_34.md` v1.0(@`81d6732b2`) + **G3 DELTA(T-0137, `fb6bf663e`, 2026-10-24 Claude 공식 리뷰 ACCEPT·COMPLETED)**. 아래는 G3로 갱신한 대조다. G3 수용 범위는 차이분석 문서이며 제품 구현 아님.

| 항목 | 이관 명세(T-0136) | G1 연구·사용자 결정이 더한 것 | 통합 결정 |
|---|---|---|---|
| 공개 범위 | 정답 공개 후(`OFFICIAL_ANSWER`) 분석만. SOURCE_ONLY는 별도 서버 필터 전 비활성 | 결정 1: 학습자 선택 4단계, 강의 cue 공개 안내(B6), 단일 공개 출처(B3) | G3 DELTA §4로 상세화(ACCEPT): 자유 3경로·선지 선택 강제 없음·access와 exposure 분리. 강의 공개 게이트는 05 §3 계약과 sidecar 승인 뒤 별도 단계(그 전에는 UNKNOWN fail-closed) |
| F07 강의 | 재생·viewer 상태 분리, 자동 cue 스크롤 억제 | LC `0e36138e3`가 같은 파일에 일부 구현. G3가 잔여 4건 확인(start 암묵 따라가기·본문 click→jump·following 중 details 재열림·pickScene 일시정지) | **순서 고정**: LC 채택·보완 판단을 `LectureStage`를 바꾸는 이관 단계보다 먼저(G3 리뷰 P2-R1). 정책은 K12(기본 수동) |
| F04 명제 비교 | ①/③ 동시 대조, ② unknown 보존 | D1 3값 필수(R00 C-1) | 일치 |
| F05 원리·한계 | 저장 basis·limitation 구분 | 강의 원리가 `when_not`을 생략하는 사례(34 c1·c12·c6·c9) | 화면 원리는 분석 `when_not` 포함. 강의 원리 문구는 감수 대기 cue로 표시 |
| 34② 강의 | 다루지 않음 | c7·c10 진위 과잉 단정 | 감수 대기 cue 표시 계약 추가(원본 수정 없음) |
| 기록 | check=1 보존, 활동≠숙달 | 결정 1 R5 기록 4종 | 01 E 표로 정렬. 시도 전/후 저장 가능 여부 조사 선행(스키마 변경 시 승인) |
| 화면 상태 | 6종 | 302/3 수치 정정 | 01 F4 |
| 전역 단축키 | (명세 미언급) | ←/→ 전역 바인딩과 목록 충돌 가능, main 문항 화면은 `keys={false}` 추정 | 이관 테스트에 포함(런타임 확인) |
| 2026#38 choices 데이터 | (범위 밖) | 본문 조각·각주 혼입(CC-07) | 34 이관과 무관, 38 확장 전 데이터 보정(DB 쓰기 승인) |

## 3. 독립 검증 근거

| 대상 | 검증자 | 판정 | 범위 |
|---|---|---|---|
| S0 R01~R08 | Codex 하위 검토자 | DL-0201 수용(@68633c195) | 메타 등록·공백 보고 |
| T-0134 S1 대안 검증 | Claude 독립 검토 | 판정 REJECT(V1 비교 불공정) — 검토 파일만, TASK 완료는 Codex 계열 리뷰어 | `T-0134-claude-independent-review-20261023.md` |
| T-0135 선정 | Claude 교차 모델 | 판정 PARTIAL(F08·38 C1) — 검토 파일만, TASK 완료는 Codex 계열 리뷰어 | `T-0135-claude-crossmodel-review-20261024.md` |
| T-0136 R2 | Claude 공식 리뷰어 `csat-v4-s0-claude-review` | **ACCEPT(제한)** · COMPLETED @81d6732b2 | D1 표시 계약 · D2 절차 · 34 이관 설계 |
| G1 연구 통합(00) | 연구 내 독립 통합 에이전트 J + 교차 심사 11 | 연구 산출물(공식 수용 아님) | 00~10 |
| LC 강의 학습자 제어 | 연구 15·18·19·20 독립 검증 | R1~R4 PARTIAL(P0/P1 0), 최신 `0e36138e3` **재검증 없음**, 실계정 E2E BLOCKED | `feat/lecture-learner-control` |
| G3 34 이관 차이분석 | Claude 공식 리뷰어 `csat-v4-s0-claude-review` | **ACCEPT · COMPLETED** @`fb6bf663e`(P2 3) | `g3-transfer-20261024/` |
| G1 연구 전체 | 별도 Codex `csat-g1-codex-review` | T-0139 **REVIEW 대기**(작성자 재현 증거 E01만, 독립 판정 없음). 이전 a518bef7c 범위 Codex 검증은 PARTIAL | `research/csat-all-types-20261024`@`810a463ac` |
| T-0138 run 1 cue 공개 | Codex `csat-s1-codex-review` | **PARTIAL → 반려**(T138-CUE-01·02·03 P1) → run 2 보정 | 이 문서 |

이 문서(T-0138)의 독립 검증자는 owner `csat-s1-codex-review`(Codex, 작성 미참여)로 등록돼 있다.

## 4. 남은 이견 (해결하지 않고 보존)

| ID | 이견 | 입장 A | 입장 B | 결정에 필요한 것 |
|---|---|---|---|---|
| Q1 | (해소) 따라가기 기본값 | — | — | K12 run 2 정정으로 기본 수동 채택. 남은 것은 LC 코드 보완과 실계정 E2E |
| Q2 | F08 작업면 | IMPROVE 3면(원문 동시 대조) | REPLACE 2면(판단 면적) | F08_EVALUATION 절차 실측(실제 PDF·사용자 4명) |
| Q3 | 34② 진위 | 분석 unknown | 강의 거짓 | 작성 미참여 감수자의 원문 대조 판정 |
| Q4 | 22③ 진위 `true` | "협력을 과소평가하기 쉽다" ≈ "less collaborative" | 동일성 미검증(CC-09) | 내용 감수 |
| Q5 | X-ORDER 공통화 | 사건 순서도 이음매 | 공통화 근거 문항 분석 없음 | X-ORDER 실제 문항 분석 |
| Q6 | retired 4 처리 | 현행 유형에 흡수 | 별도 보관 | 사용자 판단 |
| Q7 | 듣기 분류 정본 | 18(classified) | 17·14 | 사용자/DB 적재 승인 |
| Q8 | 강의 차례 문법 T1~T8 채택 | 전 유형 공통 문법 | 유형별 차례 | 강의 재저작 승인 + 학습자 관찰 |
