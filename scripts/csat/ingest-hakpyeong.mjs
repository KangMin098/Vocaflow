// scripts/csat/ingest-hakpyeong.mjs
//
// **교육청 전국연합학력평가(학평)를 코퍼스에 넣는다 — 보조·검증 집합.**
//
// 학평은 평가원 규칙 도출에 쓰지 않는다(블루프린트는 수능만). 모평처럼 **홀드아웃**이라
// 여기서 규칙이 깨지면 «평가원 설계의 일반 규칙이 아니라 수능 관행» 이라는 발견이다.
//
// ── 모평 수집기(`ingest-mock.mjs`)와 다른 점 ─────────────────────────
//   ① **pdftotext 를 못 쓴다.** 학평 PDF(EBSi 배포)는 한글 글꼴이 CID 라서 mingw pdftotext
//      (poppler-data 없음)가 한글 발문·선지·정답 기호(①~⑤)를 빈칸으로 낸다(실측 2026-09-27:
//      한 회차 한글 34~100자). pdfjs 는 cMap 을 들고 있어 같은 파일에서 한글이 온전히 나온다.
//      그래서 단 나누기도 pdftotext 레이아웃이 아니라 **pdfjs 좌표**로 한다.
//   ② 파일명이 믿을 만하다 — `YYYY학년도 M월 고G 전국연합학력평가 {문제지|정답 및 해설}.pdf`.
//      여기서 «학년도» 는 실제로 **시행연도**다(같은 폴더의 `2026학년도 6월 … 모의평가` 가
//      DB 의 M2706 = 2026년 6월 시행이다). 같은 폴더에 섞인 수능·모평 파일은 건너뛴다.
//   ③ 정답표는 해설지 첫머리의 `정 답 1 ④ 2 ⑤ …` 이고 **배점이 없다** — 배점은 문제지의
//      `[3점]` 표시에서 읽고, 검산은 «3점 10문항 · 합 100» 이다.
//
// ⚠️ **원문은 저장소에 올리지 않는다.** 해설지에 «EBSi 에서만 제공 · 무단 전재 및 재배포 금지»
//    가 찍혀 있다. `columns2/H*.txt` · `hakpyeong-*.json` 은 .gitignore 대상이다.
//
// 실행: node scripts/csat/ingest-hakpyeong.mjs [--from 2018] [--only H2503G1,...]
// 산출: data/hakpyeong-questions.json · data/hakpyeong-answers.json · data/hakpyeong-inventory.json
//       · columns2/H*.txt

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { classify, stemsOf, threePointSet, CIRC } from './lib-mock-parse.mjs'
import { parseExamId } from './lib-exam-id.mjs'

const args = process.argv.slice(2)
const argOf = (k) => {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : undefined
}
const FROM = Number(argOf('--from') ?? 2018)
const ONLY = argOf('--only') ? new Set(argOf('--only').split(',')) : null

const SRC_CANDIDATES = [process.env.CSAT_HAKPYEONG_DIR, 'C:/Users/Administrator/Documents/영어/학력평가'].filter(Boolean)
const SRC = SRC_CANDIDATES.find((d) => fs.existsSync(d))
if (!SRC) throw new Error(`학력평가 원본 폴더를 못 찾았다: ${SRC_CANDIDATES.join(' · ')}`)

const DIR = path.resolve('scripts/csat/data')
const COL = path.join(DIR, 'columns2')

// ── pdfjs ─────────────────────────────────────────────────────────────
const require = createRequire(import.meta.url)
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json')).split(path.sep).join('/')
const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')

async function openPdf(file) {
  const data = new Uint8Array(fs.readFileSync(path.join(SRC, file)))
  return getDocument({
    data,
    cMapUrl: `${pdfjsRoot}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${pdfjsRoot}/standard_fonts/`,
    wasmUrl: `${pdfjsRoot}/wasm/`,
    useSystemFonts: false,
    isEvalSupported: false,
    verbosity: 0,
  }).promise
}

/** 빈칸으로 볼 줄 안 틈(pt). 낱말 사이 띄어쓰기는 ~3pt, 빈칸 밑줄은 80pt 이상이었다 */
const BLANK_GAP = 40

/** 같은 줄로 볼 y 차이(pt). 본문 글자 크기 ~9pt 의 1/3 */
const LINE_TOL = 3

/** 한 단의 글 조각들 → 줄 목록(위에서 아래, 줄 안은 왼쪽에서 오른쪽) */
function linesOf(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  for (const it of sorted) {
    const cur = lines.at(-1)
    if (cur && Math.abs(cur.y - it.y) <= LINE_TOL) cur.items.push(it)
    else lines.push({ y: it.y, items: [it] })
  }
  const built = lines.map((l) => {
    const xs = l.items.sort((a, b) => a.x - b.x)
    const solid = xs.filter((i) => i.str.trim())
    let s = ''
    let end = null
    for (const it of xs) {
      // 공백만 든 조각은 너비를 믿을 수 없다 — 양쪽 맞춤 조판에서 60~119pt 로 나와(«words,» 끝 472 →
      // 공백 w60 → «decides» 479) 빈칸 틈을 가린다. 띄어쓰기만 남기고 틈 계산에서는 뺀다
      if (!it.str.trim()) {
        if (s && !s.endsWith(' ')) s += ' '
        continue
      }
      const gap = end == null ? 0 : it.x - end
      // **빈칸 복원.** 학평 빈칸은 밑줄이 글자가 아니라 그어진 선이라 텍스트층에 없다 — 그 자리는
      // 같은 줄 안의 큰 틈으로만 남는다(실측 80~150pt: «a(n) ▢ idea» · «that ▢ usually»).
      // 그대로 두면 빈칸·요약문 514문항 중 509문항의 지문에서 빈칸 위치가 사라졌다(2026-09-28).
      // 뒤 조각이 소문자·문장부호로 시작할 때만 빈칸으로 본다 — 표·안내문의 칸 사이 틈은 대문자로
      // 시작하고(«DIY Item ▢ Things»), 선지 사이 틈은 ①~⑤ 로 시작한다.
      if (gap >= BLANK_GAP && /^\s*[a-z.,;:!?)'’]/.test(it.str) && /[A-Za-z),'’]\s*$/.test(s)) {
        s = s.replace(/\s+$/, '') + ' ______ '
      } else if (end != null && gap > 1.5 && !s.endsWith(' ') && !it.str.startsWith(' ')) s += ' '
      s += it.str
      end = it.x + it.w
    }
    // NUL(U+0000)은 유니코드 대응이 없는 기호 글리프다(요약문 40번의 ↓ 화살표 등). Postgres 텍스트가
    // 받지 못해 적재가 `unsupported Unicode escape sequence` 로 통째로 멈춘다(2026-09-28 실측) — 지운다
    const text = s.replace(/\u0000/g, '').replace(/\s+$/, '')
    return { text, firstX: solid[0]?.x ?? null, lastEnd: end }
  })

  // **줄 머리·줄 끝의 빈칸.** 빈칸이 줄 경계에 걸리면 줄 안에 틈이 안 생긴다 — 대신 줄 머리가
  // 단 왼쪽 선보다 들어가 있거나, 줄 끝이 오른쪽 선에 못 미친다(양쪽 맞춤이라 이어지는 줄은
  // 오른쪽 선까지 찬다). 단의 선은 영어 본문 줄들의 10·90 백분위로 잡는다(들여쓰기·짧은 끝줄에 안 끌린다).
  const pct = (arr, p) => {
    const a = arr.filter((v) => v != null).sort((x, y) => x - y)
    return a.length ? a[Math.floor((a.length - 1) * p)] : null
  }
  const prose = built.filter((b) => /^[A-Za-z“"']/.test(b.text) && b.text.length > 30)
  const colLeft = pct(prose.map((b) => b.firstX), 0.1)
  const colRight = pct(prose.map((b) => b.lastEnd), 0.9)
  const CHOICE = /[①②③④⑤]/
  return built.map((b, i) => {
    let t = b.text
    if (colLeft == null || colRight == null || !t || CHOICE.test(t)) return t
    const next = built[i + 1]?.text ?? ''
    // 줄 머리 빈칸: 들여 시작하는데 소문자·문장부호로 시작한다(문단 첫 줄은 대문자로 시작한다)
    if (b.firstX - colLeft >= BLANK_GAP && /^[a-z.,;:)'’]/.test(t)) t = `______ ${t}`
    // 줄 끝 빈칸: 오른쪽 선에 못 미치고 문장 중간(소문자·쉼표)에서 끝나며, 다음 줄이 이어진다
    else if (colRight - b.lastEnd >= BLANK_GAP && /[a-z,]$/.test(t) && /^[a-z(“"']/.test(next) && !CHOICE.test(next)) t = `${t} ______`
    return t
  })
}

/**
 * 문제지 → 단이 풀린 텍스트. 학평 조판은 A4 두 단이다 — 쪽 가운데를 경계로 왼쪽 단 전부,
 * 그다음 오른쪽 단. 가운데를 가로지르는 제목 줄은 시작점이 왼쪽이라 왼쪽 단 머리에 붙는다.
 */
async function columnText(file) {
  const doc = await openPdf(file)
  const out = []
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p)
    const { width, height } = page.getViewport({ scale: 1 })
    const tc = await page.getTextContent()
    const items = tc.items
      .filter((i) => typeof i.str === 'string' && i.str.length)
      .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width ?? 0 }))
      // 쪽 머리말(«고 3 영어 영역»·구분선)과 꼬리말(쪽 번호)은 위·아래 띠에만 있다. 줄로 거르면
      // 늦다 — 본문 마지막 줄과 같은 높이면 한 줄로 합쳐져 선지 끝에 «8 영어 영역» 이 붙었다
      // (2026-09-28 실측 선지 567건). 좌표로 먼저 버린다. 경계: 105회차 중 15회차 표본에서
      // 본문은 쪽 높이의 0.096~0.849, 띠 안 글자는 쪽번호·«영어 영역»·«고 N»·구분선·1쪽 제목뿐이었다
      .filter((i) => i.y / height <= 0.86 && i.y / height >= 0.09)
    const mid = width / 2
    const left = items.filter((i) => i.x < mid)
    const right = items.filter((i) => i.x >= mid)
    out.push(...linesOf(left), '', ...linesOf(right), '')
  }
  await doc.cleanup?.()
  return out.join('\n')
}

/** 해설지 첫머리 정답표 `정 답 1 ④ 2 ⑤ …` → [{no, answers}] */
async function answerKey(file) {
  const doc = await openPdf(file)
  let flat = ''
  for (let p = 1; p <= Math.min(2, doc.numPages); p += 1) {
    const tc = await (await doc.getPage(p)).getTextContent()
    flat += ' ' + tc.items.map((i) => i.str).join(' ')
  }
  await doc.cleanup?.()
  // 표지 제목 «정답 및 해설» 에 걸리지 않게 **바로 뒤에 `1 ①` 이 오는** «정답» 을 찾는다
  // (2020·2022 회차는 제목이 표보다 앞에 있어 첫 «정답» 이 제목이었다 — 정답 0 으로 실측)
  // 2024년 이후 일부 회차는 «정답» 머리글이 없이 `1 ④ 2 ② …` 로 바로 시작한다 — 그때는
  // «1 ○ 2 ○» 로 이어지는 첫 자리를 표의 시작으로 본다(해설 본문 `1. [출제의도]` 와 안 겹친다)
  let at = flat.search(/정\s*답\s+1\s*[①②③④⑤]/)
  if (at < 0) at = flat.search(/(?<!\d)1\s*[①②③④⑤]\s+2\s*[①②③④⑤]/)
  if (at < 0) return []
  // 정답표는 해설 본문(`1. [출제의도]`)보다 앞에 있다 — 그 앞까지만 본다
  const tail = flat.slice(at)
  const stop = tail.search(/해\s*설\s|\[\s*출제의도\s*\]/)
  const zone = stop > 0 ? tail.slice(0, stop) : tail.slice(0, 600)
  const out = new Map()
  const re = /(?<!\d)(\d{1,2})\s*([①②③④⑤](?:\s*,\s*[①②③④⑤])*)/g
  let m
  while ((m = re.exec(zone))) {
    const no = +m[1]
    if (no < 1 || no > 45 || out.has(no)) continue
    const answers = [...m[2].matchAll(/[①②③④⑤]/g)].map((x) => CIRC[x[0]])
    out.set(no, { no, answer: answers[0], answers, multi: answers.length > 1 })
  }
  return [...out.values()].sort((a, b) => a.no - b.no)
}

/**
 * 눈으로 옮긴 정답(`hakpyeong-answers-manual.json`) — 정답표 글자층이 없거나 ①~⑤ 가 그림인
 * 9회차. `render-pdf-page.mjs` 로 그린 표를 두 배율로 두 번 읽어 대조했다(2026-09-28).
 * 파일이 없어도 돈다 — 그 회차는 정답 미상으로 남는다.
 */
const MANUAL_PATH = path.join(DIR, 'hakpyeong-answers-manual.json')
const MANUAL_KEYS = fs.existsSync(MANUAL_PATH) ? JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf8')).keys ?? {} : {}

// ── 회차 목록 — 파일명에서 ────────────────────────────────────────────
const RE_FILE = /^(\d{4})학년도 (\d{1,2})월 고([123]) 전국연합학력평가.*?(문제지|정답 및 해설)\.pdf$/
const exams = new Map()
const skipped = []
for (const f of fs.readdirSync(SRC).sort()) {
  const m = RE_FILE.exec(f)
  if (!m) {
    if (f.endsWith('.pdf')) skipped.push(f)
    continue
  }
  const [, yyyy, mon, grade, role] = m
  if (Number(yyyy) < FROM) continue
  const id = `H${yyyy.slice(2)}${mon.padStart(2, '0')}G${grade}`
  if (!parseExamId(id)) throw new Error(`id 문법 밖: ${id} ← ${f}`)
  if (ONLY && !ONLY.has(id)) continue
  const e = exams.get(id) ?? { id, paper: null, key: null }
  if (role === '문제지') e.paper = f
  else e.key = f
  exams.set(id, e)
}
const EXAMS = [...exams.values()].sort((a, b) => a.id.localeCompare(b.id))
if (!EXAMS.length) throw new Error(`${SRC} 에 ${FROM}년 이후 학평 PDF 가 없다`)
const onlyNon = skipped.filter((f) => !/대학수학능력시험/.test(f) && /전국연합/.test(f))
if (onlyNon.length) console.log(`  ⚠ 이름 규칙 밖 학평 파일 ${onlyNon.length}개: ${onlyNon.slice(0, 3).join(' · ')}`)

// ── 실행 ──────────────────────────────────────────────────────────────
fs.mkdirSync(COL, { recursive: true })
const questions = []
const answers = []
const report = []
for (const e of EXAMS) {
  if (!e.paper) {
    report.push({ exam: e.id, file: null, stems: 0, assigned: 0, multi: 0, none: 0, keys: 0, missing_paper: true })
    console.log(`  ${e.id} ⚠ 문제지 없음`)
    continue
  }
  const cols = await columnText(e.paper)
  fs.writeFileSync(path.join(COL, `${e.id}.txt`), cols)

  const stems = stemsOf(cols)
  const three = threePointSet(cols)
  let assigned = 0
  let multi = 0
  let none = 0
  for (const q of stems) {
    const hits = classify(q.stem)
    if (hits.length === 1) assigned += 1
    else if (hits.length > 1) multi += 1
    else none += 1
    questions.push({
      exam: e.id,
      no: q.no,
      stem: q.stem,
      high_score: q.high_score,
      rescued: q.rescued === true,
      section: q.no <= 17 ? '듣기' : q.no <= 40 ? '독해' : '장문',
      type: hits.length ? hits[0].id : null,
      hit_count: hits.length,
    })
  }

  let keyRows = []
  let pointSum = null
  let keySource = null
  if (e.key) {
    keyRows = await answerKey(e.key)
    keySource = 'pdf'
  }
  // 글자층에서 못 뽑은 회차만 눈으로 옮긴 정답으로 메운다 — 뽑힌 것은 절대 덮지 않는다
  if (keyRows.length !== 45 && MANUAL_KEYS[e.id]) {
    const digits = MANUAL_KEYS[e.id].replace(/\s+/g, '')
    if (!/^[1-5]{45}$/.test(digits)) throw new Error(`수기 정답 형식 오류: ${e.id}`)
    keyRows = [...digits].map((d, i) => ({ no: i + 1, answer: +d, answers: [+d], multi: false }))
    keySource = 'manual'
  }
  if (keyRows.length) {
    keyRows = keyRows.map((r) => ({ ...r, points: three.has(r.no) ? 3 : 2, key_source: keySource }))
    pointSum = keyRows.reduce((a, r) => a + r.points, 0)
    // 발문이 하나도 없는 회차의 정답은 붙을 문항이 없다 — 고아 정답을 원장에 남기지 않는다
    if (stems.length) for (const r of keyRows) answers.push({ exam: e.id, ...r })
  }
  const flags = []
  if (stems.length < 45) flags.push(`발문${stems.length}`)
  if (keyRows.length !== 45) flags.push(`정답${keyRows.length}`)
  if (three.size !== 10) flags.push(`3점${three.size}`)
  if (pointSum != null && pointSum !== 100) flags.push(`합${pointSum}`)
  report.push({ exam: e.id, file: e.paper, stems: stems.length, assigned, multi, none, keys: keyRows.length, three_point: three.size, point_sum: pointSum, flags })
  console.log(
    `  ${e.id} 발문 ${String(stems.length).padStart(2)}  배정 ${String(assigned).padStart(2)}  중복 ${multi}  미배정 ${none}  정답 ${keyRows.length}  3점 ${three.size}${flags.length ? '  ⚠ ' + flags.join(' ') : ''}`,
  )
}

fs.writeFileSync(path.join(DIR, 'hakpyeong-questions.json'), JSON.stringify({ report, rows: questions }, null, 1))
fs.writeFileSync(path.join(DIR, 'hakpyeong-answers.json'), JSON.stringify({ answers }, null, 1))
fs.writeFileSync(path.join(DIR, 'hakpyeong-inventory.json'), JSON.stringify({ src: SRC, from: FROM, exams: EXAMS }, null, 1))
/**
 * 알려진 예외 — 사유가 확인된 회차만. 여기에 없는 검산 실패는 **파서 퇴행**으로 보고 exit 1.
 * (PR #123 리뷰: 실패가 exit 0 으로 끝나면 다음 단계가 «104회차 정상» 을 조용히 받아들인다)
 */
const KNOWN_BAD = {
  H2004G3: '문제지 PDF 가 스캔 이미지(글자층 0) — OCR 없이는 발문·지문을 못 뜬다',
}
const bad = report.filter((r) => r.missing_paper || r.flags?.length)
const unexpected = bad.filter((r) => !KNOWN_BAD[r.exam])
console.log()
console.log(`  회차 ${EXAMS.length} · 문항 ${questions.length} · 정답 ${answers.length} · 검산 실패 회차 ${bad.length}(알려진 예외 ${bad.length - unexpected.length})`)
for (const r of bad) if (KNOWN_BAD[r.exam]) console.log(`  · ${r.exam} 제외 — ${KNOWN_BAD[r.exam]}`)
console.log('→ hakpyeong-questions.json · hakpyeong-answers.json · hakpyeong-inventory.json · columns2/H*.txt')
if (unexpected.length) {
  console.error(`\n  ✗ 예상 밖 검산 실패 ${unexpected.length}회차: ${unexpected.map((r) => `${r.exam}(${(r.flags ?? ['문제지 없음']).join(' ')})`).join(' · ')}`)
  process.exit(1)
}
