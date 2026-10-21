// verification/reviews/PR326-final-independent/inspect.mjs
// Inspect official CI artifacts and bind exact PR scope; does not apply DB changes or merge.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
const root = 'D:/workspace/Vocaflow-AI-Control', dir = path.join(root, 'verification/reviews/PR326-final-independent')
const wt = 'D:/workspace/Vocaflow-final-product'
const head = 'f9d66f487072b56a64d76ebe70fb668920a8576e', base = '8905f321440abeaac6f7cdb74b8e38b50fa5ced8'
const cli = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const write = (name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2) + '\n')
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const reportDir = path.join(dir, 'artifact/apps/web/playwright-report-isolated')
const html = fs.readFileSync(path.join(reportDir, 'index.html'), 'utf8')
const zip = Buffer.from(html.match(/data:application\/zip;base64,([A-Za-z0-9+/=\s]+)/)[1], 'base64')
const json = []
for (let p = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); p >= 0 && zip.readUInt32LE(p) === 0x02014b50;) {
  const method = zip.readUInt16LE(p + 10), size = zip.readUInt32LE(p + 20), n = zip.readUInt16LE(p + 28), e = zip.readUInt16LE(p + 30), c = zip.readUInt16LE(p + 32), at = zip.readUInt32LE(p + 42)
  const name = zip.subarray(p + 46, p + 46 + n).toString()
  if (name.endsWith('.json')) {
    const start = at + 30 + zip.readUInt16LE(at + 26) + zip.readUInt16LE(at + 28), data = zip.subarray(start, start + size)
    json.push({ name, data: JSON.parse((method === 8 ? inflateRawSync(data) : data).toString()) })
  }
  p += 46 + n + e + c
}
const images = new Map()
for (const task of ['T-0070', 'T-0071']) for (const name of fs.readdirSync(path.join(root, 'verification/ui', task)).filter(x => /^ci-39530426670-.*\.png$/.test(x))) {
  const p = path.join('verification/ui', task, name).replaceAll('\\', '/')
  const hash = sha(path.join(root, p))
  images.set(hash, [...(images.get(hash) ?? []), p])
}
const out = []
function walk(x, title = '') {
  if (!x || typeof x !== 'object') return
  const name = x.title ?? title
  if (Array.isArray(x.attachments)) for (const a of x.attachments) {
    if (a.contentType !== 'image/png') continue
    const p = path.join(reportDir, a.path ?? '')
    if (!fs.existsSync(p)) throw Error('Missing official attachment')
    const bytes = fs.readFileSync(p), hash = sha(p)
    out.push({ test: name, attachment: a.name, artifact: path.relative(root, p).replaceAll('\\', '/'), captures: images.get(hash) ?? [], sha256: hash, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) })
  }
  for (const v of Object.values(x)) walk(v, name)
}
for (const entry of json) walk(entry.data)
const unique = [...new Map(out.map(x => [x.sha256, x])).values()]
const attachments = [...new Map(out.map(x => [x.test + '|' + x.attachment, x])).values()]
function pngs(folder) { return fs.readdirSync(folder, { withFileTypes: true }).flatMap(x => x.isDirectory() ? pngs(path.join(folder, x.name)) : x.name.endsWith('.png') ? [path.join(folder, x.name)] : []) }
const official = new Map(pngs(path.join(dir, 'artifact')).map(p => [sha(p), path.relative(root, p).replaceAll('\\', '/')]))
if (images.size !== 59 || official.size !== 59 || [...images.keys()].some(h => !official.has(h)) || unique.some(x => !['T-0070', 'T-0071'].every(t => x.captures.some(p => p.includes('/' + t + '/'))))) throw Error('Official/copy attachment mismatch')
write('image-integrity.json', { official_png: official.size, named_html_attachments: attachments.length, copies: [...images].map(([hash, copies]) => ({ sha256: hash, official: official.get(hash), copies })), all_copies_match: true })
write('capture-map.json', unique)
const report = json.find(x => x.name === 'report.json')?.data
write('report-summary.json', { stats: report?.stats, selected: unique.filter(x => /goalplan-|notes-reentry-|note-revised/.test(x.attachment)), official_unique_png: official.size, named_html_attachments: attachments.length, both_task_copies_match: true })
const run = JSON.parse(cli('run', 'view', '39530426670', '--repo', 'KangMin098/Vocaflow', '--json', 'headSha,event,conclusion,status,attempt,jobs'))
if (run.headSha !== head || run.event !== 'pull_request' || run.attempt !== 1 || run.conclusion !== 'success') throw Error('Wrong/nonpassing CI')
const job = run.jobs.find(j => j.name === 'e2e')
const log = cli('run', 'view', '39530426670', '--repo', 'KangMin098/Vocaflow', '--job', String(job.databaseId), '--log')
write('ci-inspection.json', { head, run: '39530426670', attempt: run.attempt, event: run.event, conclusion: run.conclusion, jobs: run.jobs.map(x => ({ name: x.name, result: x.conclusion })), selected_log: log.split(/\r?\n/).filter(x => /goal-plan-summary\.isolated|map-return-recap\.isolated|31 passed|31 tests/.test(x)) })
const meta = () => JSON.parse(cli('api', 'repos/KangMin098/Vocaflow/pulls/326'))
const a = meta(), files = JSON.parse(cli('api', '--paginate', '--slurp', 'repos/KangMin098/Vocaflow/pulls/326/files?per_page=100')).flat(), b = meta()
const local = execFileSync('git', ['diff', '--name-only', base, head], { cwd: wt, encoding: 'utf8' }).trim().split('\n').sort(), remote = files.map(x => x.filename).sort()
if (a.head.sha !== head || b.head.sha !== head || a.base.sha !== base || b.base.sha !== base || a.changed_files !== files.length || b.changed_files !== files.length || b.commits !== 4 || JSON.stringify(local) !== JSON.stringify(remote)) throw Error('Scope mismatch or HEAD/base moved')
write('pr326-scope.json', { version: 1, head_sha: head, base_ref: 'main', base_sha: base, expected_commits: 4, expected_paths: remote })
write('scope-receipt.json', { head, base, files: files.length, commits: 4, full_pagination: true, double_metadata_stable: true, local_remote_equal: true })
console.log(JSON.stringify({ stats: report?.stats, relevant: unique.filter(x => /goalplan-|notes-reentry-|note-revised/.test(x.attachment)), unique_captures: unique.length, scope_files: files.length, ci_summary: log.split(/\r?\n/).filter(x => /31 passed|goal-plan-summary\.isolated|map-return-recap\.isolated/.test(x)) }, null, 2))
