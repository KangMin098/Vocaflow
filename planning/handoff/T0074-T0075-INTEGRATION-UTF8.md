<!-- planning/handoff/T0074-T0075-INTEGRATION-UTF8.md -->
# T-0074 + T-0075 공식 묶음 인계 — UTF-8

- T-0074 LOCAL_ACCEPT_WITH_LIMITS 유지. 시험 보정1914edb8d 수용.
- T-0075 rev1 HEAD7cc5b08f868273f94c08d1fc0b85f738cba622c3: ACCEPT_WITH_LIMITS / COMPLETED. T0075-P1-1 VERIFIED_FIXED.
- 독립 반례1440/1280: 재연결 중 새 풀이 잠금 → 복구 후 잠금 해제 → 새 session/mutation의 수행42 복귀 유지. 관련23/23. 변경 없는 backend64/PGlite·기존16 UI 검증 재사용. 실제 인증 Next+DB/RLS는 아직 NOT_VERIFIED.

## 실제 로컬 통합

Codex가 두 작업의 실제 변경 구간에 기존 staticGates를 각각 적용해 모두 통과시켰습니다. 단일 T0075 CLI dry-run은 동반 수용 T0074 경로를 범위 밖으로 읽고 외부 감사 파일을 dirty로 판정했습니다. 이 기록은 보존했습니다. 기존 작업 범위를 넓히거나 가드를 수정하지 않고, 각 작업의 검증 SHA·범위·리뷰 해시를 따로 검증했습니다.

로컬 main이 깨끗해진 뒤 Codex 잠금(pid16328)을 확보해 기존 localgate.integrate 함수로 아래 네 커밋만 기존 main에 병합했습니다. 코드 통합은 다시 실행하지 마세요.

- 대상: D:/workspace/Vocaflow-main-serving / main
- 통합 전 main: bc57b8b3c239c0a222ac2b47b1c3cee57061cff0
- 통합 후 main: 959961adcb41b8d0c592d44cf1ce0b834ea559ac
- 묶음: eb7c92b83 → 1914edb8d → 023c8474d → 7cc5b08f8 (4 commits / 15 paths)
- Git 병합 미리보기와 실제 tree 동일: 05cfa8f127197e4df4b819796398da281854e3bd
- 증거: verification/reviews/T-0075-r2-independent/local-main-integration.json
- 소스 worktree의 외부 감사2파일과 local/integration 브랜치는 변경하지 않았습니다. 원격 push/PR/CI/DB 쓰기도 하지 않았습니다.

## 다음 공식 원격 반영

현행 config/dev-mode.json development_policy.main_sync를 따릅니다. 로컬 main이 정본이며, 하루 한 번 기존 백업/통합 담당이 최신 로컬 main의 검증된 묶음을 sync/main-YYYYMMDD로 push해 PR 하나와 CI 한 번으로 origin/main에 반영합니다. T0074/T0075 전용 PR을 추가하지 마세요. 같은 날 sync PR이 있으면 기존 것을 사용하고, 기존 담당자·잠금·범위를 유지합니다. main 직접 push/force push/보호 규칙 변경은 금지입니다.

그 공식 묶음의 실제 HEAD에서 필수 CI와 인증 isolated journey의 다음을 확인해 반환합니다.

1. T0074: 현재 정책 통과와 delayedRetention NOT_ESTABLISHED가 함께 보이는지.
2. T0075: 실제 attempt를 저장한 뒤 응답 binding 메타 손실을 통제해, 실제 bind API 재호출로 같은 본인 attempt에 복귀하는지. 시도/G2/PLAN 행 수 불변.
3. source scope/형식·최종 CI의 실행과 skip을 구분하고 현재 safe-merge를 VFC_DEV_MODE=GITHUB 일시 전환으로 실행. exact HEAD/base/전체 경로/커밋 수를 scope-file에 결속합니다. 기존 SQL 적용 증거·승인 경계를 완화하지 않습니다.

공식 CI와 원격 병합 SHA가 반환되기 전 원격 통합·인증 검증 완료로 기록하지 않습니다. 실제3000 서버 재시작/빌드 갱신 여부도 로컬 Git 병합과 별개이며 아직 확인하지 않았습니다. 개발DB 설치A, 사람Gold B/B2, 권리C, 실제 학습 효과는 여전히 별도입니다.

## 구현 세션의 즉시 다음 행동

이 파일 수신을 같은 T0075에 ACK하고 기존 구현 HEAD를 보존합니다. 로컬 통합을 다시 하거나 작업별 PR을 열지 않습니다. 제품 branch가 로컬 main보다 뒤여도 외부 감사2파일 때문에 강제pull/stash/reset/대신커밋하지 마세요. 다음 제품 작업은 Codex가 최신 로컬 main 기준으로 선정해 같은 owner에 인계합니다. 공식 sync 담당이 현재 세션이면 위의 기존 일일 묶음 절차를 수행하고, 아니면 기존 담당 경로로 이 파일만 전달해 실제 수신을 구분해 남깁니다. 새 worker/오케스트레이터/임의 세션을 만들지 않습니다.
