// apps/web/src/lib/csat/order-run-status.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { summarizeOrderRun } from '@vocaflow/library-pipeline/order-production-run'

export const ORDER_RUN_SCAN_LIMIT = 200

type RunOrder = { grade: string; product_order_id: string; order_revision: number; order_hash: string }
type AtomicJournal = { journal: string; state: string; latest_file: string | null; latest_sha256: string | null }
type AtomicStatusFile = { state: string; html_sha256: string | null; revision: number; delivery_modes: string[];
  companion_items?: number; companion_activities?: string[];
  days: { day: number; grades: string[] }[]; journals: AtomicJournal[] }
/** What `scripts/textbook/run-atomic.mjs status` last recorded, re-fingerprinted on every read. */
export type RunAtomicStatus = {
  state: 'volume_ready' | 'revision_incomplete' | 'broken' | 'status_stale' | 'status_missing'
  revision: number | null
  day_count: number
  delivery_modes: string[]
  companion_items: number
  companion_activities: string[]
  journals: { journal: string; state: string }[]
}
export type OrderRunStatus = ReturnType<typeof summarizeOrderRun> & {
  run: string
  order: RunOrder
  revision_current: boolean | null
  atomic: RunAtomicStatus | null
}

async function readJson(file: string): Promise<unknown> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw Error('ORDER_RUN_FILE_UNREADABLE')
  }
}

const sha256 = async (file: string) => createHash('sha256').update(await fs.readFile(file)).digest('hex')

/**
 * The CLI verifies hash chains and manifests; here we only check that nothing it fingerprinted changed
 * since (volume HTML, the set of journals and each journal's latest record). Any change, or a missing or
 * unreadable status file, is reported as not measured instead of reusing the old verdict.
 */
async function readAtomicStatus(dir: string): Promise<RunAtomicStatus | null> {
  const atomic = path.join(dir, 'atomic')
  try { await fs.access(atomic) } catch { return null }
  const empty = { revision: null, day_count: 0, delivery_modes: [], companion_items: 0, companion_activities: [], journals: [] }
  let status: AtomicStatusFile | undefined
  try { status = await readJson(path.join(atomic, 'status.json')) as AtomicStatusFile | undefined } catch { status = undefined }
  if (!status) return { state: 'status_missing', ...empty }
  const journals = Array.isArray(status.journals) ? status.journals : []
  const summary = { revision: status.revision ?? null, day_count: status.days?.length ?? 0,
    delivery_modes: status.delivery_modes ?? [], companion_items: status.companion_items ?? 0,
    companion_activities: status.companion_activities ?? [], journals: journals.map(row => ({ journal: row.journal, state: row.state })) }
  let fresh = false
  try {
    const journalRoot = path.join(atomic, 'journal')
    const present = (await fs.readdir(journalRoot).catch(() => [] as string[])).filter(name => /^day-\d+-r\d+$/.test(name)).sort()
    fresh = status.html_sha256 === await sha256(path.join(atomic, 'volume.html')) &&
      present.join(',') === journals.map(row => row.journal).join(',')
    for (const row of journals) {
      if (!fresh) break
      const records = (await fs.readdir(path.join(journalRoot, row.journal))).filter(file => /^revision-\d{6}\.json$/.test(file)).sort()
      fresh = (records.at(-1) ?? null) === row.latest_file &&
        (row.latest_file === null || await sha256(path.join(journalRoot, row.journal, row.latest_file)) === row.latest_sha256)
    }
  } catch { fresh = false }
  if (!fresh) return { state: 'status_stale', ...summary }
  const state = (['volume_ready', 'revision_incomplete', 'broken'] as const).find(value => value === status.state) ?? 'broken'
  return { state, ...summary }
}

/**
 * Reads order-production-run directories under one operator-configured root and
 * returns those that contain the order. Only the run directory name leaves the server.
 * `currentRevision` is the registered DB revision; a run on another revision is stale.
 */
export async function readOrderRuns(root: string, orderId: string, currentRevision: number | null) {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const dirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  if (dirs.length > ORDER_RUN_SCAN_LIMIT) throw Error('ORDER_RUN_SCAN_LIMIT_EXCEEDED')
  const runs: OrderRunStatus[] = []
  for (const name of dirs) {
    const dir = path.join(root, name)
    const drain = await readJson(path.join(dir, 'drain.json')) as
      { drain_hash: string; cells: unknown[]; orders: RunOrder[] } | undefined
    const order = drain?.orders?.find((entry: RunOrder) => entry.product_order_id === orderId)
    if (!drain || !order) continue
    const summary = summarizeOrderRun({ drain,
      result: await readJson(path.join(dir, 'result.json')) as Parameters<typeof summarizeOrderRun>[0]['result'],
      complete: await readJson(path.join(dir, 'complete.json')) as Parameters<typeof summarizeOrderRun>[0]['complete'],
      review: await readJson(path.join(dir, 'review.json')),
      reviewResult: await readJson(path.join(dir, 'review.result.json')) as Parameters<typeof summarizeOrderRun>[0]['reviewResult'] })
    runs.push({ ...summary, run: name, order,
      revision_current: currentRevision === null ? null : order.order_revision === currentRevision,
      atomic: await readAtomicStatus(dir) })
  }
  return runs
}
