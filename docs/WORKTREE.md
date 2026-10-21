# Vocaflow — 브랜치·worktree·개발 서버 운영

> 2026-10-21 사용자 개발환경 정리 지시. 공통 정책은 [AGENTS.md](../AGENTS.md), 검증은 중앙 `D:/workspace/Vocaflow-AI-Control/config/dev-mode.json`의 `development_policy`를 따른다. 목적은 작업 연속성·성과 보존·통합 속도·병렬 쓰기 충돌 방지다.

## 1. 작업 공간 선택

1. 현재 목적과 같거나 관련 수정이면 현재 브랜치에서 이어 간다.
2. 기획 → 설계 → 구현 → 테스트 → 개선이나 AI 교대는 브랜치 변경 사유가 아니다.
3. 다른 목적도 해당 기능의 기존 공간부터 찾는다. 다른 담당자의 쓰기 소유가 있으면 읽기 전용으로 확인한다.
4. 독립 신규 개발 또는 실제 동시 쓰기 충돌에만 분리한다. 신규 생성 자체에 사람 승인 게이트를 추가하지 않는다.
5. 통합 완료 후 새 독립 작업은 최신으로 확인된 main 기준으로 시작한다. 읽기 전용 분석·설계·검토는 새 브랜치 불필요다.
6. 미커밋 공간을 임의 전환·stash·일괄 커밋하지 않는다. 소유와 목적이 불명확하면 보존한다.

시작할 때 `git status --short --branch`, `git worktree list --porcelain`으로 실제 상태를 확인한다. 이름만으로 소유·반영 여부를 추정하지 않는다. 오래된 브랜치는 통합 누락 점검 대상이며 나이만으로 폐기하지 않는다.

## 2. 기준 브랜치와 통합

| 기준 | 용도 | 확인 |
|---|---|---|
| `origin/main` | 마지막으로 가져온 원격 최종 기준 | 원격 조회/fetch 성공 여부와 SHA |
| 로컬 `main` | 최종 통합·플랫폼 실행 기준 | `git rev-list --left-right --count main...origin/main` |
| `local/integration` | 병렬 작업의 임시 통합·검증 | main 대비 실제 diff와 미반영 기능 |
| 기능 브랜치 | 이어지는 하나의 목적 | 수정·테스트에서도 유지 |

LOCAL_FAST는 로컬 구현·영향 범위 검증·커밋·로컬 통합으로 이어 간다. 기존 등록 작업은 중앙 `bin/local-integrate.mjs --task <ID>`를 재사용한다. 일반 작업에 등록·큐·새 공간·AI 교차 리뷰를 의무화하지 않는다. integration의 유효 변경은 최신 main 기반 임시 공간에서 합쳐 검증하고 main으로 수렴한다. 기존 작업 공간을 강제로 바꾸지 않는다.

공식 원격 정리가 요청되면 GITHUB 절차를 명시하고 `safe-merge.mjs --scope-file <계약.json>`의 범위·HEAD·필수 CI·DB 적용 이력 보호를 유지한다. main 직접 push·force push·`--no-verify`는 금지다. 원격 실패는 로컬 통합과 별도로 BLOCKED로 보고한다. 코드 병합·DB 적용·서버 반영은 각각 확인한다. 실제 DB 구조·데이터 변경과 삭제는 명시적 사용자 승인 후에만 실행한다. `_pending_` SQL은 제안 상태다.

## 3. 두 AI의 작업 소유

Claude Code는 구현·수정·실행·화면 검증, Codex는 분석·기획·설계·독립 검토 및 필요한 구현을 기본으로 한다. 강제 분할은 아니며 한 세션이 끝낼 수 있는 일반 작업은 직접 끝낸다.

같은 공간에서 동시에 쓰지 않는다. `node agents/scripts/lock.mjs status`로 확인하고 쓰기 전 `acquire <agent>`, 완료 후 `release <agent>`를 사용한다. 다른 담당자의 잠금은 읽기 전용이다. 읽기 전용 검토는 같은 브랜치에서 가능하며 독립 동시 쓰기에만 별도 공간을 사용한다. 같은 app-server PID로 여러 대화가 실행될 수 있으므로 PID 일치만으로 다른 대화의 소유를 인수하지 않는다.

AI 교대는 현재 브랜치와 검증·남은 일을 전달한다. 일반 단독 작업에 인계 양식·ACK·반대 AI 리뷰를 요구하지 않는다. 명시적 독립 검토 계약은 유지한다. 커밋은 자기 경로만 `git commit --only <paths>`로 한다. Git merge 도중에는 `--only`가 불가능하므로 자기 전용 통합 공간의 전체 범위를 확인한 뒤 병합 커밋한다. 훅은 인덱스를 수정하지 않는다.

## 4. pnpm wt

```sh
pnpm wt list
pnpm wt new <suffix> [base]
pnpm wt new <suffix> [base] --no-install
pnpm wt remove <suffix> [--del-branch]
pnpm wt sync
```

`new`는 `feat/<suffix>`를 체크아웃한 기존 공간이 있으면 경로를 알려 주고 종료하며 파일·브랜치·서버·의존성을 바꾸지 않는다. 없으면 `../Vocaflow-<suffix>`에 생성한다. 기본 base는 현재 확인 가능한 `origin/main`이며 없으면 로컬 `main`이다. 이 명령은 fetch하지 않으므로 최신 원격 확인이 필요하면 먼저 명시적으로 fetch한다. 임의 이름의 기능 공간은 `wt list`에서 찾아 직접 재사용한다. 설치는 새 공간에서만 실행하며 `--no-install`로 생략한다. Windows PowerShell 정책이 `.ps1` 래퍼를 막으면 설치된 `pnpm.cmd`를 사용하고 보안 정책을 바꾸지 않는다.

`remove`는 실제 등록된 공간의 브랜치를 확인한다. 소유 잠금·미통합 커밋·분리 HEAD를 보존하고, Git이 수정/미추적 파일이 있는 공간 제거를 거부하면 중단한다. `--del-branch`는 실제 브랜치에 안전한 `git branch -d`만 쓴다. 강제 삭제·자동 stash·reset·clean을 하지 않는다.

## 5. 포트와 실행 버전

| 포트 | 목표 용도 |
|---|---|
| 3000 | main 전용 공간의 통합 플랫폼 |
| 3001 | integration 임시 검증 |
| 3100·3200 등 | 실제 필요한 독립 개발/전환 전 검증 |

이는 목표 배치다. 현재 점유 상태를 확인하지 않고 포트에 브랜치를 할당했다고 보고하지 않는다. PID·실행 폴더·HEAD·미커밋·빌드 출처를 확인한다. `next start`는 빌드 시점을 실행하므로 현재 HEAD만으로 실행 버전을 단정하지 않는다.

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,3001,3100,3200 } | Select-Object LocalPort,OwningProcess
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'next' } | Select-Object ProcessId,ParentProcessId,CommandLine
```

Next 개발 서버의 `apps/web/.next*/.dev-server-owner.json`에는 실제 cwd·PID가 기록된다. 표식과 살아 있는 프로세스를 대조한다. 표식 부재만으로 서버 부재를 단정하지 않는다. 3000 전환은 성과 보존·쓰는 담당자의 종료/이관·목표 main 검증 후 한다. 다른 세션의 프로세스를 임의 종료하지 않는다. 점유 중이면 빈 포트에서 검증하고 전환은 미충족 상태로 남긴다.

같은 공간의 dev/build는 `NEXT_DIST_DIR`로 분리하며 살아 있는 서버의 산출물을 덮거나 지우지 않는다. 산출물 정리도 실제 경로·사용 여부·복구 가능성을 확인한다.

## 6. PR 분류와 보존

INTEGRATED는 현재 통합 기준에서 변경이 보존됨, READY는 유효하고 통합 가능함, SUPERSEDED는 대체 구현으로 중복임, BLOCKED는 충돌·DB 승인·외부 권한 미충족, ACTIVE는 다른 세션 진행 중이다. 로컬 integration과 원격 main 반영은 각각 표시한다.

중복 PR은 필요한 파일·동작·이력이 보존됐는지 확인한 뒤 닫는다. ACTIVE PR은 임의 수정·종료하지 않는다. 오래됐거나 커밋이 적다는 이유로 폐기하지 않는다. 실제 정리 결과·실행 버전·미실행 검증·승인 대기를 구분해 보고한다.
