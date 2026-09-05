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
 * ⚠️ 정렬은 **책 번호 오름차순**으로 고정한다. 목록이 실행마다 흔들리면 커서가 의미를
 *   잃고, 같은 책을 다시 받거나 통째로 건너뛴다.
 */
export async function catalogBooks({ topics, limit, skip = new Set() }) {
  const file = await ensureCatalog()
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const wanted = topics.map((t) => t.toLowerCase())
  const hits = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const f = parseCsvLine(line)
    const [id, type, , title, lang, , subjects, , shelves] = f
    if (type !== 'Text' || lang !== 'en') continue
    const n = Number(id)
    if (!n || skip.has(n)) continue
    const hay = `${subjects} ${shelves}`.toLowerCase()
    const topic = wanted.find((t) => hay.includes(t))
    if (!topic) continue
    hits.push({ id: n, title, topic })
  }
  hits.sort((a, b) => a.id - b.id)
  return limit ? hits.slice(0, limit) : hits
}
