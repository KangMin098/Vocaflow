// scripts/comic/pd/vitest.config.mjs
//
// PDCP 파이프라인 테스트 설정.
//
// `pool: 'forks'` 인 이유 (실측 2026-08-09, Node 24.15 · vitest 1.6):
//   기본 워커 스레드 풀로 테스트 파일 4개를 병렬 실행하면 **전부 통과한 뒤 종료 시점에**
//   프로세스가 SIGABRT(exit 134) 로 죽는다. 결과는 초록인데 종료 코드는 실패라
//   CI 에서 원인 없는 빨간불이 된다(파일 2개일 때는 재현되지 않아 늦게 드러난다).
//   `--pool=forks` 또는 `--no-file-parallelism` 로 각각 사라지는 것을 확인했고,
//   격리가 확실한 forks 를 택했다. 이 파일들은 실행 시간이 2초 미만이라 비용도 없다.

// `defineConfig` 를 쓰지 않는 이유: 이 디렉터리에는 node_modules 가 없어
// (테스트는 apps/web 의 vitest 를 `--root` 로 빌려 쓴다) `vitest/config` 를 해석하지 못한다.
// 평범한 객체 export 로 충분하다.
export default {
  test: {
    pool: 'forks',
    include: ['__tests__/**/*.test.mjs'],
  },
}
