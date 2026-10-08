<!-- docs/csat-learner/PRACTICE_PORT_VERIFICATION.md -->
# `/csat/practice` 이식 독립 검증 — G2 이전 (2026-10-08)

| 항목 | 내용 |
|---|---|
| 대상 | `feat/csat-practice-port` **`1ce738924`** (기준 `3d3cb47c1` · 27파일 +2594/−6) |
| 방법 | 별도 detached worktree(검증 뒤 등록 해제 — 폴더는 Windows 긴 경로로 일부 잔존) · 이식 세션 worktree 는 손대지 않음(clean · 같은 커밋 확인) |
| 범위 | 읽기 전용 코드 감사 · 타입/Lint · 전체 unit · E2E 사전 안전성 검사 |
| 변경 | **코드 0 · DB 0**(SELECT 도 이번 검증엔 없음) · 다른 세션 브랜치 0 |

## 판정
**G3 통합 준비: 미완(조건 미충족).** unit · 정적 검증은 통과했고 direct(기본) 모드의 G2 이전 동작에는 차단 결함이 없다. 그러나 **브라우저 E2E 는 미실행**(실패가 아님)이고, g2 모드에 P1 2건 · E2E 스펙에 P1 1건이 있다. 이 상태로 「Practice 이식 완전 검증」을 선언하지 않는다.

## 1. E2E 쓰기 경로 (40-csat-practice.spec.ts)
| 경로 | 막는가 | 근거 |
|---|---|---|
| 로그인 `signInWithPassword` → `/auth/v1/token` | **통과(막지 않음)** — Supabase Auth 가 auth 스키마(sessions · refresh_tokens · last_sign_in_at)에 **서버 쪽에서 쓴다** | `(auth)/login/page.tsx:68` |
| 미들웨어 `getUser()` 토큰 회전 | 막을 수 없음(서버) — auth 쓰기 가능 | `middleware.ts` |
| 로그인 컨텍스트의 분석 이벤트 · REST 쓰기 | 막음(`ctx.route`) | spec `:38-39` |
| 학습 컨텍스트의 쓰기 요청 · `/api/csat/practice/attempt` | 막음(`page.route` · 가짜 서버) — 실제 제출 라우트는 E2E 에서 실행되지 않는다 | spec `:67` |
| **「해설 먼저 보기」 새 탭(`target=_blank`)의 분석 이벤트** | **막지 않음** — `page.route` 는 새 탭에 적용되지 않는다. 새 탭 레이아웃의 화면 조회 이벤트가 `/api/analytics/event` → service role `funnel_events` INSERT 로 갈 수 있다(전송 전 `popup.close()` 타이밍이라 발생 여부는 불확실) | `ClaimPractice.tsx:259` · spec `:143-144` |
| 연습 페이지 GET · 허브 SSR | 쓰기 없음(SELECT 만 — 코드 확인) | `practice/[slug]/page.tsx` · `lib/auth/*` |
| spec 의 DB 픽스처 · 정리 | 없음 | spec 전체 |

## 2. DB 무쓰기 안전성 판정 — **불충족 → E2E 실행 보류**
- **규칙 5**(service role 키가 실제 개발 DB 에 닿는 환경에서는 실행하지 않는다): 실행 가능한 유일한 환경이 그 환경이다(`.env.local` → 공유 개발 DB).
- 로그인 자체가 **서버 쪽 auth 스키마 쓰기**를 만든다 — 요청 가로채기로 막을 수 없다.
- 스펙의 새 탭 누수(위 표) — 막히지 않은 쓰기 경로가 확인됐다.
- 격리 환경 대안: Supabase 로컬 스택(`supabase start`)은 **Docker 가 없어 불가**(CLI 2.98.1 은 있음). 필요한 것: Docker 가 있는 머신의 로컬 스택, 또는 **승인된 Supabase 브랜치 DB**(별도 프로젝트 DB — 공유 개발 DB 와 분리) + 그 키로만 띄운 dev 서버.

## 3. 타입 · Lint
- `tsc --noEmit` 전체: **0 오류**
- `next lint` 전체: **0 오류**(경고는 모두 기존 파일 — 바뀐 파일 경고 0)

## 4. 전체 unit 테스트 (DB 자격 증명 없이 · 관리 토큰 제거한 셸)
| | 결과 |
|---|---|
| 전체 | **354 파일 · 3,916 통과 · 실패 0** · 245 건너뜀(DB 통합 테스트 — 자격 증명 없을 때 의도된 skip) |
| Practice · 라우트 가드(`lib/knowledge` · `app/api/__tests__`) | 8 파일 · **84 통과** |
- 새 실패 0 — 이식 세션이 1회차에서 고친 라우트 가드 2건 포함, 수정 뒤 **전체 재실행으로 확인**(이식 보고의 공백을 메웠다).
- 실행 전 확인: 검증 worktree 에 `.env.local` 없음(`.env.example` 만) · 셸의 Supabase 계열 변수는 MCP 관리 토큰 1개뿐이고 테스트 코드가 쓰지 않음(0건) · 그것도 `env -u` 로 제거 → **unit 경로는 DB 에 닿을 수 없다**.

## 5. 결함 (재현 근거 · 수정 권고만 — 코드는 고치지 않음)
| 등급 | 결함 | 근거 | 권고 |
|---|---|---|---|
| **P1** | E2E 새 탭이 쓰기 가로채기 밖 — 분석 이벤트가 공유 DB 에 들어갈 수 있고 테스트 4 의 「어느 컨텍스트에서도」 단언이 자기 page 만 셈 | spec `:67`(page.route) · `:143` | 학습 컨텍스트도 `ctx.route('**/*')` 로 컨텍스트 전체를 가로채고, 쓰기 계수도 컨텍스트 단위로 |
| **P1 (g2 모드)** | 제출 실패 뒤 「해설 먼저 보기」 → 재제출하면 공개(reveal) 키가 고정이라 conflict 를 허용한 뒤, 시도에 클라이언트 `helpLevel`(viewed_first)을 보내 세션(independent)과 모순 → RPC 예외 → **영구 500** | `practice-writer.ts:122`(stableUuid(session,'reveal')) · `:139` 주석 · `:150` · G2 초안 「attempt metadata contradicts session」 | 시도의 `p_help_level` 을 보내지 않고(NULL → 세션 상속) 응답의 세션 도움 수준을 화면에 반영. 또는 reveal 이 conflict 면 세션 값을 읽어 맞춘다 |
| **P1 (g2 모드)** | g2 로 쓴 기록이 「내 기록」 · 완료 · 판정에서 사라짐 — 읽기는 `response.activity`/`response.help_level` 로 거르는데 g2 는 그 둘을 열로만 쓴다 | `practice-server.ts:123,128` · `practice-writer.ts:153` vs direct `:100-104` | 읽기를 열 우선(`activity`/`help_level` 열 → 없으면 response)으로, 또는 g2 도 response 에 같이 넣기 |
| P2 | direct 모드 멱등은 SELECT→INSERT 사이 경쟁 구간(동시 요청 · 다른 탭 · 타임아웃 재시도) | `practice-writer.ts:84-87` | 사용자 결정대로 G2 유일 제약 전까지 임시 수용 · 효과 집계 · 노출 금지 |
| P2 | `helpLevel` 을 클라이언트 신고에 의존(서버 세션 기록 없음) | `practice-server.ts:181` 부근 | G2 세션 표 적용 뒤 서버 세션 값을 정본으로 |
| P2 | 옛 `recordClaimSupportAttempt` 의 task_key `claim-support` 를 공유 — G2 첫 시도 뷰에서 옛 행과 같은 (task, item, phase) 로 묶일 수 있음(불확실) | `product-server.ts:22` | 옛 경로 기록이 생기기 전에 task_key 분리 또는 옛 경로 은퇴 |

g2 모드 결함은 **지금 꺼져 있는**(`PRACTICE_ATTEMPT_WRITER=g2` 일 때만) 경로라 현재 동작에는 영향이 없다. 단 G2 적용 뒤 켜기 **전에** 고쳐야 한다.

## 6. G2 계약 불일치 여부
- RPC 이름 · 인자 이름: **일치**(`learning_session_apply` 14개 + 기본값 3 · `learning_attempt_record` 15개 + `p_trial_id` 기본값). PostgREST 이름 호출이라 순서 무관.
- 공개 → 시도 순서 · 제출마다 새 `client_mutation_id` · `answered_at` 필수 · 「해설 먼저」는 시도 아님: **일치**.
- **불일치 1건**: 위 P1(g2) — 시도가 세션과 다른 `help_level` 을 보낼 수 있는 경로. G2 초안은 이를 거부하도록 설계돼 있어(2회차 Codex 수정) **초안이 결함을 정상적으로 잡는다** — 고칠 곳은 이식 쪽.
- 서버 채점 · 정답 키 비노출 · 골격 115문항 격리(미리보기 전용 · 별도 task_key · synthetic · 효과 집계 제외): **확인**.

## 7. G2 인계 (vocaflow-18 의 G2 검토 보고서 §9 에 반영)
**B5 — 합성 계정**: 서버가 관리하는 검증 계정 목록으로 판정한다 · 이메일 도메인만으로 판정하지 않는다(현재 이식은 `vocaflow.dev` 도메인 잠정 규칙) · 클라이언트가 `synthetic=false` 를 지정할 수 없게 한다(현재 이식도 클라이언트 경로로는 false 를 만들 수 없음 — 유지).

**B6 — 동시 중복 제출**: DB 유일 제약 적용 전에는 동시 중복이 남는다(direct 모드 경쟁 구간 확인) · 학습자 진입 링크를 연결하지 않는다 · 이 기간 기록은 효과 집계에서 제외 · G2 적용 뒤 **실제 DB 에서 동시 요청으로** 멱등성을 검증한다.

**진입 경로**: Practice 링크 미연결 유지 · G3 에서 G1 완료 카드의 「같은 원리 연습」 연결을 우선 검토 · 연결 전 대상 라우트 · 과제 선택 · 완료 후 복귀를 E2E 로 검증(격리 환경에서).

## 8. G3 전 남은 일
1. 이식 세션: P1 3건 수정(E2E 컨텍스트 가로채기 · g2 help 상속 · g2 기록 읽기) — 이 검증 세션은 코드를 고치지 않았다.
2. 격리 환경(브랜치 DB 또는 Docker 로컬 스택) 확보 뒤 E2E 실행 — 그 전까지 「E2E 미실행」으로 표기.
3. G2 적용(vocaflow-18 · 별도 승인) 뒤 g2 모드 · 동시 멱등을 실제 DB 에서 검증.
