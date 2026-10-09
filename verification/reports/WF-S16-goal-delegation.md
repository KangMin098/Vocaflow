# WF-S16 — 목표 단위 위임 · 위험 기반 실행 · 읽기 전용 live 검증 (2026-10-10)

기준 e416ed9b5. 새 오케스트레이터 없음 — usergoals 승인 경로 · 선정 게이트 · 기존 tty 승인을 넓혔다.

## 1. 승인 병목 조사(UG-c8315ad8-0002 실측)
| 지점 | 실측 | 판정 |
|---|---|---|
| 설계 버전마다 승인 | v2 PROPOSED → (main 결정으로 무효) → v3 초안 → v4 PROPOSED — 버전이 바뀔 때마다 「UG@vN」 승인이 새로 필요했다 | **불필요** — 같은 목표·같은 영역·같은 위험이면 목표 정책 하나로 |
| 파일 경로 단위 승인 | v4 승인 명령에 경로 6~7개를 손으로 나열 · 경로 하나(live test) 때문에 재안내 | **과도** — 코드 영역(glob)+위험 수준으로 판단 |
| 읽기 전용 DB 검증 | load.live.test.ts 는 MAP_LIVE_USER(사용자 uuid) + service role 이 필요 · 오케스트레이터는 db_scope=read 작업을 자동 실행하지 않음 | 막힌 이유 = 위임 경로·테스트 계정·읽기 전용 근거가 없었다 |
| 실제 위험 변경 | DB 쓰기·스키마 · 정본 · 인증 · 배포 · main 병합 | **별도 승인 유지(HIGH)** |
| 안전하게 바로 가능 | 읽기·분석·Work 설계 요청(브리지 tick) · 순수 로직·테스트·문서 | 정책 LOW/MEDIUM 으로 자동 |

## 2. 목표 실행 정책 (`lib/policy.mjs`)
필드: goal_id · allowed_capabilities · allowed_code_areas · excluded_operations(HIGH 8종 필수) · risk_level(LOW|MEDIUM) · approval_evidence · max_runtime_min · max_cost_usd · merge_policy · live_test_user · read_only_attestation.
- 사용자 승인: 일반 터미널 `vfc approve --kind goal_delegation --summary "UG-…@policy" --policy-file <정책>` 한 번. 결정에 정책 내용과 sha256 을 싣는다 — 파일·상태를 나중에 바꿔도 sha 가 달라 장착되지 않는다.
- 오케스트레이터: 반복마다 정책 장착 → 최신 PROPOSED 설계가 정책 안(영역·위험·DB 없음)이면 버전 승인 없이 적용 → 초안이 작업으로 → 실행. 정책 밖이면 그 목표만 승인 대기(독립 작업 계속), 같은 버전은 한 번만 시도.
- 작업마다 다시 본다: HIGH 경로·영역 밖·능력 없음·목표 비용 상한 → 그 작업만 보류. 실행 시간 상한은 정책값으로 줄인다.

## 3. 위험 분류(경로·DB 범위·작업 종류 — AI 판단 없음, 모르면 높게)
HIGH: supabase/** · *.sql · migrations · scripts/db/** · .env·비밀 · auth·middleware·RLS·lib/supabase · 정본(goals · platform-goals · LEARNING_MAP_VNEXT.md) · CI·배포·next.config · package.json·lockfile · 개인정보 · db_scope=write · 작업 db_write·schema_change·canon_change·deploy·merge_main·external_publish·auth_change·personal_data. 경로가 없으면 HIGH.
MEDIUM: 제품 코드(apps·packages 의 테스트 아닌 파일) · scripts(DB 아님) · db_scope=read.
LOW: 테스트 · 정본 아닌 문서.
HIGH 는 어떤 정책으로도 위임되지 않는다(validatePolicy 가 거부).

## 4. 승인 입력 경로 검토
| 경로 | 판정 | 근거 |
|---|---|---|
| GitHub PR Review | **불가** | GitHub 은 PR 작성자의 자기 승인을 막는다 — 교환·제품 PR 은 사용자 계정(gh 토큰)으로 열린다. 또 에이전트가 같은 토큰으로 리뷰·댓글을 쓸 수 있어 신원을 구분할 수 없다 |
| ChatGPT Work 승인 | **불가** | Work 댓글은 AI 생성물(앱 chatgpt-codex-connector)이다 — 사용자 승인 이벤트가 아니다. 지원되는 「사용자 승인 작업」 기능을 확인하지 못했다(가정하지 않음) |
| 간단한 대시보드 + 패스키(WebAuthn) | **다음 후보(미구현)** | 브라우저 생체/보안키 제스처는 에이전트가 수행할 수 없다. 단, 같은 OS 사용자 권한의 에이전트가 자격 저장소를 바꿀 수 있어 저장소 sha 고정·변경 경보가 함께 필요 |
| 대화형 터미널 + 확인 코드(현행) | **채택 · 목표당 1회로 축소** | 에이전트 프로세스(TTY 없음·CLAUDECODE)는 통과 못 함. 한계: 의사 터미널(pty) 우회는 못 막는다(KR-01) |

## 5. 읽기 전용 live 검증 (`lib/liveverify.mjs` · `vfc verify live`)
- 정적 근거: 테스트에서 import 닫힘(45 파일)을 따라 쓰기 호출(.insert/.update/.delete/.upsert/.rpc) 파일 5개를 찾고, 각 파일의 쓰기 함수가 loadMapPage 경로에서 호출되지 않음을 호출 검사로 확인 — practice-writer(directWriter·g2Writer: recordItemTaskAttempt 기본값·deps 팩토리에서만) · practice-server(schedulePracticeReview 미호출) · diagnosis/server(recomputeSnapshot 은 submit/delete 에서만) · cohesion-link·claim-support(.update( = crypto 해시).
- 그 5 파일의 sha256 을 정책 read_only_attestation 에 싣는다 → 파일이 바뀌면 자동 재차단(REATTEST_REQUIRED).
- 실행: 정책이 db_read_dev + live_test_user(실제 학습자 아닌 테스트 계정 uuid)를 위임했을 때만. .env 값은 자식 환경에만(출력·기록 없음).
- 판정: 통과>0·실패0·건너뜀0 만 PASS. 건너뜀·결과 없음 = UNVERIFIED(덮지 않음). PASS 는 같은 설계 버전의 해당 수용 기준을 덮는다.

## 6. UG-c8315ad8-0002 적용
- 정책 `planning/policies/UG-c8315ad8-0002.json`: 영역 = lib/csat/map/** · components/csat/diagnosis/map/** · knowledge/find-*(+테스트) · 위험 MEDIUM · 비용 15$ · 시간 120분 · 병합 none · DB 쓰기·정본·배포·main 병합 제외 · read_only_attestation 5.
- v4 의 7 경로 전부 영역 안 · MEDIUM · DB 없음 → 정책 승인 즉시 v4 자동 적용 · T1·T2 실행.
- live_test_user 는 비워 둠 — 테스트 계정 uuid 를 사용자가 넣어야 기준 7 을 실행한다(저장소에 지정된 테스트 계정이 없다).

## 7. 테스트
tests/policy.test.mjs 6(위험 오분류 방지 · 정책 검사 · 위임 1회 → 자동 승인·연속 실행 · 정책 밖/변조 무시 · HIGH 작업 보류 · live 판정) · 전체 141/141.

## 미구현 · 한계
- merge_policy=pr_only(브랜치 push·PR 자동 열기)는 필드만 — 이번에는 none 으로 둔다.
- 패스키 대시보드 미구현. pty 우회 한계(KR-01) 유지.
- live 검증의 읽기 전용 근거는 정적 호출 검사 — 동적 디스패치는 잡지 못한다(해시 결속으로 변경 시 재확인).

## Codex 독립 리뷰
- r1: P1 4(glob 범위가 HIGH 파일 포함 · 부수효과 import·재내보내기 누락 · 공백 낀 쓰기 호출 · 목표 예산 실행 중 미적용) · P2 4 → 전부 수정·회귀.
- r2: P1 4(소스 루트 밖 의존 · .env 가 테스트 계정 덮음 · 확인이 호출 경로에 결속 안 됨 · 다른 종류 승인으로 HIGH 통과) · P2 2(라운드별 예산 · live 근거 커밋 결속) → 전부 수정·회귀.
  - 실제 바뀐 HIGH 파일은 그 종류의 승인(db_write·secret·deploy)이 기록됐을 때만 — 인증·정본·의존성·개인정보는 자동 작업에서 늘 막힘.
  - 읽기 전용 확인 = 쓰기 파일 + 확인된 쓰기 함수 참조 파일의 해시 + 쓰기 함수 목록. 그 밖의 파일이 쓰기 호출을 갖거나 그 함수를 새로 참조하면 재확인.
- 전체 144/144. UG-0002 정책: 확인 파일 6 · 쓰기 함수 10 · 현재 코드 preflight 통과(테스트 계정만 비어 있음).

## 8. 실제 자동 실행(2026-10-10 06:02~06:12 KST · 실제 Claude·Codex·GitHub)
- 사용자 개입: **1회** — 일반 터미널 `vfc approve --kind goal_delegation`(DL-0070 · 정책 sha 16d6c64c…, 테스트 계정 없음 판).
- 승인 → 25초 뒤 감시가 오케스트레이터 실행 → 정책 장착 · v4 정책 승인(via_policy) · 초안 2 → T-0014·T-0015.
- run 1(5분 18초): T-0014 Claude 구현·커밋 d97f09408 → **foreign_worktree_write 로 BLOCKED** — 실행 중 이 세션이 AI-Control 정책 파일을 고쳤다(감지기 정상 · 내 실수). 비용 기록 0(중단).
- run 2(3분 42초): T-0015 Claude 구현 74ec05fff → Codex 리뷰 → COMPLETED($0.69). 구현 7.0분(78%) · 리뷰 1.9분(21%).
- T-0014 마무리(수동 · 같은 절차): run 2 가 같은 브랜치에 T-0015 를 쌓아 795a20bc7 기준 재실행은 범위 위반이 되므로 d97f09408 만 Codex 리뷰(findings 0) → 증거(관련 테스트 94 통과 · live 1 건너뜀 명시 · typecheck 통과) → 독립 owner 완료.
- Work 자동 왕복: 이번 실행 0회(v4 는 이전에 PR #10 자동 왕복으로 받음).
- 제품 브랜치 `feat/ug0002-map-recheck` push(main 병합 없음).
- 설계 v4: 수용 기준 9/10 → **GOAL_PARTIAL**(남은 7 = live 테스트 skip 0).

## 9. 테스트 계정 · live
- 개발 DB 읽기(auth.users · @vocaflow.local): fixture(apps/web/tests/e2e/fixtures/test-user.ts) 기본 계정 lexicon-test@vocaflow.local = b07abaf9-… 로 유일하게 특정. 그 계정의 csat_dx_session 0 · snapshot 0 → load.live.test.ts 의 기출 기록 전제(reference.exams>0) 미충족.
- 승인된 정책(DL-0070)에는 테스트 계정이 없다. 계정을 넣은 판은 `planning/policies/UG-c8315ad8-0002.proposed-live-account.json`(sha bb78eddc…) — 별도 승인 전에는 쓰지 않는다. 승인해도 데이터 전제 때문에 결과는 FAIL 로 기록될 것(데이터 생성 금지).

## 10. 최종 Codex(ee6c16398) P1 3 → 수정
깨끗하지 않은 worktree 거부·실행 뒤 HEAD 재확인 · 러너(vitest 설정·setupFiles·globalSetup) 코드도 검사 · 줄 어디의 import 도 파싱. 전체 145/145.
