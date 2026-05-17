// scripts/vcb/06-qa.ts
// VCB Step 6 QA Gate — CLI wrapper. Core logic in @vocaflow/vcb-curate-core/qa.
//
// Usage:
//   pnpm vcb:qa --run-id <id>
//   pnpm vcb:qa --run-id <id> --requeue-flagged

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { config as loadDotenv } from 'dotenv'
import { createLogger, getSupabaseAdmin, IngestError } from '@vocaflow/vcb-core'
import { performQaGate } from '@vocaflow/vcb-curate-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(__dirname, '../../.env.local') })
loadDotenv({ path: resolve(__dirname, '../../.env') })

const log = createLogger({ script: '06-qa' })

interface QaCliOptions {
  runId: number
  requeueFlagged: boolean
}

async function run(opts: QaCliOptions): Promise<void> {
  const childLog = log.child({ run_id: opts.runId })
  childLog.info('qa started')

  const client = getSupabaseAdmin()
  const result = await performQaGate(client, opts.runId, {
    requeueFlagged: opts.requeueFlagged,
  })

  if (!result.ok || !result.summary) {
    throw new IngestError(result.error ?? 'qa failed', { run_id: opts.runId })
  }

  childLog.info(result.summary, 'qa completed')
}

function parseCliArgs(): QaCliOptions {
  const { values } = parseArgs({
    options: {
      'run-id': { type: 'string' },
      'requeue-flagged': { type: 'boolean' },
    },
  })
  if (!values['run-id']) {
    throw new IngestError('--run-id is required')
  }
  return {
    runId: parseInt(values['run-id'], 10),
    requeueFlagged: values['requeue-flagged'] === true,
  }
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
    'qa failed',
  )
  process.exit(1)
})
