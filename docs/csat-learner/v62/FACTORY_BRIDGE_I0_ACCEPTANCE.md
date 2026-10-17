# I0 Factory Bridge — 수용 자료(Codex 독립 검증 전)

> 기준 main `5e2aff89d`. 코드 `3c58f955c`(dirtyTree false 실행 기준). 연결 모드 **CONTRACT_ONLY**.
> 증거 층위: ① 순수 계약 · 반례 ② 개발 DB 읽기 전용 SQL(C/B 감사) ③ 기존 화면 회귀(Chromium · 개발 DB). 실제 주문 · 생산 · 공급 · 학습 효과는 **NOT_CLAIMED**.
> 설계: [FACTORY_BRIDGE_I0](./FACTORY_BRIDGE_I0.md) · [TASK_FACTORY_CROSSWALK](./TASK_FACTORY_CROSSWALK.md) · 대기: [FACTORY_BRIDGE_I1_PENDING](./FACTORY_BRIDGE_I1_PENDING.md).
> 사용자 설계안 `Vocaflow_학습지도_교재공장_통합설계_v1.md` 는 이 작업 환경에서 열지 못했다. 지시서의 계약과 저장소 정본(main · 공장 브랜치 663f2eee8)을 기준으로 했다.

## 1. 반례 S01–S16(`factory-bridge.test.ts` · 28 테스트 중 반례 16)

| ID | 반례 | 결과 | 층위 |
|---|---|---|---|
| S01 | R5 적격 기존 자료 충분 → 신규 생산 0 · NOT_NEEDED | PASS | ① |
| S02 | V2 주석 · 출시 0 → 평가 부족 유지 · ASSESSMENT_NOT_FROM_FACTORY | PASS | ① |
| S03 | DCP 어휘(밑줄) 재고 → V2 독립 확인 공급 안 됨(blocked_runner) | PASS | ① |
| S04 | S5 어법 자료(P06) → 의미 범위 승격 안 됨(related · 검색 전용) | PASS | ① |
| S05 | 같은 자료라도 역할별 자격(역할 결속) · D 미확인은 교수 적격 아님 | PASS | ① |
| S06 | 목표 · PLAN 변경 → 새 요청 키 · 옛 요청 버전 보존 | PASS | ① |
| S07 | 부분 검수 실패 → 적격만 · 부족 보존 | PASS | ① |
| S08 | revision · 권리 · Gold · 승인 철회 → 현재 자격 무효 | PASS | ① |
| S09 | 같은 지문 · 지문 미확인 · 공유 지문 노출 → 평가 자료로 세지 않음 | PASS | ① · 실제 DB 노출 누락은 ② 결함(I1 D1) |
| S10 | 같은 키 같은 본문 재사용 · 다른 본문 충돌 | PASS | ①(기존 `reconcileRequest`) · DB 원자성은 I1 |
| S11 | 실행기 · 채점기 미지원은 blocked_runner(학생 오답 아님) | PASS | ① |
| S12 | 공용 키 · 묶음에 학습자 · Workspace · PLAN 정보 없음 | PASS | ① · DB RLS 는 I1(NOT_TESTED) |
| S13 | not_installed · error · 정상 0건 구별 · UNKNOWN_STOCK | PASS | ① |
| S14 | 여러 학생 같은 공용 요구 → 한 공유 키 | PASS | ① · DB 링크 표는 I1 delta D3 |
| S15 | 신규 생산 없이 역할별 기존 자료 조합 | PASS | ① |
| S16 | 목표일 · 점수로 학년 · 난도 · 기간 추정 안 함 → NEEDS_PRODUCT_BRIEF | PASS | ① |

나머지 12 테스트: Crosswalk 3 · 단위 2 · 상태 사다리 · golden 5 · 계보 2.
**fixture PASS 는 실제 생산 · 공급 PASS 가 아니다.** 동시 주문 · DB 원자성 · RLS 는 I1/I2 의 실제 검증 대상으로 남긴다(NOT_TESTED).

## 2. C/B SQL 감사(개발 DB 읽기 전용 · 2026-10-17)

| 위험 | 판정 |
|---|---|
| 1 G2 노출 누락 | **재현** — G2 시도 129행(123쌍) 전부, 시도 없는 해설 열람 227세션이 B 에 'none' |
| 2 교수 적합성 unknown | **재현(앱 진단 층)** — `supplyFor` 해설 줄 available/fully_supplied vs SQL D pass 필수 |
| 3 승인 범위 | **재현(정적)** — 앱 public+assessment vs B 단일 승인 |
| 4 reader · 실행기 | 지원 공백(fail-closed) |
| 5 공용 Product Order | **부분 결함** — 주문 계보 결속 칸 없음 |

C/B 표 · 함수는 개발 DB 에 0개(`to_regclass`)다. 최소 delta 는 `_pending_workspace_supply_b_delta_i0.sql` 이며 **미적용**이다.

## 3. 회귀

| 묶음 | 결과 |
|---|---|
| 단위(`lib/csat` · `components/csat` · `lib/learner` · `lib/knowledge`) | 221 파일 · 2,611/0(22 파일 묶음. 한 묶음은 첫 실행에서 결과 파일 없이 끝나 재실행 258/0) |
| tsc · eslint · check.mjs | 0 · 0 · 15/15 |
| LM-W1 통합 화면(:3006) | 36/0 |
| 공급 안내 `e2e-map-supply` | 6/0 — 1차는 로그인 대기 240초 초과(5/1, 계정 2 삭제 확인), 2차는 개발 서버 종료로 연결 거부. 서버를 다시 띄운 3차가 6/0. 앞의 두 실행은 PASS 로 세지 않는다 |
| T4 1440 · 1280 | 8/0 · 8/0 |
| T3 1440 | 20/0 |
| T2 R5 수직 1440 | 20/0 |
| T1 | 9/0 |

T3 · T2 1280, 복귀 · 해부 e2e 는 이번에 다시 돌리지 않았다(NOT_TESTED). 기존 앱 코드는 바꾸지 않았다. 새 모듈은 화면 · 서버에서 아직 import 되지 않는다.

## 4. 병렬 작업

- PR #276(V2, Codex 검증 중)과 겹치는 파일은 `docs/CHANGELOG.md` 의 Unreleased 한 줄뿐이다.
- Codex worktree · 잠금은 건드리지 않았다. DB 쓰기는 0이다.
- #276 이 먼저 병합되면 rebase 뒤 단위와 T4 · supply 를 다시 돌린다.

## 5. Codex 검증 요청

1. 해결기 판정 순서가 FQ1 · `deliveryCheck` 의 의미와 맞는가. 특히 「축 pass + 승인 없음 = awaiting_release」 구분.
2. Crosswalk 관계(overlaps / related)와 「학습지도 R5 ↔ 공장 R4」 판단.
3. 공용 `shareKey` 에 브리프 전체를 넣은 것이 묶음 단위로 적절한가(브리프가 다르면 다른 생산).
4. delta D1 의 `revealed_at` 포함 범위. 정답 공개만으로도 노출로 볼지.
5. `supplyFor` 해설 줄 판정(위험 2)을 I1 에서 바꿀지.

## Codex 최종 독립 수용 revision

위 28개 및 NOT_TESTED 표는 최초 제출 당시 관찰로 보존한다. 최신 제품 동결 SHA 45611e2b803bb6650cc857ddd39284615f355640의 별도 재검증에서는 기존 28+독립 49=77, 광역 단위 215파일 2,603, 실제 합성 계정 브라우저 15묶음 223조건을 완료했다. [최종 독립 수용](../../research/factory-i0-277-independent/ACCEPTANCE.md)과 [근거 원장](../../research/factory-i0-277-independent/EVIDENCE.json)이 최신 범위와 미검증 경계를 설명한다. 최초 NOT_TESTED를 소급 PASS로 덮지 않는다. I0는 CONTRACT_ONLY/ACCEPT_WITH_LIMITS이고 실제 Factory 연결·C/B 적용·교육 효과는 완료가 아니다. 최종 목적 리뷰·CI·안전 병합 영수증은 PR #277에서 확인한다.
