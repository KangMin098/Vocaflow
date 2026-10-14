# 학습지도 v6.2 — P-M2b 계획 저장 재시도 · 동시성 감사

> 정본 §10.3. 실측 2026-10-14 개발 서버 · 개발 DB(합성 계정 2 — 끝에 삭제). DB · RPC 변경 0.

## 1. 책임 분담(감사 결과)

| 층 | 책임 | 감사 전 | 이번 변경 |
|---|---|---|---|
| API `map/plan/route.ts` | 세션 사용자 · 본문 형식(허용 필드만) · 서버 재계산(가용량 · 단계 · 정의) · **재시도 판정** | 재시도도 매번 지금 상태로 재계산 · 재검사 → 첫 성공 뒤 콘텐츠 · 계획 범위가 바뀌면 성공한 요청의 재시도가 422 로 거절될 수 있었다 | 재계산 **전에** 같은 `clientKey` 의 본인 행을 찾아, 같은 요청이면 처음 결과(reused) · 다르면 409 `client_key_reused` |
| RPC `learner_workspace_plan_commit` | 사용자 · 템플릿 단위 잠금(advisory) · 기대 버전 비교(PT409) · 목표 버전 소유 확인 · Workspace 열기 · 추가 전용 이력 | 같은 `client_key` 면 **본문을 보지 않고** 처음 결과 반환 → 같은 키 · 다른 본문이 「저장됨」이 될 수 있었다 | 그대로(API 가 먼저 막는다). DB 층 보강은 아래 승인안 |

## 2. 실제 재현(`scripts/csat/map/v62/e2e-plan-atomicity.mjs` — ALL PASS 9)

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | 응답 유실 → 같은 키 · 같은 본문 재시도 | 200 reused · 같은 버전 · 행 1 |
| 2 | 같은 키 · 다른 본문 | 409 `client_key_reused` · 행 불변 |
| 3 | 첫 성공 뒤 목표 변경 → 같은 요청 재시도 | 200 reused(재검사로 거절 안 함) |
| 4 | 두 기기 같은 Workspace 동시 저장 | 200 하나 · 409 하나(advisory 잠금 + 기대 버전) |
| 5 | 낡은 expectedVersion | 409 `plan_version_conflict` · 행 불변 |
| 6 | 다른 사용자가 같은 clientKey · 본문 `userId` 위조 | 본인 새 Workspace(남의 것 안 받음) · `userId` 필드 400 |
| 7 | Workspace 종료 뒤 새 저장 | 옛 expectedVersion 409 · 새 Workspace 버전 1 · 옛 이력 3 보존 |
| 8 | 실패 응답의 부분 커밋 | 없음(행 수 그대로) |

콘텐츠 가용성 · 공개 자격이 바뀐 뒤의 재시도는 3 과 같은 경로(재계산 건너뜀)이고, 순수 판정은 `v4/__tests__/plan-retry.test.ts` 가 고정한다(가용량 0 · 단계 변경이어도 같은 요청이면 재사용).
클라이언트(`PlanSection`)는 이미 「서명이 같을 때만 이전 키 재사용」(`keyFor`) — 실패 응답을 저장으로 보이지 않는다(4차 E2E 18 · 20).

## 3. 승인 대상(선택 · 적용하지 않음) — DB 층 이중 방어

API 를 거치지 않는 호출(서비스 키)에도 같은 키 · 다른 본문을 막으려면 RPC 가 요청 서명을 저장하고 비교해야 한다.

```sql
-- 승인 후 새 마이그레이션 파일로(버전은 만들기 직전 ls supabase/migrations 로)
alter table public.learner_workspace_plan add column request_sig text;  -- 기존 행 null(비교 생략)
-- learner_workspace_plan_commit: p_request_sig text 인자 추가 →
--   select ... where user_id = p_user and client_key = p_client_key;
--   if found and request_sig is not null and request_sig <> p_request_sig then raise exception 'client_key_reused' using errcode = 'PT409'; end if;
--   insert ... request_sig = p_request_sig
```

- 영향: 추가 열(널 허용) · 함수 시그니처 변경(API 한 곳만 호출). 기존 이력 불변.
- 되돌리기: 함수를 지금 정의로 · 열 삭제(데이터 손실 없음 — 서명만).
- 지금은 RPC 실행 권한이 service_role 뿐이고 그 호출자는 이 API 하나라, 승인 전에도 학습자 경로는 위 2 로 막혀 있다.
