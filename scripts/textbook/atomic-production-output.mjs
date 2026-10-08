// scripts/textbook/atomic-production-output.mjs
import fs from 'node:fs'

export function assertAtomicOutputAbsent(output, io = fs) {
  if (io.existsSync(output) || io.existsSync(`${output}.manifest.json`))
    throw Error('ATOMIC_DRY_RUN_OUTPUT_EXISTS')
}

export function writeAtomicDryRunOutput(output, html, manifest, io = fs) {
  const manifestPath = `${output}.manifest.json`
  let htmlFd = null
  let manifestFd = null
  let ownsHtml = false
  let ownsManifest = false
  try {
    htmlFd = io.openSync(output, 'wx')
    ownsHtml = true
    io.writeFileSync(htmlFd, html, 'utf8')
    io.closeSync(htmlFd)
    htmlFd = null
    manifestFd = io.openSync(manifestPath, 'wx')
    ownsManifest = true
    io.writeFileSync(manifestFd, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
    io.closeSync(manifestFd)
    manifestFd = null
  } catch {
    for (const fd of [htmlFd, manifestFd]) if (fd !== null) {
      try { io.closeSync(fd) } catch { /* continue cleanup */ }
    }
    const leftovers = []
    for (const owned of [ownsManifest ? manifestPath : null, ownsHtml ? output : null]) if (owned) {
      try { io.unlinkSync(owned) } catch { leftovers.push(owned) }
    }
    return { ok: false, leftovers }
  }
  return { ok: true, leftovers: [] }
}
