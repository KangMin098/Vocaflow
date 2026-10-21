// scripts/comic/pd/refine.test.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const script = fileURLToPath(new URL('./refine.mjs', import.meta.url))
for (const local of [false, true]) test(`refine consumes ${local ? 'preferred local OCR' : 'standard hOCR output'}`, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-refine-owned-'))
  try {
    const manifest = text => ({ stats: { bubbles: 1 }, panels: [{ pageOrder: 1, page: '0001', panelIndex: 1, bubbles: [{ text, kind: 'caption', confidence: 99 }] }] })
    fs.writeFileSync(path.join(dir, 'bubbles.manifest.json'), JSON.stringify(manifest('standard')))
    if (local) fs.writeFileSync(path.join(dir, 'bubbles.local.manifest.json'), JSON.stringify(manifest('local')))
    const intake = spawnSync(process.execPath, [script, '--intake', dir], { encoding: 'utf8', windowsHide: true })
    assert.equal(intake.status, 0, intake.stderr)
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'refine.intake.json'), 'utf8'))
    assert.equal(data.generatedFrom, local ? 'bubbles.local.manifest.json' : 'bubbles.manifest.json')
    assert.equal(data.panels[0].fragments[0].text, local ? 'local' : 'standard')
    fs.writeFileSync(path.join(dir, 'refine.output.json'), JSON.stringify({ modernized: true, panels: [{ id: 0, bubbles: [{ text: 'Original refined dialogue.', kind: 'speech' }] }] }))
    const ingest = spawnSync(process.execPath, [script, '--ingest', dir, '--modernize'], { encoding: 'utf8', windowsHide: true })
    assert.equal(ingest.status, 0, ingest.stderr)
    const refined = JSON.parse(fs.readFileSync(path.join(dir, 'bubbles.refined.manifest.json'), 'utf8'))
    assert.equal(refined.source, data.generatedFrom)
    assert.equal(refined.modernized, true)
    assert.equal(refined.panels[0].bubbles[0].text, 'Original refined dialogue.')
  } finally {
    // mkdtemp가 반환한 이 테스트 전용 절대 경로만 정리한다.
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
