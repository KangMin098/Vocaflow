# LOCAL_FAST 동적 역할

2026-10-19 사용자 지시. 기존 `goal-orchestrator`, owner-worker, Task Queue, Goal Alignment Gate, Work Bridge와 `local-integrate`를 확장한다. 별도 서비스나 오케스트레이터는 없다. 제품 main·DB·봉인된 goals 정본은 변경하지 않는다.

작업 JSON에 선택적으로 지정한다.

```json
{"complexity":"simple","roles":{"analyst":"codex","planner":"codex","architect":"codex","implementer":"claude","reviewer":"codex","verifier":"codex"}}
```

여섯 역할 모두 양쪽 CLI를 지원한다. 역할을 생략하면 기존 Claude 구현을 초기 대조값으로 쓰고, 두 AI의 같은 복잡도에서 검증된 시간이 모두 쌓이면 관측 평균이 짧은 구현자와 기획자를 선택한다. 명시한 작업 맥락이 시간 측정보다 우선한다. 작업이 시작되면 `role_assignment`를 고정한다. owner·worktree는 바꾸지 않는다. 구현자와 리뷰어·독립 검증자는 다르게 강제한다. 저위험 작업에서 분석·설계·계획·구현을 같은 AI에 배정하면 실제 한 호출에서 처리하고 시간을 중복 합산하지 않는다. 이때 사전 AI 검토를 했다고 기록하지 않는다. P0·복잡도·승인·설계 플래그·해결되지 않은 설계 문제·명시적 Work 요청은 합치지 않는다.

일반 작업은 관련 코드를 읽은 로컬 계획을 구현자에게 전달한다. P0·복잡한 작업·승인이 필요한 작업·설계 플래그가 있는 작업은 반대 AI가 먼저 타당성과 반례를 확인한다. 설계 왕복은 최대 2회다. P2/P3 후속 지적만 있는 설계 리뷰는 원래 판정을 보존하고 `AI_VERIFIED_WITH_LIMITS`로 제안할 수 있다. P0/P1·판독 불가·근거 없는 반려는 막는다. 구현 중 설계 불일치도 같은 계약 안에서 로컬 보완을 먼저 시도한다. 목표·승인 범위 확대는 자동 채택하지 않는다. 반복 설계 충돌, 플랫폼 전략 변경, 독립 심층 검토, 명시적인 Work 요청은 기존 Work 경로를 사용한다. 요청 파일 생성은 전송·ACK·구현 시작을 뜻하지 않는다.

새 사용자 목표의 설계도 로컬에서 만들 수 있다.

```powershell
node bin/vfc.mjs ugoal request-design UG-... --agent codex --worktree D:/existing/owned-worktree --by existing-owner --json
```

기존 위임 worktree가 있으면 `--worktree`는 생략한다. Claude 설계는 `--agent claude`. Work 요청서는 `--work`를 명시한다. 로컬 설계는 반대 AI 검토의 실행 주체·HEAD·파일 해시를 보존한 **PROPOSED / AI_VERIFIED**다. 기존 사람 승인 또는 이미 승인된 goal delegation 정책이 덮는 범위에서만 기존 `applyTrustedDesignApprovals`가 작업을 등록한다. UI 설계/브라우저, DB, Gold·권리, 고위험 작업 승인 규칙을 대체하지 않는다. 승인된 설계도 원본 증거가 바뀌면 채택을 거부한다.

구현은 허용 범위에서 파일을 수정하고 실제 테스트 결과를 보고한다. 컨트롤러가 범위·HIGH 위험·증거를 확인하고 `git commit --only`로 해당 파일을 커밋한다. `--no-verify`, 강제 push, 원격 개발 호출은 없다. 반대 AI가 해당 HEAD를 검토한다. 비정상 종료·판독 불가·REVIEW_UNKNOWN·P0/P1은 통과가 아니다. 같은 TASK의 기존 제한된 수정 루프로 환류한다. 동적 리뷰는 다른 HEAD에 캐시를 옮기지 않는다. 완료 후 기존 로컬 통합 게이트를 자동 실행하고 실패하면 다음 작업으로 진행하지 않는다. 성공하면 Goal Check 후 의존 작업을 고른다.

Codex는 구현에 workspace-write, 나머지에는 read-only를 사용한다. 사용자 rules/hooks/auth 설정은 유지하고 MCP 서버만 비활성화한다. Claude는 strict MCP 0, 명시적 도구 허용과 dontAsk를 사용한다. 분석/설계에는 테스트 실행 도구도 허용하지 않는다. 검토/검증에는 허용된 테스트만 실행할 수 있다. 테스트는 셸 리디렉션 없이 실행하고 실제 출력을 파일 도구로 로그에 보존한다. 자동 실행은 DB sentinel 환경을 사용한다. 기존의 같은 OS 계정 신뢰 모델이며 테스트 코드 자체의 악성 행위까지 격리하는 컨테이너는 아니다.

`node bin/vfc.mjs perf --json`은 역할별 호출 시간, 검증 실패, 재작업 비율, 발견한 P0/P1, 개입·컨트롤러 GitHub 호출을 기록한다. Codex 구독 CLI는 USD 비용을 제공하지 않으므로 비용 합계는 **부분 측정**이다. 시간·왕복 상한은 유지한다. 검출 재현율과 일반적인 속도 향상은 레이블된 결함 집합·대조 실험 없이 주장하지 않는다. `poc/dynamic-local-proof.mjs`, `--fixed`, `--adaptive`는 임시 저장소/별도 VFC_ROOT에서 실제 CLI, 결함 주입, 2개 연속 작업, 로컬 통합을 비교한다. adaptive는 앞선 성공 실험의 실제 측정값을 입력으로 받는다. GitHub CLI guard가 시도를 차단·계수한다. 합성 실증은 실제 학습 효과나 플랫폼 전체 완료 증거가 아니다.

## 2026-10-19 실증

동일한 합성 작업 2개·환경·수용 기준·NaN 결함 주입을 사용했다. 각 실험은 기존 실행기의 실제 Codex/Claude CLI, 반대 AI 리뷰, 같은 TASK의 P1 수정, 로컬 통합 2회, 최종 Goal Check를 통과했다. 기본 고정 배분과의 비교는 아래와 같다.

| 경로 | 총시간 | 실제 모델 호출 | 결과 |
|---|---:|---:|---|
| 고정: Codex 기획 → Claude 구현 → Codex 리뷰 | 253.683초 | 8 | 통과 |
| 양방향 기능 확인: 두 번째 작업 Codex 구현 | 378.417초 | 8 | 통과, 이 작업에서는 더 느림 |
| 측정 기반 선택, 기획/구현 별도 호출 | 267.626초 | 8 | 통과, 전체 시간 개선 없음 |
| 측정 기반 선택 + 저위험 기획/구현 결합 | 189.252초 | 6 | 통과, 대조군 대비 25.4% 단축 |

양방향 A/B, 실제 AI 간 설계 반례 → 수정안 수용, 독립 P1 검출 → 자동 수정, 연속 작업·로컬 통합·Goal Check, GitHub CLI 시도 0을 확인했다. 새로운 설계의 사람 승인 여부는 계속 `null`이며, 원래 코드가 같은 설계 검토 결과는 HEAD와 원문 해시를 보존해 재사용했다. P2 수치 경계 지적은 `AI_VERIFIED_WITH_LIMITS / PROPOSED`로 보존했다.

전체 회귀 225개에서 예산 중단 사유 표시 1개가 실패해 수정했고, 변경 영향에 해당하는 최종 20개 검사는 통과했다. 나머지 결과는 재사용했다. Claude 독립 코드 리뷰는 APPROVE이며, 후속 P2 중 잘못된 호출 경로 지적은 실제 중앙 호출자/실험으로 반증했고, planner 측정 검증·owner-worker 측정 전달·Work 비활성 선택·오류 표기를 보완했다. 최초 실패 기록도 삭제하지 않았다.

**판정: ACCEPT_WITH_LIMITS.** 이 단일 대조 실험은 25.4% 단축을 관찰했다. 플랫폼 전반의 일반적 속도 향상, 검출 재현율, 전체 USD 비용은 검증하지 않았다. 제품 UI를 바꾸지 않아 제품 브라우저 E2E는 실행하지 않았다. 실제 제품·DB·콘텐츠·학습 효과 완료도 이 실증에서 계산하지 않는다. 기계 판독 근거: [검증 패킷](../verification/dynamic-local-roles-20261019.json).
