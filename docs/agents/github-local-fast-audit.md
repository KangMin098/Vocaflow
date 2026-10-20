# GitHub·CI 최소화 점검 — 2026-10-20

사용자 요청: 기존 최소화 설정을 확인하고 현재 작업에 적용한다. 점검 범위는 이 디자인 worktree의 지침·공통 에이전트 진입점과 중앙 모드다. 중앙 설정과 다른 worktree의 파일은 수정하지 않았다.

## 확인한 정본과 불일치

- 중앙 `D:/workspace/Vocaflow-AI-Control/config/dev-mode.json`: **LOCAL_FAST**. 정본 구현은 중앙 `lib/devmode.mjs`다. 기준 통합 브랜치는 `local/integration`, 통합 worktree는 중앙 설정이 지정한다.
- 일반 개발: 로컬 구현 → 영향 범위 검증 → 로컬 커밋 → 독립 리뷰 → 중앙 `bin/local-integrate.mjs --task <ID>`. 일반 push·PR·Actions 조회·원격 CI 대기·원격 병합은 하지 않는다.
- 원격 예외: 중앙 `bin/backup.mjs`의 하루 최대1회/복구 시점과 기존 Work Bridge. 별도의 push로 백업 상한을 우회하지 않는다.
- 이 worktree의 AGENTS.md는 milestone마다 push를 요구했고 safe-merge는 모드 확인 없이 fetch/PR/체크를 조회했다. 다른 최신 worktree에 적용된 모드 어댑터가 이 오래된 디자인 worktree에는 없었다.

## 적용

| 위치 | 변경 |
|---|---|
| AGENTS.md·PR_AUTOMATION_POLICY.md·router.md·WORKTREE.md | 중앙 실행 모드 우선, 기본 로컬 통합, GITHUB 절차의 적용 범위 명시 |
| agents/scripts/execution-mode.mjs | 중앙 설정을 읽는 어댑터. VFC_ROOT·VFC_DEV_MODE 반영, 사본 생성/원격 조회 없음. 설정 오류는 원격 모드로 승격하지 않음 |
| handoff-inject.mjs | 매 세션에 현재 모드 안내. LOCAL_FAST에서 오래된 원격 정책 동기화를 유도하지 않음 |
| safe-merge.mjs | LOCAL_FAST에서 --dry-run·--wait도 fetch/gh/Actions 조회 전에 종료 |
| 실행 모드·인수인계 회귀 | Git/gh가 없는 환경에서도 원격 진입 전 종료, 모드 우선순위/오류/세션 주입 확인 |
| ci.yml·sync-check.yml | PR별 실행 그룹/이전 PR 실행 취소. main 공유 DB 검사는 자동 취소하지 않음. 토큰 contents:read |
| sync-check.yml push | main만 유지해 PR이 있는 작업 브랜치의 push/PR 중복 검사를 줄임. 모든 base의 PR 진입/기존 필수 체크는 유지 |
| workflow-budget.test.mjs | YAML 문법·PR 필터 없음·main push·취소 범위·필수 체크8개·예약 감사/배포/격리 E2E 보존을 로컬에서 검사 |

기존 GITHUB의8개 필수 체크·승인/HEAD 결속·브랜치 보호 계약은 유지했다. 원격 CI 부재를 로컬 작업 실패로 취급하지 않으며, 미실행 로컬 검증을 통과로 표시하지 않는다. 중앙의 자동 리뷰 설정은 이 작업에서 변경하거나 실행하지 않았다.

## CI 점검 결과와 한계

로컬 파일과 로컬 origin/main 캐시를 읽었으며 GitHub API·fetch·push·PR·Actions 조회/실행은 호출하지 않았다. 원격의 현재 workflow 활성화 상태·최근 사용량·저장소 변수는 조회하지 않았으므로 확인 완료로 주장하지 않는다.

| 로컬 워크플로 | 트리거 | 처리 |
|---|---|---|
| ci.yml | main push·PR·수동 | 기존 필수 검증 유지. LOCAL_FAST는 일반 개발 push/PR을 하지 않으므로 이 개발 흐름으로 원격 CI를 유발하지 않음 |
| sync-check.yml | main push·모든 base의 PR | chore/feat/fix push 중복을 로컬 설정에서 제거. 개발/로컬 통합은 중앙 로컬 게이트로 진행 |
| deploy.yml | main push·수동 | 배포 설정 유지, 이번 작업에서 배포 호출 없음 |
| csat-source-audit.yml | 매일19:20 UTC·수동 | 기존 예약 무결성 감사 유지. LOCAL_FAST만으로 이 원격 예약 실행이 중지되지는 않음 |

**전체 Actions가 꺼진 설정은 아니다.** 이번 적용은 기존 LOCAL_FAST의 일반 개발 계약을 이 worktree에 연결한 것이다. 예약 감사 중단이나 GITHUB 모드의 필수 CI 축소는 적용하지 않았다. 불필요한 CI 반복을 피하기 위해 새로운 원격 조회/수동 실행/취소 루프도 만들지 않았다.

후속 요청 「쓰기 권한 제한 해제」 뒤 정상 git add를 다시 시도했지만 worktree 바깥 metadata의 index.lock Permission denied가 재현됐다. 일반 소스 파일 수정은 가능하다. 위2개 workflow 변경은 로컬 파일에 준비한 상태이며 GitHub에 반영됐거나 실제 실행량이 감소했다고 주장하지 않는다. 원격 조회/실행은 하지 않았고, 기존 job 본문/검증 단계는 수정하지 않았다.

## 검증·남은 것

- 최신 에이전트 회귀162/162 통과(실패·skip0). 모드/기존 병합 계약 관련25/25와 workflow 회귀5/5 포함.
- `node agents/scripts/check.mjs`15/15·diff/구문 검사 통과. 실제 중앙 설정의 safe-merge dry-run도 LOCAL_FAST 안내/종료코드3으로 원격 전에 종료했다.
- 정상 로컬 커밋은 Git metadata 쓰기 제한의 영향을 받는다. 이것은 원격 CI 미실행과 별개의 제한이다. 원격 작업을 다시 켜서 해결하지 않는다.
- 학습자 화면 작업은 대표4의 방향 유지 승인을 반영하며 나머지 렌더/상호작용 검증을 계속 요구한다. GitHub 최소화를 검증 생략으로 해석하지 않는다.

## Git 권한 복구 후속 — 2026-10-20

사용자 첨부 지시로 **이번 LOCAL_FAST 변경의 원격 납품(push·PR·필수 CI 확인)**을 일회성 허용했다. 앞 절의 원격 미실행은 최소화 점검 당시 기록이며 이번 허용을 막는 지침이 아니다. 중앙 기본 모드는 LOCAL_FAST로 유지한다. 이번에는 CI 코드를 추가 변경하지 않았다.

### 원인 판정과 증거

| 항목 | 실제 확인 |
|---|---|
| worktree | `D:/workspace/Vocaflow-learner-tines-audit` |
| Git dir | `D:/workspace/Vocaflow/.git/worktrees/Vocaflow-learner-tines-audit` |
| common dir | `D:/workspace/Vocaflow/.git` |
| index | Git dir 아래 `index`; worktree 바깥 |
| index.lock·진행 작업 | 잠금 파일 없음, Git 프로세스 없음, merge/rebase 상태 없음 |
| 파일 속성·ACL | metadata 디렉터리 Directory; 소유자 Administrator. ACL에 명시적 Deny Write/Delete 등이 있고 CodexSandboxUsers의 Allow Modify도 함께 있음. ACL은 변경하지 않음 |
| 실제 실행 정책 | worktree만 쓰기 허용, 네트워크 제한, 승인 정책 never. 저장소 config의 on-request와 달리 현재 주입된 정책이 우선 |
| 세션 소유 | 읽기 전용 부모 조회로 PowerShell → codex-command-runner → codex PID21420을 확인한 후 해당 PID로 잠금 획득 |
| 앞 회차 오류 | 정상 git add가 위 Git dir의 index.lock 생성에서 Permission denied. 같은 실패 명령은 이번에 반복하지 않음 |
| 외부 대조 | 샌드박스 밖 일반 PowerShell 성공/실패는 미측정. 이 도구에서 자식 PowerShell을 띄워도 외부 대조가 아님 |

**LOCK_EXISTS는 제외. SANDBOX_DENIED가 유력하나 외부 대조가 없어 확정하지 않는다. OS_PERMISSION_DENIED 여부도 미확정**이다. 현재 세션에 Git metadata 쓰기 허용이 없다는 실행 제약은 확인됐다. 사용자 승인과 실제 도구 권한을 동일시하지 않는다.

OpenAI 공식 문서도 명령과 자식 프로세스가 활성 파일/네트워크 제한을 따르며 승인 정책은 별도 제어라고 설명한다([Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox), [Sandbox](https://learn.chatgpt.com/docs/sandboxing)).

### 실행기·커밋 범위

- 기존 `bin/owner-worker.mjs`는 등록된 owner/task를 실행하는 구현 워커다. `bin/local-integrate.mjs`는 결속된 task·검증 커밋·리뷰를 요구하는 통합기다. 읽은 경로에서 이 작업에 바로 사용할 독립 Git 실행기는 확인되지 않았다. 이 worktree에 결속된 중앙 task도 없으므로 임의 ID·타 세션 PID·워커 기동으로 제한을 우회하지 않는다.
- 설정 범위는 기존 `tmp/github-minimize/policy-paths.txt`의 **15파일**이다. 누적 디자인 작업은 전체 **125파일** 보존 목록에 따로 남는다. tmp·인증 상태·debug.log·미사용 v2/v3 그림은 제외한다.
- `docs/CHANGELOG.md`에는 디자인 변경도 함께 있으므로 파일 전체를 설정 커밋에 넣지 않는다. 별도 준비한 `policy-only.patch`는 HEAD의 CHANGELOG에 이번 설정/진단 항목만 더한 내용이다. 기존 본문을 지우지 않고 별도 snapshot에서 적용을 검사한다.
- 현재 브랜치는 로컬 `origin/main` 캐시 대비 **23커밋**을 이미 포함한다. 이 브랜치 PR을 설정15파일만의 PR이라고 보고하면 안 된다. Git 권한 복구 후 실제 원격 기준을 한 번 확인하고 기존 PR 범위에 포함하거나 별도 설정 브랜치를 사용한다.

### 납품 상태

| 항목 | 결과 |
|---|---|
| 기존 소스/디자인 보존 | 누적 패치와 소유 파일 목록 유지; 삭제·초기화 없음 |
| 로컬 에이전트 회귀 | 162/162 PASS, 실패/skip0(기존 최신 로그) |
| 설정 검사 | 15/15 PASS |
| 커밋 | BLOCKED — metadata 쓰기 허용 없음; HEAD `e0dcdcbc13309ebf60638d293e3b9f20fdf5328c` 유지 |
| push·PR | BLOCKED — 신규 커밋 없음; 원격 반영/PR 생성 안 함 |
| 원격 필수8체크 | 전부 미검증; 로컬 PASS로 대체하지 않음 |
| 재발 방지 위임 검증 | 미실행; 외부 실행기/ACL/샌드박스 설정을 새로 만들거나 변경하지 않음 |

필수 체크: `verify`, `build`, `e2e`, `TypeScript 0 error`, `docs/*.md broken link check`, `migration ↔ docs/DB_SCHEMA / CHANGELOG 정합`, `docs/CHANGELOG.md Unreleased 비어있지 않음`, `PROJECT_KNOWLEDGE_MANIFEST drift 점검`. 보호 규칙/필수 체크 목록은 수정하지 않았다.

재개 조건은 **실제 Git dir와 common dir 쓰기가 허용되는 실행 세션** 또는 관리자가 제공한 승인 가능한 Git 작업 도구다. 단순 채팅 승인·repo config 편집은 현재 세션의 never 정책을 바꾸지 않는다. 외부 일반 PowerShell 대조 후에도 실패하면 OS 권한 문제를 추가 조사한다. 복구 전 같은 Git 쓰기 명령을 반복하지 않는다.
