// scripts/textbook/frym-benchmark/local-draft.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { identifyLocalFile } from './local-admission.mjs'
import { draftLocalCandidates } from './local-draft.mjs'

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'frym-draft-'))
  const source = join(directory, 'synthetic.txt')
  writeFileSync(source, 'A synthetic textbook preview fixture.\n')
  const file = identifyLocalFile(source)
  const meta = { sourceHash: file.source_sha1, status: 'ok', pages: 1 }
  const pages = `${JSON.stringify({ p: 1, text: 'A passage and a question are mixed on this page.' })}\n`
  return { directory, source, file, meta, pages }
}

test('page extraction becomes a held local candidate with source binding', t => {
  const { directory, source, file, meta, pages } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const before = readFileSync(source)
  const result = draftLocalCandidates(source, meta, pages, { publisher: 'Fixture Press', grade: 'middle_1' })
  assert.equal(result.audit.candidates, 1)
  assert.equal(result.candidates[0].expected_file_hash, file.file_hash)
  assert.equal(result.candidates[0].metadata.publisher, 'Fixture Press')
  assert.equal(result.candidates[0].extraction.boundary_confirmed, false)
  assert.equal(result.candidates[0].extraction.question_boundary_confirmed, false)
  assert.equal(result.candidates[0].extraction.passage_text, undefined)
  assert.ok(result.candidates[0].review_material.page_text.includes('mixed'))
  assert.ok(!JSON.stringify(result.audit).includes(result.candidates[0].review_material.page_text))
  assert.deepEqual(readFileSync(source), before)
})

test('stale extractor source, chunk pages and duplicate page IDs fail closed', t => {
  const { directory, source, meta, pages } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  assert.throws(() => draftLocalCandidates(source, { ...meta, sourceHash: 'stale' }, pages), /EXTRACTION_SOURCE_CHANGED/)
  assert.throws(() => draftLocalCandidates(source, { ...meta, pageKind: 'chunk' }, pages), /EXTRACTION_NOT_PAGE_BOUND/)
  assert.throws(() => draftLocalCandidates(source, meta, pages + pages), /EXTRACTION_PAGES_INVALID/)
})

test('draft CLI writes raw review material only outside repository and never overwrites', t => {
  const { directory, source, meta, pages } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const metaPath = join(directory, 'meta.json'), pagesPath = join(directory, 'pages.jsonl'), hintsPath = join(directory, 'hints.json'), outputPath = join(directory, 'candidates.json')
  writeFileSync(metaPath, JSON.stringify(meta))
  writeFileSync(pagesPath, pages)
  writeFileSync(hintsPath, JSON.stringify({ publisher: 'Fixture Press' }))
  const args = ['scripts/textbook/frym-benchmark/local-draft-run.mjs', 'draft', source, metaPath, pagesPath, hintsPath, outputPath]
  const first = spawnSync(process.execPath, args, { encoding: 'utf8' })
  assert.equal(first.status, 0, first.stderr)
  assert.equal(JSON.parse(readFileSync(outputPath, 'utf8')).length, 1)
  assert.equal(spawnSync(process.execPath, args).status, 1)
})
