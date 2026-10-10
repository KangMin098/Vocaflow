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

## 리뷰 정책 RP-2026-10-10.1 — 중복 제거 (2026-10-10)

10/1~10/10 실측(판정 118건, Codex 호출 503회 ≈ 10시간): 판정의 **37%(44건)가 REVIEW_UNKNOWN** 이었다. 사유는 사용량 한도 30건, 판독 실패 19건이다.
- 판독 실패 원문 16건은 모두 깨끗한 답이었다(「No concrete defects or goal drift were found…」).
- 한도 실패 직후 같은 실행의 다음 묶음은 62개 중 60개가 성공했다. 한도는 대부분 잠깐이다.
- UNKNOWN 은 통과가 아니라서, 다음 Stop 에 같은 범위 전체를 다시 리뷰했다(같은 head 재리뷰).

| 바뀐 것 | 근거 · 안전 |
|---|---|
| **판독**: 「No … defects/regressions/findings … found/identified」 문장과 「introduces no confirmed defects」를 깨끗한 답으로 읽는다. 「could not / unable / no review / not provided」 같은 리뷰 불가 표현이 있으면 깨끗하지 않다 | shadow: 원문 230건 중 판독 실패 17건 → 16건 회복. 차단 84건과 깨끗함 129건은 판정이 그대로(놓친 P0/P1 0건). `[P0-3]` 표지가 있으면 문장과 관계없이 지적으로 읽는다 |
| **재사용** `review-reuse.json`: (정책 판 · 목적 파일 해시 · **범위 전체 파일·diff 해시** · 파일 · 파일 diff)가 모두 같고 **같거나 높은 effort** 로 깨끗했던 파일은 다시 부르지 않는다 | 범위나 주변 변경이 하나라도 다르면 쓰지 않는다(「범위 동일」). 주로 UNKNOWN 재시도 때 이미 성공한 묶음에 걸린다. P0/P1 이 나온 묶음은 기록하지 않는다. low 기록으로 high 요구를 건너뛰지 않는다. 14일 만료. 출처는 판정 기록 `files_reused` 에 남는다 |
| **한도 재시도**: 한도에 걸린 묶음은 다른 묶음을 먼저 돌린 뒤 한 번 다시 부른다(묶음이 하나뿐이면 30초 쉬고). 재시도 **직전에** 시작 뒤 240초가 지났으면 부르지 않는다(훅 제한 600초) | 다시 실패하면 그대로 UNKNOWN(PASS 아님). 대기·중단 방식은 실측으로 기각했다 |
| 판정 기록에 `policy_version` · `effort` · `codex_calls` · `files_reused` 추가 | 구버전·신버전 증거가 섞여도 구분된다(옛 기록 = 필드 없음 = `RP-v1`) |

**전환 규칙(소급 금지)** — 훅은 Stop 마다 새 프로세스로 돈다. 설치하면 모든 세션이 **다음 Stop** 부터 새 파일을 읽는다(재시작 불필요). 정책 판은 루트 상태(`roots[root].policy_version`)로 정한다.
- 새 세션 · 새 루트 · 유휴 루트(열린 사이클 없음) · 최종 판정을 이미 낸 루트(`final`) → 다음 리뷰부터 새 판.
- **열린 v1 수정 사이클**(`pending_block` 있음, 또는 `fix_rounds>0` 이고 `final` 없음) → 그 사이클을 닫는 리뷰까지 v1 그대로(옛 판독 · 재사용·재시도 없음)이고, 기록은 `RP-v1`. 기준선이 넘어가면(PASS) 새 판으로 올린다.
- 이미 돌고 있는 리뷰 프로세스는 옛 코드를 메모리에 올린 채 끝난다.

**효과(추정 — 이력 replay, 10/1~ 기록 121건)**: UNKNOWN 45 → 약 4건, 같은 head 재리뷰 10회 회피, Codex 호출 264 → 약 255(−3%). 범위 동일 조건 때문에 호출 수 절감은 작다. 이득의 중심은 「판정 불가」가 사라져 사람 확인과 재리뷰 대기가 줄어드는 것이다. 설치 뒤 `verdicts.jsonl` 의 `policy_version` 별로 다시 잰다.

검증: `node --test tests/stop-hook.test.mjs`(RP1–RP11).
설치: `node hooks/install.mjs --dry-run` → 승인 → `node hooks/install.mjs`(이전 파일은 `.bak-<시각>` 으로 남는다). 되돌리기: 백업 파일을 원래 이름으로 복사하면 다음 Stop 부터 v1 로 돈다(`review-reuse.json` 은 v1 이 읽지 않는다).

## 완료 정체 해소 (2026-10-10 · 같은 정책 판 RP-2026-10-10.1 안의 결함 수정)

실측: AI-Control 세션은 9일 최종 판정 뒤 기준선이 고정된 채 리뷰 범위가 커밋 61개·35파일로 자랐다. g2-int 세션은 같은 head 를 6분마다 4묶음씩 다시 리뷰하며 매번 「6파일 미검토」 UNKNOWN 이었다. 차단 지적 65건 중 24건은 직전 차단과 같은 파일이었는데, 기존 반복 규칙은 그중 13건을 놓쳤다.

| 결함 | 수정 |
|---|---|
| 미검토 파일이 있으면 검토한 묶음의 P1 도 UNKNOWN 에 묻혔다(실측: AI-Control `lib/policy.mjs:127` P1 이 UNKNOWN 으로 기록됨) | 차단 지적이 있으면 미검토·실패와 관계없이 **BLOCKED**(더 엄격한 쪽) |
| 최종·최종 이후 리뷰는 범위가 커지기만 하는데 묶음 상한이 4라서, 33파일부터는 영구 UNKNOWN | 읽기 전용 최종 리뷰만 상한 6(`CODEX_REVIEW_MAX_CHUNKS_FINAL`) |
| 열린 v1 사이클이 같은 head 에서 UNKNOWN 으로 멈추면 v1(재사용 없음)으로는 닫히지 않는 교착 | 그 경우에만 새 판으로 올린다. 새 판은 차단 규칙을 완화하지 않고, 범위가 같을 때 깨끗한 묶음을 재사용해 미검토 파일까지 차례로 본다 |
| 같은 파일이 줄만 바뀌어 다시 막혀도 반복으로 잡지 못함 | 같은 파일 재차단이면 「파일 계약 전체를 한 번에 적고 경계 경우를 테스트로 덮어라 · 범위 밖이면 별도 작업」 안내를 붙인다. **차단은 그대로**(새 독립 P0/P1 은 계속 막는다) |

검증: `tests/stop-hook.test.mjs` RP13–RP17.
