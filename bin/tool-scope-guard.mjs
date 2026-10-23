#!/usr/bin/env node
// bin/tool-scope-guard.mjs — Claude PreToolUse hook; refusal does not alter files.
import fs from 'node:fs'
import { checkToolScope } from '../lib/tool-scope.mjs'
try {
  const reason = checkToolScope(JSON.parse(fs.readFileSync(0, 'utf8')), JSON.parse(fs.readFileSync(process.argv[2], 'utf8')))
  if (reason) { process.stderr.write(`VFC_SCOPE_DENIED: ${reason}\n`); process.exitCode = 2 }
} catch { process.stderr.write('VFC_SCOPE_DENIED: invalid scope/input\n'); process.exitCode = 2 }
