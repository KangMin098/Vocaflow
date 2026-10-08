`ai-control` 브랜치를 읽기 전용으로 확인했습니다. **새 P1 결함 1건**을 확인했습니다.

| 번호 | 판정 | 파일:줄 근거와 확인 내용 |
|---|---|---|
| 1 | **PARTIAL** | stale 회수는 세대 마커 안에서 재검사합니다([lock.mjs:184](D:/workspace/Vocaflow-AI-Control/lib/lock.mjs:184)). 그러나 죽은 마커 제거 자체의 검사→rename 경쟁은 남아 있습니다([lock.mjs:89](D:/workspace/Vocaflow-AI-Control/lib/lock.mjs:89), [CONCURRENCY.md:23](D:/workspace/Vocaflow-AI-Control/docs/CONCURRENCY.md:23)). |
| 2 | **PARTIAL** | release·heartbeat도 세대 보호를 사용합니다([lock.mjs:212](D:/workspace/Vocaflow-AI-Control/lib/lock.mjs:212), [lock.mjs:223](D:/workspace/Vocaflow-AI-Control/lib/lock.mjs:223)). 다만 1번의 마커 제거 경쟁이 발생하면 배타성이 깨질 수 있습니다. |
| 3 | **PARTIAL** | owner·독립 리뷰어 검사는 구현됐습니다([tasks.mjs:56](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:56), [tasks.mjs:395](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:395)). 하지만 reject에는 리뷰 파일 검사가 없고([tasks.mjs:412](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:412)), complete는 디렉터리도 허용합니다([tasks.mjs:399](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:399)). `--reviewer`도 `--by` 대신 `--owner`가 우선하는 `caller()`와 비교합니다([vfc.mjs:60](D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs:60), [vfc.mjs:245](D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs:245)). |
| 4 | **PARTIAL** | 저널 커밋·재적용·커밋 후 반납은 구현됐습니다([state.mjs:93](D:/workspace/Vocaflow-AI-Control/lib/state.mjs:93), [state.mjs:124](D:/workspace/Vocaflow-AI-Control/lib/state.mjs:124)). 제품 `.agent-lock`은 고아 정리 대상에서 빠져 크래시 복구가 불완전합니다([tasks.mjs:283](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:283)). 아래 P1 참조. |
| 5 | **RESOLVED** | 파싱 가능한 본만 `.bak`으로 복사하고, 손상 본은 별도 보존합니다([fsutil.mjs:51](D:/workspace/Vocaflow-AI-Control/lib/fsutil.mjs:51)). |
| 6 | **RESOLVED** | 시작 시 worktree 필수·소유 검사, realpath 및 Windows 소문자 정규화가 있습니다([tasks.mjs:305](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:305), [paths.mjs:41](D:/workspace/Vocaflow-AI-Control/lib/paths.mjs:41)). |
| 7 | **RESOLVED** | `.agent-lock`을 `wx`로 생성하고, 읽기 실패·다른 소유자는 거부하며 반납 시 token을 검사합니다([tasks.mjs:230](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:230), [tasks.mjs:255](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:255)). 크래시 정리 문제는 별도 P1입니다. |
| 8 | **RESOLVED** | `approval_required`와 승인 종류의 모순을 양방향으로 거부합니다([tasks.mjs:149](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:149)). |
| 9 | **RESOLVED** | 대상별 DB 소유자 중복을 거부하고 기존 범위 변경에 APPROVED 결정을 요구합니다([tasks.mjs:69](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:69)). |
| 10 | **PARTIAL** | type·covers·현재 run·전부 pass/skip 0 검사는 구현됐습니다([tasks.mjs:352](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:352), [tasks.mjs:400](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:400)). 그러나 `Date.parse`는 비 ISO 문자열도 허용하고 미래 5분까지 받습니다. artifact도 파일 여부 없이 존재만 검사합니다([tasks.mjs:357](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:357)). |
| 11 | **PARTIAL** | PASS/FAIL 증거·사유 검사와 `reported_only` 갱신은 있습니다([tasks.mjs:479](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:479), [tasks.mjs:492](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:492)). 하지만 문자열 접두사 검사라 `verification/../README.md`도 통과하며 디렉터리도 허용합니다([tasks.mjs:482](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:482)). |
| 12 | **RESOLVED** | 명시 ID 형식·중복 검사·sequence 증가·자동 ID 충돌 회피가 있습니다([tasks.mjs:127](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:127), [tasks.mjs:155](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:155)). |
| 13 | **PARTIAL** | 재봉인 승인·종류·버전 일치 검사는 구현됐습니다([vfc.mjs:138](D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs:138)). 그러나 manifest가 JSON `null` 또는 `false`이면 `if (man)` 때문에 schema·필수 파일·버전·승인일 검사를 전부 건너뜁니다([goals.mjs:154](D:/workspace/Vocaflow-AI-Control/lib/goals.mjs:154)). |
| 14 | **PARTIAL** | 문자열/배열 검사와 전략·플랫폼 범위 검사는 강화됐습니다([goals.mjs:101](D:/workspace/Vocaflow-AI-Control/lib/goals.mjs:101), [goals.mjs:217](D:/workspace/Vocaflow-AI-Control/lib/goals.mjs:217)). acceptance의 `status`가 `null`·`false`·`0`·빈 문자열이면 검사를 건너뜁니다([goals.mjs:106](D:/workspace/Vocaflow-AI-Control/lib/goals.mjs:106)). |
| 15 | **RESOLVED** | request ID·sha256 중복 판정을 상태 트랜잭션 안에서 수행하고, 보관 이동을 커밋 후 실행합니다([vfc.mjs:305](D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs:305), [vfc.mjs:311](D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs:311)). |

**새 P1 — 커밋 후 크래시가 제품 worktree를 자동 복구할 수 없는 잠금 상태로 남깁니다.**

`submit`·`block`·`fail`은 커밋 전에 `product_lock_token`을 `null`로 지우고, 실제 삭제는 메모리의 after-commit 콜백에 맡깁니다([tasks.mjs:340](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:340)). 상태 커밋 후 콜백 실행 전에 CLI가 종료되면 `.agent-lock`은 남지만 소유 token은 상태에서 사라집니다. 고아 정리는 runtime의 task/worktree/db 잠금만 처리하고, reap도 이미 REVIEW/BLOCKED/FAILED인 작업을 건너뜁니다([tasks.mjs:283](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:283), [tasks.mjs:455](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:455)).

구체적으로 `submit`이 커밋된 직후 CLI가 죽고 다른 에이전트 PID로 다음 작업을 시작하면, 남은 `.agent-lock` 때문에 `PRODUCT_LOCK_HELD`로 거부됩니다. 기존 에이전트가 살아 있으면 stale 복구도 기대할 수 없어 수동 정리가 필요합니다. 해당 회귀 테스트는 이 파일을 **직접 삭제한 뒤** 재시작합니다([control.test.mjs:610](D:/workspace/Vocaflow-AI-Control/tests/control.test.mjs:610), [control.test.mjs:613](D:/workspace/Vocaflow-AI-Control/tests/control.test.mjs:613)).

새 P0는 확인하지 못했습니다. **30개 테스트는 실행하지 않았습니다.** 셸 실행 도구가 초기화 오류로 실패했고, 테스트 자체도 임시 파일을 작성하므로 읽기 전용 조건에서 실행하지 않았습니다. 통과 결과를 주장하지 않습니다.
