# Codex Stop 훅 — 리뷰 상한과 판정

정본: `hooks/codex-review.mjs`(입력·git·Codex 연결) + `hooks/codex-review-policy.mjs`(판정 규칙).
설치: `node hooks/install.mjs` → `~/.claude/hooks/`(기존 파일은 `.bak-<시각>` 으로 남는다 · 되돌리기 = 백업을 원래 이름으로 복사).
`codex-review-lib.mjs`(범위 수집·Codex 호출·예산)와 DB 쓰기 게이트 `codex-review-gate.mjs` 는 바꾸지 않았다 — 게이트는 이 변경과 무관하게 그대로 돈다.

## 이전 판의 결함(2026-10-09 감사)

| # | 결함 | 결과 |
|---|---|---|
| 1 | 왕복 상한에 닿으면 기준선을 HEAD 로 옮겼다 | 마지막 수정이 **리뷰 없이 통과** |
| 2 | 파일 상한(8) 밖 파일은 로그만 남기고 기준선이 넘어갔다 | 영영 리뷰되지 않음 |
| 3 | 리뷰 실패 때도 diff 해시를 저장했다 | 다음 Stop 에 「이미 리뷰함」 으로 통과 |
| 4 | 같은 결함 반복을 몰랐다 | 땜질 커밋 반복 |
| 5 | 판정 기록이 없었다 | 완료 판정이 리뷰 결과를 대조할 수 없음 |
| 6 | 동시 실행 보호가 없었다 | 같은 세션 Stop 훅이 겹치면 상태 경쟁 |
| 7 | 사용자 턴마다 왕복 카운터가 0 | 상한이 사실상 없음 · Codex 호출 수와 수정 횟수를 구분 못 함 |
| 8 | 일일 예산 초과 시 기준선을 옮겼다 | 예산 초과 범위가 리뷰 없이 통과 |

## 규칙

- **MAX_FIX_ROUNDS**(기본 3, `CODEX_REVIEW_MAX_FIX_ROUNDS`) = **수정 사이클** 수. 차단 리뷰 뒤 새 커밋이 생겨 다시 리뷰할 때만 +1(한 head 당 한 번). Codex 호출 수가 아니다. 사용자 턴이 바뀌어도 줄지 않는다(PASS 로 기준선이 넘어갈 때만 0).
- **상한 도달** → 마지막 코드에 **읽기 전용 최종 리뷰 1회** → `REVIEW_PASS` / `REVIEW_BLOCKED` / `REVIEW_UNKNOWN`. 최종 리뷰는 exit 2 를 내지 않는다(수정 루프 재진입 없음).
- **최종 이후**(post-final): 같은 세션·루트의 새 커밋은 head 당 1회 리뷰·기록·알림만. PASS 면 정상 모드로 복귀.
- **모든 파일**을 묶음(`MAX_FILES` 개씩, 최대 `CODEX_REVIEW_MAX_CHUNKS`=4 묶음)으로 리뷰. 넘치면 `REVIEW_UNKNOWN`.
- **리뷰 실패 · 예산 초과 = `REVIEW_UNKNOWN`** — 통과 아님. 기준선을 옮기지 않아 다음 Stop 에 다시 시도한다.
- **반복 지적**: 지적마다 `finding_id`(등급·파일·줄 번호 뺀 문구의 지문) · `severity` · `affected_file`(루트 상대) · `relevant_line` · `defect_summary` · `related_goal_id` · `current_work_scope`(.agent-goal.md). 같은 지문 **또는 같은 파일 ±5줄의 같은 등급** 지적이 다시 나오면 원인 분석 지시로 전환(실측: Codex 는 같은 결함을 매번 다른 말로 쓴다).
- **오탐**: 작업 루트 `.codex-review-fp.json` = `[{ finding_id, rationale }]`. 지적 파일이 **현재 리뷰 범위 밖**이고 근거가 있을 때만 수용한다. 범위 안이면 차단 유지. 수용·거부 근거는 모두 판정 기록 `false_positives` 에 남는다.
- **세션 잠금**: `~/.claude/codex-review/locks/<session>.lock`(wx + pid). 살아 있는 잠금이 있으면 겹친 실행은 아무것도 안 한다. 죽은 잠금은 이름을 바꿔 치운 뒤 진행.
- Stop 훅은 **판정만** 한다. 다음 작업 선택·새 세션 생성은 하지 않는다.

## 판정 기록

`~/.claude/codex-review/verdicts.jsonl` 한 줄 = 한 판정:
`at · root · head(커밋) · range · diff_hash · kind(stop|final|post_final) · verdict · fix_rounds · files_reviewed · files_unreviewed · failures · p0_p1[] · false_positives[] · raw_paths[](Codex 원문 ~/.claude/codex-review/reviews/) · tests`.
테스트 증거는 훅이 아니라 작업 증거(AI-Control `evidence`)가 담는다 — 기록의 `tests` 는 그 사실을 적는다.

## AI-Control 연동

- `lib/review-verdicts.mjs` 가 기록을 읽는다(`VFC_REVIEW_VERDICTS` 로 위치 변경).
- `completeTask`: 완료하려는 커밋의 **가장 최근** 판정이 `REVIEW_BLOCKED` 면 `REVIEW_BLOCKED` 오류 — 완료·병합·배포 금지.
- `require_review_pass: true` 작업은 **그 커밋**의 `REVIEW_PASS` 가 있어야 한다. 다른 커밋의 PASS 만 있으면 `REVIEW_COMMIT_MISMATCH`.
- 오케스트레이터는 이 오류를 재시도하지 않고 즉시 `BLOCKED`(`blocked_review_verdict`)로 두고 다음 반복에서 다른 독립 작업을 고른다.

## 검증

- `node --test tests/stop-hook.test.mjs` — 1회 통과 · 수정 2회 · 수정 3회 → 최종 PASS · 최종 BLOCKED · 실패 UNKNOWN · 묶음 초과 UNKNOWN · 반복 → 원인 분석 · 실측 형식(8.3 경로·다른 문구) · 오탐 범위 대조 · 최종 이후 재귀 없음 · 중복 실행 차단.
- `tests/orchestrator.test.mjs` SH9 · SH10·11 — 다른 커밋 PASS 거부 · BLOCKED 완료 금지 · 독립 작업 진행.
- 실제 시나리오(설치본 + 실제 Codex): `verification/reports/WF-S6-stop-hook-limit-real.json`.

## 바꾸지 않은 것

DB 쓰기 게이트 · 일일 예산 정책 · `rm -rf` 가드 · 승인 없는 DB 변경 금지. 이번 변경은 판정을 더 엄격하게만 만든다(통과 경로를 늘리지 않는다).
