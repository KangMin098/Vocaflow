// scripts/comic/pd/pipeline.mjs
//
// PDCP 오케스트레이터 — 취득 → 복원 → 컷분할 → 대사추출을 한 줄로 돌린다.
//
//   node scripts/comic/pd/pipeline.mjs --doctor
//   node scripts/comic/pd/pipeline.mjs --source internet-archive --id <식별자> --dry-run
//   node scripts/comic/pd/pipeline.mjs --source internet-archive --id <식별자> --test
//   node scripts/comic/pd/pipeline.mjs --source internet-archive --id <식별자> --out work/<slug>
//
// ── 왜 테스트 모드가 필요한가 ────────────────────────────────────
// 한 호가 52페이지다. 파라미터 하나 잘못 잡고 전권을 돌리면 수십 분을 버리고,
// 잘못된 산출물이 검수 큐를 오염시킨다. 게다가 이 파이프라인은 **외부 사이트를 때린다** —
// 시행착오를 실제 트래픽으로 치르면 차단당한다.
//
//   --doctor   외부 도구(ffmpeg·tesseract.js)와 소스 접근성만 점검. 아무것도 안 만든다.
//   --dry-run  실행 계획만 출력. **네트워크·디스크 쓰기 0**. 어떤 파라미터로 몇 장을 칠지 보여준다.
//   --test     앞 N페이지(기본 6)만 임시 디렉터리에 돌리고 QC 요약을 낸다. 적재는 하지 않는다.
//
// 전권 실행은 --test 로 QC 를 확인한 뒤에만 하는 것을 전제로 한다.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { getAdapter, listAdapters } from './sources/index.mjs'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))

// 저장소 tools/ 자동 인식 — 앱 브리지(pipeline-bridge.ts resolveTools)와 동일 규칙.
// CLI 를 직접 돌릴 때도 env 수동 세팅 없이 ffmpeg·tesseract.js 가 잡히게 한다(앱↔CLI 일관).
// tools/ 는 .gitignore 대상(커밋 안 됨)이지만 있으면 설정 0으로 동작.
;(function resolveTools() {
  const root = path.resolve(HERE, '..', '..', '..')
  if (!process.env.FFMPEG_BIN) {
    const local = path.join(root, 'tools', 'ffmpeg', 'ffmpeg.exe')
    if (fs.existsSync(local)) process.env.FFMPEG_BIN = local
  }
  if (!process.env.TESSERACTJS_DIR) {
    const local = path.join(root, 'tools', 'tess')
    if (fs.existsSync(path.join(local, 'eng.traineddata'))) process.env.TESSERACTJS_DIR = local
  }
})()

function parseArgs(argv) {
  const a = { pages: null, testPages: 6 }
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--source') a.source = argv[++i]
    else if (k === '--id') a.id = argv[++i]
    else if (k === '--out') a.out = argv[++i]
    else if (k === '--pages') a.pages = Number(argv[++i])
    else if (k === '--test-pages') a.testPages = Number(argv[++i])
    else if (k === '--dry-run') a.dryRun = true
    else if (k === '--test') a.test = true
    else if (k === '--doctor') a.doctor = true
    else if (k === '--keep') a.keep = true
  }
  return a
}

// ── --doctor : 도구·소스 점검 ────────────────────────────────────

function checkFfmpeg() {
  const bin = process.env.FFMPEG_BIN || 'ffmpeg'
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8' })
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `없음 (${bin}) — FFMPEG_BIN 으로 경로 지정 필요` }
  }
  return { ok: true, detail: (r.stdout.split('\n')[0] || '').slice(0, 60) }
}

function checkTesseract() {
  const dir = process.env.TESSERACTJS_DIR
  if (!dir) return { ok: false, detail: 'TESSERACTJS_DIR 미설정 — 컷 직접 OCR 불가(hOCR 경로만 가능)' }
  const pkg = path.join(path.resolve(dir), 'node_modules', 'tesseract.js', 'package.json')
  if (!fs.existsSync(pkg)) return { ok: false, detail: `tesseract.js 없음: ${pkg}` }
  return { ok: true, detail: `v${JSON.parse(fs.readFileSync(pkg, 'utf8')).version}` }
}

async function checkSource(id) {
  try {
    const ad = getAdapter(id)
    if (ad.caps.discovery !== 'api') return { ok: null, detail: `자동 점검 불가 (${ad.caps.discovery})` }
    const items = await ad.search('test', 1)
    return { ok: true, detail: `검색 응답 OK (${items.length}건)` }
  } catch (e) {
    return { ok: false, detail: e.message.slice(0, 70) }
  }
}

async function doctor() {
  console.log('\nPDCP 환경 점검\n')
  const rows = []
  const ff = checkFfmpeg()
  rows.push({ 항목: 'ffmpeg (복원·분할)', 상태: ff.ok ? 'OK' : '없음', 비고: ff.detail })
  const ts = checkTesseract()
  rows.push({ 항목: 'tesseract.js (컷 OCR)', 상태: ts.ok ? 'OK' : '선택', 비고: ts.detail })
  for (const ad of listAdapters()) {
    const c = await checkSource(ad.id)
    rows.push({ 항목: `소스: ${ad.id}`, 상태: c.ok === true ? 'OK' : c.ok === null ? '수동' : '실패', 비고: c.detail })
  }
  console.table(rows)
  if (!ff.ok) {
    console.log('\n⚠️ ffmpeg 없이는 복원·컷분할이 불가합니다. 파이프라인을 돌릴 수 없습니다.')
    process.exitCode = 1
  }
}

// ── 단계 실행 ────────────────────────────────────────────────────

function run(script, args, { dryRun }) {
  const cmd = ['node', path.join(HERE, script), ...args]
  if (dryRun) {
    console.log(`   $ ${cmd.map((c) => (c.includes(' ') ? `"${c}"` : c)).join(' ')}`)
    return { skipped: true }
  }
  const r = spawnSync(process.execPath, cmd.slice(1), { encoding: 'utf8', stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`${script} 실패 (exit ${r.status})`)
  return { skipped: false }
}

function readJson(f) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return null
  }
}

/** 단계별 산출물을 읽어 한 장짜리 QC 요약을 만든다 — 전권 실행 여부의 판단 근거. */
function qcSummary(root) {
  const src = readJson(path.join(root, 'source.manifest.json'))
  const restore = readJson(path.join(root, 'restored', 'restore.manifest.json'))
  const panels = readJson(path.join(root, 'panels', 'panels.manifest.json'))
  const bubbles =
    readJson(path.join(root, 'bubbles.local.manifest.json')) ??
    readJson(path.join(root, 'bubbles.manifest.json'))

  const pages = restore?.pages?.length ?? 0
  const panelCount = panels?.panels?.length ?? 0
  const perPage = pages ? (panelCount / pages).toFixed(1) : '—'
  const b = bubbles?.stats

  console.log('\n── QC 요약 ─────────────────────────────────')
  console.log(`  출처       ${src?.source?.label ?? '—'} · ${src?.source?.identifier ?? '—'}`)
  console.log(`  PD 근거    ${src?.legal?.pdBasis ?? '**미확정 — 이 상태로는 발행 불가**'}`)
  console.log(`  복원       ${pages}장`)
  console.log(`  컷 분할    ${panelCount}컷 (페이지당 ${perPage})`)
  if (b) {
    const clean = (b.bubbles ?? 0) - (b.needsReview ?? 0)
    const pct = b.bubbles ? Math.round((clean / b.bubbles) * 100) : 0
    console.log(`  대사       ${b.bubbles}개 · 사용 가능 ${clean}개(${pct}%) · 검수 ${b.needsReview}개`)
    if (b.nonLatinBubbles != null) console.log(`  비라틴 오염 ${b.nonLatinBubbles}개`)
  } else {
    console.log('  대사       — (OCR 미실행)')
  }

  // 판정 — 사람이 "전권 돌려도 되나"를 즉시 알 수 있게
  const warn = []
  if (pages && panelCount / pages < 2) warn.push('페이지당 컷이 2 미만 — 컷 분할이 거의 안 됐을 수 있음')
  if (b && b.bubbles && (b.bubbles - b.needsReview) / b.bubbles < 0.2) warn.push('대사 사용가능률 20% 미만')
  if (!src?.legal?.pdBasis) warn.push('PD 근거 미확정 — 발행 게이트에서 차단됨')
  if (warn.length) {
    console.log('\n  ⚠️ 확인 필요')
    warn.forEach((w) => console.log(`     · ${w}`))
  } else {
    console.log('\n  ✅ 전권 실행해도 좋아 보입니다')
  }
  console.log('────────────────────────────────────────────')
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.doctor) return doctor()
  if (!args.source || !args.id) {
    console.log(`사용법:
  --doctor                                   환경 점검만
  --source <id> --id <식별자> --dry-run       실행 계획만 (네트워크·쓰기 0)
  --source <id> --id <식별자> --test          앞 ${args.testPages}장만 임시 실행 + QC 요약
  --source <id> --id <식별자> --out <dir>     전권 실행`)
    process.exit(args.doctor ? 0 : 1)
  }

  const ad = getAdapter(args.source)
  const slug = String(args.id).replace(/[^\w.-]+/g, '-').slice(0, 60).toLowerCase()
  const isTest = !!args.test
  const root = isTest
    ? fs.mkdtempSync(path.join(os.tmpdir(), `pdcp-test-${slug}-`))
    : path.resolve(args.out ?? `work/${slug}`)
  const pages = args.pages ?? (isTest ? args.testPages : null)
  const p = ad.profile

  console.log(`\nPDCP ${isTest ? '[테스트]' : args.dryRun ? '[계획]' : ''} ${ad.label} · ${args.id}`)
  console.log(`  작업 디렉터리 ${root}`)
  console.log(`  페이지        ${pages ?? '전체'}`)
  console.log(
    `  프로파일      crop=${p.needsCrop} sat=${p.saturation} scale=${p.upscale} ` +
      `analysis=${p.segmentAnalysis} dilate=${p.segmentDilate} ocr=${p.ocrStrategy}`,
  )
  if (args.dryRun) console.log('\n실행될 명령:')

  try {
    // ① 취득
    run('acquire.mjs', [
      '--source', args.source, '--id', String(args.id), '--out', root,
      ...(pages ? ['--pages', String(pages)] : []),
    ], args)

    // ② 복원 — 어댑터 프로파일을 그대로 인자로 넘긴다
    run('restore.mjs', [
      '--in', path.join(root, 'pages'), '--out', path.join(root, 'restored'),
      '--sat', String(p.saturation), '--scale', String(p.upscale),
      ...(p.denoise ? [] : ['--no-denoise']),
      ...(p.needsCrop ? [] : ['--no-crop']),
    ], args)

    // ③ 컷 분할
    run('segment.mjs', [
      '--in', path.join(root, 'restored'), '--out', path.join(root, 'panels'),
      '--analysis', String(p.segmentAnalysis), '--dilate', String(p.segmentDilate),
    ], args)

    // ④ 대사 — 소스가 선언한 전략에 따라 스크립트가 갈린다.
    //   dry-run 은 아직 아무것도 받지 않았으므로 **파일 존재가 아니라 어댑터 선언**으로 판단해야
    //   실제 실행과 같은 계획이 나온다(파일 검사로 했더니 hOCR 단계가 계획에서 누락됐다).
    const hasTesseract = checkTesseract().ok
    const willHaveHocr = args.dryRun
      ? ad.caps.ocr
      : fs.existsSync(path.join(root, 'ocr', 'source.hocr'))
    if (p.ocrStrategy === 'source-hocr' && willHaveHocr) {
      run('ocr.mjs', ['--intake', root], args)
    }
    if (hasTesseract) {
      run('ocr-local.mjs', ['--intake', root], args)
    } else if (p.ocrStrategy === 'own-ocr') {
      console.log('   ⚠️ own-ocr 전략인데 tesseract.js 가 없습니다 — 대사 추출을 건너뜁니다')
    }

    if (args.dryRun) {
      console.log('\n계획만 출력했습니다. 실제 실행은 --test 또는 --out 으로.')
      return
    }
    qcSummary(root)
  } finally {
    if (isTest && !args.keep) {
      console.log(`\n테스트 산출물은 임시 디렉터리에 있습니다(--keep 없으면 다음 부팅 시 정리):\n  ${root}`)
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\n${e.message}`)
    process.exit(1)
  })
}
