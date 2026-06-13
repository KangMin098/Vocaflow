// apps/web/src/test/server-only-stub.ts
//
// vitest 전용 stub — `server-only` 패키지는 RSC 외부에서 import 시 throw 한다.
// 노드 테스트 환경에서 server-only 를 쓰는 모듈(route handler·server query 등)을
// import 할 수 있도록 vitest.config.ts 의 resolve.alias 에서 이 빈 모듈로 치환한다.
export {}
