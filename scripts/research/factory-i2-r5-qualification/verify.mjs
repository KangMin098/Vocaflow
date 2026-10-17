// scripts/research/factory-i2-r5-qualification/verify.mjs
//
// Factory I2 R5 첫 자료 자격 근거 재현기 — 읽기 전용(DB SELECT 만 · 쓰기 0). 원문을 출력하지 않는다(해시 · 일치 수만).
// 하는 일:
//   1. 주석 파일 sha256 · annotationHash(= claim-support.ts annotationHash: sha256(JSON.stringify(주석))) 계산
//   2. 구운 골격의 skeletonSig(sha256(JSON.stringify(문장 길이))) · 문장 수가 주석과 같은지
//   3. DB csat_items 의 B revision(sha256(stem|passage|choices|answer)) · passage sha256
//   4. 공식 문제지 PDF(사용자 로컬 · git 밖) sha256, 그 쪽 텍스트에 DB 지문이 연속으로 있는지 · 선택지 5개가 있는지
// 실행(apps/web 의 .env.local 을 프로세스에서만 읽는다):
//   node --tls-max-v1.2 scripts/research/factory-i2-r5-qualification/verify.mjs <itemId> <문제지.pdf> <쪽 번호> --answer-key <정답표.pdf> [--env <.env.local>]
// pdf 텍스트는 pdfjs-dist(메인 워크트리 node_modules)로 뽑는다. 기대값은 같은 폴더 evidence.json 과 비교한다.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { itemRevision, norm, orderedChoices } from './verify-content.mjs'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const args = process.argv.slice(2)
const [itemId, pdfFile, pageArg] = args
if (!itemId || !pdfFile || !pageArg || !args.includes('--answer-key')) {
  console.error('사용법: verify.mjs <itemId> <문제지.pdf> <쪽> --answer-key <정답표.pdf> [--env <.env.local>] [--modules <node_modules/.pnpm>]')
  process.exit(2)
}
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const envFile = opt('--env', path.join(ROOT, 'apps/web/.env.local'))
const pnpmDir = opt('--modules', path.join(ROOT, 'node_modules/.pnpm'))
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
const evFile = path.join(ROOT, 'docs/research/factory-i2-r5-qualification-20261017/evidence.json')
const expected = JSON.parse(fs.readFileSync(evFile, 'utf8')).items?.[itemId]
if (!expected) throw new Error(`${itemId}: no bound qualification evidence`)

const env = Object.fromEntries(
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).map((l) => /^([A-Z_]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, '')]),
)

// 1. 주석
const slug = itemId.toLowerCase().replace('#', '-')
const annFile = path.join(ROOT, `apps/web/src/lib/knowledge/annotations/claim-support-${slug}.v1.json`)
const annRaw = fs.readFileSync(annFile)
const ann = JSON.parse(annRaw)

// 2. 골격
const exam = JSON.parse(fs.readFileSync(path.join(ROOT, `apps/web/src/lib/csat/skeleton-data/${itemId.split('#')[0]}.json`), 'utf8'))
const sk = exam.items.find((i) => i.id === itemId)
const sig = sha(JSON.stringify(sk.sentences.map((s) => s.chars)))

// 3. DB
const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/csat_items?id=eq.${encodeURIComponent(itemId)}&select=stem,passage,choices,answer`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
})
if (!res.ok) throw new Error(`DB 조회 실패 ${res.status}`)
const [row] = await res.json()
if (!row) throw new Error(`${itemId}: 문항 없음`)
// PostgreSQL jsonb 표기와 같은 공식을 사용하고 격리 PostgreSQL oracle로 대조한다.
const passageSha = sha(Buffer.from(row.passage ?? '', 'utf8'))

// 4. 공식 문제지
const pdfBytes = fs.readFileSync(pdfFile)
const pdfjsDir = fs.readdirSync(pnpmDir).find((d) => d.startsWith('pdfjs-dist@'))
const pdfjs = await import(pathToFileURL(path.join(pnpmDir, pdfjsDir, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href)
const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true, verbosity: 0 }).promise
const page = await doc.getPage(Number(pageArg))
const text = (await page.getTextContent()).items.map((i) => i.str).join(' ')
const pageN = norm(text)
const words = (row.passage.toLowerCase().match(/[a-z]+/g) ?? [])
let windows = 0, found = 0
for (let i = 0; i + 8 <= words.length; i += 4) { windows++; if (pageN.includes(words.slice(i, i + 8).join(''))) found++ }
const choices = (Array.isArray(row.choices) ? row.choices : Object.values(row.choices ?? {})).map((c) => (typeof c === 'string' ? c : c.text ?? ''))
const ordered = orderedChoices(text, row.passage, choices)

const out = {
  itemId,
  annotation: { file: path.relative(ROOT, annFile).replaceAll('\\', '/'), fileSha256: sha(annRaw), annotationHash: sha(JSON.stringify(ann)), version: ann.version },
  skeleton: { sig, sentences: sk.sentences.length, matchesAnnotation: sig === ann.skeletonSig && sk.sentences.length === ann.sentenceCount },
  db: { passageSha256: passageSha, bRevision: itemRevision(row), answer: row.answer },
  officialPdf: {
    sha256: sha(pdfBytes), page: Number(pageArg), pages: doc.numPages,
    passageContiguous: pageN.includes(norm(row.passage)), windows8: windows, windows8Found: found,
    choices: choices.length, choicesFound: choices.filter((c) => c && pageN.includes(norm(c))).length,
    choicesInOrder: ordered.matched, choicesInOrderCount: ordered.matchedCount,
  },
}
// Independent answer-key check: correct paper form and exact item row, not a title/answer inferred from the question PDF.
if (args.includes('--answer-key')) {
  const keyBytes = fs.readFileSync(opt('--answer-key'))
  const keyDoc = await pdfjs.getDocument({ data: new Uint8Array(keyBytes), useSystemFonts: true, verbosity: 0 }).promise
  const no = itemId.split('#')[1], matches = []
  for (let p = 1; p <= keyDoc.numPages; p++) {
    const parts = (await (await keyDoc.getPage(p)).getTextContent()).items.map(i => i.str.trim()).filter(Boolean)
    if (!/짝\s*수/.test(parts.join(' '))) continue
    for (let i = 0; i < parts.length; i++) if (parts[i] === no) {
      const answer = '①②③④⑤'.indexOf(parts[i + 1]) + 1
      if (answer) matches.push({ page: p, answer })
    }
  }
  if (matches.length !== 1) throw new Error('Even-form answer-key row is missing or ambiguous')
  out.officialAnswerKey = { sha256: sha(keyBytes), form: '짝수', ...matches[0], matchesDb: matches[0].answer === row.answer }
}
console.log(JSON.stringify(out, null, 2))

const ev = expected
const bad = []
    if (ev.annotation.annotationHash !== out.annotation.annotationHash) bad.push('annotationHash')
    if (ev.annotation.fileSha256 !== out.annotation.fileSha256) bad.push('annotation fileSha256')
    if (ev.skeleton.sig !== out.skeleton.sig || !out.skeleton.matchesAnnotation) bad.push('skeleton')
    if (ev.source.passageSha256 !== out.db.passageSha256) bad.push('passageSha256')
    if (ev.artifact.bRevision !== out.db.bRevision) bad.push('bRevision')
    if (ev.source.officialPdf.sha256 !== out.officialPdf.sha256) bad.push('pdf sha256')
    if (!out.officialPdf.passageContiguous || !out.officialPdf.choicesInOrder) bad.push('pdf 대조(번호별 선지 포함)')
    if (ev.source.answer !== out.db.answer) bad.push('answer')
    if (out.officialAnswerKey && (ev.source.officialAnswerKey.sha256 !== out.officialAnswerKey.sha256 || !out.officialAnswerKey.matchesDb)) bad.push('official answer key')
    console.log(bad.length ? `불일치: ${bad.join(', ')}` : 'evidence.json 과 일치')
if (bad.length) process.exit(1)
