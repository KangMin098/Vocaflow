// packages/vcb-core/src/paths.ts
// exports/vcb-jobs/ 경로 유틸. CLAUDE.md §19.5 / §19.4b 정합.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 모노레포 루트 탐색 (pnpm-workspace.yaml 존재 기준).
 */
export function findMonorepoRoot(startDir?: string): string {
  let dir = startDir ?? path.dirname(fileURLToPath(import.meta.url));
  const root = path.parse(dir).root;

  while (dir !== root) {
    const wsFile = path.join(dir, 'pnpm-workspace.yaml');
    if (fs.existsSync(wsFile)) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error('pnpm-workspace.yaml not found — not in a monorepo');
}

/**
 * exports/vcb-jobs/ 디렉토리 경로 (없으면 생성).
 */
export function getVcbJobsDir(): string {
  const root = findMonorepoRoot();
  const dir = path.join(root, 'exports', 'vcb-jobs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 타임스탬프 prefix 생성 (YYYYMMDD-HHMM).
 */
export function timestampPrefix(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '-',
    pad(d.getHours()),
    pad(d.getMinutes()),
  ].join('');
}

/**
 * 파일명 생성 헬퍼.
 */
export const jobFileName = {
  pending: (slug: string, ts: string) => `${ts}-${slug}-pending.jsonl`,
  enriched: (slug: string, ts: string) => `${ts}-${slug}-enriched.jsonl`,
  seedSpec: (slug: string, ts: string) => `${ts}-${slug}-seed-spec.json`,
  seedList: (slug: string, ts: string) => `${ts}-${slug}-seed-list.jsonl`,
  validation: (baseFile: string) =>
    baseFile.replace(/\.jsonl$/, '.validation.json'),
  error: (baseFile: string) => baseFile.replace(/\.jsonl$/, '.error.json'),
};

/**
 * UTF-8 without BOM + LF 보장 writer.
 * CLAUDE.md §19.5 Windows 인코딩 제약 준수.
 */
export function writeUtf8Lf(filePath: string, lines: string[]): void {
  const content = lines.join('\n') + '\n';
  fs.writeFileSync(filePath, content, { encoding: 'utf8' });
}

/**
 * BOM / CRLF 검사. validator 공통 유틸.
 */
export function checkEncoding(filePath: string): {
  ok: boolean;
  hasBom: boolean;
  hasCrlf: boolean;
} {
  const buf = fs.readFileSync(filePath);
  const hasBom =
    buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const text = buf.toString('utf8');
  const hasCrlf = text.includes('\r\n');
  return { ok: !hasBom && !hasCrlf, hasBom, hasCrlf };
}
