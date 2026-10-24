# 2023#32 — 지문 줄바꿈 하이픈 정정 + 분석 v5 인용 정정 (준비만 · 미실행)

사용자 결정(2026-10-25): 2023#32 는 published 분석 v4 의 인용 오류와 함께 처리 · 이번 단계에서는 DB UPDATE · 발행을 하지 않는다.

## 확인한 사실(SELECT · 공식 PDF)

- 공식 문제지 2023_영어영역_문제지.pdf 32번: 줄 끝 「trans-」 + 다음 줄 「missible」 → 낱말 **transmissible**(줄바꿈 하이픈). 원장(재생성)도 transmissible.
- DB `csat_items.passage`(md5 `03a62be1…`) 에 `trans-missible` 1곳.
- 분석 v4(`efb293fa-…`, published, 검수 3) `choice_analysis` ③ `lure_quote` = 「in a manner not unlike trans-missible disease」 — 인용 1곳. design_intent · solve_procedure · 저장소 강의 · 탐구 · 골격에는 없다.
- 지금은 v4 인용과 DB 지문이 서로 맞는다(둘 다 하이픈). **지문만 고치면 v4 인용이 지문에서 사라지고, v5 만 발행하면 v5 인용이 지문에 없다** → 둘은 한 트랜잭션이어야 한다.

## 순서(혼용 방지)

| 단계 | 내용 | 학습자 화면 |
|---|---|---|
| A `stage-a.sql` | v5 draft(v4 복사 · 인용 1곳만 transmissible) — 예정 choice_analysis md5 `2c95d468…`. 지문 · 검수 · 발행 없음 | 불변(v4) |
| 검수 | v5 = v4 와 인용 한 낱말만 다름(diff 로 확인) — 검수 기록 방식은 사용자 결정 | 불변 |
| B (미작성) | **한 트랜잭션**: 지문 `trans-missible → transmissible`(md5 `03a62be1…` → `839326bf…`) + v5 검수 3 + v5 published | v5 + 정정 지문 동시 |

- B 는 검수 기록 방식이 정해진 뒤 만든다(지금 만들면 검수자 값을 지어내야 한다).
- 원장 수리 기록 불필요(원장이 이미 transmissible). B 적용 뒤 재생성 원장 = DB.
- 실행은 승인형 러너(`csat-content-fix`)의 단계로만. 러너는 DB 접속 문자열(`VF_DEPLOY_DB_URL`)이 필요하다.
