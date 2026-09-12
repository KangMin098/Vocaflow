// scripts/textbook/lib/pg-catalog.mjs
//
// **Gutenberg 자체 카탈로그로 책 목록을 만든다 — gutendex 가 죽어도 수확이 선다.**
//
// ── 왜 (실측 2026-09-05) ─────────────────────────────────────────────
// 수확기는 책 목록을 `gutendex.com` 한 곳에서만 받았다. 그날 gutendex 가 응답을 멈췄고
// (60초 타임아웃 · 0바이트), **수확이 통째로 멈춰 서서 오래 매달려 있었다.** 그런데
// `gutenberg.org` 본체는 200 을 정상으로 돌려주고 있었다 — 받을 수 있는 책이 있는데
// *목록을 못 얻어서* 못 받은 것이다. 한 곳에 묶어 둘 이유가 없다.
//
// ── 이 경로가 오히려 나은 점 ─────────────────────────────────────────
// · 페이지네이션이 없다 — gutendex 페이징은 정렬 키가 없어 이 저장소에서 이미
//   **214건을 중복시키고 그만큼 누락**시킨 적이 있다(IA 수집에서 같은 함정).
// · `Subjects` 와 `Bookshelves` 를 통째로 준다 — 주제를 우리가 직접 고를 수 있다.
// · 한 번 받아 캐시하면 그 뒤로는 네트워크가 필요 없다.
//
// 캐시는 7일. 5.5MB(gz) 한 번 받아 `data/.cache/` 에 둔다(저장소에 안 들어간다).

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const URL = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz'
const CACHE_DIR = path.resolve('scripts/textbook/data/.cache')
const CACHE = path.join(CACHE_DIR, 'pg_catalog.csv')
const MAX_AGE_MS = 7 * 24 * 3600 * 1000

/**
 * 따옴표 안의 쉼표를 지키는 최소 CSV 파서.
 *
 * 이 파일 하나 때문에 의존성을 늘리지 않는다. 카탈로그는 RFC4180 을 지킨다 —
 * 큰따옴표로 감싸고, 안의 따옴표는 두 번 쓴다.
 */
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false
      } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

/**
 * 파일 전체를 **레코드 단위**로 자른다 — `split('\n')` 로 자르면 안 된다.
 *
 * ⚠️ 실측 2026-09-07: 이 카탈로그는 따옴표 안에 **개행이 들어 있다**(제목이 두 줄인 책 ·
 *   주제어가 여러 줄인 책). 줄 단위로 자르면 그런 레코드가 두 조각으로 쪼개져 열 위치가
 *   밀리고, `type !== 'Text'` 에 걸려 **조용히 사라진다.** 90,611줄 → 79,289레코드이고
 *   그 차이가 그대로 손실이었다: 영어 도서가 **52,608 로 보이던 것이 실제로는 61,606** 이다
 *   (`docs/reports/source-probe/pd-classics.md` 의 52,608 이 이 함정으로 나온 값이다).
 */
function splitRecords(raw) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '"') { inQ = !inQ; cur += c; continue }
    if (c === '\n' && !inQ) { out.push(cur.replace(/\r$/, '')); cur = ''; continue }
    cur += c
  }
  if (cur.trim()) out.push(cur)
  return out
}

async function ensureCatalog() {
  const fresh =
    fs.existsSync(CACHE) && Date.now() - fs.statSync(CACHE).mtimeMs < MAX_AGE_MS
  if (fresh) return CACHE
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const gz = `${CACHE}.gz`
  // ⚠️ node fetch 로는 gutenberg.org 에 못 붙는다 — 이 저장소가 세 번 겪었다. curl 을 쓴다.
  await run('curl', ['-sSL', '--max-time', '300', '--fail', '-o', gz, URL], { maxBuffer: 1024 })
  fs.writeFileSync(CACHE, zlib.gunzipSync(fs.readFileSync(gz)))
  fs.rmSync(gz, { force: true })
  return CACHE
}

/**
 * 주제어에 맞는 영어 책 목록을 낸다.
 *
 * `topics` 는 `Subjects` + `Bookshelves` 문자열에 대한 **부분 일치**다(대소문자 무시).
 * 하나라도 맞으면 담는다. `skip` 에 든 번호는 건너뛴다(커서).
 *
 * ⚠️ 정렬은 **주제 순서 → 책 번호 오름차순**으로 고정한다.
 *   주제 순서가 곧 우선순위다 — 호출자가 수율 높은 서가를 앞에 둔다(실측 2026-09-05:
 *   `Children's Instructional Books` 3.8편/권 vs 다른 서가 1.7~2.0). 처음엔 번호순만
 *   썼는데, 그러면 네 서가가 뒤섞여 **가장 좋은 서가 80권 중 15권만 쓰고** 나머지
 *   서가로 넘어갔다. 안에서는 번호순 — 목록이 실행마다 흔들리면 커서가 의미를 잃고,
 *   같은 책을 다시 받거나 통째로 건너뛴다.
 */
export async function catalogBooks({ topics, limit, skip = new Set() }) {
  const wanted = topics.map((t) => t.toLowerCase())
  const hits = []
  for (const r of await catalogRows()) {
    if (skip.has(r.id)) continue
    const hay = `${r.subjects} ${r.shelves}`.toLowerCase()
    const topic = wanted.find((t) => hay.includes(t))
    if (!topic) continue
    hits.push({ id: r.id, title: r.title, topic })
  }
  const rank = (h) => wanted.indexOf(h.topic)
  hits.sort((a, b) => rank(a) - rank(b) || a.id - b.id)
  return limit ? hits.slice(0, limit) : hits
}

/**
 * 영어 도서 전체를 **책 번호 오름차순**으로 낸다 — 주제 필터 없이.
 *
 * 왜 정렬을 여기서 못 박는가: 이 목록이 곧 증분 커서의 좌표계다. 순서가 실행마다
 * 흔들리면 "여기까지 봤다" 가 뜻을 잃고, 2026-08-16 IA 사고(정렬 없는 페이징으로
 * 214건 중복 + 동수 누락)가 그대로 재현된다. 책 번호는 발급 후 바뀌지 않는다.
 *
 * 한 번 읽어 메모리에 둔다(6만 행 · 프로세스 1회).
 */
let _rows = null
export async function catalogRows() {
  if (_rows) return _rows
  const file = await ensureCatalog()
  const records = splitRecords(fs.readFileSync(file, 'utf8'))
  const out = []
  for (let i = 1; i < records.length; i++) {
    if (!records[i]) continue
    const f = parseCsvLine(records[i])
    if (f.length < 9) continue
    const [id, type, issued, title, lang, authors, subjects, locc, shelves] = f
    if (type !== 'Text' || lang !== 'en') continue
    const n = Number(id)
    if (!n) continue
    out.push({ id: n, title, authors, issued, subjects, locc, shelves })
  }
  out.sort((a, b) => a.id - b.id)
  _rows = out
  return out
}

/**
 * **LoCC(미국 의회도서관 분류) 접두어로 고른다.**
 *
 * 주제 문자열(`Subjects`)로 고르면 「Psychological fiction」·「Schools -- Juvenile fiction」
 * 같은 소설이 대거 딸려 온다(2026-09-07 실측: 심리 겨냥 889권 중 상위가 전부 소설).
 * LoCC 는 사서가 매긴 분류라 그 혼동이 없다. 한 글자 접두어는 클래스(`H` = 사회과학),
 * 두 글자는 서브클래스(`BF` = 심리학)다.
 *
 * `excludeFiction` 이 켜져 있으면 주제어에 소설·시·희곡·아동물 표지가 있는 책을 뺀다 —
 * LoCC 가 `PE`(영어) 인데 주제가 「Juvenile fiction」인 교재 겸 독본이 실제로 있다.
 */
const FICTION_SUBJECT =
  /\bfiction\b|\bstories\b|\btales\b|\bpoetry\b|\bpoems\b|\bdrama\b|\bjuvenile\b|\bnovel\b|\bsatire\b/i

/**
 * **참고서 배제.** 사전·백과·색인·목록·연감은 문장이 아니라 표제어다.
 *
 * ⚠️ 실측 2026-09-07: LoCC `PE`(영어) 를 번호순으로 훑었더니 **첫 6권이 전부
 *   Webster 사전과 Roget 시소러스**였다(Gutenberg 초기 번호대에 몰려 있다).
 *   조각 3,500개에서 적합 54개(1.5%) — 받는 값보다 받는 비용이 크다.
 *   이 배제가 없으면 「번호 오름차순」이라는 안정된 좌표계가 곧 **최악부터 훑는 순서**가 된다.
 */
const REFERENCE_SUBJECT =
  /\bdictionar(?:y|ies)\b|\bencyclopedi|\bthesaur|\bglossar|\bbibliograph|\bindexes\b|\bcatalogs?\b|\bcatalogues?\b|\bconcordance|\bgazetteer|\bdirectories\b|\balmanac|\bstatistics\b/i
const REFERENCE_TITLE = /\bmidi\b|\bdictionary\b|\bthesaurus\b|\bconcordance\b|\bindex to\b/i

export function loccMatches(locc, prefixes) {
  const codes = String(locc ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  return codes.some((c) => prefixes.some((p) => (p.length === 1 ? c[0] === p : c.startsWith(p))))
}

export async function catalogByLocc({
  prefixes,
  skip = new Set(),
  excludeFiction = true,
  excludeReference = true,
  after = 0,
}) {
  const rows = await catalogRows()
  return rows.filter(
    (r) =>
      r.id > after &&
      !skip.has(r.id) &&
      loccMatches(r.locc, prefixes) &&
      (!excludeFiction || !FICTION_SUBJECT.test(r.subjects)) &&
      (!excludeReference || (!REFERENCE_SUBJECT.test(r.subjects) && !REFERENCE_TITLE.test(r.title))),
  )
}
