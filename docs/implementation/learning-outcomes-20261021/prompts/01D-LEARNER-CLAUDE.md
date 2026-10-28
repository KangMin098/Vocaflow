<!-- docs/implementation/learning-outcomes-20261021/prompts/01D-LEARNER-CLAUDE.md -->
# 신규 Claude Code 세션 — 1D 학습자 수행 연결

전용 작업공간 D:/workspace/Vocaflow-learning-outcomes-20261021-work, 기준 c78bf9bbd. 새 세션으로 시작하며 이전 세션 resume/continue를 쓰지 않는다. AGENTS/CLAUDE/apps-web CLAUDE와 개발정책, **01D-LEARNER-SPEC.md**, AI-VALIDATION-ROLES.md, LEARNING_MODEL/MODULES의 관련 부분을 읽고 구현한다. UI는 .agents/skills/vocaflow-design-loop/SKILL.md를 적용하고 이전 참조/실제 컴포넌트를 재사용한다. 새 전체 디자인·목표 테이블·공통 프레임워크·subagent·새 worktree는 필요 없다.

너의 소유는 spec의 dcp-learning 서버/학습자 API·page·Runner·Workspace 진입·관련 시험/최소 pending SQL과 계약 문서다. 다른 작업자도 있는 저장소이므로 타인 변경을 되돌리지 않는다. 이 단계는 약 20개 안팎의 명확한 파일로 묶고 불필요한 파일 확대를 피한다. 모두 실제 호출부에 연결하고 /dev 모형만 만들어 완료하지 않는다.

1A·1B·1C는 실제 공장 서비스/원천 정책/manifest를 재사용했다. 1C 신규 API와 pending SQL은 139 관련 테스트와 타입을 통과했다. Codex가 직접 발견한 실패(자격 영구 누락, 옛 PLAN 납품, raw metadata 조회, Supabase 기본 service_role 권한)를 수정했다. 새 코드에서 이 계약을 보존한다. 1C SQL은 공유 DB에 미적용이다.

실제 소량 제작 파일은 외부 runtime/learning-outcomes-20261021/production-1b/run-20261021-a, 원천 source-snapshot.json(실DB SELECT)이다. 수요/정책 hash는 합성이고 아직 실등록/발행/납품되지 않았다. 이를 실제 DB 승인으로 바꾸지 않는다. 격리 PGlite에서 실제 SQL과 서비스로 공급해 학습자 역할을 실행한다. 실제 grade_dcp_item/기존 G2 RPC를 사용하고 테스트의 채점 대역만으로 통과시키지 않는다. 중간 실패는 같은 트랜잭션으로 되돌리거나 저장된 동일 결과를 복구한다. source 기반 MCQ는 guided 연습이고 direct/validated_learning이 아니다.

새 브라우저 검증은 외부 공유 DB·계정 없이 격리한다. 기존 Playwright/esbuild/React와 실제 제품 컴포넌트/앱 CSS를 재사용하는 하네스는 가능하되 목/픽스처와 실제 제품 부분을 명시한다. 구현 후 실제 PC 캡처/상호작용을 실행할 명령을 준비한다. 세션 실행 권한에서 node/tsx/Playwright가 막히면 우회하지 말고 정확한 코드·명령을 남겨 Codex가 실행하게 한다. 화면을 보지 않고 시각 검증 PASS로 쓰지 않는다. 두 AI가 사람의 학습자/교사/검수/채점 역할을 맡으므로 실제 학생 모집·사람 검수 대기로 중단하지 않는다.

읽을 경로를 좁혀 진행한다. grade_dcp_item의 실제 현재 SQL은 20260920120000_grade_dcp_band_is_fit_not_eligibility.sql을 먼저 확인하고 이후 실제 덮어쓰기 여부를 targeted 검색한다. canonical G2 writer는 knowledge/practice-writer.ts, supply/G2 하네스는 map/v62/__tests__다. 기존 authored 경로는 원문 파생 등록용으로 사용하지 않는다. AI 원저작 검토/평가 자산은 다음 단계 담당이므로 r5-central-meaning JSON은 이 세션에서 건드리지 않는다.

Vitest --pool=forks --maxWorkers=1 --minWorkers=1. 실제 실행한 관련 시험·타입·lint와 NOT_RUN을 구분한다. 총괄 파일 01D-LEARNER-RESULT.md에 AC별 결과·코드 경로·브라우저 명령/캡처·실제 원시 로그·남은 단계 2 경계를 남긴다. 공유 DB 접속/쓰기·SQL 실제 적용·커밋·push·main merge·배포는 하지 말고 Codex 검토를 위해 종료한다.
