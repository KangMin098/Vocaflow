<!-- docs/implementation/learning-outcomes-20261021/prompts/01A-CALLER-REPAIR-CLAUDE.md -->
# 새 Claude 세션 — 1A 실제 운영 호출부 구현

작업공간 D:/workspace/Vocaflow-learning-outcomes-20261021-work. 새 세션이며 resume하지 않는다. AGENTS.md, CLAUDE.md, dev-mode development_policy와 `docs/implementation/learning-outcomes-20261021/01A-CALLER-REPAIR-SPEC.md`를 읽고 그 계약만 구현하라. subagent·넓은 재조사는 하지 않는다.

이전 1A 구현은 웹 205·package 5·Codex 독립6을 통과했다. 하지만 전역 route-callers 회귀가 factory-order-draft와 product-order-lineage 실제 호출부 누락을 검출했다. 면제/테스트 문자열로 숨기지 말고 관리자의 실제 읽기 전용 CLI를 만들어 두 API를 각각 호출하게 하라.

SPEC의 Node CLI·Node 테스트·문서만 작성한다. 새 앱 UI/DB/migration/계보 쓰기/생산/납품/배포/remote 작업은 하지 않는다. 인증 Cookie는 env에서만 읽고 출력·기록하지 않는다. 임의 외부 host·redirect로 Cookie를 보내지 않는다. 기존 파일은 덮어쓰지 않는다. CLI 테스트는 합성 Cookie·fake fetch다. 실제 서버에 로그인하거나 공유 DB에 쓰지 않는다.

`node --test scripts/textbook/__tests__/factory-order-draft.test.mjs`와 `pnpm --filter web exec vitest run --pool=forks --maxWorkers=1 --minWorkers=1 src/app/api/__tests__/route-callers.test.ts`를 실제 실행한다. 단순히 helper import 문자열만 넣어 회귀를 속이지 마라. 서비스 변경 없으면 이전 테스트는 HEAD/범위가 같으므로 불필요하게 반복하지 않는다.

`01A-DEMAND-ORDER-RESULT.md`에 R1 보완과 실제 결과를 추가한다. 코드가 없는 시험/skip/실행하지 못한 항목을 PASS로 만들지 않는다. 커밋은 Codex 검토 뒤 하므로 이 세션은 커밋하지 말고 종료한다.
