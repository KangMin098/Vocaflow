# T-0006 — Claude Code 실행 보고 (run 1 · 2026-10-09)

| 항목 | 값 |
|---|---|
| 작업 | T-0006 · 주 목표 **VG-L3-D1-02** 「실사용/테스트 데이터 분리」(R0 차단) · 템플릿 VG-L4-TEMPLATE-BUILD |
| owner / 세션 | `data-contract` / `wf-s4-claude-main`(claude pid 22364) |
| worktree / 브랜치 | `D:/workspace/Vocaflow-wf4-d102` / `feat/qa-account-separation` (기준 origin/main `bc7cd0340`) |
| 커밋 | **`cfc1833b9`** (10파일, +609 −52) — push 완료 |
| 기획 | ChatGPT REQ-20261009-001 → DL-0014(판정 revise)·DL-0015~0017(PROPOSED)·DL-0018~0019(질문) · 정규화 1건(제안 1 의 requires_user_approval false→true) |
| 범위 승인 | **DL-0020** (사용자 2026-10-09 메시지) · 완료 조건 8개로 교체(task set-acceptance) |
| 잠금 | task--T-0006 · worktree--d__workspace_vocaflow-wf4-d102 · 제품 `.agent-lock`(vfc_token) — 시작 시 원자 획득, 제출 시 반납 |
| DB | SELECT 2회(조사)만. 쓰기·DDL·apply_migration **0** |

## 정본·승인 범위 대조 (구현 전)
- ChatGPT 제안은 정본 VG-L3-D1-02-AC1 을 **PARTIAL** 로 두라고 한다 — 정본과 일치, 사용자 지시 「전체 PASS 금지」와 일치.
- SD-R0-01~04 무관 · 변경 없음. 학습자 화면·knowledge·정본·DB 금지 범위 준수.
- ChatGPT 제안 중 **채택하지 않은 것**: 없음. **유보**: 제안 2(DB user_type · 전 지표 통합) — DL-0017 PROPOSED 로 남김.
- 설계 판단(Claude): 운영 역할이 「검증된 외부」 목록에 오르면 내부로 판정하고 충돌로 센다(외부 지표를 부풀리지 않는 쪽). 기획서에 명시되지 않은 세부.

## 구현
- `lib/admin/account-classification.ts`(신규·순수): `parseAccountRegistry`(UUID·중복·두 목록 충돌 검증, 오류에 ID 미포함) · `classifyAccount`(목록 → admin/curator → unknown) · `isInternalDomainHint`(RFC 2606/6761 + vocaflow.dev/.local, 힌트 전용) · `summarizeAccounts`(수만).
- `lib/admin/retention.ts`: 환경변수 `VOCAFLOW_INTERNAL_ACCOUNT_IDS` · `VOCAFLOW_EXTERNAL_VERIFIED_ACCOUNT_IDS` → 오류면 DB 전 `unavailable` · `user_profiles.role` 추가 조회(실패 시 null) · external_verified 만 `computeRetention`.
- `lib/admin/retention-math.ts`: `RetentionResult` 타입 추가(`computeRetention`·`RetentionReport` 불변).
- `components/admin/RetentionPanel.tsx`: 실사용·내부·미분류 칸 · 경고(미설정·미분류·도메인 힌트·충돌) · 「계산 불가」 · prop 이름 `report` 유지(호출부 `app/admin/page.tsx` 무변경).
- 도움말 `help/ops.ts` · `docs/ADMIN_CONSOLE.md` · `docs/CHANGELOG.md`.

## 검증
| 증거 | 결과 | 덮는 완료 조건 |
|---|---|---|
| E01 관련 vitest 4파일 56개 | pass · skip 0 | 0–5 |
| E02 typecheck | pass | 6 |
| E03 eslint(변경 8파일) | pass | 6 |
| E04 DB 변경 0 기록 | pass | 6 |
| E05 다른 지표 오염 감사 | pass(감사 완료 — 오염 5곳 남음) | 7 |

참고(완료 근거 아님): `vitest run src/lib/admin src/components/admin src/app/admin` → 48파일 705 pass · **19 skip**. skip 은 DB 연결이 필요한 통합 테스트(db-health 3파일 · dashboard-stats.integration 3 · video-drift.integration 1)로 이번 변경과 무관. 로그 `verification/tests/EV-T-0006-r1-admin-vitest.log`.

## 실측 효과 (현재 DB · 2026-10-09)
계정 5 → 목록 미설정 상태에서 내부 1(역할 admin) · 미분류 4(그중 도메인 힌트 3) · **실사용 0**. 이전 화면은 이 5계정을 그대로 가입자·활성화로 셌다.

## 남은 것
- 목록(환경변수) 설정은 사용자 몫 — 설정 전 패널은 「미설정」 경고를 띄운다.
- 퍼널·대시보드 KPI·교사 채널·영상 콘솔·효과 분석은 미적용(감사 E05) → AC1 PARTIAL.
- 브라우저 E2E 미실행(CI e2e 는 시크릿 미설정으로 건너뜀 — DL-0004).

---

## run 2 (Codex r1 P2 반영 · 커밋 `6165b7160`)

| P2 | 처리 |
|---|---|
| P2-1 역할 조회 정렬 없음 → 1,000행 초과 시 운영자 누락 | `user_profiles` 조회에 `.order('user_id')`. 회귀: 정렬 없는 페이지 순서 변동을 흉내 내는 모의 DB 1,001 프로필 |
| P2-2 server-only 경계 근거 과대(vitest 가 server-only 를 빈 모듈로 치환) | `retention-server-boundary.test.ts` — 첫 문장 `import 'server-only'` · 순수 모듈 env/조회부/Supabase 미사용 · 컴포넌트의 조회부 import 금지를 **소스**로 검사. 완료 조건 5 의 근거를 이것으로 교체 |

변이 검사: 두 수정을 각각 되돌리면 해당 회귀가 실패(EV-T-0006-r2-mutation.md). 관련 vitest 5파일 60 pass·skip 0 · typecheck · lint 통과. 관리자 영역 49파일 709 pass · 19 skip(run 1 과 같은 DB 통합 테스트).
범위 밖으로 남김: `learning_records`·`scores` 페이지 조회에도 정렬이 없다(기존 코드 · 이번 변경 전부터) — 별도 티켓 후보.
