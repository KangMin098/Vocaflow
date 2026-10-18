// scripts/ci/factory-i1-prerequisites.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ciTargetAllowed, prerequisiteSQL, sourceDirectory } from './factory-i1-prerequisites.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const env = { CI: 'true', GITHUB_ACTIONS: 'true' }
const local = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
test('CI canonical sources are read from the archive after migrations are moved', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-ci-source-test-'))
  const supabase = path.join(root, 'supabase')
  fs.mkdirSync(supabase)
  const migrations = path.join(supabase, 'migrations'), archive = path.join(supabase, '_all_migrations')
  fs.mkdirSync(migrations)
  try {
    assert.equal(sourceDirectory(root), migrations)
    fs.mkdirSync(archive)
    assert.equal(sourceDirectory(root), archive)
  } finally {
    if (fs.existsSync(archive)) fs.rmdirSync(archive)
    fs.rmdirSync(migrations); fs.rmdirSync(supabase); fs.rmdirSync(root)
  }
})
test('canonical prerequisite recovery only accepts disposable GitHub Actions Supabase', () => {
  assert.equal(ciTargetAllowed(local, env), true)
  assert.equal(ciTargetAllowed(local, {}), false)
  for (const bad of [local + '?host=remote', local + '#fragment', local.replace('54322', '5432'), local.replace('127.0.0.1', 'remote'),
    local.replace(/\/postgres$/, '/other'), local.replace('postgresql:', 'https:')]) assert.equal(ciTargetAllowed(bad, env), false)
})
test('prerequisite SQL uses canonical non-permissive bodies and creates no tables/history', () => {
  assert.ok(prerequisiteSQL.includes("e.policy_version = 4"))
  assert.ok(prerequisiteSQL.includes("WHERE user_id = auth.uid() AND role = 'admin'"))
  assert.ok(!/create\s+table|insert\s+into|schema_migrations|select\s+true/i.test(prerequisiteSQL))
})
