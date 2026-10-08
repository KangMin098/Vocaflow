P0는 발견하지 않았습니다. **P1 11건, P2 4건**을 확인했습니다. 파일·정본·실제 `state/`는 수정하지 않았습니다.

지정 테스트는 실행했지만, 21개 모두 임시 폴더 생성 시 읽기 전용 환경의 `EPERM`으로 중단되었습니다. 따라서 테스트 통과를 주장하지 않습니다. 아래 재현은 순수 함수 또는 메모리 파일시스템에서 수행했습니다.

1. **P1 — stale 복구가 새 소유자의 살아 있는 잠금을 회수할 수 있습니다.**  
   [lib/lock.mjs:123](D:/workspace/Vocaflow-AI-Control/lib/lock.mjs:123)  
   A·B가 같은 stale 잠금을 읽은 뒤, B가 먼저 회수하고 새 잠금을 획득하면 A의 `renameSync(holder.file, dest)`가 **B의 새 잠금**을 이동합니다. 상태 뮤텍스에도 같은 문제가 적용됩니다. 메모리 재현에서 새 소유자의 token이 보관함으로 이동했습니다.  
   **수정:** 판단부터 회수·재획득까지 교체 경쟁을 막는 별도 직렬화 수단을 사용하고, 동일 잠금 세대인지 확인해야 합니다. 단순 재조회만으로는 경쟁이 해결되지 않습니다. `docs/CONCURRENCY.md:16`의 “경쟁자 중 하나만 성공” 설명도 수정해야 합니다.

2. **P1 — heartbeat·release에도 잠금 교체 경쟁이 있습니다.**  
   [lib/lock.mjs:147](D:/workspace/Vocaflow-AI-Control/lib/lock.mjs:147), [lib/lock.mjs:137](D:/workspace/Vocaflow-AI-Control/lib/lock.mjs:137)  
   token 확인 뒤 기존 잠금이 반납되고 B가 획득하면, 이전 heartbeat의 rename이 B의 잠금을 덮어씁니다. release 역시 확인 뒤 교체된 파일을 삭제할 수 있습니다. 두 경우 모두 메모리 재현했습니다. heartbeat는 Windows의 일시적 `EPERM/EBUSY`에 대한 재시도·임시 파일 정리도 없습니다.  
   **수정:** heartbeat·release·복구를 동일한 직렬화 규약으로 보호하고 잠금 세대를 확인하십시오. Windows rename 실패 처리도 공통화해야 합니다.

3. **P1 — 다른 세션의 작업을 종료하고 잠금을 해제할 수 있으며, 자기 완료도 가능합니다.**  
   [lib/tasks.mjs:256](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:256), [lib/tasks.mjs:265](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:265), [lib/tasks.mjs:285](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:285)  
   submit·block·fail은 호출자의 owner/session을 확인하지 않고 저장된 token으로 실행 잠금을 해제합니다. complete는 `reviewer !== owner_id`만 검사하므로, owner가 `--reviewer 임의이름`을 주면 자기 작업을 완료할 수 있습니다. 미등록 reviewer로 `COMPLETED`되는 것을 재현했습니다.  
   **수정:** 실행 변경은 해당 run의 owner/session과 대조하고, 완료는 등록된 독립 reviewer의 실제 세션·리뷰 기록과 연결해야 합니다.

4. **P1 — 상태 저장과 잠금 변경이 하나의 트랜잭션이 아닙니다.**  
   [lib/state.mjs:54](D:/workspace/Vocaflow-AI-Control/lib/state.mjs:54), [lib/tasks.mjs:223](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:223), [lib/tasks.mjs:236](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:236)  
   start가 에이전트 PID의 잠금을 잡은 뒤 TASK_QUEUE 저장 전에 죽으면, 작업은 READY인데 살아 있는 고아 잠금이 남습니다. `task reap`은 READY를 처리하지 않고 recover도 살아 있는 PID를 거부합니다. 반대로 submit은 저장 전에 잠금을 해제하므로 저장 실패 시 IN_PROGRESS가 잠금 없이 남습니다. 5개 상태 파일도 순차 교체되어 부분 커밋이 가능합니다.  
   **수정:** 변경 의도·잠금 token·커밋 단계를 기록하는 복구 가능한 journal 또는 트랜잭션 저장소를 사용하십시오. 현재 `after_tmp` 테스트는 이 경계를 검증하지 않습니다.

5. **P1 — 복구에 사용한 정상 `.bak`을 깨진 본 파일로 덮어씁니다.**  
   [lib/fsutil.mjs:51](D:/workspace/Vocaflow-AI-Control/lib/fsutil.mjs:51), [lib/fsutil.mjs:60](D:/workspace/Vocaflow-AI-Control/lib/fsutil.mjs:60)  
   본 파일이 깨져 `.bak`을 읽은 뒤 저장하면, 먼저 깨진 본 파일을 정상 `.bak` 위에 복사합니다. 다음 rename이 실패하면 본 파일과 백업이 모두 파싱 불가능해집니다. 메모리 고장 주입으로 재현했습니다.  
   **수정:** 검증된 마지막 정상본만 백업으로 유지하고, 손상된 본 파일은 별도로 격리하십시오. `tests/control.test.mjs:442`는 복구 후 저장 실패를 검사하지 않습니다.

6. **P1 — worktree 잠금을 생략하거나 Windows 경로 별칭으로 우회할 수 있습니다.**  
   [lib/tasks.mjs:135](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:135), [lib/paths.mjs:37](D:/workspace/Vocaflow-AI-Control/lib/paths.mjs:37)  
   worktree 없이 등록·시작할 수 있어 파일 변경 작업도 task 잠금만 잡습니다. 실제 seed의 T-0003·T-0005도 변경 허용 경로가 있지만 worktree가 없습니다. 또한 경로의 드라이브 문자만 소문자화하여 `d:/workspace/x`와 `d:/WORKSPACE/X`가 별도 소유권·잠금 키가 됩니다.  
   **수정:** 파일 변경 작업에는 실행 위치를 필수로 하고, Windows 대소문자·junction·실경로 별칭을 동일한 리소스 식별자로 정규화하십시오.

7. **P1 — 제품 `.agent-lock`과 공유 잠금이 상호 배제를 보장하지 않습니다.**  
   [lib/tasks.mjs:174](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:174), [lib/tasks.mjs:211](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:211), [참조 AGENTS.md:20](D:/workspace/Vocaflow-ai-control-ref/AGENTS.md:20)  
   vfc는 `.agent-lock`을 읽기만 합니다. 검사 후 vfc 잠금을 잡아도 기존 제품 잠금 도구는 이를 확인하지 않으므로 다른 세션이 `.agent-lock`을 획득하고 동시에 쓸 수 있습니다. 깨진 `.agent-lock`도 안전하게 거부하지 않고 없는 잠금처럼 처리합니다.  
   **수정:** 두 도구가 동일한 잠금 규약을 사용하도록 연결하고, 불완전한 잠금은 확인될 때까지 차단해야 합니다. AGENTS의 보장 표현도 구현에 맞춰야 합니다.

8. **P1 — 명시적인 `approval_required:true`를 무시합니다.**  
   [lib/tasks.mjs:121](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:121), [lib/tasks.mjs:140](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:140)  
   승인 필요 여부를 `approval_kinds`만으로 다시 계산합니다. `approval_required:true`만 지정한 spec은 false로 등록되는 것을 재현했습니다.  
   **수정:** 명시적 승인 요구를 보존하고, 승인 종류가 필요하다면 누락을 오류로 거부하십시오.

9. **P2 — DB 쓰기 소유권을 기록 없이 복제·덮어쓸 수 있습니다.**  
   [lib/tasks.mjs:60](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:60), [bin/vfc.mjs:179](D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs:179)  
   `owner add 기존owner --db 대상`이 기존 registry를 수정하며, 이미 다른 owner가 소유한 대상도 그대로 등록합니다. 개발 DB가 `data-contract`와 다른 owner 양쪽에 등록되는 것을 재현했습니다. 문서의 “유일한 소유자” 규칙이 유지되지 않습니다.  
   **수정:** DB 대상별 소유권 유일성, 진행 중 작업, 승인된 이전 기록을 검사하십시오.

10. **P1 — COMPLETED가 수용 기준·현재 실행의 검증을 요구하지 않습니다.**  
    [lib/tasks.mjs:245](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:245), [lib/tasks.mjs:270](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:270)  
    임의 type, 존재하지 않는 artifact, 잘못된 observed_at도 받아들입니다. pass·skip=0 한 건만 있으면 다른 필수 검증의 skip/not_run도 무시합니다. 반려·재실행 시 이전 evidence를 유지하므로 새 실행을 검증하지 않고 완료할 수도 있습니다. 파일이 없는 보고서 증거로 완료되는 것을 재현했습니다.  
    **수정:** 증거의 구조·참조를 검증하고 run/commit 및 acceptance 항목에 연결하여 현재 실행의 필수 기준이 모두 충족되었는지 판단하십시오.

11. **P1 — 목표 PASS가 보고서로 우회되거나 영구 차단됩니다.**  
    [lib/tasks.mjs:327](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:327), [lib/init.mjs:27](D:/workspace/Vocaflow-AI-Control/lib/init.mjs:27)  
    초기 `reported_only:false`인 VG-L3-D2-01은 존재하지 않는 보고서 경로만 주어도 PASS가 됩니다. 반대로 대부분 목표는 true로 초기화되며, 직접 검증 후 이를 전환하는 경로가 없어 계속 `REPORTED_ONLY`로 거부됩니다. 두 방향 모두 재현했습니다.  
    **수정:** 초기 플래그 대신 제출된 검증 증거의 출처·결과·필수 기준 충족 여부로 PASS를 판정하십시오. 현재 PASS 테스트는 정상적인 성공 경로를 검사하지 않습니다.

12. **P1 — 명시적 task_id와 자동 생성 ID가 중복됩니다.**  
    [lib/tasks.mjs:124](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:124), [lib/tasks.mjs:126](D:/workspace/Vocaflow-AI-Control/lib/tasks.mjs:126)  
    명시적 ID 등록은 `next_seq`를 올리지 않고, 자동 ID는 중복 검사를 받지 않습니다. T-0007을 명시적으로 넣은 뒤 자동 등록하면 T-0007이 두 개 생기는 것을 재현했습니다. 이후 `findTask`는 첫 항목만 조작합니다.  
    **수정:** ID 형식을 검사하고 명시적 등록 시 sequence를 보정하며, 자동 생성도 기존 ID를 건너뛰게 하십시오.

13. **P1 — 승인되지 않은 재봉인과 불완전한 manifest가 허용됩니다.**  
    [bin/vfc.mjs:132](D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs:132), [lib/goals.mjs:78](D:/workspace/Vocaflow-AI-Control/lib/goals.mjs:78)  
    `goals seal --decision 임의문자열`은 실제 결정 존재·사용자 승인 여부를 확인하지 않고 해시 불일치를 무시하여 재봉인합니다. 검증기는 manifest에 열거된 파일만 검사하므로 `files:{}`도 통과하고, 봉인 버전 불일치도 거부하지 않습니다. 빈 manifest·잘못된 버전 통과를 메모리 사본으로 재현했습니다.  
    **수정:** 승인된 정본 변경 결정과 새 버전을 확인하고, manifest schema·필수 파일 전체·버전·승인일을 검증하십시오.

14. **P2 — 정본의 스키마·승인·플랫폼 범위 검증이 불충분합니다.**  
    [lib/goals.mjs:98](D:/workspace/Vocaflow-AI-Control/lib/goals.mjs:98), [lib/goals.mjs:149](D:/workspace/Vocaflow-AI-Control/lib/goals.mjs:149), [lib/goals.mjs:199](D:/workspace/Vocaflow-AI-Control/lib/goals.mjs:199)  
    키 존재 위주라 condition=null, verification_method=[], required_evidence=null이 통과합니다. `/approved/i`는 `not_approved`도 승인으로 인정합니다. R0 대상의 한국어 “수능”도 놓치며, 플랫폼 영역이 전부 빠져도 경고만 냅니다. 모두 메모리 사본으로 확인했습니다. required_journey·entry와 승인 전략의 충돌도 검사하지 않습니다.  
    **수정:** 정본은 그대로 두고 검증기에 타입·열거형·참조 및 구조화된 전략 간 일관성 검사를 추가하십시오.

15. **P2 — ChatGPT import의 중복 방지가 원자적이지 않습니다.**  
    [bin/vfc.mjs:284](D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs:284)  
    archive 존재 확인은 상태 뮤텍스 밖이고, 결정 기록 저장 후 응답을 rename합니다. 두 프로세스가 동시에 확인하면 양쪽 모두 결정을 기록할 수 있습니다. 저장 후 crash 또는 Windows rename 실패가 발생해도 재시도 시 중복 기록됩니다.  
    **수정:** request_id와 응답 hash를 import 식별자로 삼아 상태 트랜잭션 안에서 중복을 검사하고, 보관 이동은 복구 가능한 단계로 처리하십시오. 현재 테스트는 순차 재가져오기만 확인합니다.

정상으로 확인한 부분은 다음과 같습니다.

- 현재 정본은 해시 대조를 통과했습니다. 버전 1.1.0, 승인일 2026-10-09, 목표 40개, L0–L4 분포 1/4/10/20/5입니다. L4 전용 상태 경고는 seed의 열린 질문으로 기록되어 있습니다.
- 주 goal_id는 존재하는 L3로 제한하고, 없는 목표·L2·L4 템플릿 연결을 거부합니다.
- owner_id와 세션 라벨은 분리되어 있으며, 세션 변경 후 소유권과 이전 세션 기록이 유지됩니다.
- 변경 없는 두 번째 init은 추가 항목 0개입니다.
- 최초 잠금 획득은 `wx`를 사용하고, 정상 경로에서 token 불일치·살아 있는 PID의 stale 회수를 거부합니다.
- 단일 JSON 저장은 임시 파일·fsync·rename을 사용하며 Windows 쓰기 재시도가 있습니다. 다만 위 트랜잭션·백업 결함은 남습니다.
- ChatGPT 경로에는 API·브라우저 자동화가 없고, verdict=approve여도 RECORDED/PROPOSED/OPEN_QUESTION으로만 변환됩니다.
- `.gitignore`가 상태·백업·임시 파일·잠금·heartbeat·로그·체크포인트와 `.env*`·키 파일을 제외합니다. 검토 파일에서 대표적인 비밀값 패턴은 발견하지 않았습니다.
- 요청한 `git -C … diff`는 환경에서 실패하여 명시적 git-dir/work-tree로 확인했습니다. AGENTS.md는 요청한 절 추가만 있으며 기존 규칙 삭제는 없습니다. 전체 diff에는 관련 `docs/CHANGELOG.md` 항목 추가도 있습니다.
