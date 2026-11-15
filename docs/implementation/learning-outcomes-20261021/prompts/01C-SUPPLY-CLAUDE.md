<!-- docs/implementation/learning-outcomes-20261021/prompts/01C-SUPPLY-CLAUDE.md -->
# 신규 Claude Code 세션 — 1C DCP 공급 연결 구현

전용 작업공간 D:/workspace/Vocaflow-learning-outcomes-20261021-work, 기준65e2613bf. 새 세션이며 resume/continue를 쓰지 않는다. AGENTS/CLAUDE/apps/web CLAUDE와 dev-mode development_policy, 01C-SUPPLY-SPEC.md, AI-VALIDATION-ROLES.md를 읽고 구현한다. 너의 소유는 spec에 명시된 dcp-admission/dcp-supply/관련 시험, 최소 pending SQL/기존 CLI 확장과 필요 계약 문서다. 공유 코드에는 다른 작업자가 있으며 그 변경을 되돌리지 않는다. subagent·자동 review·새 worktree·원격 호출을 추가하지 않는다.

1A 수요/공장 계획, 1B actual sealer/evaluateSource/validateManifest·실제 제작 3문항을 완료했다. 결과 문항은 source derived이므로 authored_item 등록 금지. 실제 snapshot/수정 출력/영수증은 D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/production-1b/run-20261021-a 아래에 있다. source-snapshot.json 및 codex-item-review-resolved.json은 runtime 루트에 있다(관련 파일은 targeted Glob). 1B 합성 수요를 실제 주문·정책 승인으로 승격하지 않는다.

기존 SQL은 C/B/I1/annotation/G2와 20261020063000 D3 계보를 targeted로 읽는다. pending와 실제 날짜버전의 차이를 확인하고 쓰기/학습자 권한을 보존한다. 실제 공유 DB는 접속하지 않는다. 실제 함수로 연결하는 격리 시험(PGlite)을 실행한다. 새 SQL 필요 시 pending파일로만 작성하고 DB_SCHEMA/CHANGELOG에 미적용을 명시한다. 새로운 환경 키를 요구하지 않는다. API가 꼭 필요 없다면 추가하지 않는다; 순수 계약만 작성하고 실제 호출부 없이 종료하지도 않는다. 실행 가능한 CLI plan과 실제 service integration을 낸다.

사람 검수·교사·Gold는 AI 역할로 대체하되 AI라는 증거를 보존하고 권리 근거가 없으면 unknown을 유지한다. 공개 승인/납품을 단순한 accepted flag로 만들지 않는다. 현재 단계가 guided_practice만 지원한다는 것을 검사한다.

Vitest --pool=forks --maxWorkers=1 --minWorkers=1. 타입·변경 TS lint·기존 관련 SQL 회귀 실행. 권한에 막힌 실행은 우회하지 말고 정확한 NOT_RUN/명령을 남긴다. 변경된 실제 동작과 AC별 증거/한계를 01C-SUPPLY-RESULT.md에 기록한다. 커밋/공유DB 쓰기/SQL 실제 적용/push/merge/배포는 하지 말고 Codex 검토를 위해 종료한다.
