# 사용자 지정 목표 — 다중 턴 협업 (WF-S7)

목표 하나 = thread 하나. 고정 턴 수가 없다. 지금 상태에서 **필요한 AI 하나**만 부른다.
ChatGPT 구간은 **사람이 파일을 옮긴다(HUMAN_IN_THE_LOOP)** — OpenAI API·브라우저 자동화는 쓰지 않는다.
구현: `lib/usergoals.mjs` · CLI `node bin/vfc.mjs ugoal …` · 상태 `state/USER_GOALS.json`.

## 무엇을 재사용했나

| 기존 | 이번에 쓰는 방식 |
|---|---|
| planning request/response (`lib/planning.mjs`) | 요청 헤더·응답에 `thread`(thread_id·goal_ref·round_id·design_version) 추가. 없는 옛 요청은 그대로 `planning import` |
| DECISION_LOG 사용자 APPROVED | 설계 승인·DB 승인의 유일한 근거(「UG-…@vN」·「UG-…@vN db」 문자열로 대상 고정) |
| TASK_QUEUE · 잠금 · journal · 복구 | 작업에 `user_goal_id`·`design_version`·`design_acceptance` 만 더함 |
| goal-orchestrator 재작업 루프 | 코드 결함은 그대로 Claude↔Codex. 설계 쟁점만 ChatGPT 재질의로 분기 |
| Stop 훅 판정 · require_review_pass | CRITICAL 프로필 작업에 자동으로 켠다 |

## 상태 모델

- 목표: `OPEN | PAUSED | ACCEPTED`. 시작 경로 `origin = chatgpt | claude` 는 같은 모델.
- 설계 버전: `DRAFT → PROPOSED → (REVIEWED) → APPROVED → SUPERSEDED`. ChatGPT 응답은 **PROPOSED 로만** 들어온다.
- 승인 범위: 승인 때 정한 `allowed_paths` ⊆ 그 설계의 `allowed_paths`. 새 버전은 범위를 자동으로 넓히지 않는다. DB 는 별도 승인 전에는 0.
- 계약(수용 기준·보존 계약·경로·DB 여부)의 해시가 바뀐 버전이 승인되면 옛 버전으로 끝난 작업은 `revalidate_required` — 목표 완료와 goal-check PASS 근거에서 빠진다.
- 라운드 기록: `thread_id · goal_id · round_id · request_id · parent_response_id · sender · recipient · purpose · design_version · base_commit · source_evidence · response_status · approval_status · created_at · completed_at`.

## 라우터 (`vfc ugoal route <UG>`)

| route | 다음 행위자 | 조건 |
|---|---|---|
| DESIGN_REQUIRED | ChatGPT(요청서) 또는 Claude(초안) | 설계 없음 · DEEP/CRITICAL 의 Claude 초안 · 응답 대기 |
| APPROVAL_REQUIRED | 사용자 | 새 설계 버전 승인 대기 · DB 변경 승인 대기 |
| IMPLEMENTATION_REQUIRED | Claude | 승인 설계의 실행할 작업 · 덮이지 않은 수용 기준 |
| CODE_REVIEW_REQUIRED | Codex | 작업이 REVIEW |
| IMPLEMENTATION_DEFECT | Claude → Codex | 리뷰 반려 뒤 READY |
| DESIGN_CONFLICT | ChatGPT | Claude `design_issue` 또는 Codex `kind:"design"` 지적 |
| EXTERNAL_BLOCKER | 사용자 | 응답 대기 상한 초과 · 작업 전부 BLOCKED |
| GOAL_ACCEPTED | — | 현재 설계 수용 기준을 COMPLETED 작업이 모두 덮음(`ugoal accept` 로 확정) |
| PAUSED | 사용자 | 일시정지 |

선정: `mode=USER_GOAL` 이면 활성 목표 작업 → 다른 열린 사용자 목표 작업 순. 사용자 목표 밖 플랫폼 작업은 `PLATFORM_AUTO` 에서만 고른다.

## 프로필 · 예산

| 프로필 | 리뷰 반복 | Claude 1회 예산 | 설계 선행 | 추가 게이트 |
|---|---|---|---|---|
| FAST | 2 | $2 | 아니오 | — |
| BALANCED | 3 | $5 | 아니오 | — |
| DEEP | 3 | $5 | 예(ChatGPT) | — |
| CRITICAL | 3 | $5 | 예(ChatGPT) | 그 커밋의 Stop 훅 REVIEW_PASS 필수 |

프로필은 예산만 줄이고 게이트는 올리기만 한다. 목표 예산(기본): 같은 쟁점 재질의 2 · 전체 재질의 6 · 응답 대기 72시간 · 연속 실패 3. 넘으면 작업은 `DESIGN_BUDGET`/`EXTERNAL_BLOCKER` 로 보류되고 오케스트레이터는 다른 독립 작업으로 간다 — 완료로 위장하지 않는다.

## 응답 인수 (`vfc ugoal intake`)

1. `planning/responses/` 에서 임시 확장자(`.part`·`.tmp`·`.crdownload`…)·빈 파일·최근 2초 안에 바뀐 파일은 건너뛴다(복사 중).
2. `rename` 으로 `.processing/` 에 옮긴 쪽만 처리한다(동시 실행 중 하나만).
3. schema → 요청 존재 → thread_id → goal_ref → round_id → 설계 버전 → 중복(sha256) 순서로 검증. 실패는 `planning/rejected/` 로(원문 보존), 중복은 `planning/archive/duplicates/`.
4. 기준 커밋이 바뀌었으면 적용하되 `base_moved` 로 표시한다(승인 때 사람이 본다).
5. thread 없는 옛 요청 응답은 손대지 않는다 → `vfc planning import`.

자동 감시(파일 watcher)는 두지 않았다 — Windows 에서 부분 복사·잠금 문제가 있고, 명시적 `intake` 가 재실행 안전하다.

## 사용자 매뉴얼 (Windows PowerShell)

```powershell
Set-Location D:\workspace\Vocaflow-AI-Control
```

**1. ChatGPT 에서 새 목표 시작** — ChatGPT 에게 응답 끝에 아래 블록을 정확히 하나 넣어 달라고 한다.

````text
```json vfc-goal
{ "schema": "vfc-goal/1", "title": "…", "canon_goal_ids": ["VG-L3-A2-01"], "profile": "BALANCED",
  "design": { "summary": "…", "design": "…", "acceptance": ["…"], "preserved_contracts": ["…"],
              "allowed_paths": ["apps/web/src/lib/…"], "db_changes": false } }
```
````

**2. 설계안 다운로드** — 응답 전체를 `.md` 로 저장한다(예: `C:\Users\<나>\Downloads\goal.md`).

**3. 로컬 AI-Control 에 인수**

```powershell
node bin\vfc.mjs ugoal start --from chatgpt --file C:\Users\<나>\Downloads\goal.md --by user
# Claude-first 라면:
node bin\vfc.mjs ugoal start --from claude --title "…" --goals VG-L3-A2-01 --profile DEEP --by claude
node bin\vfc.mjs ugoal list
```

**4. 사용자 승인 범위 지정** — 결정 기록(사람만) → 설계 승인. `--paths` 를 주면 설계 범위보다 좁힐 수만 있다.

```powershell
node bin\vfc.mjs decision add --status APPROVED --kind design_approval --summary "UG-0001@v1 승인" --approved-by user --ref "2026-10-09 검토" --by user
# 출력의 decision_id(예: DL-0031)를 넣는다
node bin\vfc.mjs ugoal approve UG-0001 --design 1 --decision DL-0031 --by user
# DB 변경 설계라면 별도로: --summary "UG-0001@v1 db 승인" 결정 → --db-decision DL-00xx
```

**5. 자동 구현 시작** — 작업을 넣고(승인 전이면 초안으로 보관 → 승인 때 자동 생성) 목표를 활성화한 뒤 실행.

```powershell
node bin\vfc.mjs ugoal task add UG-0001 --file planning\specs\my-task.json --by r0-learning-journey
node bin\vfc.mjs ugoal activate UG-0001 --by user
node bin\goal-orchestrator.mjs --max-tasks 2
```

작업 spec 은 `vfc task add` 와 같고 `design_acceptance`(이 작업이 덮는 설계 수용 기준 번호 배열)를 더한다.

**6. 설계 재질의 요청 확인** — Claude/Codex 가 설계 문제를 찾으면 작업은 `DESIGN_CONFLICT: REQ-…` 로 멈추고 요청서가 생긴다.

```powershell
node bin\vfc.mjs ugoal route UG-0001
Get-ChildItem planning\requests
# 직접 재질의하려면(쟁점 파일: problem·evidence·conflicts_with·alternatives·question·approval_scope_change)
node bin\vfc.mjs ugoal request-design UG-0001 --issue-file issue.json --by claude
```

**7. ChatGPT 에서 후속 설계 보완** — `planning\requests\REQ-….md` 를 ChatGPT 에 올린다. 응답은 파일 안 `vfc-response` 블록 형식(thread 값 그대로)이어야 한다.

**8. 후속 응답 인수** — 응답 전체를 `planning\responses\REQ-….response.md` 로 저장한 뒤:

```powershell
node bin\vfc.mjs ugoal intake --by user
```

**9. 자동 재개** — 새 설계 버전(PROPOSED)을 4번처럼 승인하면 설계 쟁점으로 멈춘 작업이 새 버전으로 READY 가 되고, 다음 실행이 이어 간다.

```powershell
node bin\vfc.mjs ugoal approve UG-0001 --design 2 --decision DL-00xx --by user
node bin\goal-orchestrator.mjs --max-tasks 2
```

**10. 목표 상태 확인**

```powershell
node bin\vfc.mjs ugoal status UG-0001
node bin\vfc.mjs status
```

**11. 일시정지·재개**

```powershell
node bin\vfc.mjs ugoal pause UG-0001 --by user
node bin\vfc.mjs ugoal resume UG-0001 --by user
New-Item -ItemType File runtime\STOP      # 실행 중인 오케스트레이터를 다음 단계 전에 멈춤
Remove-Item runtime\STOP
```

**12. 최종 완료 증거 확인**

```powershell
node bin\vfc.mjs ugoal route UG-0001          # GOAL_ACCEPTED 와 coverage
node bin\vfc.mjs ugoal accept UG-0001 --by user
node bin\vfc.mjs task show T-00xx             # 증거·리뷰 기록·verified_commit
Get-ChildItem verification\reviews
```

## 한계

- ChatGPT 왕복은 사람이 옮긴다. 시나리오 테스트(`tests/usergoals.test.mjs`)의 ChatGPT 응답은 모의 파일이다 — 실제 ChatGPT 연동 성공의 근거가 아니다.
- 작업 분해(설계 → 작업 spec)는 사람 또는 대화형 Claude 가 한다. 오케스트레이터는 분해하지 않는다.
- 목표 수용은 설계 수용 기준을 작업의 `design_acceptance` 가 덮는지로 본다 — 작업의 증거·리뷰는 기존 완료 게이트가 보장한다.
- DEEP/CRITICAL 은 Claude 초안을 바로 승인할 수 없다(ChatGPT 검토 선행). 계약 해시는 대소문자를 보존한다.
- 알려진 한계(Codex 리뷰 r2 P2, 미수정): ① 2초 넘게 멈춘 복사 중 파일은 집힐 수 있다 — 블록을 못 읽으면 60초 안 파일은 되돌리지만, 블록까지 쓰인 반쪽 파일은 막지 못한다. 저장은 다른 이름으로 받은 뒤 `REQ-….response.md` 로 바꾸는 것을 권한다. ② 같은 목표에 요청 두 개를 **동시에** 만들면 라운드 번호가 겹칠 수 있다(평소엔 대기 중 요청이 있으면 새 요청을 거부한다).
