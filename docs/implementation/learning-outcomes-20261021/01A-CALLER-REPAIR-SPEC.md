<!-- docs/implementation/learning-outcomes-20261021/01A-CALLER-REPAIR-SPEC.md -->
# 1A R1 — 실제 운영 호출부 보완

Codex 전역 검증에서 `apps/web/src/app/api/__tests__/route-callers.test.ts`가 4통과/1실패였다. 새 factory-order-draft와 기존 product-order-lineage의 앱/운영 코드 호출부가 없다. 예외 목록이나 테스트용 문자열로 숨기지 않고 실제 운영 진입을 붙인다. UI는 단계 3 FAST에서 다루며 이번에는 관리자가 실행할 수 있는 읽기 전용 CLI다.

## 구현

- `scripts/textbook/factory-order-draft.mjs`: Node 기본 API만 사용하는 실제 HTTP 도구. `prepare --input <JSON> --out <새 파일>`은 새 `/api/admin/csat/factory-order-draft`에 POST. `lineage --user <UUID> --workspace <UUID> --out <새 파일>`은 기존 `/api/admin/csat/product-order-lineage`에 GET. 명령은 조회·계산만 하며 register/link/withdraw는 제공하지 않는다.
- 관리자 Cookie는 `process.env.VOCAFLOW_ADMIN_COOKIE`에서만 읽고 인자/파일/출력에 넣지 않는다. 사용자에게 Cookie 입력을 요청하지 말고 미설정은 명시적 오류다. 이 오류를 검증 성공으로 세지 않는다. 시험에서는 합성 Cookie만 사용한다.
- `--base-url`은 기본 `http://localhost:3000`. 자격 증명 전송은 http의 loopback(localhost/127.0.0.1/[::1]) origin만 허용한다. username/password, 다른 host/protocol, redirect, 경로/쿼리/fragment가 섞인 base는 거절한다. redirect는 `error`로 막아 Cookie가 다른 곳으로 흘러가지 않게 한다. Origin 헤더를 명시하고 JSON Content-Type을 사용한다.
- 입력 크기는 API와 같은 120000바이트 상한. JSON 파싱·필수 플래그·UUID·Cookie·loopback 검증 실패 시 fetch/파일 쓰기 0. 성공 응답도 적절한 shape를 확인한다. API 비200/응답 파싱 실패/네트워크 오류는 실패로 전파하고 비밀 포함 원시 오류/헤더는 출력하지 않는다.
- 출력은 `wx`로 **새 파일에만** 저장하고 기존 파일은 거절한다. 실패 시 산출물을 만들지 않는다. 응답의 초안·미검증 대응·생산/납품 미실행 상태를 간단히 보고한다.
- CLI 로직을 export해 fake fetch로 시험할 수 있게 하고, 실제 entrypoint에서는 실행한다. 프레임워크·의존성 추가는 없다.
- `scripts/textbook/__tests__/factory-order-draft.test.mjs`: loopback/외부 origin·redirect·Cookie 미설정·입력 초과·잘못된 인자·기존 출력 보호·HTTP 실패·실제 두 URL/헤더/메서드 연결 정상 사례. 합성 입력만.
- `docs/ROUTES.md`와 `01A-DEMAND-ORDER-RESULT.md`: 실제 호출 명령·권한·기록 미생성·검증 결과. 읽기 전용임을 분명히 한다.

## 수용

1. `node --test scripts/textbook/__tests__/factory-order-draft.test.mjs` 실제 통과.
2. 기존 `route-callers.test.ts` 5/5 통과. EXTERNAL 목록/스캐너를 바꾸거나 가짜 참조를 추가하지 않는다.
3. 실제 CLI가 prepare/lineage 각각 올바른 HTTP 요청을 만들고, admin 인증/Origin을 유지하는 시험 통과. 실제 공유 서버를 호출하거나 로그인/DB 데이터를 변경하지 않는다.
4. 기존 서비스 코드는 변경하지 않는다. 꼭 필요하면 이유와 영향·재시험을 결과에 적는다. 신규 경로 파일 총수가 30개에 이르지 않게 유지한다.
