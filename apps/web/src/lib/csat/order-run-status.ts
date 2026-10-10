// apps/web/src/lib/csat/order-run-status.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { summarizeOrderRun } from '@vocaflow/library-pipeline/order-production-run'

export const ORDER_RUN_SCAN_LIMIT = 200

type RunOrder = { grade: string; product_order_id: string; order_revision: number; order_hash: string }
export type OrderRunStatus = ReturnType<typeof summarizeOrderRun> & {
  run: string
  order: RunOrder
  revision_current: boolean | null
}

async function readJson(file: string): Promise<unknown> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw Error('ORDER_RUN_FILE_UNREADABLE')
  }
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
      complete: await readJson(path.join(dir, 'complete.json')) as Parameters<typeof summarizeOrderRun>[0]['complete'] })
    runs.push({ ...summary, run: name, order,
      revision_current: currentRevision === null ? null : order.order_revision === currentRevision })
  }
  return runs
}
