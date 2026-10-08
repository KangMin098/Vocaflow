# Phase 3 첫 수직 경로 — 독해 「주장과 근거 관계 이해」(2026-10-08)

> 목적: 관리자 등록부의 원리가 **학생의 실제 한 행동**까지 이어지는지 한 경로로 증명한다.
> 실제 DB → 관리자 채택 → `/csat/item/[slug]` → 실행 과제 → 수행 기록 → 학습 지도 FIND → 관리자 추적 → 재검토 전파.
> 상위 설계: [VNEXT_ARCHITECTURE](../VNEXT_ARCHITECTURE.md) §7. 스키마는 Phase 2(`20261008120000_knowledge_vnext`)만 쓴다 — 새 마이그레이션 적용 0.

## 1. 대상 문항 — 2022학년도 수능 20번(R-CLAIM · 필자의 주장)

| 기준 | 2022#20 |
|---|---|
| 주장이 명확 | 2번째 문장이 「도구가 아니라 조직의 목표 이해에서 시작한다」로 주장을 직접 세운다 |
| 뒷받침이 명확 | 4 · 5번째 문장이 이유 · 조건(존재 자체는 목적이 없다 · 문제 해결이나 개선이어야 한다)으로 떠받친다 |
| 반박 대상 · 재진술 | 1번째 = 흔한 실수(반박 대상), 6 · 7번째 = 주장의 일반화(재진술) — 「주장 아닌 문장을 주장으로 잡는」 오답 경로를 실제로 보여 준다 |
| 정답 근거와 설명 용이 | 정답 근거 앵커(answer)가 2번째 문장과 같다 — 두 객체의 차이를 한 문항에서 보여 줄 수 있다 |
| 분석 데이터 | 공개 분석 v4(문장 역할 주석 · 설계 패턴 myth_rebuttal) · 골격(7문장) · 원천 B 등급(Blanchard, *Social Media ROI*) |

후보로 본 것: M2406#20(원천 A지만 정답 근거 앵커 없음) · 최근 수능 · 모평 R-CLAIM(원천 G — 근거로 쓸 수 없음).

## 2. 탐구 질문 · 근거

- 탐구 질문 `claim-support-relation-csat` — 「수능 독해에서 학생이 주장과 근거의 관계를 정확히 파악하는 것이 주장형 문항 판단에 어떤 역할을 하는가?」 · 결론 = 처리 기제 · 남은 불확실성 기록.
- 근거(세 층 각각 1건): **기출 관찰**(`csat_origin` · 원천 B · `exam_observation`).
- **연구 근거 없음** — 연구 서지를 등록하지 않았다. 연구 수준을 만들어 채우지 않는다. 강사 영상(실무자 주장 118건)은 이 사슬에 잇지 않았다.

## 3. 채택 사슬

| 층 · 종류 | slug | 제목 | 상태 |
|---|---|---|---|
| 본질 묶음(기존) | `essence-meaning-processing` | 의미 처리 | 검토 중(노출 조건 아님) |
| 원리 · 언어 처리 기제 | `claim-support-relation` | 주장과 근거 연결 | **채택** |
| 방법론 | `method-claim-support-marking` | 주장·뒷받침 문장 표시하며 읽기 | **채택** |
| 공부법 · 실행 과제 | `task-claim-support-link` | 주장 문장·뒷받침 문장 고르고 관계 표시 | **제품 적용** |

### 채택 검토 — Claude Code 작성 + Codex 독립 검토(사람 검수 대체 규칙)
| 회차 | Codex 판정 | 지적 → 고친 점 |
|---|---|---|
| 1 | 3항목 hold | 기제 문장의 효과 단정(「뒤에야 선다 · 오답으로 끌린다」) → 삭제 · 효과 미확인 명시 / 방법의 분류 모순 → 뒷받침 · 재진술 · 반박 대상 분리 / 과제 채점 기준 불명 → 이중 맹검 주석으로 |
| 2 | 3항목 hold | 「요구한다」 필수성 단정 → 「쓰이는 처리 후보 · 필수 근거 없음」 / 반박 대상과 필자의 반박 혼동 → 따로 표시 / 「뒷받침」 범위 → 이유 · 조건으로 좁힘 |
| 3 | **3항목 · 사슬 adopt** | 「단일 기출에 근거한 탐색적 훈련 사슬로 채택 가능, 효과를 과장하지 않는다」 |

채택은 **제품에 써도 된다는 판단**이지 효과 입증이 아니다 — 세 항목 efficacy = `not_assessed`.

## 4. 문항 주석(주장/근거) — 정답 근거와 다른 객체

`apps/web/src/lib/knowledge/annotations/claim-support-2022-20.v1.json` — **문장 번호만**(지문 원문 없음 · 평가원 저작물). 0부터 센다.

| 필드 | 값 | 뜻 |
|---|---|---|
| `claim` | 1 | 주장이 가장 직접 드러난 문장 |
| `claimRestated` | 5, 6 | 주장을 다시 말함(일반화) |
| `support` | 3, 4 | 이유 · 조건으로 떠받침(채점 대상) |
| `supportDisputed` | 2 | 판정이 갈림 — 채점 제외 |
| `opposed` | 0 | 필자가 반박하는 생각 |
| `relationProbe` | 3 → reason | 과제 3단계 질문 |
| `skeletonSig` | 골격 문장 길이 sha256 | 골격이 다시 구워져 경계가 바뀌면 채점 · 노출하지 않는다 |
| `answerAnchorOverlap` | [1] | 정답 근거 앵커와 같은 문장 — 앵커 = 정답 설명용, 이 주석 = 논증 구조 과제용 |

출처: Claude 맹검 주석 → Codex 맹검 독립 주석(다른 판정 미공개) → 비교. 일치: 주장 · 재진술 · 4번째=이유 · 반박 대상 · 뒷받침 4·5. 불일치 1곳(3번째 문장: Claude=뒷받침, Codex=반박 대상) → 채점 제외로 해소.

## 5. 학습자 경로

- `/csat/item/2022-20` 해설 아래 「이 문항에서 확인할 읽기 원리 — 주장과 근거 연결」(`PrinciplePanel`). 학습자 문구는 과제 쪽 고정 문구(`CLAIM_SUPPORT_LEARNER`) — 관리자 항목 문장 · 연구 용어 · 내부 id 를 넘기지 않는다.
- 「직접 확인하기」 → ① 주장 문장 ② 이유 · 조건으로 떠받치는 문장(모두) ③ 4번째 문장의 관계 — 문장 번호(공개 문제지를 곁에 두고). 「확인하기」 → 서버 채점 → 결과(주장 · 뒷받침(빠진/남는 문장) · 관계) · 다시 해 보기.
- 노출 게이트(`lib/knowledge/product-server.ts`): ① `csat_item_task` · `claim-support:2022-20` 적용 active ② 과제 → 방법 → 기제 사슬 전체 adopted/applied(`live-chain.resolveChain`) ③ 주석 서명 = 지금 골격. 하나라도 어긋나면 칸이 없다(조회 실패도 해설은 그대로).
- 수행 기록 `POST /api/csat/item/[slug]/task` → `learning_task_attempts`(service_role 쓰기 · userId 는 세션 · `task_key=claim-support` · `application_id` · `item_ref` · `content_hash`=주석 해시 · `phase=practice` · `is_correct`). 학습자 키는 본인 행 SELECT 만.

## 6. 학습 지도 연결

`learning_map_find` 적용 1행(`b6-3` → 지도 과제 `B6-3` 「헷갈린 선지 비교」 — 「글 구조·핵심」 단계 R 축 FIND). 단계 시트의 그 과제 아래에만 「2022학년도 수능 20번으로 직접 확인 →」. 다른 FIND 는 바꾸지 않는다. 문항 쪽 적용이 꺼지면 지도 링크도 사라진다(빈 화면으로 보내지 않는다).
추적: routing(R 안정 후보) → FIND(B6-3) → 적용(`learning_map_find` · 같은 과제 항목) → 실행 과제(`task-claim-support-link`).

## 7. 관리자 추적 · 재검토

- `/admin/knowledge/product/[id]` — 탐구 질문 → 근거(수준별 · 연구 근거 없음) → 기제 → 방법 → 과제 → 적용 → 실제 수행 → 효과 검증, 「끊긴 곳」 먼저.
- 재검토 전파(`lib/knowledge/review-cascade.ts`): 항목 재검토 · 반려, **문장 고치기**(새 `StatementForm` · `editStatementAction`), 근거 추가(외부 · 기출 · 연구) · **근거 축 변경** → 채택 · 적용 중 항목은 검토 중 + 그것을 구현하는 아래 층 전부 검토 중 → 각 항목의 active 적용은 DB 트리거가 자동 중단 → 학습자 화면에서 내려간다.

### 동시성 · 실패 순서(Codex 리뷰 P1 4건 반영)
- 상태 변경(채택 등)은 화면이 읽은 **문장 버전 · 근거 버전 · 상태** 셋 다 그대로일 때만 저장 — 본 적 없는 문장을 채택하지 않는다.
- 문장 고치기는 읽은 **버전 · 상태** 그대로일 때만 — 그 사이 채택되면 실패(「재검토 없는 문장 변경」 방지).
- 근거 추가 · 축 변경은 **재검토를 먼저** 한다 — 뒤에서 실패해도 항목은 이미 검토 중(학습자에게서 내려감 · fail-closed). 축이 실제로 바뀔 때만(메모 · 같은 값은 그대로).
- 전파는 읽은 상태가 아니라 「지금 adopted · applied 인가」로 갱신 — 그 사이 상태가 바뀐 자식이 빠지지 않는다.
- 완전한 원자성(근거 변경과 재검토를 한 트랜잭션)은 앱에서 만들 수 없다 → 아래 DB 가드.

### DB 가드 — 관리자 화면 밖 변경도 전파(2026-10-08 적용)
`20261008140000_knowledge_review_cascade_guard`(사용자 승인 sha256 `e97f5852386121b48c3541f87003efb4f19b805f38265939f2f5bcfbdec895d2`) — SQL 편집기 · 드레인 스크립트 · 다른 service_role 쓰기로 근거 · 문장 · 상태를 바꿔도 같은 전파가 DB 에서 일어난다(I1 근거 추가 · 축 변경 · 철회 / I2 문장 변경 / I3 재귀 연쇄 → 적용 자동 중단).
- 격리 PostgreSQL 13/13(`scripts/knowledge/pending-guards-test.mjs`)
- 실제 개발 DB 롤백 smoke 18/18(`scripts/knowledge/guard-db-smoke.mts`) — 실제 사슬에 기제 문장 직접 변경 · 방법에 근거 직접 추가 · 기제 근거 축 직접 변경 → 각각 대상 + 아래 층 검토 중 · 문항 · 지도 적용 중단 · 학습자 게이트(문항 원리 칸 · 지도 링크) 닫힘 · 수행 기록 보존 · 검토 기록 이유. 끝에 전체 롤백 — 실제 사슬 그대로.
- ⚠️ 남은 구멍 3(Codex 커밋 리뷰 · SQL 직접 변경에서만 — 관리자 화면 경로는 해당 없음): ① 문장 + 상태를 한 UPDATE 로 바꾸면(adopted → applied + 문장 변경) I2 를 건너뜀 ② 근거를 다른 항목으로 옮기면(item_id UPDATE) 옛 주인이 재검토되지 않음 ③ 연쇄가 이미 검토 중인 중간 층에서 멈춰 그 아래 적용 중 과제가 남음. 수정 후보 `_pending_20261008150000_knowledge_statement_review_fix.sql`(sha256 `78baa0279e5c282f250fe5316997586046d342399f6c6fa7ceeb77607eba2486` · 함수 본문 3개 교체만 · **미적용 · 승인 대기**) — 격리 검증에 세 경로 모두 포함 통과.
- 앱 경로의 전파(`review-cascade.ts`)는 남겨 둔다 — DB 가드와 같은 결과(조건부 UPDATE 가 0행)라 무해하고, 화면에 「연쇄 재검토: …」를 보여 준다.

## 8. 효과 상태

과제 수행 기록만 쌓는다(`phase=practice`). 검증 계획 2건(문항 · 지도) = planned · 실제 · 최소 표본 30 · 지연 14일 · 전이 있음 · 비교 조건 있음. efficacy 는 실제 학습자 사전 · 사후가 최소 표본을 넘겨 분석 완료돼야 DB 가 바꾸게 한다 — **미확정**. 실제 학습자 데이터가 없으므로 효과 입증은 이 단위의 완료 조건이 아니다.

수행 기록 멱등 키 후보 `_pending_20261008140100_learning_task_attempts_idempotency.sql`(sha256 `3b7df58ae70f26266e4c9f0c588b1abfd5fb9e9f199571e385c2282b7a9f47e2`) — **미적용**. 지금은 중복 제출이 효과 집계를 바꾸지 않지만(집계 없음), 사전 · 사후 · 첫 시도 집계로 넘어가기 전에 필요하다.

## 9. 검증

- 실제 사슬: `scripts/knowledge/vertical-claim-support-build.mts`(관리자 화면 · 재실행 안전)
- 브라우저 E2E: `scripts/knowledge/vertical-claim-support-e2e.mts` — 학습자(오답→정답 · 기록 · 본인 행 · 쓰기 거부 · 401 · 400) · 지도 링크 · 추적 · 노출 게이트(실제 적용 중단 → 사라짐 → 다시 켬) · 재검토 전파(zz 시험 사슬 · 정리 0)
- 단위: `lib/knowledge/__tests__/vertical-claim-support.test.ts`

## 10. 다음 경로 후보

같은 틀(탐구 질문 → 근거 → 기제 → 방법 → 과제 → 주석 1문항 → 문항 화면 → 지도 FIND)을 복제: **문장 관계**(연결어 · 지시어 — R-ORDER/R-INSERT, 기존 기제 `cohesion-cues` 재사용) → 본문↔선지 → 어휘↔문맥 → 문장 이해 직접 진단.
학습자 연습 기능 이식(다른 세션 `feat/knowledge-vnext` — ClaimPractice · 첫 시도 집계 · 전이 추천 · evaluateProtocol · E2E 40)은 별도 단위([VNEXT_MERGE](https://github.com/KangMin098/Vocaflow/blob/feat/knowledge-vnext/docs/methodology/VNEXT_MERGE.md)).
