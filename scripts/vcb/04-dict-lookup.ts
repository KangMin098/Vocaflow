// scripts/vcb/04-dict-lookup.ts
// VCB Step 4 Dictionary Lookup — CLI wrapper.
// Core logic lives in @vocaflow/vcb-curate-core/dict-lookup for SSoT.
//
// Usage:
//   pnpm vcb:dict-lookup --run-id <id>

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { config as loadDotenv } from 'dotenv'
import { createLogger, getSupabaseAdmin, IngestError } from '@vocaflow/vcb-core'
import { performDictLookup } from '@vocaflow/vcb-curate-core'

// Load .env.local from monorepo root (same pattern as 07-curate.ts).
const __dirname = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(__dirname, '../../.env.local') })
loadDotenv({ path: resolve(__dirname, '../../.env') })

const log = createLogger({ script: '04-dict-lookup' })

interface DictLookupOptions {
  runId: number
}

async function run(opts: DictLookupOptions): Promise<void> {
  const childLog = log.child({ run_id: opts.runId })
  childLog.info('dict-lookup started')

  const client = getSupabaseAdmin()
  const result = await performDictLookup(client, opts.runId)

  if (!result.ok || !result.summary) {
    throw new IngestError(result.error ?? 'dict-lookup failed', { run_id: opts.runId })
  }

  childLog.info(result.summary, 'dict-lookup completed')
}

function parseCliArgs(): DictLookupOptions {
  const { values } = parseArgs({
    options: { 'run-id': { type: 'string' } },
  })
  if (!values['run-id']) {
    throw new IngestError('--run-id is required')
  }
  return { runId: parseInt(values['run-id'], 10) }
}

const opts = parseCliArgs()
run(opts).catch((err) => {
  log.error(
    {
      err: err instanceof Error
        ? {
            name: err.name,
            message: err.message,
            code: (err as { code?: string }).code,
            context: (err as { context?: unknown }).context,
          }
        : err,
    },
    'dict-lookup failed',
  )
  process.exit(1)
})
