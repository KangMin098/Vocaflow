// scripts/textbook/production-revision-journal.mjs
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { hash } from './frym-benchmark/benchmark.mjs'
import { assertExternalCandidate } from './frym-benchmark/local-candidate-path.mjs'
import { beginSyntheticRevisionWorkflow, advanceSyntheticRevisionWorkflow,
  validateSyntheticRevisionWorkflow } from './production-revision-workflow.mjs'

const name = sequence => `revision-${String(sequence).padStart(6, '0')}.json`
const directory = input => {
  const root = path.resolve(input)
  assertExternalCandidate(root)
  if (fs.existsSync(root) && (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()))
    throw Error('REVISION_JOURNAL_DIRECTORY_INVALID')
  return root
}
const seal = body => ({ ...body, journal_hash: hash(body) })
const json = file => {
  if (fs.lstatSync(file).isSymbolicLink()) throw Error('REVISION_JOURNAL_LINK_FORBIDDEN')
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** Read only durable records; interrupted pending files never count as success. */
export function readRevisionJournal(input) {
  const root = directory(input)
  const files = fs.readdirSync(root)
  if (files.some(file => !/^revision-\d{6}\.json$/.test(file) &&
      !/^\.pending-[a-f0-9-]{36}$/.test(file) && file !== '.writer-lock'))
    throw Error('REVISION_JOURNAL_UNKNOWN_FILE')
  const records = files.filter(file => /^revision-\d{6}\.json$/.test(file)).sort()
  if (!records.length || records.length > 10000) throw Error('REVISION_JOURNAL_EMPTY_OR_LIMIT')
  let previous = null
  for (const [sequence, file] of records.entries()) {
    if (file !== name(sequence)) throw Error('REVISION_JOURNAL_GAP')
    const record = json(path.join(root, file))
    const { journal_hash: stored, ...body } = record
    if (Object.keys(body).sort().join(',') !==
        'event,inputs,non_production,previous_hash,run_id,schema,sequence,synthetic_fixture,workflow' ||
        record.schema !== 'textbook-revision-journal/1' || record.synthetic_fixture !== true ||
        record.non_production !== true || record.sequence !== sequence ||
        typeof record.run_id !== 'string' || !/^[a-f0-9-]{36}$/.test(record.run_id) ||
        stored !== hash(body) || record.previous_hash !== (previous?.journal_hash ?? null))
      throw Error('REVISION_JOURNAL_TAMPERED')
    validateSyntheticRevisionWorkflow(record.workflow)
    if (!previous) {
      if (record.event !== null || record.workflow.events.length !== 0)
        throw Error('REVISION_JOURNAL_BASE_INVALID')
      if (!record.inputs || Object.keys(record.inputs).sort().join(',') !== 'next,prior' ||
          hash(beginSyntheticRevisionWorkflow(record.inputs.prior, record.inputs.next, record.workflow.cause)) !==
            hash(record.workflow)) throw Error('REVISION_JOURNAL_BASE_INVALID')
    } else if (record.inputs !== null || record.run_id !== previous.run_id ||
        hash(advanceSyntheticRevisionWorkflow(previous.workflow, record.event)) !== hash(record.workflow) ||
        record.workflow.events.length !== previous.workflow.events.length + 1)
      throw Error('REVISION_JOURNAL_TRANSITION_INVALID')
    previous = record
  }
  return { record: previous, pending_files: files.filter(file => file.startsWith('.pending-')).length }
}

function locked(root, action) {
  const lockPath = path.join(root, '.writer-lock')
  const token = randomUUID()
  const pending = path.join(root, `.pending-${token}`)
  let fd
  let acquired = false
  try {
    fd = fs.openSync(pending, 'wx')
    fs.writeFileSync(fd, JSON.stringify({ token, pid: process.pid, host: os.hostname() }), 'utf8')
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fd = undefined
    try { fs.linkSync(pending, lockPath) } catch (error) {
      if (error.code === 'EEXIST') throw Error('REVISION_JOURNAL_WRITER_BUSY')
      throw error
    }
    acquired = true
    fs.unlinkSync(pending)
    return action()
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
    if (fs.existsSync(pending)) { try { fs.unlinkSync(pending) } catch { /* non-durable remainder */ } }
    if (acquired) {
      if (json(lockPath).token !== token) throw Error('REVISION_JOURNAL_LOCK_CHANGED')
      fs.unlinkSync(lockPath)
    }
  }
}

function append(root, record, io = fs) {
  const pending = path.join(root, `.pending-${randomUUID()}`)
  const target = path.join(root, name(record.sequence))
  let fd
  try {
    fd = io.openSync(pending, 'wx')
    io.writeFileSync(fd, JSON.stringify(record, null, 2) + '\n', 'utf8')
    io.fsyncSync(fd)
    io.closeSync(fd)
    fd = undefined
    // Hard-link creates the durable name atomically and refuses an existing record.
    io.linkSync(pending, target)
    io.unlinkSync(pending)
  } catch (error) {
    if (fd !== undefined) io.closeSync(fd)
    // A pending file is intentionally retained if cleanup is unavailable.
    if (io.existsSync(pending)) {
      try { io.unlinkSync(pending) } catch { /* read reports this non-durable remainder */ }
    }
    throw error
  }
}

export function startRevisionJournal(input, prior, next, cause = 'changed', io = fs) {
  const root = directory(input)
  const workflow = beginSyntheticRevisionWorkflow(prior, next, cause)
  if (!fs.existsSync(root)) fs.mkdirSync(root)
  return locked(root, () => {
    const existing = fs.readdirSync(root).filter(file => /^revision-\d{6}\.json$/.test(file))
    if (existing.length) {
      const current = readRevisionJournal(root)
      const base = json(path.join(root, name(0)))
      if (hash(base.workflow) !== hash(workflow)) throw Error('REVISION_JOURNAL_START_CONFLICT')
      return current
    }
    if (fs.readdirSync(root).some(file => file !== '.writer-lock' && !/^\.pending-[a-f0-9-]{36}$/.test(file)))
      throw Error('REVISION_JOURNAL_UNKNOWN_FILE')
    const body = { schema: 'textbook-revision-journal/1', synthetic_fixture: true,
      non_production: true, run_id: randomUUID(), sequence: 0, previous_hash: null,
      event: null, inputs: { prior, next }, workflow }
    append(root, seal(body), io)
    return readRevisionJournal(root)
  })
}

export function advanceRevisionJournal(input, event, io = fs) {
  const root = directory(input)
  return locked(root, () => {
    const current = readRevisionJournal(root)
    const workflow = advanceSyntheticRevisionWorkflow(current.record.workflow, event)
    if (workflow.workflow_hash === current.record.workflow.workflow_hash) return current
    if (current.record.sequence >= 9999) throw Error('REVISION_JOURNAL_LIMIT')
    const body = { schema: 'textbook-revision-journal/1', synthetic_fixture: true,
      non_production: true, run_id: current.record.run_id, sequence: current.record.sequence + 1,
      previous_hash: current.record.journal_hash, event, inputs: null, workflow }
    append(root, seal(body), io)
    return readRevisionJournal(root)
  })
}

/** Read-only recovery diagnosis. Lock quarantine requires stopped writers and one operator. */
export function recoverRevisionJournal(input, isAlive = pid => {
  try { process.kill(pid, 0); return true } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}) {
  const root = directory(input)
  const lockPath = path.join(root, '.writer-lock')
  const head = () => {
    try { return readRevisionJournal(root) } catch (error) {
      if (error.message !== 'REVISION_JOURNAL_EMPTY_OR_LIMIT' ||
          fs.readdirSync(root).some(file => /^revision-\d{6}\.json$/.test(file))) throw error
      return { record: null, pending_files: fs.readdirSync(root).filter(file => file.startsWith('.pending-')).length }
    }
  }
  if (fs.existsSync(lockPath)) {
    let owner
    try { owner = json(lockPath) } catch {
      throw Error('REVISION_JOURNAL_LOCK_UNREADABLE_MANUAL_QUARANTINE_REQUIRED')
    }
    if (owner.host !== os.hostname() || !Number.isInteger(owner.pid) || owner.pid <= 0 ||
        typeof owner.token !== 'string' || !/^[a-f0-9-]{36}$/.test(owner.token) || isAlive(owner.pid))
      throw Error('REVISION_JOURNAL_WRITER_NOT_RECOVERABLE')
    return { ...head(), recovery: { status: 'manual_quarantine_required',
      lock_token: owner.token, owner_pid: owner.pid } }
  }
  return { ...head(), recovery: { status: 'resume_ready' } }
}
