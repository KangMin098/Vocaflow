<!-- docs/implementation/learning-outcomes-20261021/prompts/01B-ROLLBACK-REPAIR-CLAUDE.md -->
# 새 Claude 세션 — 1B R2 부분 쓰기 실패 복구

작업공간 D:/workspace/Vocaflow-learning-outcomes-20261021-work. AGENTS.md, CLAUDE.md, development_policy와 01B-PRODUCTION-SPEC.md 마지막 R2를 읽는다. 신규 세션이며 resume/continue하지 않는다. subagent·넓은 재조사는 하지 않는다.

Codex가 실제 prepare-synthetic/export/import를 실행했다. HTML·materials·manifest·receipt와 실제 로컬 run이 있다. 문항 가정 사례를 실험처럼 쓴 표현도 Codex가 수정해 `chunk-01.reviewed.out.json`과 원본·독립 검토 JSON을 외부 runtime에 보존했다. 이 콘텐츠는 바꾸지 않는다.

**재현된 결함:** `node D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/probe-write-rollback.mjs before` → expected_rejection=true, output_directory_remains=true, remaining_files=[sheet.html], rollback_passed=false. writeFileSync가 새 파일을 부분적으로 만든 뒤 던지면 created 목록에 들어가기 전이라 정리가 안 된다. 1A CLI도 기본 writeNew에서 같은 유형의 문제를 갖는다.

네 책임 파일: scripts/textbook/factory-production-local.mts, scripts/textbook/factory-order-draft.mjs와 그 Node 테스트. 필요하면 scripts/textbook/__tests__/factory-production-local.test.mjs를 새로 만들 수 있다. 다른 작업자가 있는 코드베이스이므로 Codex/이전 세션 변경을 되돌리지 않는다. source core/API/생산물/반려 설계/기존문서 원기록은 고치지 않는다.

open wx로 소유를 확보한 뒤 fd 쓰기·정리하는 작은 helper를 기존 .mjs에서 export해 양쪽 CLI가 재사용해도 된다. 실패 시 자기 신규 파일만 닫고 제거하며, 기존 파일·다른 프로세스 파일은 삭제하지 않는다. 재귀 삭제는 쓰지 않는다. cleanup 실패도 숨기지 않는다. 오류 메시지에 Cookie/입력 본문을 싣지 않는다.

Node 시험으로 성공·기존 파일 충돌·부분 쓰기·close/cleanup 실패를 검증한다. 네가 쓴 .mts CLI에 시험이 필요하면 import 시 entrypoint가 실행되지 않게 분리하되 scope를 최소화한다. 파일 첫 줄 경로 주석을 지키고 shebang이 필요 없는 Node CLI에 추가하지 않는다.

허용 로컬 시험을 실행하고 01B-PRODUCTION-RESULT.md에 R2 결과를 추가한다. 외부 after probe나 tsx 실행 권한이 막히면 우회하지 말고 명령을 남긴다. Codex가 직접 실행할 것이다. 임시 tmp-packet-ids 시험은 Codex가 runtime/archived-packet-ids.test.ts로 옮겼으니 복구/재생성하지 않는다. 커밋·DB 쓰기·migration·등록·발행·납품·push/merge/배포 금지. 완료 뒤 파일·시험·한계를 보고하고 종료한다.
