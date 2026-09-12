// apps/web/vitest.config.ts
// vitest 가 .env.local 을 자동 로드하지 않으므로 dotenv 로 명시 로딩
// (NEXT_PUBLIC_* 외 SUPABASE_SERVICE_ROLE_KEY 등 통합 테스트용 키 주입)

import { defineConfig } from 'vitest/config'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// 레포 루트 → 워크스페이스 순. dotenv 는 이미 설정된 키를 덮지 않으므로 CI 환경변수와 루트가 우선.
// ⚠️ 루트 .env.local 은 존재하지 않는다 — 실제 키는 apps/web/.env.local 에만 있다.
// 루트만 읽던 동안 *.integration.test.ts 가 전부 조용히 skip 됐고(2026-08-12 실측:
// "injected env (0)"), 그 사이 골든 스냅샷이 추출 알고리즘 변경을 못 따라가 낡았다.
// 통합 테스트는 "돌지 않으면 없는 것" 이므로 skip 은 안전이 아니라 사각지대다.
dotenvConfig({ path: resolve(__dirname, '../../.env.local') })
dotenvConfig({ path: resolve(__dirname, './.env.local') })

export default defineConfig({
  // tsconfig 의 "@/*": ["./src/*"] 경로 별칭을 테스트에서도 동일하게 해석
  // (route handler 등 @/ 별칭 소스를 import 하는 테스트가 모듈을 찾도록)
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // `server-only` 은 RSC 외부 import 시 throw — 노드 테스트에선 빈 모듈로 치환
      'server-only': resolve(__dirname, './src/test/server-only-stub.ts'),
    },
  },
  // .tsx 테스트(RSC renderToString)용 — Next 와 동일한 automatic JSX 런타임
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // `.integration.test.ts` 들이 공유 dev DB(select_book_chapter_vocab 등 무거운 RPC)를
    // 동시 호출하면 statement_timeout 경합 → 간헐 실패. 파일 직렬 실행으로 경합 제거.
    // (CI 는 SERVICE_KEY 부재로 integration skip → 순수 단위 테스트만 직렬, 비용 미미.)
    fileParallelism: false,
    testTimeout: 40_000, // 통합 테스트가 대형 도서 select_book_chapter_vocab(~15s+부하) 호출 → 여유
    hookTimeout: 40_000,
  },
})
