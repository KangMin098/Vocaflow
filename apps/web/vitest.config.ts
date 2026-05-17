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
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
