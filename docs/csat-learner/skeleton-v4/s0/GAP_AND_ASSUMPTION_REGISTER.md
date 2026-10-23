# CSAT v4.0 S0 — GAP_AND_ASSUMPTION_REGISTER

- 2026-10-23 · T-0131 · 상태: `DATA_GAP`(자료 없음) · `UNVERIFIED`(있으나 정확성 미검증) · `MISMATCH`(두 정본 불일치) · `BLOCKED`(권한) · `ASSUMPTION`(이 S0가 둔 가정).

## 1. 데이터 공백

| ID | 내용 | 근거 | 상태 | 영향 |
|---|---|---|---|---|
| GAP-D01 | 듣기 문항·원음·전사·화자·시간 구간 전무 | `csat_items` 듣기 0, 시험당 선언 45 vs 적재 28; 코드에 오디오/전사 모델 없음 | DATA_GAP | S5 전체, AT16 |
| GAP-D02 | `csat_types`에 L-* 18행 없음(규칙표에는 있음) | `classify-types.mjs:42-61` vs DB 26행 | MISMATCH | 원장 재시드 시 DB 쓰기 승인 필요 |
| GAP-D03 | body_ok 낮음: R-SUMMARY 29/130, R-BLANK 354/527 | DB | UNVERIFIED(파서 기준 탓인지 본문 결함인지 미판정) | 원문 표시 신뢰 |
| GAP-D04 | 미분류 16(네모 어법 4 · 불일치 1 · 요약 2 · 발문 파싱 실패 9) | DB | UNMAPPED | AT17 커버리지 99.57% |
| GAP-D05 | R-CHART 학평 103건 분석 없음 | DB | DATA_GAP | |
| GAP-D06 | 학평 2,912문항에 v3·강의·비교·의미 0 | 파일 집계 | DATA_GAP | 탐구 화면은 수능·모평 한정 |
| GAP-D07 | 도표 셀·실용문 필드 구조 모델 없음(원본 크롭 이미지 의존) | `reflow.ts:38`, `ItemScreen.tsx:65-72` | DATA_GAP | CHART_CELL 근거 불가 |
| GAP-D08 | 삽입 위치 전용 타입 없음(① 기호가 본문에 인라인, 선지 배열은 본문 조각) | `reflow.ts:93-100`, 2026#38 choices | DATA_GAP | AT02·AT09 |
| GAP-D09 | schema3 강의 0 → 강의가 분석 v5·units_hash에 결속되지 않음 | `lecture/types.ts:105-163`, 데이터에 schemaVersion 3 없음 | DATA_GAP | AT10·AT12 |
| GAP-D10 | 수능·모평 published 분석 `units_hash` 전부 NULL | DB | UNVERIFIED | 근거 위치 결속 |
| GAP-D11 | 최신 판 in_review 186(183 stale 노출) | DB | stale | R-CLAIM 75·R-BLANK 106 |
| GAP-D12 | 학평 R-INSERT units 불일치 21 | DB | MISMATCH | 위치 강조 중지 필요 |
| GAP-D13 | A7(듣기 해독)은 유형 가중치 0, 문항 역량 3,558이 type_default 상속 | `csat_dx_type_attribute`, `csat_dx_item_attribute` | ASSUMPTION(기본값=문항 역량) | 진단 해석 |

## 2. 정확성 미검증

| ID | 내용 | 상태 |
|---|---|---|
| GAP-V01 | 공식 정답 대조: `has_answer_key` true 133/134, 출처 대조 기록은 S0에서 확인 안 함 | UNVERIFIED(CORE-01: "저장된 정답 정보·대조 필요") |
| GAP-V02 | 강의 796의 내용 감수 — AI 루브릭 점수만 | UNVERIFIED |
| GAP-V03 | 비교 749쌍 검수 기록 없음 | UNVERIFIED |
| GAP-V04 | v3 786 `verified`는 파일 주장 | UNVERIFIED(DB 근거 없음) |
| GAP-V05 | 응답 통계는 사설 집계(공식값 아님), verified 5,670/5,715 | 출처 표기 유지 |
| GAP-V06 | 2026-34·22·38 원문 PDF 1:1 대조 미실시 | UNVERIFIED — CONTENT_VALIDATED 금지 |
| GAP-V07 | 34 c4 강의에 "정답은 삼 번" 직접 발화, 38 c1 간접 암시 | 공개 위험 실재(REPRESENTATIVE §3) |

## 3. 권한·PDF·TTS

| ID | 내용 | 상태 |
|---|---|---|
| GAP-P01 | 비교 짝이 정적 JSON import — 짝별 공개/권한 필드 없음, 비공개 본문 미전송 보장 불가 | UNVERIFIED(CORE-07, AT13) |
| GAP-P02 | `csat_items_public`이 authenticated에게 `answer` 노출 | 기존 설계(정답 키 노출). 공개 매트릭스(AT05)와 충돌 여부 S1 판정 |
| GAP-P03 | 정상 로그인/RLS 실화면 미실행(S0는 service 권한 MCP SELECT) | UNVERIFIED |
| GAP-P04 | 로컬 PDF pdfMatch 실측 미실행 | UNVERIFIED |
| GAP-P05 | TTS는 브라우저 Web Speech — 음성 가용성·실패 처리 실측 미실행 | UNVERIFIED |
| GAP-P06 | `20261018120100_r5_delivery_g2_binding.sql` 머리말이 "보류(적용 안 함)"인데 migrations/에 있음 | ASSUMPTION — 적용 여부는 S1에서 `list_migrations` 대조 |
| GAP-P07 | DB 보안 advisor: `public.textbook_shelf_stats_meta` RLS 꺼짐(CSAT 무관, 발견 보고만) | 사용자 판단 필요 — 수정 안 함 |
| BLOCKED | 없음 — S0 범위 SELECT·파일 읽기는 모두 허용됨 | |

## 4. 이 S0의 가정

- ASM-01 판단 기능(J-*)·증거 매체(M-*)를 DB 유형에 대응시킨 표는 설계 추정이다(사실 아님).
- ASM-02 R01~R19/L01~L07 ↔ DB 유형 대응은 로드맵 초안 이름 기준 추정이다. R18/R19 장문 분할은 로드맵 설명 기준.
- ASM-03 "강의 색인 유형"을 v3·비교 유형 집계에 사용(강의 없는 문항 11건은 유형 미상).
- ASM-04 듣기 문항 수 ≈ 2,278은 시험당 17 가정의 산술이며 실측 아님.
