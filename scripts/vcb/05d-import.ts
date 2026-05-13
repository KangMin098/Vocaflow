// scripts/vcb/05d-import.ts
// VCB Step 5d — /vcb-enrich 결과 JSONL 을 vocab_enrichment_queue 에 반영.
//
// 사용:
//   pnpm vcb:import-enriched --file exports/vcb-jobs/...-enriched.jsonl
//   pnpm vcb:import-enriched --file ... --skip-validation  (위험, 디버깅용)
//
// CLAUDE.md §19.5 [5d] 정합. 멱등 — 재import 안전.

import {
  createLogger,
  getSupabaseAdmin,
  IngestError,
  isEnrichedSkip,
  ValidationError,
  type EnrichedLine,
} from '@vocaflow/vcb-core'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const log = createLogger({ script: '05d-import' })

interface ImportOptions {
  filePath: string
  skipValidation: boolean
}

interface ValidationReport {
  ok: boolean
  total_input: number
  total_passed: number
  total_failed: number
  total_skipped: number
}

function loadValidationReport(enrichedPath: string): ValidationReport | null {
  const reportPath = enrichedPath.replace(/\.jsonl$/, '.validation.json')
  if (!fs.existsSync(reportPath)) return null
  try {
    const content = fs.readFileSync(reportPath, 'utf8')
    return JSON.parse(content) as ValidationReport
  } catch {
    return null
  }
}

function parseJsonl(content: string): EnrichedLine[] {
  const lines = content.split('\n').filter((l) => l.trim().length > 0)
  return lines.map((line, idx) => {
    try {
      return JSON.parse(line) as EnrichedLine
    } catch (e) {
      throw new ValidationError('invalid JSON line', {
        line_number: idx + 1,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  })
}

async function updateQueueRow(opts: {
  queueId: number
  enrichedAt: string
  enrichedFile: string
  payload: Record<string, unknown> | null
  status: 'enriched' | 'failed'
  lastError: string | null
}): Promise<void> {
  const sb = getSupabaseAdmin()
  const { error } = await sb
    .from('vocab_enrichment_queue')
    .update({
      status: opts.status,
      enriched_payload: opts.payload,
      enriched_job_file: opts.enrichedFile,
      enriched_at: opts.enrichedAt,
      last_error: opts.lastError,
    })
    .eq('id', opts.queueId)

  if (error) {
    throw new IngestError('queue update failed', {
      queue_id: opts.queueId,
      error: error.message,
    })
  }
}

async function run(opts: ImportOptions): Promise<void> {
  const childLog = log.child({ file: path.basename(opts.filePath) })
  childLog.info('import started')

  if (!fs.existsSync(opts.filePath)) {
    throw new IngestError('file not found', { path: opts.filePath })
  }

  // validation report 확인
  if (!opts.skipValidation) {
    const report = loadValidationReport(opts.filePath)
    if (!report) {
      throw new ValidationError(
        'validation report not found — run 05c-validate-output.mjs first or use --skip-validation',
        { expected: opts.filePath.replace(/\.jsonl$/, '.validation.json') }
      )
    }
    if (!report.ok) {
      throw new ValidationError('validation report indicates failures — import blocked', {
        total_failed: report.total_failed,
        total_input: report.total_input,
      })
    }
    childLog.info(
      {
        passed: report.total_passed,
        skipped: report.total_skipped,
      },
      'validation passed'
    )
  } else {
    childLog.warn('skip-validation flag set — proceeding without validation')
  }

  // 파일 파싱
  const content = fs.readFileSync(opts.filePath, 'utf8')
  if (content.charCodeAt(0) === 0xfeff) {
    throw new ValidationError('file has UTF-8 BOM', { path: opts.filePath })
  }
  if (content.includes('\r\n')) {
    throw new ValidationError('file has CRLF line endings', { path: opts.filePath })
  }

  const items = parseJsonl(content)
  childLog.info({ count: items.length }, 'parsed JSONL')

  const enrichedAt = new Date().toISOString()
  let imported = 0
  let skippedCount = 0
  let failedCount = 0

  for (const item of items) {
    if (isEnrichedSkip(item)) {
      // skip: queue row 를 'failed' 로 마킹 + last_error 기록
      await updateQueueRow({
        queueId: item.queue_id,
        enrichedAt,
        enrichedFile: opts.filePath,
        payload: null,
        status: 'failed',
        lastError: `skipped by enrich: ${item.error}`,
      })
      skippedCount += 1
      continue
    }

    // EnrichedItem
    const payload: Record<string, unknown> = {
      ipa: item.ipa,
      cefr: item.cefr,
      definitions_ko: item.definitions_ko,
      definitions_en: item.definitions_en,
      examples: item.examples,
      synonyms: item.synonyms,
      antonyms: item.antonyms,
      collocations: item.collocations,
      korean_learner_note: item.korean_learner_note,
      confidence: item.confidence,
    }

    try {
      await updateQueueRow({
        queueId: item.queue_id,
        enrichedAt,
        enrichedFile: opts.filePath,
        payload,
        status: 'enriched',
        lastError: null,
      })
      imported += 1
    } catch (err) {
      failedCount += 1
      childLog.error(
        { queue_id: item.queue_id, err: err instanceof Error ? err.message : err },
        'queue update failed'
      )
    }
  }

  childLog.info(
    {
      total: items.length,
      imported,
      skipped: skippedCount,
      failed: failedCount,
    },
    'import completed'
  )
}

function parseCliArgs(): ImportOptions {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'skip-validation': { type: 'boolean' },
    },
  })

  if (!values.file) {
    throw new IngestError('--file is required')
  }

  return {
    filePath: path.resolve(values.file),
    skipValidation: values['skip-validation'] === true,
  }
}

const opts = parseCliArgs()
run(opts).catch((err) => {
  log.error(
    {
      err:
        err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              code: (err as any).code,
              context: (err as any).context,
            }
          : err,
    },
    'import failed'
  )
  process.exit(1)
})
