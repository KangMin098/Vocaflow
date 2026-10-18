<!-- docs/research/final-independent-20261018/VALIDATION.md -->
# 기준선 검증 기록

- 기준 제품: main c3a03d168. 제품 코드는 수정하지 않았다.
- pnpm --filter web typecheck: PASS. 전체 앱 및 스크립트 타입 검사.
- pnpm --filter web exec tsc -p tsconfig.scripts.json: PASS. 최종 실행기 두 파일 포함.
- pnpm --filter web exec eslint scripts/final-independent/probe-delivery-provenance.ts scripts/final-independent/audit-task-support.ts: PASS.
- node agents/scripts/check.mjs --quiet 및 git diff --check: PASS.
- 자체 보고서 3개 Markdown의 로컬 링크: 누락0.
- FI-001 최초 조합·같은 역할 조합: 모두 실제 SQL PGlite에서 결함 재현. 명시 delivery 대조군은 모두 evidence=true. 이는 제품 테스트 PASS가 아니라 반례 재현 성공이다.
- 적용 이력 4개: 실제 DB statements SHA와 저장소 SHA 전부 일치. #286~#292 필수8종 CI SUCCESS 재사용. e2e-shared-dev SKIPPED를 실DB PASS로 세지 않음.
- 실제 개발 DB: READ ONLY 집계·카탈로그 SELECT만 수행. 브라우저/사용자 계정 생성·쓰기 없음. 기존 PC·권한·격리 검증은 원본 증거를 재사용하고 새 통합 코드가 오면 변경 범위를 재검증한다.
- 신규 통합 PR: 관찰 시점 #292 이후 없음. 최종 제품 ACCEPT나 전체 수용 완료를 선언하지 않음.
- FI-001 개발 세션 전달: 로컬 공용 제어 원장 DL-0148에 기록. GitHub 게시 요청은 자동 승인 심사 거부 후 사용자 구체적 게시 승인 대기. 거부를 우회한 공개 push·이슈 게시 없음.
