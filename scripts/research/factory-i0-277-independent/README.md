# PR #277 I0 독립 재현

제품 마지막 변경 0ac635478. 최초 제출/초기 실패/후속 반례는 docs/research/factory-i0-277-independent의 INITIAL, PINNED-REPLAY, PURPOSE-REVIEW에 있다. CONTRACT_ONLY이며 실제 생산/공급/효과를 검증하지 않는다. 원본 SQL을 바꾸지 않는다.

1. pnpm install --frozen-lockfile 후 node scripts/research/factory-i0-277-independent/unit-final.mjs (순수 I0 76개, 소스 결속).
2. node scripts/research/factory-i0-277-independent/sql-isolated.mjs (local PGlite만, 원본 결함+수정 사양 7조건; 실제 DB/RLS 아님).
3. node scripts/research/factory-i0-277-independent/broad-final.mjs (소스 결속 광역 단위).
4. 전용 :3013이 비어 있는지 확인하고, 기존 개발 환경 변수 파일을 출력/복사하지 않고 Node --env-file로 전달해 checks.mjs browser 0 14 <새-run-id>를 실행한다. T1–T4·V2 두 PC 및 기존 경로 실행기는 기존 검증 자산을 재사용한다. NEXT_DIST_DIR은 .next-fi0277-review다. 해당 실행이 만든 합성 계정만 정리하며 삭제/부재를 확인한다.
5. node scripts/research/factory-i0-277-independent/audit.mjs <run-id>[,<추가-id>] (완료·소스·실행기·단위 결과가 일치해야 최종 EVIDENCE 생성).

local은 ignored이며 환경/원본·실행 중 기록을 공개하지 않는다. 기존 출력은 덮지 않고 재실행 시 새 run ID 또는 별도 깨끗한 checkout을 쓴다. 미완료·오류·SKIP·정리 미확인은 PASS가 아니다. 브라우저가 추가하는 tsconfig의 해당 distDir include는 소유 서버 종료 뒤 원복한다. 실제 학생 기록이나 기존 다른 서버를 건드리지 않는다. 최종 SHA의 CI·목적 검토·safe-merge는 PR 영수증과 독립 수용 보고에 기록한다.
