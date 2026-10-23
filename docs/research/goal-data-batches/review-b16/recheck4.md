# T-0128 · 초기화 예외 가림 짧은 재검

**RECHECK3-P1-01 resolved · 새 P0 0 / P1 0 · b17 진행 가능.** result=pass는 검증 수행 완료이며 skip_count=0이다.

입력 @8980aaa59eff4156a8e4a916fbaeeb5e1dc37e1c, 이전 @fc3690e3abafc213ab04afbbf394f4cd384c4935와 비교했다. 변경 3파일(실행기·제공 회귀·검토 기록)을 정독했다. 중앙 development_policy를 읽었고 첫 task show에서 IN_PROGRESS/session t-0128-codex가 일치해 추가 대기는 없었다. PID 조회는 하지 않았다. 입력 worktree에는 쓰지 않았다.

- AC0 **resolved** — 깨진 배치 input.json과 정의 밖 tasks를 임시 복사본의 실제 d2-run spawn으로 재현했다. 각각 stdout/stderr 전체 외부 ID 0, stdout 오류 한 줄·「검사 실패」, stderr 빈 값, exit 1이다. 두 핸들러는 인자 해석 직후 등록되어 input.json 파싱과 tasks 해석보다 앞선다. (scripts/research/goal-data/d2-run.mjs:17; scripts/research/goal-data/d2-run.mjs:18; scripts/research/goal-data/d2-run.mjs:19; scripts/research/goal-data/d2-run.mjs:20; scripts/research/goal-data/d2-run.mjs:29; scripts/research/goal-data/d2-run.mjs:36)
- AC1 **resolved** — 제공 회귀 32/32. 캡처 296파일이 현재 입력 바이트와 일치한다. b2–b16 및 b9t 총 16변형의 전체 validate·agree 32회 비교에서 stdout/stderr·exit가 전부 동일하고 agree 생성물 해시도 동일하다. 실제 전체 검증기로 자기 행 결함·자기 깨진 출력·다른 출력 읽기 불가+자기 빈 출력을 재현해 결함 출력과 exit 1이 유지됨을 확인했다. 핸들러 등록은 청크 validate에만 적용된다. (scripts/research/goal-data/d2-validate.check.mjs:176; scripts/research/goal-data/d2-run.mjs:17; scripts/research/goal-data/d2-run.mjs:80; scripts/research/goal-data/d2-run.mjs:93; scripts/research/goal-data/d2-run.mjs:101; scripts/research/goal-data/review-b16/recheck4.mjs:1)
- AC2 **resolved** — recheck4.json·recheck4.md와 새 P0/P1·b17 가부를 기록했다. (docs/research/goal-data-batches/review-b16/recheck4.json:1; docs/research/goal-data-batches/review-b16/recheck4.md:1)

독립 확인 41/41, 제공 회귀 32/32. 초기 검증 스크립트의 의존 파일 누락·변경 파일 수 예상·JSON 결함 문구 예상 오류를 바로잡고 재실행했다. 초기 출력은 recheck4-initial.local.json, 최종 원문·명령 출력·전체 diff는 recheck4.local.json에만 보존했다. 제공 구조 회귀 일부는 stub을 쓰며 별도 결함 반례는 실제 runner와 전체 함수를 사용했다. DB·제품 build/E2E·학습자 측정·main/원격 통합은 미실행이며 이번 범위 밖이다.

재현: node scripts/research/goal-data/review-b16/recheck4.mjs → node scripts/research/goal-data/review-b16/finish-recheck4.mjs. Git·증거·submit 원출력은 recheck4-finish.local.json에 남긴다. Git 실패와 검증 완료는 별도로 기록한다.

**b17 진행 가능 — 이번 초기화 예외 가림 재검 범위에서 차단 P0/P1 없음.**
