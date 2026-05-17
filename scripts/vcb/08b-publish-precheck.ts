// scripts/vcb/08b-publish-precheck.ts
// Thin CLI — vcb-curate-core 의 precheckPublish 호출 (dry-run).

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { getSupabaseAdmin, createLogger } from '@vocaflow/vcb-core'
import { precheckPublish } from '@vocaflow/vcb-curate-core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

const log = createLogger({ script: '08b-publish-precheck' })

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  let runId: number | null = null
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--run-id' && i + 1 < args.length) {
      const next = args[i + 1]
      if (next) {
        runId = parseInt(next, 10)
      }
      break
    }
  }

  if (runId === null || Number.isNaN(runId)) {
    log.error('usage: pnpm vcb:publish-precheck --run-id <number>')
    process.exit(1)
  }

  const client = getSupabaseAdmin()
  const result = await precheckPublish(client, runId)

  log.info(
    {
      runId,
      ok: result.ok,
      blockers: result.blockers,
      warnings: result.warnings,
      stats: result.stats,
    },
    result.ok ? 'precheck PASSED — ready to publish' : 'precheck FAILED',
  )

  if (!result.ok) {
    process.exit(2)
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  log.error({ err }, `08b-publish-precheck failed: ${msg}`)
  process.exit(1)
})
