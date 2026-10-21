<!-- docs/implementation/learning-outcomes-20261021/01B-PRODUCTION-RESULT.md -->
# 1B 결과 — 실제 소량 제작과 파일 복구 검증

2026-10-21 · 기준 `1c17a0a01` 이후 작업 트리. 구현·문항 작성 Claude Code 신규 세션 `0581875e-7520-4a62-8304-ca8d134d8946`, 복구 수정 신규 세션 `2dda6cc2-e3a7-48a8-bbc2-54e912a942bd`, 독립 검증·해설 수정 Codex.

**ACCEPT: 1B의 로컬 제작 범위.** 실제 1A 서비스로 준비한 합성 수요에 실제 원문을 연결해 문항 3개와 HTML·자료 JSON·manifest·receipt를 생성했다. 원문은 한 편이므로 독립 지문 3개로 세지 않는다. 공유 DB 쓰기·등록·발행·납품·학습효과 검증은 수행하지 않았다.

## 생성물과 판본

외부 실행 폴더: `D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/production-1b/run-20261021-a`.

- 원문: What a Name Does to a Picture, DB SELECT snapshot. 본문 SHA-256 `33dc4880f42b6b5815b93da059beb2dae640b138371e0cb1992ad46ba6452b0f`.
- Claude 직접 작성: `chunk-01.out.json`. Codex가 가상 예시를 실제 실험처럼 부른 설명 2곳을 고쳤다. 원본은 보존하고 `chunk-01.reviewed.out.json`을 실제 import했다. 수정본 SHA-256 `fe72cecf474728d23c5efac93c4ece5a6cd5a538f9e68fa30ff0afb72dffbf98`.
- 실제 결과: `reviewed-result/sheet.html`, `materials.json`, `manifest.json`, `receipt.json`. run `33498ac6-2cc7-4bad-b626-8b7732d6154e`.
- sheet SHA-256 `677a10e49b4f5590357768c9f057f6822c3109454824e0f6f00047202780b3f6`; materials `7a24f15788341fa2d1ec956b7f6efdf3b1a0b12afbe59edad56a07809ddfda6a`; manifest `eda0965a4fa37fd152004fde3565b34c160a0b48ef65daab670a43cec939a458`.

`REAL`은 실제 로컬 제작 실행이라는 뜻이다. 수요와 정책 hash는 합성이며 lifecycle은 `test_fixture`, 상태는 `review_pending`, 권리/품질/전역 crosswalk는 미승인이다. snapshot 이후 현재성 조회를 하지 않았으며 실제 제품 공급 승인을 뜻하지 않는다.

## 수용 결과

| 기준 | 결과 | 증거 |
|---|---|---|
| B1 실제 제작 | PASS | prepare-synthetic → export → 직접 집필 → 검토 수정 → import로 4파일 생성 |
| B2 결속·변조 차단 | PASS | 실제 sealer·evaluateSource·validateManifest 사용. 주문/원문/요청/hash/role/TASK/수량/답·근거 변조 회귀 및 실제 stale import 거절 |
| B3 원천 적격성 | PASS | archived/display_only/분석 미비/미판정 입력은 실제 원천 정책 결과대로 거절 |
| B4 안전 출력·파일 hash | PASS | HTML escape·CSP 회귀, 실제 디스크 bytes와 receipt/manifest hash 대조 |
| B5 재실행·복구 | PASS | 동일 export 재사용, 기존 import 결과 bytes/mtime 보존, 쓰기 실패 주입 후 잔여 파일·폴더 없음 |
| B6 관련 검증 | PASS | 웹 167, 파일·CLI Node 18, scripts 타입 검사 포함 여부 6. 웹/scripts 타입 검사와 변경 TS lint exit 0 |

Codex 실제 실패 주입에서 최초 구현은 1바이트 sheet.html을 남겼다(`fault-before-result.json`). 새 Claude 세션이 open wx로 소유를 확보한 뒤 쓰고 실패 시 자신의 파일만 지우도록 수정했다. 수정 후 writeSync 경로에 실제 오류가 주입된 `fault-after2-result.json`에서 exit 1·주입 확인·잔여 0을 확인했다. 주입이 발생하지 않았던 첫 after 실행은 복구 증거에 포함하지 않는다. 강제 프로세스 종료/전원 중단 복구는 검증하지 않았다.

## 검증 재현과 기록

웹 Vitest는 `--pool=forks --maxWorkers=1 --minWorkers=1`로 factory-bridge, factory-order-draft, route-callers를 실행(167). `node --test scripts/textbook/__tests__/factory-new-file.test.mjs scripts/textbook/__tests__/factory-order-draft.test.mjs`(18). `script-typecheck-coverage.test.ts`(6), `tsc --noEmit -p .`, `tsc --noEmit -p tsconfig.scripts.json`, 변경 TS eslint를 실행했다. 루트 CLI를 scripts tsconfig에 명시적으로 포함시켜 타입 검증 공백을 막았다.

원시 로그와 독립 반례: 위 runtime의 `production-1b-*.log`, `production-1b-independent-result.json`, `fault-before-result.json`, `fault-after2-result.json`. 임시 무단언 테스트는 저장소 밖으로 옮겼으며 최종 통과 167에 포함하지 않았다. Claude 초기 제출본은 runtime `01B-CLAUDE-SUBMISSION.md`로 보존했다. 초기 CLI NOT_RUN은 이후 Codex 실제 실행으로 해소했으며 브라우저 E2E와 공유 DB 쓰기는 NOT_RUN이다.

다음은 1C의 현재 원천 재검증·AI 검수 결속·DCP 후보 공급이다. 원문 파생 문항을 완전 창작 authored_item으로 등록하지 않는다.
