// scripts/csat/__tests__/lib-cli-fixture.mjs
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
/** An isolated copy of the unchanged CLI, so its script-relative private work stays in the fixture. */
export function cloneReviewCli(directory) {
  const source=fileURLToPath(new URL('../',import.meta.url))
  const target=path.join(directory,'scripts/csat')
  fs.mkdirSync(target,{recursive:true})
  for(const name of fs.readdirSync(source)) {
    if(name==='review-drain.mjs'||(/^lib-.*\.mjs$/.test(name)))fs.copyFileSync(path.join(source,name),path.join(target,name))
  }
  const modules=fileURLToPath(new URL('../../../node_modules/',import.meta.url))
  fs.symlinkSync(modules,path.join(directory,'node_modules'),process.platform==='win32'?'junction':'dir')
  return path.join(target,'review-drain.mjs')
}
export function removeCliFixture(directory) {
  const resolved=path.resolve(directory)
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'csat-'))
  // Remove the dependency junction itself before recursively deleting the verified temp fixture.
  fs.unlinkSync(path.join(resolved,'node_modules'))
  fs.rmSync(resolved,{recursive:true,force:true})
}
