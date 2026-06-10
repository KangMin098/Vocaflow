// apps/web/vitest.config.ts
// vitest 가 .env.local 을 자동 로드하지 않으므로 dotenv 로 명시 로딩
// (NEXT_PUBLIC_* 외 SUPABASE_SERVICE_ROLE_KEY 등 통합 테스트용 키 주입)

import { defineConfig } from 'vitest/config'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
dotenvConfig({ path: resolve(__dirname, '../../.env.local') })

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
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
