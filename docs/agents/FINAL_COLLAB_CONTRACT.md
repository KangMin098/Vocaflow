# FINAL MISSION — Claude Code × Codex 양방향 협업 계약

> 범위: VOCAFLOW FINAL MISSION A~H(제품 완성). 기존 VG/LM/TASK 정본은 바꾸지 않는다. 개별 기능 · 게이트 · PR 완료를 최종 제품 완료로 보지 않는다.
> 세션 결속 정본: [`agents/sessions.json`](../../agents/sessions.json) · 라우터: `agents/scripts/codex-route.mjs`.
> **정책 변경안**(이 문서 §6)은 사용자 채택 전까지 제안이다 — `agents/router.md` 의 「자동 Codex 리뷰 없음」은 그대로다.

## 1. 역할

| | Codex | Claude Code |
|---|---|---|
| 책임 | 분석 · 기획 · 설계 · 구현 지시 · **독립 수용** | 실제 구현 · 통합(제품 파일 소유) |
| 하는 일 | ① 코드 · 화면 · DB · 교육 계약 분석 ② 최종 목표와의 차이 발견 ③ 설계 문제 · 대안 비교 ④ 교육 · UX · 시스템 최적안 ⑤ 구현 지시문 전달 ⑥ 독립 검증 ⑦ 결함 근거 · 수정 지시 ⑧ ACCEPT/REWORK ⑨ 다음 미완료 영역 연결 | ① 지시 접수 ② 기존 코드 · DB · 화면 충돌 검토 ③ 불명확한 계약은 근거와 함께 보완 요청 ④ 구현 ⑤ 실제 브라우저 · 격리 DB 검증 ⑥ 문서 · commit · push · PR ⑦ 수정 HEAD · 증거 전달 ⑧ REWORK 는 같은 작업 단위에서 수정 ⑨ 수용 뒤 병합 · 다음 작업 |
| 하지 않는 일 | 제품 파일 동시 수정 · 사람 사실 확인(Gold · 권리 · 출시) | 자기 결과의 독립 수용 · 사람 사실 확인 |

기획 담당과 독립 수용 담당은 가능하면 **별도 Codex 세션**으로 운용한다(`Codex-VOCAFLOW-FINAL-PLANNER` · `Codex-VOCAFLOW-FINAL-ACCEPT`). PLANNER 가 아직 없으면 ACCEPT 세션이 겸하고, 인계문에 「기획 · 수용 겸임」을 적는다.

## 2. 인계 형식

**Codex → Claude**: 목표 · 문제 정의 / 기존 시스템 근거 / 선택한 설계안 / 구현 파일 · 영향 범위 / 수용 기준 / 테스트 · 브라우저 시나리오 / DB · 권리 · Gold 제약 / 구현 지시문.

**Claude → Codex**(`codex-route.mjs send` 인계문): 첫 줄 `[VF-TASK <작업 ID>]` · PR · HEAD · FI · 수용 기준 + 실제 변경 · CI/테스트 · 브라우저 증거 · DB 적용 여부 · 구현 중 바꾼 설계와 이유 · 남은 결함 · 독립 수용 요청.

검증 실패 시 **같은 FI · PR · 작업 ID** 를 유지한다. Codex 응답 · 판정의 첫 줄에도 같은 `[VF-TASK …]` 를 적어 작업에 결속한다.

## 3. 세션 결속 규칙

- 세션 **이름 · 실제 UUID · GitHub 작업 ID(PR/FI 이슈)** 를 구분해 관리한다. 이름만 보고 같은 대화라고 추측하지 않는다.
- UUID 는 세션 기록(`~/.codex/sessions/**/rollout-*-<uuid>.jsonl`)의 `session_meta.id` 와 역할 배정 문구로 확인한 값만 `sessions.json` 에 적는다(근거 함께).
- 세션을 찾지 못하거나 연결에 실패하면 **새 Codex 대화로 대체하지 않는다.** 라우터가 「미전달 + 재개 조건」을 돌려주고, GitHub PR · FI 이슈에 그대로 남긴다(`--record-pr` · `--record-issue`).
- 실제 자동 전송이 불가능하면 **GitHub 인계까지만 완료**로 기록한다. GitHub 게시만으로 상대 세션이 실행된다고 가정하지 않는다.
- 같은 제품 파일을 서로 다른 세션이 동시에 수정하지 않는다. Claude 는 `D:/workspace/Vocaflow-final-product` · Codex 는 `D:/workspace/Vocaflow-final-independent`.

## 4. 연결 확인 기록(2026-10-19)

| 이름 | UUID | 근거 | 런타임 |
|---|---|---|---|
| Codex-VOCAFLOW-FINAL-ACCEPT | `01a14de8-2485-7a53-b530-d5612f35e57a` | session_meta.id · 배정문 「세션: 신규/기존 `Codex-VOCAFLOW-FINAL-ACCEPT`」 20회 · worktree 언급 2,174회 | `codex queue` 성공(큐 id `01a15248-9233-7f21-bab5-c80dea96fabf`) · 세션 기록에 문구 기록 확인. 공유 app-server 데몬은 꺼짐(VS Code 확장 런타임) |
| Codex-VOCAFLOW-FINAL-PLANNER | 없음 | — | **새 세션 만들지 않았다** — 사용자가 만들면 UUID 확인 뒤 등록 |

## 5. 자동 진행 순서

분석 → 설계 → Claude 구현 → Codex 평가 → 수정 · 개선 → 수용 → 안전 병합 → 다음 목표. 각 단계에서 사용자에게 새 기획 지시를 반복 요구하지 않는다. DB · Gold · 권리 · 출시 등 별도 승인은 기존 정책 그대로(승인 위임 제안은 PR #314).

## 6. 정책 변경안(사용자 채택 필요 · FINAL MISSION 한정)

현재 `agents/router.md`: 「자동 Codex 리뷰는 없다(2026-10-10 · RP-2026-10-10.2) — Stop 훅 · 커밋 · task submit · DB 게이트 · PR · 머지 어디서도 자동으로 부르지 않는다」.

제안(이 임무 기간 · 이 두 세션에 한정):
1. 훅 · 커밋 · PR · 병합의 **자동 호출은 계속 없다**(정책 유지).
2. 대신 Claude 가 작업 단위를 끝냈을 때 `codex-route.mjs send` 로 **지정 ACCEPT 세션에 명시적으로 인계**하는 것을 표준 절차로 둔다(사람이 매번 전달하지 않아도 된다).
3. 인계 · 판정은 `[VF-TASK]` 작업 ID 로 결속하고 GitHub PR/FI 에 전달 · 미전달을 기록한다.
4. 임무가 끝나면 이 예외는 소멸한다.

채택되면 `router.md` 에 위 4줄을 「FINAL MISSION 예외」로 추가하는 PR 을 따로 낸다(보호 경로 — 사람 병합). 채택 전에도 라우터는 사람이 명시적으로 실행하는 도구로 쓸 수 있다(자동 호출이 아니므로 현 정책 위반 아님).

## 7. 인계 · 판정 결속 명령(2026-10-19 협업 속도 지시)

자동 호출은 여전히 없다 — 구현을 마친 쪽이 push 직후 **한 번** 부른다. 사람이 인계문을 쓰거나 전달하지 않는다.

| 명령 | 하는 일 |
|---|---|
| `codex-route.mjs handoff --task <ID> --pr <N> [--criteria …] [--evidence-file f]` | git 에서 HEAD · 변경 파일을 읽고 수용 기준(`--criteria` 없으면 `.agent-goal.md` 「수용 기준」 절)과 직전 REWORK 의 P0/P1 을 실어 지정 세션에 보낸다. CI 를 기다리지 않는다(CI 와 리뷰 병렬) |
| 같은 키 재요청 | 키 = sha256(HEAD · base..HEAD diff · 수용 기준). 같은 키의 판정이 있으면 `reuse`, 보낸 뒤 대기면 `pending` — 다시 보내지 않는다 |
| 상한 | 작업 ID 당 3회(기존 상한). 넘으면 보내지 않고 `FIX_REQUIRED`(마지막 판정 REWORK) · `REVIEW_UNKNOWN`(판정 없음)으로 분류 — 승인된 별도 수정 작업으로 잇는다 |
| `codex-route.mjs verdict --task <ID> [--head sha]` | 세션 기록의 그 작업 응답 + 응답이 링크한 PR 댓글 본문에서 **그 HEAD(9자 이상)를 판정한 것만** 결속한다. 다른 커밋 · 다른 작업의 응답은 판정으로 쓰지 않는다. REWORK 면 P0/P1 줄만 수정 목록으로 낸다 |

원장: `.agent-handoff/review-ledger.json`(로컬 · git 제외). safe-merge 는 기존대로 필수 CI + Codex 수용 둘 다 필요하다 — 이 명령은 병합 판정을 대신하지 않는다.
