// scripts/vcb/01-ingest.ts
// VCB Method A — Step 2 Ingest: 업로드된 파일을 vocab_raw_texts 에 적재
//
// 사용:
//   pnpm vcb:ingest --source-id <id> --run-id <id> --file <path>
//   pnpm vcb:ingest --source-id <id> --run-id <id> --storage-key <key>
//
// CLAUDE.md §19.4 Step 2 정합.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  getSupabaseAdmin,
  createLogger,
  IngestError,
  LicenseGateError,
  type VocabSourceRow,
} from '@vocaflow/vcb-core';

const log = createLogger({ script: '01-ingest' });

interface IngestOptions {
  sourceId: number;
  runId: number;
  filePath?: string;
  storageKey?: string;
}

async function fetchSource(sourceId: number): Promise<VocabSourceRow> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('vocab_sources')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (error || !data) {
    throw new IngestError('source not found', {
      source_id: sourceId,
      error: error?.message,
    });
  }
  return data as VocabSourceRow;
}

async function readFromStorage(storageKey: string): Promise<Buffer> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage
    .from('vocab-sources-raw')
    .download(storageKey);

  if (error || !data) {
    throw new IngestError('storage download failed', {
      storage_key: storageKey,
      error: error?.message,
    });
  }
  return Buffer.from(await data.arrayBuffer());
}

async function readFromLocal(filePath: string): Promise<Buffer> {
  if (!fs.existsSync(filePath)) {
    throw new IngestError('local file not found', { file_path: filePath });
  }
  return fs.readFileSync(filePath);
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

async function insertRawText(opts: {
  runId: number;
  sourceId: number;
  externalRef: string | null;
  content: Buffer;
}): Promise<{ inserted: boolean; rawId?: number }> {
  const sb = getSupabaseAdmin();
  const contentHash = sha256(opts.content);
  const contentBytes = opts.content.byteLength;

  // ON CONFLICT (run_id, content_hash) DO NOTHING — dedup
  const { data, error } = await sb
    .from('vocab_raw_texts')
    .upsert(
      {
        run_id: opts.runId,
        source_id: opts.sourceId,
        external_ref: opts.externalRef,
        content_hash: contentHash,
        content_bytes: contentBytes,
      },
      {
        onConflict: 'run_id,content_hash',
        ignoreDuplicates: true,
      }
    )
    .select('id')
    .maybeSingle();

  if (error) {
    throw new IngestError('insert raw_text failed', {
      error: error.message,
      content_hash: contentHash,
    });
  }

  return {
    inserted: data !== null,
    rawId: data?.id,
  };
}

async function updateRunStatus(runId: number, status: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('vocab_runs')
    .update({ status })
    .eq('id', runId);

  if (error) {
    throw new IngestError('run status update failed', {
      run_id: runId,
      error: error.message,
    });
  }
}

async function run(opts: IngestOptions): Promise<void> {
  const childLog = log.child({ run_id: opts.runId, source_id: opts.sourceId });
  childLog.info('ingest started');

  // 1. Source 조회 + 라이선스 게이트
  const source = await fetchSource(opts.sourceId);

  if (source.license_tier === 'T3') {
    throw new LicenseGateError('T3 source cannot be ingested', {
      source_id: opts.sourceId,
      tier: source.license_tier,
    });
  }

  // 2. 파일 읽기
  let content: Buffer;
  let externalRef: string | null = null;

  if (opts.storageKey) {
    childLog.info({ storage_key: opts.storageKey }, 'reading from storage');
    content = await readFromStorage(opts.storageKey);
    externalRef = opts.storageKey;
  } else if (opts.filePath) {
    childLog.info({ file_path: opts.filePath }, 'reading from local');
    content = await readFromLocal(opts.filePath);
    externalRef = path.basename(opts.filePath);
  } else {
    throw new IngestError('either --file or --storage-key required');
  }

  if (content.byteLength === 0) {
    throw new IngestError('empty file', { external_ref: externalRef });
  }

  // 3. run status 전환
  await updateRunStatus(opts.runId, 'ingesting');

  // 4. raw_text 적재 (dedup)
  const result = await insertRawText({
    runId: opts.runId,
    sourceId: opts.sourceId,
    externalRef,
    content,
  });

  if (!result.inserted) {
    childLog.warn(
      { content_hash: sha256(content).slice(0, 12) },
      'duplicate content, skipped'
    );
  } else {
    childLog.info(
      {
        raw_id: result.rawId,
        bytes: content.byteLength,
        hash_prefix: sha256(content).slice(0, 12),
      },
      'raw_text inserted'
    );
  }

  childLog.info('ingest completed');
}

function parseCliArgs(): IngestOptions {
  const { values } = parseArgs({
    options: {
      'source-id': { type: 'string' },
      'run-id': { type: 'string' },
      file: { type: 'string' },
      'storage-key': { type: 'string' },
    },
  });

  if (!values['source-id'] || !values['run-id']) {
    throw new IngestError('--source-id and --run-id are required');
  }
  if (!values.file && !values['storage-key']) {
    throw new IngestError('either --file or --storage-key required');
  }

  return {
    sourceId: parseInt(values['source-id'], 10),
    runId: parseInt(values['run-id'], 10),
    filePath: values.file,
    storageKey: values['storage-key'],
  };
}

const opts = parseCliArgs();
run(opts).catch((err) => {
  log.error(
    {
      err:
        err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              code: (err as { code?: string }).code,
              context: (err as { context?: unknown }).context,
            }
          : err,
    },
    'ingest failed'
  );
  process.exit(1);
});
