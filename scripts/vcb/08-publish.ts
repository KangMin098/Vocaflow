// scripts/vcb/08-publish.ts
// Thin CLI — vcb-curate-core 의 publishRun 호출.

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { getSupabaseAdmin, createLogger } from '@vocaflow/vcb-core'
import { publishRun, type PublishContext } from '@vocaflow/vcb-curate-core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

const log = createLogger({ script: '08-publish' })

const CTX: PublishContext = { published_by: null }

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
    log.error('usage: pnpm vcb:publish --run-id <number>')
    process.exit(1)
  }

  const client = getSupabaseAdmin()

  log.info({ runId }, 'publish: starting')
  const result = await publishRun(client, runId, CTX)

  if (!result.ok) {
    log.error({ runId, error: result.error }, 'publish failed')
    process.exit(1)
  }

  log.info(
    {
      runId,
      sharedWordSetId: result.shared_word_set_id,
      collectionId: result.collection_id,
      version: result.version,
      publishedCount: result.published_count,
    },
    'publish OK',
  )
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  log.error({ err }, `08-publish failed: ${msg}`)
  process.exit(1)
})
