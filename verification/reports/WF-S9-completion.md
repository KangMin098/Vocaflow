# WF-S9 — 속도 최적화 · Context Sync · 세션 매핑 (2026-10-09)

사용자 승인안 「Context Sync + Work Bridge + Adaptive Orchestrator」 중 이번에 한 것과 남은 것.

## Phase 별

| Phase | 결과 |
|---|---|
| A 성능 측정 + Context Sync | **완료** — `vfc perf report` · `vfc ugoal context` · 설계 요청 자동 첨부 · 응답 설계의 코드 대조 |
| B USER_GOAL·세션 매핑 | WF-S7 재사용 + `ugoal link`(chat_surface·chat_url 참조용) · status 에 owner@worktree |
| C 적응형 다중 턴·자동 재개 | WF-S7 재사용(라우터·재질의·자동 재개) — 이번 변경 없음 |
| D Work 이벤트 브리지 | **보류** — 교환 저장소 생성 미승인(2026-10-09 선택지에서 PR 병합만 승인). `poc/work-bridge.mjs` 준비 상태 그대로 |
| E 실제 목표 2개 + 성능 비교 | **부분** — 실제 ChatGPT 왕복은 사람 필요(미실시). Codex 강도 변경만 같은 실제 프롬프트로 전후 실측 |

## 실측 병목 (실행 10 · 완료 작업 5 · 2026-10-08~09)

작업당 3.5분 · 비용 $3.50. 구현 49.9% · **Codex 리뷰 44.2%** · 목표 검사 5.2% · 선정·상태·git 0.7%.
작업 4개 중 3개는 리뷰가 구현보다 길었다(T-0009 102초/65초 · T-0010 60/50 · T-0011 124/44).
기계 시간 밖의 큰 대기는 사람 승인과 ChatGPT 왕복이다(로그에 시간이 없다 — 측정 대상 아님).

## 최적화와 효과

| 조치 | 근거 | 효과 |
|---|---|---|
| 프로필별 Codex 강도(FAST·BALANCED medium · DEEP·CRITICAL·플랫폼 high) | 리뷰 44% | 같은 실제 프롬프트 high 130초 → medium 83·79초(−38%), 판정 동일(APPROVE · 지적 0). 표본 1건×2회 — 결함 검출력 동등은 미입증, 그래서 고위험 프로필은 high 유지 |
| Context Sync 캐시 | 재조사 제거 | 패킷 생성 159ms · 캐시 58ms. 같은 main·설계·작업 상태면 재생성 없음 |
| 쟁점 중심 재질의 | 왕복 크기 | WF-S7 그대로(기존 설계 전문 재전송 없음 — 테스트 B) |

테스트 축소로 얻은 속도는 없다 — 완료 게이트(증거·리뷰·CI skip 판정)는 그대로다.

## Context Sync

- `context/<UG>/` 패킷: L1 플랫폼(AGENTS.md 프로젝트 절·정본 기준) · L2 목표·설계·범위 코드 발췌·형제 테스트·완료 증거·결정 · L3 main HEAD·최근 커밋·활성 작업·owner.
- 모든 내용을 `origin/main` 의 **고정 SHA** 에서 읽는다. manifest: base_commit · generated_at · 원본 blob(AGENTS.md 포함) · cache_key · 등급표(code_verified · test_verified · doc_claim · unverified).
- 비밀값: 비밀 경로(.env·키·인증서)는 읽지도 이름을 남기지도 않는다(개수만). 데이터 파일(.sql·덤프·csv·seed 등)은 발췌하지 않는다. 키·토큰·비밀번호(JSON·환경변수형 포함)·DB URL 은 가리고, 가린 뒤에도 키 흔적이 남으면 그 발췌를 통째로 뺀다.
- 실제 UG-0001 패킷 생성 확인(main 3a2d048d0).

## 테스트 · 리뷰

- AI-Control 96/96. 「동시 프로세스 8개 시작」 테스트는 이 세션에서 한 번 간헐 실패 후 재실행 통과 — 잠금 경쟁 테스트의 시간 민감성으로 보이며 추적 필요.
- Codex 실제 리뷰 r1(WF-S9): P1 2(JSON·환경변수형 비밀값 미가림 · DB 덤프 발췌) · P2 7 → 전부 반영 + 회귀.

## 사용자 개입이 남는 구간

1. 설계·DB 승인(`decision add … 「UG-…@vN」` → `ugoal approve`) — UG-0001 대기 중.
2. ChatGPT 왕복(요청서 업로드 · 응답 저장) — Work 이벤트 브리지 실측 전까지.
3. Work 브리지 실험: 교환 저장소 생성 승인 + Work UI 이벤트 작업 설정.

## 다음 개선(수치 근거)

- Codex 강도 표본 확대: P1 이 있었던 실제 리뷰(T-0012 등)로 medium 검출력 비교 → 확인되면 DEEP 도 조정 검토.
- 목표 검사(5.2%)는 매 실행 앞뒤 2회 — 작업이 없을 때 앞 검사 생략 가능(측정 후).
