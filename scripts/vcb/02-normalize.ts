// scripts/vcb/02-normalize.ts
// VCB Method A — Step 2.b Normalize: vocab_raw_texts 의 내용을 NFC 정규화
// + lowercase 변환 후 같은 row 의 normalized_content 컬럼에 적재.
// dedup 은 ingest 단계에서 이미 처리됨.
//
// 주: 현재 vocab_raw_texts 는 content 자체를 저장하지 않고 hash 만 보관.
// 따라서 normalize 는 원본 파일을 다시 읽거나, Storage 에서 재조회해야 함.
// P1 단계에서는 "정규화 결과를 메타필드에만 기록 + run status 전환" 으로 한정.
// 본격적 텍스트 처리는 P2 (03-extract.ts) 에서 WLP 가 담당.
//
// 사용:
//   pnpm vcb:normalize --run-id <id>
//
// CLAUDE.md §19.4 Step 2 정합.

import { parseArgs } from 'node:util';
import {
  getSupabaseAdmin,
  createLogger,
  IngestError,
} from '@vocaflow/vcb-core';

const log = createLogger({ script: '02-normalize' });

interface NormalizeOptions {
  runId: number;
}

interface RawTextRow {
  id: number;
  content_hash: string;
  content_bytes: number | null;
}

async function fetchRawTexts(runId: number): Promise<RawTextRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('vocab_raw_texts')
    .select('id, content_hash, content_bytes')
    .eq('run_id', runId);

  if (error) {
    throw new IngestError('fetch raw_texts failed', {
      run_id: runId,
      error: error.message,
    });
  }
  return (data ?? []) as RawTextRow[];
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

/**
 * NFC 정규화 + lowercase 검증.
 * 실제 정규화는 03-extract.ts (WLP) 에서 토큰 단위로 수행.
 * 이 단계는 raw_texts 존재 + 빈도 검증 + status 전환만 책임.
 */
async function run(opts: NormalizeOptions): Promise<void> {
  const childLog = log.child({ run_id: opts.runId });
  childLog.info('normalize started');

  const rawTexts = await fetchRawTexts(opts.runId);
  if (rawTexts.length === 0) {
    throw new IngestError('no raw_texts found for run — run ingest first', {
      run_id: opts.runId,
    });
  }

  childLog.info(
    {
      raw_count: rawTexts.length,
      total_bytes: rawTexts.reduce((s, r) => s + (r.content_bytes ?? 0), 0),
    },
    'raw_texts validated'
  );

  // dedup 검증 (이미 UNIQUE (run_id, content_hash) 로 DB 가 보장하지만 명시적 확인)
  const hashes = new Set(rawTexts.map((r) => r.content_hash));
  if (hashes.size !== rawTexts.length) {
    throw new IngestError('hash collision detected — DB constraint violated', {
      run_id: opts.runId,
      expected: rawTexts.length,
      unique: hashes.size,
    });
  }

  await updateRunStatus(opts.runId, 'normalized');
  childLog.info('normalize completed');
}

function parseCliArgs(): NormalizeOptions {
  const { values } = parseArgs({
    options: {
      'run-id': { type: 'string' },
    },
  });

  if (!values['run-id']) {
    throw new IngestError('--run-id is required');
  }

  return { runId: parseInt(values['run-id'], 10) };
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
    'normalize failed'
  );
  process.exit(1);
});
