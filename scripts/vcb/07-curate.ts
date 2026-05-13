// scripts/vcb/07-curate.ts
// Thin CLI — vcb-curate-core 의 큐레이션 함수 호출 분배.
// 모든 비즈니스 로직은 @vocaflow/vcb-curate-core 에 있음.

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { getSupabaseAdmin, createLogger } from '@vocaflow/vcb-core'
import {
  approveQueueItem,
  rejectQueueItem,
  editQueueItem,
  reenrichQueueItem,
  fetchCurationStats,
  type CurationContext,
  type QueuePayload,
} from '@vocaflow/vcb-curate-core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

const log = createLogger({ script: '07-curate' })

// CLI 는 service-role 클라이언트 사용 → decided_by null
const CTX: CurationContext = { decided_by: null }

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const subcommand = args[0]

  if (!subcommand) {
    printUsage()
    process.exit(1)
  }

  try {
    switch (subcommand) {
      case 'approve':
        await cmdApprove(args.slice(1))
        break
      case 'reject':
        await cmdReject(args.slice(1))
        break
      case 'edit':
        await cmdEdit(args.slice(1))
        break
      case 'reenrich':
        await cmdReenrich(args.slice(1))
        break
      case 'stats':
        await cmdStats(args.slice(1))
        break
      default:
        log.error(`unknown subcommand: ${subcommand}`)
        printUsage()
        process.exit(1)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error({ err }, `07-curate failed: ${msg}`)
    process.exit(1)
  }
}

function printUsage(): void {
  log.info('usage: pnpm vcb:curate <subcommand> <args>')
  log.info('subcommands:')
  log.info('  approve  <queue_id> [note]')
  log.info('  reject   <queue_id> [note]')
  log.info('  edit     <queue_id> <payload_json_file> [note]')
  log.info('  reenrich <queue_id> [note]')
  log.info('  stats    <run_id>')
}

async function cmdApprove(args: string[]): Promise<void> {
  const queueIdStr = args[0]
  if (!queueIdStr) {
    log.error('approve: missing queue_id')
    process.exit(1)
  }
  const queueId = parseInt(queueIdStr, 10)
  if (Number.isNaN(queueId)) {
    log.error(`approve: invalid queue_id: ${queueIdStr}`)
    process.exit(1)
  }
  const note = args[1] ?? null

  const client = getSupabaseAdmin()
  const result = await approveQueueItem(client, queueId, note, CTX)

  if (!result.ok) {
    log.error({ queueId, error: result.error }, 'approve failed')
    process.exit(1)
  }
  log.info({ queueId, decisionId: result.decision_id }, 'approve OK')
}

async function cmdReject(args: string[]): Promise<void> {
  const queueIdStr = args[0]
  if (!queueIdStr) {
    log.error('reject: missing queue_id')
    process.exit(1)
  }
  const queueId = parseInt(queueIdStr, 10)
  if (Number.isNaN(queueId)) {
    log.error(`reject: invalid queue_id: ${queueIdStr}`)
    process.exit(1)
  }
  const note = args[1] ?? null

  const client = getSupabaseAdmin()
  const result = await rejectQueueItem(client, queueId, note, CTX)

  if (!result.ok) {
    log.error({ queueId, error: result.error }, 'reject failed')
    process.exit(1)
  }
  log.info({ queueId, decisionId: result.decision_id }, 'reject OK')
}

async function cmdEdit(args: string[]): Promise<void> {
  const queueIdStr = args[0]
  const payloadFile = args[1]
  if (!queueIdStr || !payloadFile) {
    log.error('edit: missing queue_id or payload_json_file')
    process.exit(1)
  }
  const queueId = parseInt(queueIdStr, 10)
  if (Number.isNaN(queueId)) {
    log.error(`edit: invalid queue_id: ${queueIdStr}`)
    process.exit(1)
  }
  const note = args[2] ?? null

  const { readFile } = await import('node:fs/promises')
  const rawPayload = await readFile(payloadFile, 'utf-8')
  let editedPayload: Partial<QueuePayload>
  try {
    editedPayload = JSON.parse(rawPayload) as Partial<QueuePayload>
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error({ payloadFile, err: msg }, 'edit: payload JSON parse failed')
    process.exit(1)
  }

  const client = getSupabaseAdmin()
  const result = await editQueueItem(client, queueId, editedPayload, note, CTX)

  if (!result.ok) {
    log.error({ queueId, error: result.error }, 'edit failed')
    process.exit(1)
  }
  log.info({ queueId, decisionId: result.decision_id }, 'edit OK')
}

async function cmdReenrich(args: string[]): Promise<void> {
  const queueIdStr = args[0]
  if (!queueIdStr) {
    log.error('reenrich: missing queue_id')
    process.exit(1)
  }
  const queueId = parseInt(queueIdStr, 10)
  if (Number.isNaN(queueId)) {
    log.error(`reenrich: invalid queue_id: ${queueIdStr}`)
    process.exit(1)
  }
  const note = args[1] ?? null

  const client = getSupabaseAdmin()
  const result = await reenrichQueueItem(client, queueId, note, CTX)

  if (!result.ok) {
    log.error({ queueId, error: result.error }, 'reenrich failed')
    process.exit(1)
  }
  log.info(
    {
      queueId,
      decisionId: result.decision_id,
      slashCommand: result.slash_command,
    },
    'reenrich OK — execute slash command in VS Code Claude Code',
  )
}

async function cmdStats(args: string[]): Promise<void> {
  const runIdStr = args[0]
  if (!runIdStr) {
    log.error('stats: missing run_id')
    process.exit(1)
  }
  const runId = parseInt(runIdStr, 10)
  if (Number.isNaN(runId)) {
    log.error(`stats: invalid run_id: ${runIdStr}`)
    process.exit(1)
  }

  const client = getSupabaseAdmin()
  const stats = await fetchCurationStats(client, runId)

  log.info({ runId, stats }, 'curation stats')
}

main()
