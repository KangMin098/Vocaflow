# 동기화 불일치 534건 — 분류와 처리 (2026-10-24, 집계 정정)

## 534 와 536

534 는 **문항 ID** 수(형식 266 + 내용 268), 536 은 **판정 행** 수(형식 266 + 판정 270)다. 판정은 필드(passage · choices) 단위라 두 문항이 행 두 개씩이다. 중복 ID · 누락 ID 는 0(268 ID 전부 판정, 판정 밖 ID 0).

| 문항 | passage | choices |
|---|---|---|
| 2023#32 | DB_ERROR(하이픈 trans-missible 잔존) | DB_CORRECT(원장 쪽번호 잔여) |
| M2606#27 | BOTH_DIFF(표 읽기 순서) | DB_CORRECT(원장 쪽번호 · 공백) |

## ID 단위 분류 (534)

| 분류 | ID 수 | 처리 |
|---|---|---|
| 형식 차이(정규화 해시 같음) | 266 | 반영 안 함 — DB 유지, 동기화 가드 보호 |
| 내용 차이 · 전 필드 DB_CORRECT | 264 | 수리 기록 |
| 내용 차이 · 일부 DB_CORRECT + DB_ERROR | 1 (2023#32) | choices 만 수리 기록 · passage 는 DB 정정 후보 |
| 내용 차이 · 일부 DB_CORRECT + BOTH_DIFF | 1 (M2606#27) | choices 만 수리 기록 · passage 별도 후보 |
| 내용 차이 · BOTH_DIFF | 2 (2014B#36 · 2017#42) | 별도 후보 |

수리 기록 266 건 = 264 + 2(부분). `kice-source-repairs.json` 총 267(기존 3 + 추가 264 + 기존 항목 병합 2 — 2017#24 · 2018#24). 커밋 7a5e89811 · 로컬 main 병합 94e227dd0.

## 재대조 (재생성 원장 ↔ DB, SELECT)

801 문항: same 531 · format_only 267 · content 3(2014B#36 · 2017#42 · M2606#27 — 모두 passage).
format_only 267 = 원래 형식 266 + 2023#32(passage 차이가 하이픈뿐이라 정규화 뒤 같음 → 내용 → 형식으로 이동). 상태 이동 1 건 외 집계 오류 없음.
수리 테스트 `scripts/csat/__tests__/source-repair*.test.mjs` 16/16. DB 쓰기 없음.
