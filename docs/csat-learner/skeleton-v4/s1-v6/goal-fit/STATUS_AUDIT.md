# T-0131 행정 완료와 설계 수용의 분리

2026-10-23 · 연결 후속 **T-0134** · owner **csat-v4-s0** · 기존 브랜치 `docs/csat-v4-s0-20261023`.

**S1 상태: DRAFT / NOT_ACCEPTED.** T-0131의 COMPLETED는 문서 조사·후보 제출의 행정 이력이다. 목표에 가장 적합한 대안의 확정, 내용 감수, 실제 제품·학생 효과 수용을 의미하지 않는다. 이 후속의 완료 역시 비교 근거·추천·차단에 대한 검토 완료이며 최종 S1 수용과 다르다.

동일한 상태 해석을 공식 `decision add`의 **DL-0202 / RECORDED / S1_ACCEPTANCE_SCOPE**에 남겼다. 이는 사용자 대신 설계를 APPROVED로 만든 기록이나 기존 COMPLETE 이력을 수정한 것이 아니다.

## 공식 절차와 감사 이력

AI-Control `bin/vfc.mjs`의 task 명령 및 `lib/tasks.mjs` 상태 전이를 읽기 전용으로 확인했다. `task start`는 READY, `prepareContinuation`은 READY/BLOCKED에서 종료 실행의 미커밋 변경을 대상으로 하며, `task amend`도 READY/BLOCKED만 허용한다. COMPLETED를 다시 READY로 여는 정식 CLI 전이는 없다. 잘못된 전이를 시도하거나 상태 JSON을 직접 바꾸지 않았다.

사용자의 ‘재개 불가능하면 연결 후속 하나’ 지시에 따라 기존 중복 작업을 확인하고 `task check/add`로 T-0134 하나만 등록했다. `depends_on=[T-0131]`, reopen_reason, 사용자 요청 근거가 기록되었다. 같은 owner·worktree·브랜치에서 `task start`로 잠금을 획득했다. 이전 완료 이력과 review_record는 보존했다. 별도 브랜치·PR·DB 수정 없음.

## 커밋 계보와 범위

| 커밋 | 계보·범위 | 검토가 뜻하는 것 |
|---|---|---|
| `68633c195` | `9d559e3ab`의 후손. 원5문서의 미검증 부록 주장을 한정 | R01~R08의 메타 등록·공백·계약 충돌 수용 대상. 모든 수치의 새로운 실DB 조회가 아님 |
| `8113c9fd9` | `68633c195`의 직접 후손. README/CHECKS/CHANGELOG 3파일 | 기존 수용과 이번 재개 검증,25순수검사, S1 부재/전체 제출 보류를 구분. 원5문서 본문은 동일 |
| `fae57cba1` | `8113c9fd9`의 직접 후손. S0 수용 영수증·S1 문서/증거 28파일 | 40후보 제출·미정6/자료차단4를 문서로 수용한 기록. 최적안 선정 완료가 아님 |

이번 쓰기 전에 worktree clean·잠금 없음·owner binding·허용 경로를 확인했다. 원격 fetch 후 원격 `8113c9fd9`가 `fae57cba1`의 조상임을 확인하고 **정상 fast-forward push**했다. force/main push 없음. 이후 원격 push는 같은 소유 브랜치의 후속 검증 커밋만 대상으로 한다.

## S0 수용의 작성자와 독립성

| 기록 | 실제 보존 형태 | 확인 가능한 독립성·한계 |
|---|---|---|
| AI-Control `verification/reviews/T-0131-v6-recheck-20261023/INDEPENDENT_REVIEW.md`, DL-0201 | root가 `/root/s0_independent_recheck` reviewer의 최종 응답을 취합한 Markdown | 별도 읽기 전용 agent 검토였다는 보고서상 provenance를 확인. 이번에는 해당 자식의 원시 대화/실행 transcript를 다시 확보하지 못했으므로 실제 독립 실행의 재입증으로 부르지 않음. 실제 사람 교사 감수가 아님 |
| AI-Control `verification/reviews/T-0131-s0-resume-20261023/claude-response.json`, EXECUTION.json 및 INDEPENDENT_REVIEW.md | 별도 Claude Code 프로세스 PID19112, session `bcbe6598-15c2-4f79-887a-e3fdeac02a26`, success/18 turns, Read/Grep/Glob만 허용한 실행과 원문 응답 | `8113c9fd9` 고정 Git blob을 별도 실행에 전달한 절차적 독립성 근거가 남음. 동일 OS계정/작성자 제공 보존자료를 공유하므로 암호학적 신원 분리나 새로운 실DB 전수 감수를 보증하지 않음. reviewer는 직접 하지 않은 재집계/테스트를 명시했고 P2문구3건을 남김 |
| AI-Control `verification/reviews/T-0131-v6-recheck-20261023/FINAL_DOCUMENT_REVIEW.md` | root가 `/root/v6_independent_acceptance` 응답을 취합한 `fae57cba1` 문서 제출 한정 APPROVE | 별도 agent라는 보고서상 기록. 원시 transcript 독립 재확인은 미완료. 후보 선정0·정상 인증/콘텐츠/음성/효과 미검증을 명시하므로 행정 완료가 설계 수용으로 확대되지 않음 |

AI-Control의 owner 신원은 `--by` 선언을 믿는 로컬 신뢰 모델이다(`lib/tasks.mjs` 주석). 다른 owner 문자열로 complete된 사실만으로 검토 독립성을 입증할 수 없다. 위 실행 provenance와 검토 범위를 함께 보아야 한다. 과거 수용을 취소·조작하지 않고 신뢰 범위와 미확인 부분을 공개한다.

이번 S1 비교도 독립 검토자가 고정 커밋을 읽고 검증 범위를 분명히 기록해야 한다. 작성 owner는 자기 결과를 독립 감수 PASS로 바꾸거나 S1/S2를 사용자 대신 승인하지 않는다.
