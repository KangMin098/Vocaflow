<!-- docs/implementation/learning-outcomes-20261021/prompts/01B-PRODUCTION-CLAUDE.md -->
# 새 Claude 세션 — 1B 실제 소량 제작과 manifest 구현·실행

작업공간 D:/workspace/Vocaflow-learning-outcomes-20261021-work, 기준 commit 1c17a0a01. 새 세션이며 resume하지 않는다. AGENTS.md, CLAUDE.md, apps/web/CLAUDE.md, dev-mode development_policy, **01B-PRODUCTION-SPEC.md**, AI-VALIDATION-ROLES.md를 읽는다. 넓은 재조사·subagent·자동 peer review를 추가하지 않는다.

사용자는 분석 우선순위별 설계→신규 Claude 구현→Codex 검증→다음 설계 순서로 끝까지 진행하라고 요청했고, 모든 사람 검수/학습자/채점 역할을 Claude·Codex로 대체하라고 명시했다. 사람 대기·API 키 대기로 중단하지 않는다. 실제 사람의 효과를 관측했다고 꾸미지도 않는다.

1A는 실제 수요 검증→공장 설계기 관리자 API와 CLI까지 통과했다(웹205, package5, Codex6, CLI9, route callers5). core helper를 재사용해 SPEC의 local-production 함수·CLI·시험을 구현한다. 기존 factory sealer, evaluateSource와 validateManifest를 실제 호출하며 새 pipeline 기준/공통 프레임워크로 대체하지 않는다.

**구현 뒤 실제로 소량 작업을 완주해야 한다.** 외부 source-snapshot.json(실DB 읽기 전용 export)을 읽고 source를 평가한다. 1A 정상 fixture에서 실제 서비스로 prepared draft를 만든 smoke라면 synthetic_demand=true를 명시한다(실제 주문/등록이라고 쓰지 않는다). export를 실행하고, 지금 실행 중인 네가 문항·해설 출력 파일을 직접 작성한 뒤 import를 실행해 실제 HTML/자료/manifest/receipt를 남긴다. 테스트 픽스처만 추가하고 제작 실행은 생략하지 않는다. 출력 경로는 D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/production-1b 아래의 새 경로다.

Node/tsx CLI 실행에 이 세션 권한 설정이 없어 거절되면 우회하지 말고 구현과 필요한 정확한 실행 명령·작성한 출력까지 남긴다. Codex가 허용된 로컬 도구로 실제 실행을 확인할 수 있게 한다. 공유 DB 쓰기/migration/발행/납품/실제 관리자 로그인/원격 push/merge/배포는 금지한다. 합성 정책 hash는 정책 승인이 아니고 source metadata는 권리 발급이 아니다. 상태를 review_pending/test_fixture와 해당 한계로 정확히 기록한다.

Vitest는 --pool=forks --maxWorkers=1 --minWorkers=1로 실행한다. 타입·변경 파일 lint를 수행한다. 원시 로그 저장이 막히면 결과를 지어내지 말고 실제 도구 출력과 재현 명령을 보고한다. source/body/hash/role/TASK/답·근거 변조를 시험하고 양성 대조를 함께 유지한다.

01B-PRODUCTION-RESULT.md에 실제 파일·수용 기준별 결과·생성물 경로와 hash·직접 작성했다는 원시 근거·남은 현재성/정책/납품 경계를 남긴다. 총 수정 범위는 이 단계의 명세 파일/필요 계약 1곳으로 제한한다. 1A 기록을 덮거나 반려된 01-E2E 설계를 구현하지 않는다. 커밋하지 말고 Codex 검토를 위해 종료한다.
