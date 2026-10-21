# Claude Code 새 세션 — 단계 0 조사 결과를 설계로 확정

사용자 요청: 첨부 분석을 우선순위별로 설계하고 각 설계에 따라 새 Claude Code 세션에서 구현. 학습효과·사용성·교수·채점 등 모든 사람 검증 역할은 Claude Code와 Codex로 대체한다. 사람 대기 때문에 중단하지 않는다. 결과는 AI 기반 검증으로 정확히 표시한다.

작업 공간은 D:/workspace/Vocaflow-learning-outcomes-20261021-work이다. AGENTS.md, CLAUDE.md 및 D:/workspace/Vocaflow-AI-Control/config/dev-mode.json development_policy, docs/implementation/learning-outcomes-20261021/00-ROADMAP.md와 00-AUDIT-SPEC.md를 읽어라. 이전 Claude 세션은 조사 뒤 중단됐고 아직 산출 문서는 없다. 새 세션이며 resume/continue하지 않는다.

**넓은 조사를 반복하지 마라.** D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/preserved-research.md의 기존 결과를 재사용하고, 첫 구현에 필요한 몇 파일/함수만 추가 확인하라. 이번에는 subagent를 만들지 않는다. 기존 Vitest가 worker 초기화 오류였으므로 단계 0에서 시험을 더 돌리지 말고 NOT_VERIFIED로 적어라. 테스트 오류를 무시하거나 PASS로 바꾸지 않는다. 실제 DB 상태는 migration 파일 존재로 확정하지 말고 UNKNOWN이다.

이 세션은 아래 세 문서를 **지금 작성해서 종료**한다. 제품 구현은 다음 새 세션에서 한다.

1. docs/implementation/learning-outcomes-20261021/00-AUDIT-RESULT.md: 기존 조사로 확인한 호출 경로/연결 공백/미확인 상태. 일반 독해와 CSAT 특화 경로를 구분한다.
2. 같은 폴더 01-E2E-SPEC.md: 재사용 가능한 일반 독해 경로에 학습목표/활동/응답/평가/다음 계획을 실제로 연결할 최소 첫 구현. 코드·API·UI·테스트 경로, 데이터 신뢰 경계, 오류·중복·구버전·타인 데이터 격리 수용 기준. CSAT 전용을 R0 전체 완료로 오용하지 않는다. DB 의존으로 막히면 승인 없이 가능한 코드/격리 검증과 구체적 승인 대상을 분리하라. 새 프레임워크나 순수 계약만 추가하고 제품 연결을 미루는 설계를 피하라. 한 milestone 변경 파일은 30개 미만으로 제한한다.
3. prompts/01-E2E-CLAUDE.md: 새 구현 세션이 위 설계대로 코드·화면/API 연결·검증·결과 문서까지 실행할 명령형 지시문. 사용자 최신 AI 역할 검증 지침 포함. 실제 DB 변경/삭제/migration 적용, 원격 push/main merge/발행/배포는 이 세션에서 하지 않는다.

본래 예시의 고2 사례로 승인된 중등 일반 독해 전략을 변경하지 않는다. 광범위한 조사·설명 대신 구현 가능한 첫 범위를 정하라. 설계에 필요한 최소 활동 계약은 단계 1에 포함하고 활동 확대는 2단계, FAST는 3단계, AI 기반 비교 검증은 4단계다. 사람 검수/실제 학생 모집을 완료 선행조건으로 만들지 마라. AI가 실제로 수행한 원시 근거와 모의 지연을 구분한다.

작성 범위는 위 3개 문서뿐이며 다른 작업공간·제품 정본·중앙 작업 상태는 바꾸지 않는다. 커밋하지 않는다. 최종 답은 작성 파일·첫 구현 범위·남은 실제 승인 경계를 요약한다.
