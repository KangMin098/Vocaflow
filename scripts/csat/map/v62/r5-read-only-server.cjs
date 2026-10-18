// scripts/csat/map/v62/r5-read-only-server.cjs
// Permanent R5 test server: use the same guarded fetch layer as manual QA.
const path = require('node:path')
const { spawn } = require('node:child_process')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '../../../..')
const web = path.join(root, 'apps/web')
const req = createRequire(path.join(web, 'package.json'))
const child = spawn(process.execPath, ['--tls-max-v1.2', '--max-old-space-size=4096', '--require', path.join(__dirname, 'r5-read-only-preload.cjs'), req.resolve('next/dist/bin/next'), 'dev', '-p', process.env.R5_READ_ONLY_PORT || '3129'], { cwd: web, env: { ...process.env, DEV_ADMIN_BYPASS: '0', NEXT_DIST_DIR: '.next-r5-read-only' }, stdio: 'inherit', windowsHide: true })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (error) => { console.error(error.message); process.exit(1) })
