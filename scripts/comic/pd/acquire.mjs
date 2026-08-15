// scripts/comic/pd/acquire.mjs
//
// 소스 취득 CLI — 어떤 사이트에서 왔든 **하나의 정규화된 intake 디렉터리**로 떨어뜨린다.
//
//   node scripts/comic/pd/acquire.mjs --source internet-archive --id <identifier> --out intake/<slug>
//   node scripts/comic/pd/acquire.mjs --source local-dir --id ./downloads/adv-darkness-5 --out intake/<slug>
//   node scripts/comic/pd/acquire.mjs --source iiif --id <manifest-url> --out intake/<slug>
//   node scripts/comic/pd/acquire.mjs --source internet-archive --search "classics illustrated"
//
// 정규화 intake 구조 — 이후 단계(restore → segment → ocr → ingest)는 소스를 모른다:
//   intake/<slug>/
//     pages/0001.jpg …          원본 페이지 (소스 무관 동일 규칙)
//     ocr/source.hocr           소스가 OCR 을 주면 원본 그대로
//     source.manifest.json      출처·법적근거·파이프라인 프로파일·페이지 목록
//
// 이 "정규화 경계"가 설계의 핵심이다. 사이트가 늘어나도 어댑터 하나만 추가하면 되고,
// 복원·분할·적재 코드는 손대지 않는다.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { getAdapter, listAdapters } from './sources/index.mjs'

function parseArgs(argv) {
  const a = { width: 1600 }
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--source') a.source = argv[++i]
    else if (k === '--id') a.id = argv[++i]
    else if (k === '--out') a.out = argv[++i]
    else if (k === '--search') a.search = argv[++i]
    else if (k === '--limit') a.limit = Number(argv[++i])
    else if (k === '--width') a.width = Number(argv[++i])
    else if (k === '--pages') a.pages = Number(argv[++i])
    else if (k === '--list') a.list = true
  }
  return a
}

function usage() {
  console.log(`사용법:
  --list                                  어댑터 목록과 능력 표
  --source <id> --search "<질의>"          소스에서 후보 검색
  --source <id> --id <식별자> --out <dir>  호 하나 취득 → 정규화 intake

옵션: --width 1600  --pages <n>(앞 n장만)  --limit 20(검색 결과 수)`)
}

function printAdapters() {
  console.log('\n소스 어댑터 — 취득 방식이 사이트마다 다르다는 사실을 구조로 흡수한다\n')
  const rows = listAdapters().map((a) => ({
    id: a.id,
    label: a.label,
    발견: a.caps.discovery,
    인증: a.caps.auth,
    단위: a.caps.unit,
    대량: a.caps.bulk ? 'O' : 'X',
    OCR: a.caps.ocrBoxes ? '좌표O' : a.caps.ocr ? '텍스트' : 'X',
    간격: `${a.caps.minDelayMs}ms`,
    OCR전략: a.profile.ocrStrategy,
  }))
  console.table(rows)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.list) return printAdapters()
  if (!args.source) {
    usage()
    printAdapters()
    return
  }

  const ad = getAdapter(args.source)

  if (args.search) {
    const items = await ad.search(args.search, args.limit ?? 20)
    console.log(`\n${ad.label} — "${args.search}" 결과 ${items.length}건\n`)
    for (const it of items) {
      const hint = ad.pdHint(it)
      console.log(`  ${it.identifier}`)
      console.log(`    ${it.title}${it.publishedYear ? ` (${it.publishedYear})` : ''}${it.pageCount ? ` · ${it.pageCount}p` : ''}`)
      console.log(`    PD: ${hint.basis ?? '미확정'} — ${hint.note}`)
    }
    return
  }

  if (!args.id || !args.out) {
    usage()
    process.exit(1)
  }

  const item = await ad.metadata(args.id)
  const hint = ad.pdHint(item)
  const outDir = path.resolve(args.out)
  const pagesDir = path.join(outDir, 'pages')
  fs.mkdirSync(pagesDir, { recursive: true })

  console.log(`\n${ad.label} · ${item.title}`)
  console.log(`  식별자 ${item.identifier}${item.publishedYear ? ` · ${item.publishedYear}년` : ''}`)
  console.log(`  PD 근거: ${hint.basis ?? '미확정'} — ${hint.note}`)
  if (!hint.basis) {
    console.log('  ⚠️ PD 근거가 확정되지 않았습니다. 취득은 진행하되 **발행은 차단**됩니다.')
  }

  const refs = await ad.pages(args.id, { width: args.width })
  const take = args.pages ? refs.slice(0, args.pages) : refs
  console.log(`  페이지 ${take.length}/${refs.length}장 취득 시작 (동시 ${ad.caps.concurrency})\n`)

  // 소스가 선언한 동시성·간격을 지킨다 — 차단당하면 파이프라인 전체가 죽는다.
  const results = []
  const queue = [...take]
  const workers = Array.from({ length: Math.max(1, ad.caps.concurrency) }, async () => {
    while (queue.length) {
      const ref = queue.shift()
      const name = `${String(ref.index + 1).padStart(4, '0')}.${ref.ext ?? 'jpg'}`
      const dest = path.join(pagesDir, name)
      try {
        await ad.fetchPage(ref, dest)
        results.push({ index: ref.index, file: `pages/${name}`, bytes: fs.statSync(dest).size })
        process.stdout.write('.')
      } catch (e) {
        results.push({ index: ref.index, file: null, error: e.message })
        process.stdout.write('x')
      }
    }
  })
  await Promise.all(workers)
  console.log('')

  let ocrFile = null
  if (ad.caps.ocr) {
    const dest = path.join(outDir, 'ocr', 'source.hocr')
    try {
      ocrFile = (await ad.fetchOcr(args.id, dest)) ? 'ocr/source.hocr' : null
      if (ocrFile) console.log(`  OCR 원본 확보 (${Math.round(fs.statSync(dest).size / 1024)}KB) — 자체 OCR 불필요`)
      else console.log('  ⚠️ OCR: 소스가 제공한다고 선언했으나 받지 못함 → 자체 OCR 필요')
    } catch (e) {
      // 삼키면 "소스 미제공"과 구분이 안 돼 원인을 못 찾는다(실측에서 한 번 당함).
      console.log(`  ⚠️ OCR 취득 실패: ${e.message} → 자체 OCR 필요`)
      ocrFile = null
    }
  } else {
    console.log(`  OCR: 소스 미제공 → 전략 '${ad.profile.ocrStrategy}'`)
  }

  const ok = results.filter((r) => r.file).length
  const manifest = {
    source: {
      adapter: ad.id,
      label: ad.label,
      identifier: item.identifier,
      url: item.url,
      title: item.title,
      seriesTitle: item.seriesTitle ?? null,
      issueNo: item.issueNo ?? null,
      publishedYear: item.publishedYear ?? null,
    },
    legal: {
      pdBasis: hint.basis,
      note: hint.note,
      // 사람이 검증해 채워야 발행 가능 (DB 제약으로 강제)
      pdEvidenceUrl: item.raw?.pdEvidenceUrl ?? null,
      checkedAt: null,
      checkedBy: null,
    },
    pipelineProfile: ad.profile,
    capabilities: ad.caps,
    ocr: ocrFile,
    pages: results.sort((a, b) => a.index - b.index),
  }
  fs.writeFileSync(path.join(outDir, 'source.manifest.json'), JSON.stringify(manifest, null, 2))

  console.log(`\n취득 ${ok}/${take.length}장 → ${path.relative(process.cwd(), outDir)}`)
  console.log(`다음: node scripts/comic/pd/restore.mjs --in ${path.relative(process.cwd(), pagesDir)} --out <restored>`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\n${e.message}`)
    process.exit(1)
  })
}
