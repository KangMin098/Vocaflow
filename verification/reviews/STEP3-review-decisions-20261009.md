# STEP 3 — 독립 리뷰 처분 기록 (2026-10-09)

- 대상: 공유 제어 공간 `D:/workspace/Vocaflow-AI-Control`(브랜치 `ai-control`) + 제품 저장소 `AGENTS.md` 공통 참조 절(브랜치 `chore/ai-control-goal-ref`)
- 리뷰어: Codex(`codex exec -s read-only`, reasoning high) — 원문 [1차](./codex-step3-raw-20261009.md) · [확인](./codex-step3-recheck-raw-20261009.md)
- 수정·검증: Claude Code(platform-goal). Codex 쪽은 샌드박스 제약으로 테스트를 실행하지 못했다 — 테스트 결과는 Claude 가 실행한 [EV-20261009-control-tests.log](../tests/EV-20261009-control-tests.log)(30/30, 3회 연속) 뿐이다.

## 1차 리뷰 — P1 11 · P2 4 · 오탐 0

| # | 지적 | 처분 | 회귀 테스트 |
|---|---|---|---|
| 1 | stale 회수가 새 소유자의 잠금을 옮길 수 있다(TOCTOU) | 세대 마커(`<name>.gen-<token>.marker`, `wx`)로 같은 세대 동작 직렬화 | 「동시 회수 경쟁: 6개 프로세스」 |
| 2 | heartbeat·release 교체 경쟁 · Windows rename 재시도 없음 | 같은 세대 마커 + heartbeat rename 재시도 | 「세대 마커: 옛 token 반납·heartbeat 불가」 |
| 3 | 남의 실행 종료 · 임의 reviewer 로 자기 완료 | 전이별 호출자 검사(owner / 등록된 다른 owner) · 리뷰 기록 파일 필수 · `--reviewer`=`--by` | 「중복 실행·남이 제출 불가」 · 「COMPLETED 금지」 |
| 4 | 잠금 변경과 상태 저장이 원자적이지 않음 · 5파일 부분 커밋 | redo journal 커밋 지점 · 반납은 커밋 후 · 상태 뮤텍스 안 고아 정리 | 「journal 재적용」 · 「커밋 후 반납 전 사망」 |
| 5 | 깨진 본이 정상 `.bak` 을 덮음 | 파싱되는 본만 `.bak`, 깨진 본은 `.corrupt-*` 격리 | 「.bak 보존」 |
| 6 | worktree 없는 작업 · 경로 대소문자 별칭 | 시작 시 worktree 필수 · 실경로 + Windows 소문자 정규화 | 「worktree 없는 작업 거부」 · 「대소문자 경로」 |
| 7 | 제품 `.agent-lock` 과 상호 배제 안 됨 · 깨진 잠금 통과 | vfc 가 `.agent-lock` 을 `wx`+`vfc_token` 으로 함께 잡음 · 깨진/남의 잠금 거부 | 「제품 .agent-lock」 |
| 8 | `approval_required:true` 무시 | 종류 없는 true · 종류 있는 false 모두 거부 | 「잘못된 입력 거부」 |
| 9 | DB 쓰기 소유권 복제·덮어쓰기 | 대상별 소유자 하나 · 기존 범위 변경은 APPROVED 결정 필요 | 「DB 쓰기 소유자 하나」 |
| 10 | COMPLETED 가 acceptance·현재 run 을 안 봄 · 없는 artifact | type 열거 · 실제 파일 · `covers` · 현재 run 만 · 전부 pass·skip 0 | 「COMPLETED 금지」 |
| 11 | 목표 PASS 우회/영구 차단 | `verification/` 아래 실제 파일 + 사유. `reported_only` 는 결과 표시로만 | 「목표 PASS」 |
| 12 | 명시 task_id 와 자동 id 중복 | 형식 검사 · sequence 보정 · 자동 id 가 사용 id 건너뜀 | 「명시적 task_id 뒤 자동 id」 |
| 13 | 승인 없는 재봉인 · 빈 manifest 통과 | APPROVED `canon_change` + `new_canon_version` 일치 · manifest 형식/필수 파일/버전/승인일 | 「봉인」 · 「재봉인」 |
| 14 | 스키마 타입·승인 상태·R0 대상(한국어)·범위 누락 경고 | 타입 검사 · `approved` 정확 일치 · R0 대상/진입/경로 대조 · 범위 누락은 오류 | 「JSON 검증」 |
| 15 | ChatGPT import 중복 방지 비원자 | request_id+sha256 를 상태 트랜잭션 안에서 판정 · 보관 이동은 커밋 후 | 「동시 import 4개」 |

## 확인 리뷰 — RESOLVED 7 · PARTIAL 8 · 새 P1 1

| 항목 | 처분 |
|---|---|
| **새 P1** 커밋 후 반납 전 사망 시 제품 `.agent-lock` 이 영구히 남음 | 고아 정리가 vfc 가 만든(`vfc_token`) 제품 잠금 중 IN_PROGRESS run 이 참조하지 않는 것도 반납. 테스트가 더는 `.agent-lock` 을 손으로 지우지 않는다 |
| PARTIAL 3 — reject 에 리뷰 기록 없음 · 디렉터리 허용 · `--reviewer` 비교 대상 | reject 도 리뷰 기록 필수 · `verification/reviews/` 아래 **파일**만 · `--reviewer` 는 `--by` 와 비교 |
| PARTIAL 10 — 비 ISO 날짜 · artifact 디렉터리 | 시간대 있는 ISO 8601 정규식 · 파일만 |
| PARTIAL 11 — `verification/../` 탈출 · 디렉터리 | 경로 해석 후 하위 여부 + 파일 검사 |
| PARTIAL 13 — manifest `null` | 객체 아니면 오류 |
| PARTIAL 14 — acceptance status `null`/빈 값 | 비지 않은 문자열 강제 |
| PARTIAL 1·2 — 죽은 마커 제거의 이론적 경쟁 | **수용(잔여 위험)**. 조건: 잠금 소유 에이전트 사망 ∧ 마커 구간(수 ms) 내 CLI 사망 ∧ 그 죽은 마커를 둘 이상이 동시에 치움. `docs/CONCURRENCY.md` §1 에 명시, 발생 시 `lock.marker_cleared` 로그 |
| PARTIAL 4 — 제품 `.agent-lock` 고아 | 위 새 P1 과 같은 수정 |

추가 Codex 왕복은 하지 않는다(자동 가드=테스트가 판단 · P0/P1 만 리뷰 대상 — 작업 원칙). 남은 수용 위험은 위 1건이다.
