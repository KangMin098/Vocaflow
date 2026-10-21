# GitHub·CI 최소화 점검 및 적용 — 2026-10-20

현재 중앙 설정은 이미 **LOCAL_FAST**다. 이번 관리자 작업이 구 GitHub 절차를 따른 원인은 저장소 안내·세션 시작·원격 병합 도구에 중앙 모드 연결이 없었던 것이다. 중앙 설정을 바꾸거나 복제하지 않고 연결을 보완했다. 이 수정은 현재 관리자 작업 브랜치의 로컬 변경이며 다른 기존 워크트리에 자동 배포됐다는 뜻은 아니다.

## 실제 설정과 충돌

| 항목 | 직접 확인한 값/동작 | 적용 |
|---|---|---|
| 중앙 모드 | `D:/workspace/Vocaflow-AI-Control/config/dev-mode.json`: `LOCAL_FAST` | 중앙 파일 우선, `VFC_ROOT`·명시적 `VFC_DEV_MODE` 반영 |
| 로컬 통합 | `local/integration`, `D:/workspace/Vocaflow-integration` | 중앙 `bin/local-integrate.mjs --task <ID>`의 검증·독립 리뷰·커밋 일치 게이트 유지 |
| 원격 백업 | `backup/local-integration`, `max_per_day: 1` | 중앙 `bin/backup.mjs`만 사용, 중요 복구 시점 추가 허용. 이번 점검에서는 백업을 새로 실행하지 않음 |
| 기존 작업 안내 | milestone마다 push, PR·CI를 일반 완료 경로로 안내 | LOCAL_FAST의 로컬 커밋·리뷰·통합이 우선한다고 정정 |
| 기존 safe-merge | dry-run도 `git fetch`·여러 `gh` 조회 수행 | LOCAL_FAST는 해당 호출 전 종료. GITHUB의 필수 체크·DB 승인·SHA 보호는 유지 |
| 세션 시작 | 원격 PR 정책 버전만 읽음 | 중앙 모드를 항상 표시. LOCAL_FAST에서는 원격 정책 동기화를 유도하지 않음 |
| 현재 관리자 작업 상태 | T-0051이 GitHub Actions 장애로 BLOCKED | GitHub 대기를 로컬 개발 blocker로 삼지 않음. 기존 미충족 검증·수용을 통과로 바꾸지는 않음 |

중앙 `lib/devmode.mjs`, `lib/localgate.mjs`, `bin/local-integrate.mjs`, `bin/backup.mjs`를 읽어 실제 경로·게이트를 확인했다. 통합 브랜치나 공유 개발 DB를 이번 점검에서 수정하지 않았다. 중앙 백업은 기존 UTC 일자 기준으로 상한을 센다.

## 이전 흐름과 변경된 흐름

| 단계 | 이전 관리자 작업 | 현재 LOCAL_FAST |
|---|---|---|
| 구현·수정 | 로컬 구현 후 단계마다 원격 push | 로컬 구현·검증·커밋 |
| 검증 | 같은 범위의 로컬 검증과 원격 전체 CI 반복 | 변경 영향에 맞는 로컬 타입·lint·관련 회귀. 필요한 PC/E2E는 수행 범위를 따로 기록 |
| 통합 | PR → CI 폴링 → safe-merge | 독립 리뷰·증거·정렬·승인 게이트 → 중앙 로컬 통합 |
| 외부 장애 | GitHub 장애로 로컬 작업까지 중단 | 원격 결과와 로컬 개발 상태를 분리 |
| 원격 호출 | PR이 열린 feature push에서 sync-check(push/PR)와 CI(PR)가 중복 시작 가능 | 일반 개발 push·PR·Actions 조회/대기·원격 병합 0 |
| 백업 | 각 단계 push | 중앙 백업의 하루 상한·복구 시점만 |

원격 CI 검증을 삭제하거나 성공으로 위조해서 최소화하지 않는다. `.github/workflows/*`, 원격 보호 설정, `pr-automation.json`의 필수 체크 목록은 변경하지 않았다. 명시적으로 GITHUB 모드를 선택하면 기존 원격 검증을 그대로 적용한다. LOCAL_FAST에서는 일반 push가 없고 기존 백업 ref가 feature/main 트리거에 해당하지 않으므로 개발 도중의 중복 Actions를 시작하지 않는다. 백업·설계 교환 외에 원격 배포를 하려면 해당 작업의 별도 범위를 따른다.

## 이번 작업에 적용한 정리

- 내 브랜치 `feat/admin-restructure-20261019`의 Actions 실행을 한 번에 조회했다. 15개가 조회됐으며 진행·대기 중인 취소 대상은 **0개**였다. 취소했다고 보고하지 않는다. 다른 브랜치·다른 사람의 실행은 건드리지 않았다.
- 추가 push·새 PR·PR 본문 갱신·Actions 폴링·원격 병합을 중단했다. 기존 PR #317과 CI 결과는 과거 기록으로 보존한다.
- 세션 안내, 원격 호출 전 중단, 명시적 GITHUB의 기존 게이트 보존을 회귀로 확인한다. 설정 파일 없음은 LOCAL_FAST, 깨진 설정·알 수 없는 모드는 오류로 중단한다.
- 로컬 통합은 독립 수용과 중앙 게이트 통과 후에만 진행한다. 이 점검 자체가 관리자 118파일의 통합 승인·제품 목표 달성·학습 효과 증명이 되는 것은 아니다.

검증 로그와 한 번의 원격 정리 조회 결과는 로컬 `.agent-logs/localfast-focused.log`, `localfast-agent-tests.log`, `localfast-actions-cleanup.json`에 보존한다. 새 에이전트 파일은 배포 전 워크트리별 버전을 확인해야 하며, 실행 중인 다른 세션이 이 변경을 자동으로 다시 읽는다고 가정하지 않는다.

## 검증 결과

- 에이전트 스크립트 전체 회귀 **157개 통과, 실패·생략 0**. 집중 31개는 여기에 포함되며 합산하지 않는다. 최초 전체 실행의 인수인계 테스트는 “출력 없음”을 기대해 실패했고, 공통 개발 모드는 항상 출력하되 잘못된 수신자/읽은 인수인계를 재주입하지 않는지 검사하도록 수정한 뒤 전체를 재실행했다.
- 에이전트 설정 검사 **15/15 통과**, `git diff --check` 통과.
- `git`/`gh` 실행 파일이 없는 환경에서 LOCAL_FAST의 `safe-merge --dry-run`과 `--wait`가 의도된 종료 코드 3으로 먼저 중단됨을 실행 검증했다. 설정 오류·모드 오타와 기존 GITHUB 판정 회귀도 포함한다.
- 별도 읽기 전용 소스·정책 검토 **NO_FINDINGS**. 해당 검토는 테스트 재실행·원격 조회를 수행하지 않았다.
- 이번 변경은 앱·DB·워크플로 변경이 없어 프런트 전체 빌드나 GitHub CI를 새로 실행하지 않는다. 로컬 커밋으로 보존하며 추가 push·PR을 만들지 않는다.
