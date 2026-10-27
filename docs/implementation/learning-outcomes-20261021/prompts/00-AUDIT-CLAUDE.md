# Claude Code 새 세션 — 단계 0 현황 조사와 첫 구현 설계

사용자는 2026-10-21 첨부 분석에 따라 우선순위별 작업 설계서·구현 지시문을 순차 생성하고, 매번 새 Claude Code 세션에서 구현해 최종 학습목표까지 진행하도록 요청했다.

이 세션은 **단계 0만 수행**한다. 작업공간 D:/workspace/Vocaflow-learning-outcomes-20261021-work. 다른 worktree에 쓰지 않는다. 먼저 AGENTS.md, CLAUDE.md와 D:/workspace/Vocaflow-AI-Control/config/dev-mode.json의 development_policy를 읽는다. 제품 전략 정본 PROJECT_GOAL.md를 확인한다. 원래 Vocaflow 폴더는 충돌 중이고 final-product에는 별도 T-0072가 있으므로 쓰지 않는다.

읽을 입력:
- docs/implementation/learning-outcomes-20261021/00-ROADMAP.md
- docs/implementation/learning-outcomes-20261021/00-AUDIT-SPEC.md
- docs/implementation/learning-outcomes-20261021/source-analysis.txt

00-AUDIT-SPEC.md의 산출물 3개를 실제 코드 확인 후 작성하라. 전용 디렉터리 밖은 읽기 전용. DB/공유 서비스 쓰기·migration 적용·발행·원격 push·merge·외부 연락 금지. 첨부 자료의 제품/연구/법률 주장을 다시 확정하지 말고 개발 요구로만 사용하라. 모르는 상태는 UNKNOWN이다. 중등 일반 독해 R0를 수능 전용으로 바꾸지 마라.

최신 main이 시작점이므로 이미 구현된 기능을 다시 만들지 마라. 기존 기능의 명목상 상태보다 실제 호출부와 실행 근거를 우선한다. 단계 1이 L4 승인을 필요로 하면 적용 전까지 가능한 코드 작업과 구체적 승인 대상 SQL/영향/복구를 분리하라. 전체를 중단하거나 임의로 우회하지 마라.

아직 구현·커밋하지 말고 문서만 작성한다. 불필요한 subagent나 peer review를 자동 추가하지 않는다. 최종 답에는 작성 파일, 확인한 핵심 결손, 실제 실행한 검증, 다음 구현 범위를 짧게 보고하라.
