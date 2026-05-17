// packages/library-pipeline/src/env.ts
// 환경변수 검증 — admin 측 (CLI / Edge Function / API Route) 진입 시 1회 호출

import { z } from 'zod'

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // ANTHROPIC_API_KEY 는 LLM stage 사용 시에만 필요 (lookup-enrich, cefr-detect 가 자체 검사)
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    SUPABASE_URL:
      process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'],
    SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'],
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'],
  })

  if (!parsed.success) {
    throw new Error(
      `library-pipeline env invalid: ${parsed.error.message}`,
    )
  }
  return parsed.data
}
