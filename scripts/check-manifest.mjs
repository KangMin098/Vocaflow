#!/usr/bin/env node
// scripts/check-manifest.mjs
// ─────────────────────────────────────────────────────────
// PROJECT_KNOWLEDGE_MANIFEST drift 검증.
// docs/AI_CONTEXT/ 신규 폴더가 manifest 에 없거나, docs/ 직속 파일이
// manifest §1 Tier 1 list 에서 누락된 경우 알림 (CI warning).
//
// 실행: node scripts/check-manifest.mjs
// 종료 코드: 0 (정합) · 1 (drift 감지, warning 만 — block 안 함)
// ─────────────────────────────────────────────────────────

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const repoRoot = resolve(__dirname, '..');

const manifestPath = join(repoRoot, 'docs/PROJECT_KNOWLEDGE_MANIFEST.md');
if (!existsSync(manifestPath)) {
  console.error('FATAL: PROJECT_KNOWLEDGE_MANIFEST.md not found');
  process.exit(2);
}
const manifest = readFileSync(manifestPath, 'utf8');

let warnings = 0;
const warn = (msg) => {
  console.log(`::warning::${msg}`);
  warnings++;
};

// (1) docs/ 직속 .md 파일 vs manifest §1 Tier 1 의 "docs/ 직속" 표기
const docsDirect = readdirSync(join(repoRoot, 'docs'), { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.md'))
  .map((d) => d.name)
  .sort();

const tier1DocsMentioned = new Set();
// manifest 본문에서 백틱으로 감싼 *.md 만 추출 (docs/ 접두 없이)
for (const m of manifest.matchAll(/`([\w_.-]+\.md)`/g)) {
  tier1DocsMentioned.add(m[1]);
}

const missingFromManifest = docsDirect.filter((f) => !tier1DocsMentioned.has(f));
if (missingFromManifest.length > 0) {
  warn(
    `docs/ 직속 ${missingFromManifest.length} 파일이 manifest 에 미언급: ${missingFromManifest.join(', ')}`,
  );
}

// (2) docs/AI_CONTEXT/ 의 하위 폴더가 manifest 에 명시됐는지
const aiCtxDir = join(repoRoot, 'docs/AI_CONTEXT');
if (existsSync(aiCtxDir)) {
  const subdirs = readdirSync(aiCtxDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const sub of subdirs) {
    const token = `docs/AI_CONTEXT/${sub}/`;
    if (!manifest.includes(token)) {
      warn(
        `docs/AI_CONTEXT/${sub}/ 폴더가 manifest 분류에 없음 (Tier 1/2/3 또는 §2 제외 중 명시 필요)`,
      );
    }
  }
}

// (3) docs/ 의 새 1차 폴더가 manifest 분류에 있는지 (adr, references, proposals 등)
const docsSubdirs = readdirSync(join(repoRoot, 'docs'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => n !== 'AI_CONTEXT'); // AI_CONTEXT 는 (2) 에서 처리
for (const sub of docsSubdirs) {
  const token1 = `docs/${sub}/`;
  const token2 = `\`${sub}/\``;
  if (!manifest.includes(token1) && !manifest.includes(token2)) {
    warn(`docs/${sub}/ 폴더가 manifest 분류에 없음`);
  }
}

if (warnings === 0) {
  console.log('✅ manifest 정합 — drift 없음');
} else {
  console.log(`⚠ manifest drift ${warnings}건 — 위 warning 검토 후 manifest 갱신 권장`);
}
// 의도적으로 exit 0 — warning only, CI block 안 함.
// drift 가 누적되면 error 승급 (.github/workflows/sync-check.yml 에서 결정).
process.exit(0);
