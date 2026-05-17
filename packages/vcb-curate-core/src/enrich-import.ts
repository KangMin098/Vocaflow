// packages/vcb-curate-core/src/enrich-import.ts
// VCB Step 5d — Import enriched JSONL into vocab_enrichment_queue.
// Shared between CLI + Server Action. Idempotent (re-import safe).

import fs from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isEnrichedSkip, type EnrichedLine } from '@vocaflow/vcb-core'

export interface ValidationReport {
  ok: boolean
  total_input: number
  total_passed: number
  total_failed: number
  total_skipped: number
}

export function loadValidationReport(enrichedPath: string): ValidationReport | null {
  const reportPath = enrichedPath.replace(/\.jsonl$/, '.validation.json')
  if (!fs.existsSync(reportPath)) return null
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as ValidationReport
  } catch {
    return null
  }
}

export interface ImportEnrichmentOptions {
  /** Skip validation report check (use only when validation file unavailable). */
  skipValidation?: boolean
}

export interface ImportEnrichmentResult {
  ok: boolean
  imported?: number
  skipped?: number
  failed?: number
  total?: number
  error?: string
}

interface UpdateRowOpts {
  queueId: number
  enrichedAt: string
  enrichedFile: string
  payload: Record<string, unknown> | null
  status: 'enriched' | 'failed'
  lastError: string | null
}

async function updateQueueRow(
  client: SupabaseClient,
  opts: UpdateRowOpts,
): Promise<void> {
  const { error } = await client
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
    throw new Error(`queue update failed (queue_id=${opts.queueId}): ${error.message}`)
  }
}

function parseJsonl(content: string): { ok: boolean; items?: EnrichedLine[]; error?: string; line?: number } {
  if (content.charCodeAt(0) === 0xfeff) {
    return { ok: false, error: 'file has UTF-8 BOM' }
  }
  if (content.includes('\r\n')) {
    return { ok: false, error: 'file has CRLF line endings' }
  }
  const lines = content.split('\n').filter((l) => l.trim().length > 0)
  const items: EnrichedLine[] = []
  for (let i = 0; i < lines.length; i++) {
    try {
      items.push(JSON.parse(lines[i]!) as EnrichedLine)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: `invalid JSON: ${msg}`, line: i + 1 }
    }
  }
  return { ok: true, items }
}

export async function importEnrichmentResult(
  client: SupabaseClient,
  filePath: string,
  opts: ImportEnrichmentOptions = {},
): Promise<ImportEnrichmentResult> {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: `file not found: ${filePath}` }
    }

    if (!opts.skipValidation) {
      const report = loadValidationReport(filePath)
      if (!report) {
        return {
          ok: false,
          error: 'validation report not found — run validator first or set skipValidation',
        }
      }
      if (!report.ok) {
        return {
          ok: false,
          error: `validation report indicates failures (${report.total_failed}/${report.total_input})`,
        }
      }
    }

    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = parseJsonl(content)
    if (!parsed.ok || !parsed.items) {
      const ln = parsed.line ? ` (line ${parsed.line})` : ''
      return { ok: false, error: `${parsed.error}${ln}` }
    }

    const enrichedAt = new Date().toISOString()
    let imported = 0
    let skipped = 0
    let failed = 0

    for (const item of parsed.items) {
      if (isEnrichedSkip(item)) {
        await updateQueueRow(client, {
          queueId: item.queue_id,
          enrichedAt,
          enrichedFile: filePath,
          payload: null,
          status: 'failed',
          lastError: `skipped by enrich: ${item.error}`,
        })
        skipped++
        continue
      }

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
        await updateQueueRow(client, {
          queueId: item.queue_id,
          enrichedAt,
          enrichedFile: filePath,
          payload,
          status: 'enriched',
          lastError: null,
        })
        imported++
      } catch {
        failed++
      }
    }

    return {
      ok: true,
      imported,
      skipped,
      failed,
      total: parsed.items.length,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
