// scripts/comic/pd/assist.mjs
//
// 브라우저 보조 취득 세션 — 진짜 크롬 창을 띄우고, 사람이 받은 파일만 자동 정규화한다.
//
//   node scripts/comic/pd/assist.mjs --site dcm --slug whiz-002
//   node scripts/comic/pd/assist.mjs --url https://... --slug my-issue --timeout 900
//
// 흐름:
//   1) 영속 프로필로 크롬 실행 → 이미 로그인해뒀다면 다시 로그인하지 않는다
//   2) 사람이 로그인·검색·다운로드를 직접 수행
//   3) 다운로드 이벤트를 가로채 intake 폴더에 저장
//   4) 창을 닫으면 CBZ/CBR/ZIP/PDF/낱장을 풀어 `pages/` 로 정규화 + 매니페스트 작성
//
// **자동 클릭·자동 순회는 하지 않는다.** 이 파일에 페이지 셀렉터가 등장하면 그건
// 스크래퍼지 보조 도구가 아니다. 사이트가 거부한 자동 수집을 우회하는 셈이 된다.
//
// 압축 해제는 외부 도구 없이 처리한다: ZIP(=CBZ) 은 내장 구현, PDF 는 ffmpeg 이 못 하므로
// 페이지 이미지가 아니라 **원본 그대로 보관**하고 사람이 변환하도록 안내한다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import zlib from 'node:zlib'

import { ASSIST_SITES } from './sources/browser-assist.mjs'

// Windows 에서 `new URL(...).pathname` 은 `/D:/...` 를 주어 path 조작이 어긋난다 → fileURLToPath.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

function parseArgs(argv) {
  const a = { timeout: 900, width: 1400 }
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i]
    const v = argv[i + 1]
    if (k === '--site') (a.site = v), i++
    else if (k === '--url') (a.url = v), i++
    else if (k === '--slug') (a.slug = v), i++
    else if (k === '--out') (a.out = v), i++
    else if (k === '--timeout') (a.timeout = Number(v)), i++
    else if (k === '--title') (a.title = v), i++
    else if (k === '--year') (a.year = Number(v)), i++
    else if (k === '--list') a.list = true
  }
  return a
}

/** Playwright 는 apps/web devDependency 라 저장소 루트에서 해석한다. */
async function loadChromium() {
  try {
    const mod = await import('playwright-core')
    return mod.chromium
  } catch {
    // @playwright/test 가 번들한 playwright-core 로 폴백
    const req = (await import('node:module')).createRequire(
      pathToFileURL(path.join(REPO_ROOT, 'apps', 'web', 'package.json')).href,
    )
    const resolved = req.resolve('playwright-core')
    return (await import(pathToFileURL(resolved).href)).chromium
  }
}

// ─── ZIP(=CBZ) 최소 구현 ─────────────────────────────────────────────
// 왜 직접 푸는가: 이 환경에는 unzip 이 없고(Windows), Node 에 zip 리더가 없다.
// CBZ 는 거의 전부 **무압축(store) 또는 deflate** 이고 둘 다 zlib 로 처리된다.

function readZipEntries(buf) {
  // End of Central Directory 를 뒤에서 찾는다(주석이 있을 수 있어 최대 64KB 역탐색)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('ZIP 중앙 디렉터리를 찾지 못했습니다 (손상 또는 비ZIP)')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)

  const entries = []
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8')
    entries.push({ name, method, compSize, localOff })
    off += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function extractZipEntry(buf, e) {
  // 로컬 헤더는 중앙 디렉터리와 길이 필드가 다를 수 있어 여기서 다시 읽는다
  if (buf.readUInt32LE(e.localOff) !== 0x04034b50) throw new Error(`로컬 헤더 불일치: ${e.name}`)
  const nameLen = buf.readUInt16LE(e.localOff + 26)
  const extraLen = buf.readUInt16LE(e.localOff + 28)
  const start = e.localOff + 30 + nameLen + extraLen
  const raw = buf.subarray(start, start + e.compSize)
  if (e.method === 0) return raw
  if (e.method === 8) return zlib.inflateRawSync(raw)
  throw new Error(`지원하지 않는 압축 방식 ${e.method}: ${e.name}`)
}

const IMG_RE = /\.(jpe?g|png|jp2|webp|gif|bmp)$/i

/**
 * 받은 파일들을 `pages/` 로 편다.
 * CBZ/CBR/ZIP → 내부 이미지 추출, 낱장 이미지 → 그대로 복사, PDF → 보관만.
 */
function normalizeIncoming(incomingDir, pagesDir) {
  fs.mkdirSync(pagesDir, { recursive: true })
  const files = fs.readdirSync(incomingDir).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const notes = []
  let n = 0

  const put = (data, ext) => {
    const name = `${String(n).padStart(4, '0')}.${ext}`
    fs.writeFileSync(path.join(pagesDir, name), data)
    n++
  }

  for (const f of files) {
    const full = path.join(incomingDir, f)
    if (!fs.statSync(full).isFile()) continue

    if (/\.(cbz|zip)$/i.test(f)) {
      const buf = fs.readFileSync(full)
      let entries
      try {
        entries = readZipEntries(buf)
      } catch (e) {
        notes.push(`${f}: ${e.message}`)
        continue
      }
      const imgs = entries
        .filter((e) => IMG_RE.test(e.name) && !e.name.startsWith('__MACOSX'))
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
      for (const e of imgs) {
        try {
          put(extractZipEntry(buf, e), (e.name.match(IMG_RE)[1] || 'jpg').toLowerCase())
        } catch (err) {
          notes.push(`${f}!${e.name}: ${err.message}`)
        }
      }
      notes.push(`${f}: 이미지 ${imgs.length}장 추출`)
      continue
    }

    if (/\.cbr$/i.test(f)) {
      // RAR 은 내장 해제가 불가능하다. 조용히 건너뛰면 "0장 취득"으로 보이므로 명시한다.
      notes.push(`${f}: CBR(RAR) 은 자동 해제 불가 — CBZ 로 받거나 직접 풀어 pages/ 에 넣으세요`)
      continue
    }

    if (/\.pdf$/i.test(f)) {
      notes.push(`${f}: PDF 는 페이지 이미지가 아니라 원본으로 보관 — 별도 변환 필요`)
      continue
    }

    if (IMG_RE.test(f)) {
      put(fs.readFileSync(full), (f.match(IMG_RE)[1] || 'jpg').toLowerCase())
      continue
    }
    notes.push(`${f}: 인식하지 못한 형식 — 보관만`)
  }
  return { pageCount: n, notes }
}

async function main() {
  const args = parseArgs(process.argv)

  if (args.list || (!args.site && !args.url)) {
    console.log('\n브라우저 보조 취득 — 사람이 로그인·선택, 도구가 정리\n')
    console.table(
      ASSIST_SITES.map((s) => ({ key: s.key, 사이트: s.label, 이유: s.policy.slice(0, 60) })),
    )
    console.log('\n  node scripts/comic/pd/assist.mjs --site <key> --slug <작업명>')
    console.log('  node scripts/comic/pd/assist.mjs --url <주소> --slug <작업명>\n')
    return
  }

  const site = args.site ? ASSIST_SITES.find((s) => s.key === args.site) : null
  if (args.site && !site) throw new Error(`알 수 없는 사이트: ${args.site}`)
  const startUrl = args.url ?? site.url
  const slug = args.slug ?? (site ? `${site.key}-${Date.now()}` : 'assist')

  const root = path.resolve(args.out ?? path.join(REPO_ROOT, 'work', 'pdcp', slug))
  const incoming = path.join(root, 'incoming')
  const profile = path.join(REPO_ROOT, 'work', 'pdcp', '.browser-profile')
  fs.mkdirSync(incoming, { recursive: true })
  fs.mkdirSync(profile, { recursive: true })

  const chromium = await loadChromium()
  console.log(`\n브라우저를 엽니다 — ${site?.label ?? startUrl}`)
  if (site) console.log(`  정책: ${site.policy}`)
  console.log(`  받은 파일 저장 위치: ${incoming}`)
  console.log(`  로그인 세션은 ${profile} 에 남아 다음 회차에 재사용됩니다.`)
  console.log(`  다 받으셨으면 **창을 닫으세요** — 자동으로 정규화합니다 (최대 ${args.timeout}s)\n`)

  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    acceptDownloads: true,
    viewport: null,
    args: ['--start-maximized'],
  })

  let captured = 0
  ctx.on('page', (p) => {
    p.on('download', async (d) => {
      const name = d.suggestedFilename() || `download-${captured}`
      const dest = path.join(incoming, name)
      try {
        await d.saveAs(dest)
        captured++
        console.log(`  ↓ 받음 (${captured}) ${name}`)
      } catch (e) {
        console.log(`  ✗ 저장 실패 ${name}: ${e.message}`)
      }
    })
  })

  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto(startUrl, { waitUntil: 'domcontentloaded' }).catch((e) => {
    console.log(`  (초기 이동 실패: ${e.message} — 주소창에서 직접 이동하세요)`)
  })

  // 사람이 창을 닫을 때까지 대기. 타임아웃은 무한 점유 방지용.
  await new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        resolve()
      }
    }
    ctx.on('close', finish)
    setTimeout(() => {
      console.log('\n제한 시간에 도달했습니다 — 지금까지 받은 파일로 진행합니다.')
      finish()
    }, args.timeout * 1000)
  })
  await ctx.close().catch(() => {})

  console.log(`\n받은 파일 ${captured}개 — 정규화 중…`)
  const { pageCount, notes } = normalizeIncoming(incoming, path.join(root, 'pages'))
  for (const n of notes) console.log(`  · ${n}`)

  const manifest = {
    sourceId: 'browser-assist',
    site: site?.key ?? null,
    originUrl: startUrl,
    title: args.title ?? slug,
    publishedYear: args.year || null,
    capturedFiles: captured,
    pageCount,
    notes,
    // 사람이 직접 받았다는 사실 자체가 감사 기록이다 — PD 근거는 검수에서 사람이 입력한다
    acquisition: 'human-driven browser session',
    legal: { pdBasis: null, checkedBy: null, checkedAt: null, pdEvidenceUrl: null },
  }
  fs.writeFileSync(path.join(root, 'assist.manifest.json'), JSON.stringify(manifest, null, 2))
  fs.writeFileSync(path.join(root, 'source.manifest.json'), JSON.stringify(manifest, null, 2))

  console.log(`\n페이지 ${pageCount}장 → ${path.join(root, 'pages')}`)
  if (pageCount === 0) {
    console.log('  ⚠ 페이지가 0장입니다. CBR 이거나 다운로드가 없었을 수 있습니다(위 메모 확인).')
  } else {
    console.log(`\n다음: node scripts/comic/pd/restore.mjs --in ${path.join(root, 'pages')} --out ${path.join(root, 'restored')}`)
  }
}

// Windows 에서 `file:///D:/` 와 `file://D:/` 가 달라 직접 비교하면 절대 안 맞는다.
// argv[1] 은 `node -e` 로 import 될 때 없다 — 없으면 CLI 실행이 아니다(테스트 경로).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
}

export { normalizeIncoming, readZipEntries, extractZipEntry }
