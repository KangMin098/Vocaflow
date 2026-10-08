# USAGE — 일상 절차

모든 명령은 `D:\workspace\Vocaflow-AI-Control` 에서 `node bin/vfc.mjs …`. 전체 목록: `node bin/vfc.mjs help`.

## 세션을 시작할 때 (Claude Code · Codex 공통)

```
node bin/vfc.mjs goals validate          # exit 0 확인
node bin/vfc.mjs status                  # 목표 분포 · 진행 중 작업 · 잠금 · 열린 결정
node bin/vfc.mjs task list --owner <내 owner_id>
```

## 작업 하나를 맡아 끝내기

```
# 0) 작업에 worktree 가 없으면 지정(owner 에 묶인 것만)
node bin/vfc.mjs task assign-worktree T-0005 D:/workspace/<worktree> --branch <branch> --by r0-learning-journey
# 1) 시작 — 내 owner 의 현재 세션으로 바인딩되고 task/worktree(/db) 잠금을 잡는다
node bin/vfc.mjs task start T-0005 --owner r0-learning-journey --agent claude --session <세션 라벨>
#    (조상 프로세스에서 claude/codex 를 못 찾으면 --pid <에이전트 pid>)
# 2) 그 worktree 의 .agent-goal.md 를 이 작업 단위로 갱신(아래 템플릿)
# 3) 작업 · 검증 — 증거 기록
node bin/vfc.mjs task evidence T-0005 --file ev.json --by r0-learning-journey
# 4) 리뷰로 넘기기(잠금 반납)
node bin/vfc.mjs task submit T-0005 --by r0-learning-journey
# 5) 독립 리뷰어가 완료 판정
node bin/vfc.mjs task complete T-0005 --by independent-review --review verification/reviews/T-0005-20261009.md
```

`ev.json` 예: `{"type":"e2e","command_or_protocol":"pnpm --filter web test:e2e","result":"pass","skip_count":0,"artifact_path_or_url":"verification/e2e/EV-….md","observed_at":"2026-10-09T10:00:00+09:00","covers":[0,1]}` — `covers` 는 이 증거가 확인하는 acceptance 번호. 완료하려면 이번 run 의 증거가 모든 번호를 pass·skip 0 으로 덮어야 한다.

막히면 `task block --reason …` (외부 입력이면 `--external`), 실패면 `task fail`. 세션이 죽었으면 다음 세션이 `task reap`.

## 승인이 필요한 작업

DB 쓰기·main 머지·배포·시크릿은 사용자가 승인한 뒤에만 시작된다.
```
node bin/vfc.mjs task approve T-00NN --by user --ref "2026-10-09 대화: SQL 확인 후 승인" --sql-sha256 <sha256>
```
에이전트가 사용자 대신 이 명령을 실행하는 것은 **사용자가 그 대화에서 명시적으로 승인했을 때만**이고, `--ref` 에 그 근거를 적는다.

## 목표 상태 갱신

```
node bin/vfc.mjs goal set VG-L3-D2-01 --status PASS --evidence verification/e2e/EV-….md --by release-quality --note "run id …"
```
PASS·FAIL 은 `verification/` 아래 실제 증거 파일과 사유 필수. 보고서 경로만으로는 거부.

## ChatGPT 검토 (파일 교환)

```
node bin/vfc.mjs planning request --topic "R0 우선순위" --question-file q.md --goals VG-L3-A3-01 --attach goals/PROJECT_GOAL.md --by platform-goal
# → planning/requests/REQ-YYYYMMDD-NNN.md 를 사용자가 ChatGPT 에 올린다
# → 답 전체를 planning/responses/REQ-…response.md 로 저장
node bin/vfc.mjs planning validate REQ-…
node bin/vfc.mjs planning import REQ-…      # PROPOSED/OPEN_QUESTION 으로만 기록 · archive 로 이동
```

## .agent-goal.md 템플릿 (제품 worktree 루트 · 현재 작업 단위만)

```
# 작업 단위 — T-00NN (owner: <owner_id>)
플랫폼 목표 정본: D:/workspace/Vocaflow-AI-Control/goals/PROJECT_GOAL.md (v1.1.0) · 주 목표 VG-L3-…
## 목적 / 수용 기준 / 변경 허용 범위 / 변경 금지 범위 / DB 범위 / 승인
## 하지 않을 것 — 이 작업 단위에만 적용(다른 작업·전역 규칙 아님)
```
