# 승인 정책 · 협업 상태 원장(제품 개발 원장과 분리)

> 제품 개발 상태는 [FINAL_LEDGER](./FINAL_LEDGER.md). 이 파일은 승인 정책 · 협업 경로의 상태만 적는다.
> 상태 값: **PROPOSED**(제안) · **INDEPENDENT_ACCEPTED**(지정 Codex 세션 수용) · **HUMAN_ADOPTED**(권한 있는 사람이 정식 보호 경로에서 채택) · **TECHNICALLY_ENFORCED**(실행기 · 가드가 실제로 집행).
> 전달 값: **GITHUB_POSTED** · **QUEUED**(codex queue 접수) · **SESSION_DELIVERED**(세션 기록 반영) · **ACKNOWLEDGED**(Codex 응답 첫 줄 ACK).

## 정책

| 정책 | PR | 상태 | 근거 · 남은 것 |
|---|---|---|---|
| AUTONOMOUS_DELEGATED 위임(판정기 · 보호 경로 · AI_VERIFIED 원장 제안) | #314 | **PROPOSED** | 2026-10-19 사용자 지시 「보호경로 해제 · 사람 역할 Codex」 적용 시도 → 실행 환경 Self-Modification 차단 · 우회 안 함. 지시 원본에 따라 #314 는 안전한 제안 상태 유지. Codex 6항목 보안 검토 요청(QUEUED). 채택은 권한 있는 사람이 정식 보호 경로에서 |
| 지정 Codex 세션 라우터 · 양방향 협업 계약 | #315 | **PROPOSED** | 라우터 시험 6/6 · 실제 check ok. router.md 「자동 Codex 리뷰 없음」 불변 · 임무 한정 변경안만 제안 |
| FI-018 병합 게이트 입력 완전성 | #312 | **PROPOSED**(수정 HEAD 제출) | d786d2538 — 비공개 후보 채택 · safe-merge 21/21 · Codex 비공개 재검증 요청(QUEUED). 수용 전 #250 · #303 병합 보류 |
| 현행 승인(A DB · B/B2 사람 Gold · C 권리) | — | **TECHNICALLY_ENFORCED**(기존) | 승인 창 티켓 · 사람 결정 원장 · safe-merge 적용 이력 대조. 변경 없음 |

## Codex 인계(지정 세션 `Codex-VOCAFLOW-FINAL-ACCEPT` = `01a14de8-2485-7a53-b530-d5612f35e57a`)

| 작업 ID | 대상 | 전달 상태 | 큐 id |
|---|---|---|---|
| (연결 확인) | — | SESSION_DELIVERED(ACK 불요) | 01a15248-9233-7f21-bab5-c80dea96fabf |
| FINAL-REWORK-20261019 | #303 FI-006~018 수용 | QUEUED · 세션 기록 반영 미확인 · ACK 없음 | 01a1524c-97cc-7160-88f6-63c7944bd4d4 |
| FINAL-COLLAB-20261019B | #312 · #303 FI-011 · #314 검토 | QUEUED · ACK 없음 | 01a1525b-7f80-7ee0-a6ab-9f3ca41178bc |

Codex 쪽 문서(`COLLABORATION_CONTRACT_20261019.md`)는 Claude 세션을 `c513ff5b-86ef-44a3-8efd-7925a229614b` 로 결속했다. ACK 가 오기 전에는 수신 · 착수 · 완료로 기록하지 않는다.

## 별도 오류

- 2026-10-19 기억 색인(MEMORY.md) 한 줄 추가가 auto mode(Instruction Poisoning)로 차단됨. 기억 파일 `feedback-codex-takes-human-role.md` 는 생성됐으나 색인에 없음. 보호 규칙을 완화해 해결하지 않는다 — 사용자가 직접 색인에 넣거나 그대로 둔다.
