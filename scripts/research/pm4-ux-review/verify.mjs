// scripts/research/pm4-ux-review/verify.mjs
// Read-only input integrity check. No browser, API or DB operations.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const base = path.join(root, 'docs/research/pm4-ux-review');
const readJson = async (name) => JSON.parse(await readFile(path.join(base, 'data', name), 'utf8'));
const manifest = await readJson('input-manifest.json');
let checked = 0;
for (const entry of [...manifest.code, ...manifest.evidence]) {
  const bytes = await readFile(path.join(root, entry.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.path);
  if (entry.width) {
    assert.equal(bytes.readUInt32BE(16), entry.width, entry.path);
    assert.equal(bytes.readUInt32BE(20), entry.height, entry.path);
  }
  checked++;
}
assert.equal(manifest.evidence.filter((x) => x.width).length, 20);
const results = await readJson('unit-results.json');
assert.equal(results.success, true);
assert.equal(results.numFailedTests, 0);
assert.equal(results.numPassedTests, 122);
assert.equal(results.testResults.every((x) => x.status === 'passed'), true);
const learner = JSON.parse(await readFile(path.join(root, 'docs/csat-learner/v62/evidence/pm4-learner-20261015/results.json'), 'utf8'));
const r5 = JSON.parse(await readFile(path.join(root, 'docs/csat-learner/v62/evidence/pm4-r5-20261015/results.json'), 'utf8'));
assert.equal(learner.head, manifest.browserEvidenceHead);
assert.equal(r5.head, manifest.browserEvidenceHead);
for (const name of ['PM4-UX-REVIEW.md', 'PM4-UX-FINDINGS.md', 'PM4-UX-VISUAL-AUDIT.md', 'PM4-UX-REGRESSION.md', 'PM4-CLAUDE-HANDOFF.md']) {
  assert.ok((await readFile(path.join(base, name), 'utf8')).length > 300);
}
console.log(JSON.stringify({ integrity: 'PASS', boundFiles: checked, existingScreenshots: 20, independentScreenshots: 0, independentTests: 122, acceptance: (await readJson('acceptance-ledger.json')).gates }, null, 2));
