# 학습지도 v6.2 — P-F1 수요 계약 · P-F2 공급 판정 · P-F3 공장 명세(dry-run)

> 2026-10-14 · 감사 [P-F0_FACTORY_AUDIT.md](./P-F0_FACTORY_AUDIT.md) 위에서. **DB · RPC 변경 0 · 생산 · 적재 0 · 새 콘텐츠 공개 0.** 아래 「승인 계약」은 제안이며 적용하지 않았다.

## 1. 흐름(논리 계약 → 지금 구현된 범위)

`LearningMap(composeV4) → WorkspaceDemand → [재사용 공급 판정 | 공장 명세] → (WorkspaceDelivery) → LearningEvidence`

| 객체 | 구현 | 위치 |
|---|---|---|
| WorkspaceDemand | **순수 계약 · 생성기** — 단계 → 자료 역할 · 수량(계획량 또는 정본 최소) · 자격 요구 · 멱등 키(학습자 · 시각 제외) | `lib/csat/map/v62/demand.ts` |
| 공급 판정(재사용 우선) | **순수** — 검수 확인 과제 → 전이 과제 → v3 해설(노출 규칙) → 공장 재고(연습 후보) | `lib/csat/map/v62/supply.ts` |
| ContentQualification | 줄마다 A 생산 · B 권리 · C 내용 · D 교수 · E 평가 · F 학습자 · G 실행(모르면 null) | `supply.ts` `Qualification` |
| ProductOrder(공장 명세) | **dry-run 순수** — 평가원 유형 → 공장 문항 유형(`CSAT_BACKING` 뒤집기) · 기존 드레인 명령 · 공급까지의 공백 · 필요한 승인 | `lib/csat/map/v62/order-spec.ts` |
| WorkspaceDelivery(기록) | **없음** — 영속 공급 기록은 DB 승인 대상(아래). 지금은 Inspector 가 매번 계산해 보여 줄 뿐 | — |
| LearningEvidence | 기존 그대로(learning_* · skill-diagnosis) — 새 엔진 없음 | — |

Inspector 「교재 · 학습 · 계획 → 지금 단계에 필요한 자료」가 위 판정을 보인다(자료 부족 ≠ 무관 · 자료 수 ≠ 실력 문구 고정).

## 2. 같은 계약으로 R5 · E3 · V2 · S5(실측 · 기록 0 + 목표 80 화면)

| TASK | 수요 줄 | 공급 |
|---|---|---|
| R5 | 독립 확인 | 지금 쓸 수 있음 — 검수 확인 문항(미노출) |
| E2 | 독립 확인 | 지금 쓸 수 있음 |
| V2 | 독립 확인 | 공급 경로 없음 — 직접 확인 과제(검수 주석 · 채점)가 없는 TASK · 공장 재고(R-VOCAB ≈51k)는 평가 자격이 없어 대신 쓰지 않는다 |
| S5 | 독립 확인 | 같음(공장 R-GRAMMAR 15,258) |
| L · X | 없음(보류) | — |

바로잡기 단계(확정 뒤)에는 원문 분석 · 모델 설명(v3 해설 · 노출 규칙) · 지도 연습(공장 재고 = 「검수 전 후보」) 줄이 생긴다.

## 3. 시나리오 대응(단위 테스트 `v62/__tests__/demand-supply.test.ts` · `order-spec.test.ts`)

| 사례 | 결과 |
|---|---|
| A R5 기존 자료 재사용 | 독립 확인 = 검수 확인 문항 · 새 생산 0 |
| B V2 자료 부족 | 공장 재고 있음 → 「검수 전 후보」(평가 · 실행 자격 false) · 독립 확인은 「경로 없음」 — 결손 · 무관으로 바꾸지 않음 |
| C 해설 본 지문의 독립 확인 | 미노출 목록 밖 → 공급 안 함 |
| D 요구 변경 | 멱등 키에 목표 · 계획 버전 포함 → 다른 수요. 이전 결과를 덮지 않음(저장 자체가 없음) |
| E 검수 실패 | 자격 필드 false/null 로 「공급 가능」에서 빠짐 |
| F 저장 · 동시성 · 권한 | 수요 · 공급을 저장하지 않으므로 이번 범위 밖 — 계획 저장은 P-M2b 그대로 |
| 「생성 중」 | 쓰지 않는다 — 영속 주문 · 작업 큐가 없다(테스트 고정) |

## 4. 승인 계약(제안 · 적용 안 함)

| 변경 | 목적 | 대상 | 영향 · 되돌리기 |
|---|---|---|---|
| ① 영속 주문 · 공급 기록 | 수요 → 주문 → 산출물 → 공급을 추적(관리 화면 연결) | 새 표 `workspace_content_demand`(key · user · workspace · 버전 · lines jsonb · 상태) · `workspace_content_delivery`(demand_key · 산출물 ref · revision · 역할 · 자격 jsonb · 시각) · RLS 본인 읽기 · 쓰기 service_role | 새 표만 · 기존 데이터 불변 · 되돌리기 = 표 삭제 |
| ② 문항 단위 자격 | 공장 문항을 TASK 적합 · 권리 · 검수 상태로 공급 판정 | `csat_dcp_items` 에 `qualification jsonb`(널 허용) 또는 별도 표 | 열 추가 · 기존 행 null |
| ③ 학습자 노출 = 발행 승인 | 감사에서 찾은 결함(교재 화면이 발행 결정을 보지 않음) | `textbook_practice_items` · 서가 RPC 에 `textbook_volume_renders.status='published'` 조건 | 지금 발행 19권 전부 published 라 즉시 영향 0 · 되돌리기 = 함수 이전 정의 |
| ④ 실제 생산 | V2/S5 지도 연습 문항 생성 · 적재 | 드레인 실행(비용 · 대량 적재) | 승인 · 체크포인트(`/db-checkpoint`) 뒤 |

승인 전에도 진행 가능: 수요 · 공급 · 명세의 순수 계약과 화면 표시(이번 범위), 관리 화면에 dry-run 명세 보이기.
