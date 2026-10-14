# 학습지도 v6.2 — P-F0 Workspace ↔ 교재공장 계약 감사

> 2026-10-14 · 기준 main(PR #249 병합본) · 읽기 전용(코드 · 마이그레이션 · 개발 DB 집계). **이 문서는 감사이며 구현 완료 보고가 아니다.**

## 0. 지시의 전제와 실제 저장소의 차이(먼저 읽을 것)

| 지시의 전제 | 실제 |
|---|---|
| P01~P20 제품 유형 · Product Order 정본 | **없다.** `ProductOrder` · `product_type` · `product_orders` 코드 · 테이블 0. 병합 보고서(2026-09-06)가 「완료」라 적은 `product-model.ts` · `product-view.ts` 는 지금 없다(카탈로그 작업에 흡수) |
| Academic Reading 계약(원문 · 각색 · 학년 · 난도 · Gold) | **계약은 없다.** 각색 드레인 · V-level 추정 · 출처 적격성은 있으나 Gold 검수는 없다 |
| 주문이 DB 에 영속 | **아니다.** `/admin/csat/new` 「새 교재 만들기」(OrderWizard, 4걸음)는 CLI 명령 · Claude Code 프롬프트 조립기다 — 저장 · 주문 목록 · 주문 상태 없음 |
| 8공정 / 9공정 | 코드 `FACTORY_STAGES` 9개(evidence · market · blueprint · source · author · explain · review · press · operate), 주석은 「8칸」. 관리 사이드바 「여덟 걸음」은 쉬운 말 9걸음. 권별 생산 6단계 · 출처 6단계 · 발주 4걸음은 각각 다른 집합 — 하나로 맞추지 않았다 |

## 1. As-Is — 실제로 도는 경로(사람 · Claude 가 명령을 차례로 실행, 자동 오케스트레이터 없음)

| 단계 | 실행 | 기록 |
|---|---|---|
| 원천 | `csat_source_pipeline_live()` · `source-pipeline.ts` | `csat_source_eligibility`(usable/excerpt/…/blocked · policy_version · 이력) · `library_articles.license_class` |
| 각색 | `scripts/textbook/adapt-drain-*` | `library_articles`(adapted_from_id · article_v_level) |
| 문항 | `store-new-types.mjs` · `write-drain-*` | `csat_dcp_items`(type · payload · answer_key · v_level) |
| 해설 | `explain-fill.mjs` · `explain-drain-*` | `csat_dcp_items` |
| 검수 | `item-review-drain-import.mjs` | `csat_item_reviews`(문항 × 페르소나) |
| 조판 | `render-volume.mjs` | `textbook_volume_renders`((series, band) · status) |
| 발행 | `/admin/csat/press` 서버 액션 | `csat_pipeline_approvals` · `textbook_volume_renders.status=published` |
| 학습자 | `/library/textbooks/…` · RPC `textbook_practice_items` | `user_textbook_selections` |

**생산 단위 = 권(series × step/band)** — 시리즈 3(reading · vocab · syntax) × 단계 7, 권당 60문항 · 단원당 6. 지문 · 활동 하나를 주문하는 경로는 없다(행은 있으나 주문 단위가 아님).

### 1-1. 재고 실측(개발 DB · `csat_dcp_items` 834,311행)

| 유형(평가원 대응) | 수 | 학습지도 TASK 후보 |
|---|---|---|
| vocab_choice(R-VOCAB) | ≈51,060(추정 집계) | V2 문맥 의미 |
| grammar_choice(R-GRAMMAR) | 15,258 | S5 형태 · 의미 범위(어법 판정 — S5 의 일부일 뿐) |
| topic · title · main_point · claim(R-TOPIC 등) | 413 · 395 · 82 · 42 | R5 · E3 |
| blank(R-BLANK) | 446 | E2 · R6 |
| order · insert · irrelevant | 88,539 · 121,923 · 15,493 | R2 · R4 |

발행 권 19개(`textbook_volume_renders` 전부 `published`).

### 1-2. 감사에서 나온 결함 · 공백

- **학습자 교재 화면이 발행 결정을 보지 않는다** — `/library/textbooks` 는 재고 · 목차 스냅샷으로 「준비됨」을 정하고 `textbook_volume_renders.status` · 승인을 읽지 않는다(안내 문구 「누르지 않으면 나가지 않아요」와 불일치). 고치려면 RPC 변경 = 승인 대상.
- 문항 행에 버전 · 권리 · 검수 상태 열이 없다(권리는 지문 단위 `license_class` · 적격성 캐시로만).
- Gold · 루브릭 · 대안 답 · 부분 응답 계약 없음 — 공장 문항은 정답 키 · 해설 · 페르소나 검수까지.
- 공장 문항과 학습지도 TASK 의 연결은 「평가원 유형 대응」(`CSAT_BACKING`)뿐 — TASK 수행 적합성 검수가 아니다.

## 2. 분류

| 기능 | 분류 |
|---|---|
| 시리즈 · 단계 · 문항 유형 카탈로그(`SERIES_CATALOG` · `CSAT_BACKING`) | 재사용 |
| 발주 게이트 · 명령 조립(`order-model` · `order-view`) | 재사용 / 확장 |
| 원천 · 적격성 · 권리(`csat_source_eligibility` · `license_class`) | 재사용 |
| 각색 · V-level | 재사용 / 확장 |
| 문항 · 해설 · 페르소나 검수 드레인 | 재사용 |
| 조판 · 발행 승인 | 재사용 |
| WorkspaceDemand → 공장 명세 변환 | **새 어댑터(코드 · 이 작업 P-F1/F2)** |
| 영속 주문 · 주문 목록 · 주문 상태 · 공급(Delivery) 기록 | **승인 필요(DB 스키마)** |
| 문항 단위 버전 · 권리 · 검수 상태 | 승인 필요(DB 스키마) |
| 학습자 노출이 발행 승인을 따르게 | 확장 — RPC 변경 승인 필요 |
| Gold · 루브릭 · 직접 평가 자격(R3) | 현재 미지원 |
| 지문 · 활동 단위 주문 | 현재 미지원(새 어댑터 + 공정 확장) |
| 주문 → 발행 자동 실행 | 현재 미지원 |

## 3. Workspace 수요 ↔ 공장의 매핑(현실적인 첫 경로)

| 수요 | 공장에서 대응 가능한 것 | 학습지도에 공급 가능한가 |
|---|---|---|
| R5 원문 분석 · 모델 설명 | 공장 아님 — 기존 v3 기출 해설(P-M3b) · `claim-support` 확인 · 전이 | **예(기존 자산 재사용)** — 독립 확인은 미노출 · 첫 시도 규칙 |
| R5 · E3 지도 연습 | 공장 `topic/title/main_point/claim` 문항 | 조건부 — TASK 적합성 검수 · 권리(지문 단위) · 학습 지도 실행 화면 연결이 없다 |
| V2 · S5 연습 | 공장 `vocab_choice` · `grammar_choice` 대량 재고 | 조건부(같은 이유) · 직접 확인(R3)으로는 불가 |
| 독립 확인 · 전이 · 지연 재확인 | 공장 문항은 Gold · 루브릭 · 학생별 노출 원장이 없다 | **아니요** — 지금은 기존 확인 과제(검수된 주석 · B7) 경로만 |

## 4. 단계별 계획(이 문서 뒤)

- **P-F1**(코드 · 승인 불필요): `WorkspaceDemand` 계약 — 교육 필요(NeedRank)와 재고를 분리, 자료 역할 · 노출 · 권리 · 평가 자격 · 멱등 키. R5 · E3 · V2 · S5 를 같은 계약으로.
- **P-F2**(코드): 공급 판정 어댑터 — 기존 자산(확인 · 전이 주석 · v3 해설 · 공장 문항 재고)을 수요에 대 보고 `delivered / shortfall / unsupported` 와 이유를 낸다. 공장 문항은 「연습 후보」까지만(평가 자격 없음).
- **P-F3**(코드 dry-run): 부족 수요 → 기존 발주 모델의 명령 · 프롬프트 명세(실제 생산 · 적재는 별도 승인).
- **승인 대상 계약(별도)**: 영속 주문 · 공급 테이블, 문항 단위 자격 열, 학습자 노출의 발행 승인 연동.
