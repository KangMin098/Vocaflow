<!-- docs/csat-learner/PRACTICE_PORT.md -->
# `/csat/practice` 이식 기록 (2026-10-08)

| 항목 | 내용 |
|---|---|
| 지시 | `origin/feat/csat-learning-loop-g1` `docs/csat-learner/PRACTICE_PORT_BRIEF.md` (사용자 결정 2026-10-08) |
| 브랜치 | `feat/csat-practice-port` (`origin/main` `3d3cb47c1` 기준 · worktree `Vocaflow-csat-practice-port`) |
| 정본 | `origin/feat/methodology-vnext`. 채점은 `gradeClaimSupport`, 기록은 `learning_task_attempts` 13열 |
| 이식 원천 | `origin/feat/knowledge-vnext`(동결). 화면 · `pickNext` · `judgeCapability` · `evaluateProtocol` · E2E |
| 하지 않은 것 | DB 쓰기 0건(SELECT 만 실행) · 마이그레이션 0개 · 다른 세션 브랜치 수정 0건. G2 SQL의 표 · RPC는 없다고 보고 짰다 |

## 1. 정본 파일 복사 (바이트 그대로)
`claim-support.ts` · `claim-support-labels.ts` · `live-chain.ts` · `product-server.ts` · `annotations/claim-support-2022-20.v{1,2}.json` · `__tests__/vertical-claim-support.test.ts`를 `origin/feat/methodology-vnext`에서 **고치지 않고** 가져왔다. 정본이 main 에 병합될 때 같은 내용이라 충돌하지 않는다. 정본 쪽이 먼저 바뀌면 병합할 때 정본을 택한다.

## 2. 무엇이 어디로 갔나
| 원천(knowledge-vnext) | 이식 | 바뀐 점 |
|---|---|---|
| `knowledge_designs` · `knowledge_deployments`로 여는 화면(`/csat/practice/<설계 slug>`) | `/csat/practice/claim-support` | 설계 · 배포 표는 폐기됐다. 정본의 적용 게이트를 쓴다: `loadLiveApplication('csat_item_task', 'claim-support:<문항>')`와 채택 사슬, 주석 서명 |
| `scoreClaim`(정답 근거 앵커 한 문장 적중) | `gradePractice` → 정본 `gradeClaimSupport` | 주석 문항은 주장 · 근거 집합 · 관계로 채점한다. 골격 문항은 앵커에서 만든 **검증 안 된 키**로 채점하며, 옛 의미(앵커 문장 중 하나 = 적중)를 그대로 둔다 |
| `knowledge_task_runs` INSERT (`/api/knowledge/runs`) | `POST /api/csat/practice/attempt` → 쓰기 어댑터(`practice-writer.ts`) | 정본 `learning_task_attempts`에 넣는다. G2 열 값은 response 안에 둔다 |
| `vnext.ts` `evaluateProtocol` · `judgeCapability` | `protocol.ts` | phase 열(pre/post/delayed/transfer)을 그대로 쓴다. `effectEligible`이 합성 · 골격 · 해설 먼저 · 적용 없는 기록을 뺀다. 지연은 14일 |
| `practice.ts` `pickNext` · 응답 범위 검사 | `practice.ts` | 단계 이름만 `train` → `practice`로 바꿨다. 판단 시각 · 제출 id · 세션 id 검사를 더했다 |
| `ClaimPractice.tsx` + CSS | 같은 이름 | 3단계(주장 → 근거 → 관계) + 선지 · 확신. 「해설 먼저 보기」를 넣었다. 이벤트 송신을 걷었다. CSS는 그대로 |
| `40-knowledge-practice.spec.ts` | `40-csat-practice.spec.ts` | 실제 DB 대신 가짜 제출 서버를 쓴다. 로그인을 포함한 모든 컨텍스트에서 쓰기를 가로챈다 |

## 3. 수용 기준 대응 (BRIEF §3)
| 기준 | 구현 · 검증 |
|---|---|
| 주장 → 근거 0–3 → 선지 · 확신 → 판정 · 다음 행동 | 화면 4단계(주석 문항은 관계 질문 1개가 더 붙는다) · `practiceFeedback.next` |
| 서버 채점 · 정답 키는 저장 뒤에만 | `submitPractice` 순서: 검사 → 채점 → reveal → record → 판정. 시험 「기록이 실패하면 정답 키가 나가지 않는다」 |
| `activity='practice'` · phase 분리 | 시도마다 `response.activity='practice'`. phase는 유형으로 서버가 정한다(주장 · 요지 = practice, 주제 · 제목 = transfer) |
| 해설 먼저 보기 ≠ 독립 시도 | 시도를 만들지 않는다. 세션 `helpLevel='viewed_first'` → 뒤에 낸 판단에 그대로 붙는다. 역량 판정 · 효과 입력에서 빠진다 |
| 전이 ≠ 완료 수준 | 전이는 phase=transfer로 따로 센다. 역량 판정(`capabilityHits`)에는 practice 단계만 들어간다 |
| 합성 계정 분리 | `isSyntheticEmail`(vocaflow.dev · vocaflow.local · example.com)과 관리자 미리보기는 `synthetic=true`. 서버 목록은 아직 확정 전이다(G2 검토 B5) |
| 골격 115문항 격리 | 관리자 `?preview=1`에서만 보인다. `task_key='claim-support-skeleton'` · `application_id=null`이라 효과 입력에서 구조적으로 빠진다 |
| `lib/csat/skeleton` 의존 · 채점 회귀 | `practice.test.ts`가 115문항 키의 sha256 지문을 고정한다. 골격을 다시 구우면 시험이 멈추고, 바뀐 문항을 확인한 뒤 값을 고친다 |

## 4. 쓰기 어댑터와 G2 전환
- `selectWriter`: 기본값은 `direct`이고, 환경 변수 `PRACTICE_ATTEMPT_WRITER=g2`일 때만 `g2`를 쓴다. **G2 통합 SQL(sha256 `779eb9bb0812719702e16e4fcf34fe5813ed6f9adaa8173cc81a1f7aa4182a01`)이 적용·확인되기 전에는 켜지 않는다.**
- **direct(지금)** — 정본 13열에 INSERT한다. `response`에 `activity` · `help_level` · `client_mutation_id` · `client_session_id`를 넣어 G2 이전 때 그대로 옮긴다.
  - 멱등: 같은 학습자의 `response->>client_mutation_id`를 먼저 읽는다. 같은 답이면 duplicate, 다른 답이면 conflict(409)다. 판단 시각까지 비교한다.
  - **한계**: 유일 키가 없어서, 동시에 도착한 두 요청 사이의 틈은 화면의 제출 잠금으로만 막는다. 틈을 닫는 것은 G2의 `(user_id, client_mutation_id)` 유일 인덱스다.
  - 세션 표가 없어 reveal은 기록하지 않는다.
- **g2(적용 뒤)** — `learning_session_apply`(stage=revealed, 결정론적 mutation id)로 세션을 공개한 뒤, 받은 세션 id로 `learning_attempt_record`를 부른다. G2 규칙(공개 전 시도 거부 · 세션 메타데이터 상속)을 따르는 순서다.
- **두 어댑터의 response 모양은 같다**(`responseOf`). g2도 열 값의 사본(`activity` · `help_level` · client ids)을 response에 넣어, 「내 기록」 · 완료 · 판정 읽기가 어느 모드의 기록이든 같은 칸으로 읽는다.
- g2 시도는 `p_help_level`을 **보내지 않는다**(NULL → 세션 상속). 세션과 다른 값을 보내면 RPC가 영구 거부하기 때문이다.
- **판단을 한 번 보낸 세션의 도움 수준은 바꾸지 않는다**(성공 · 실패 무관). 그 뒤의 해설 열람은 `explanationViewedAt` → 기록 `response.explanation_viewed_at`인 별도 행동이다. 재시도의 같은 id · 같은 판단 시각은 유지된다. 그 열람 뒤에는 **답을 잠근다**. 같은 답 재전송만 가능하므로, 해설을 보고 바꾼 답이 독립 수행으로 저장되지 않는다.
- 클라이언트가 보내는 값:
  - 문항을 열 때마다 새 `clientSessionId`
  - 제출마다 새 `clientMutationId`. 같은 답의 재시도만 같은 id와 같은 `answeredAt`을 쓴다
  - `answeredAt`은 필수다. 서버는 미래 5분 초과 · 30일 이전 값을 거부한다

## 5. 이벤트
`knowledge_task_viewed` · `knowledge_task_submitted` 송신을 원천 화면에서 걷었다(DB 허용 목록에 없음). G2 통합 SQL의 83종 허용 목록이 적용된 뒤 정의 · 송신을 한 커밋으로 켠다. 실패를 반복 전송하거나 조용히 버리는 경로는 없다.

## 6. 검증
| 무엇 | 결과 |
|---|---|
| 단위 `src/lib/knowledge` (6파일) | 74/74 통과. 정본 수직 경로 14 · 이식 규칙 · 골격 115 회귀 20 · 제출 · 어댑터 12 포함 |
| `src/app/api/__tests__` (라우트 가드 · 호출부) | 통과. 새 라우트를 PUBLIC 목록에 사유와 함께 넣었다 |
| `tsc --noEmit` · eslint(바뀐 파일) | 통과 |
| P1 3건 수정(2026-10-08, 근거 `PRACTICE_PORT_VERIFICATION.md` §5) | ① E2E를 컨텍스트 단위로 가로챈다(새 탭 포함) · 쓰기 계수도 컨텍스트 단위 ② g2 `p_help_level` NULL + 판단 뒤 해설 열람은 별도 행동 ③ g2 response 사본. 단위 79/79 |
| E2E `40-csat-practice.spec.ts` | **실행하지 않았다.** 이 worktree에는 `.env.local`이 없다(비밀값을 복사하지 않는다). 실행하려면 env가 있는 worktree에서 `pnpm --filter web exec playwright test 40-csat-practice` |
| 개발 DB(SELECT) | `learning_task_attempts` 13열 · 0행. `claim-support:2022-20` 적용 active v1. `learning_sessions` · `learning_attempt_record` 없음 |

## 7. 최종 통합 전 남은 확인 (BRIEF §6 · 사용자 결정 C항)
1. G2 실제 스키마와 `g2Writer` 인자가 일치하는지 — 적용 뒤 PGlite 하네스나 브랜치 DB에서 확인
2. 재전송 중복 없음 — direct는 순차 재전송까지만 보장한다(§4 한계). g2에서 동시 전송을 확인해야 한다
3. 세션 공개 전 판단 제출 차단 — g2 RPC가 막는다. direct에는 세션이 없다
4. 해설 먼저 보기가 독립 시도로 승격되지 않음 — 단위 · E2E(가짜 서버)로 확인했다
5. 첫 시도 · 복습 · 전이 통계 분리 — `firstAttempts`(판단 시각 순) · phase로 분리했다. `review` phase는 이 화면에 없다
6. 학습 결과와 분석 이벤트 중복 없음 — 이벤트를 보내지 않는다
7. G1 완료 · 재개 회귀 없음 — G1 코드는 건드리지 않았다(이 브랜치는 main 기준이고, G1은 아직 main에 없다)

DB 적용과 코드 병합은 각각 별도 승인 단계다.
