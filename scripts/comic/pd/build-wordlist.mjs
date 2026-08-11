// scripts/comic/pd/build-wordlist.mjs
//
// OCR 판정기용 영어 사전 생성 — shared_dictionary(word + inflected_forms) → 평문 목록.
//
//   node scripts/comic/pd/build-wordlist.mjs [--out tools/en-wordlist.txt]
//
// 왜 저장소에 커밋하지 않나: 사전의 SSoT 는 DB 다. 스냅샷을 커밋하면 곧 어긋난다.
// `tools/` 는 .gitignore 대상이고, 없으면 판정기가 사전 규칙만 건너뛰고 정상 동작한다.
//
// ⚠️ 이 사전을 쓰는 규칙(--lexicon)은 **기본 비활성**이다. 방언·고유명사를 오탐한다 —
//    근거는 ocr.mjs 의 NONWORD_RATIO_MAX 주석에 실측과 함께 적어뒀다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }

function env(key) {
  const f = path.join(REPO, 'apps', 'web', '.env.local')
  const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m ? m[1].trim() : null
}

async function main() {
  const out = path.resolve(REPO, arg('out', 'tools/en-wordlist.txt'))
  const base = env('NEXT_PUBLIC_SUPABASE_URL')
  const svc = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!base || !svc) throw new Error('apps/web/.env.local 에 SUPABASE URL/SERVICE_ROLE_KEY 가 필요합니다')
  const H = { apikey: svc, Authorization: `Bearer ${svc}` }

  const words = new Set()
  // PostgREST 는 서버측 db-max-rows(1000)로 자른다 — Range 로 못 늘리므로 페이징한다.
  for (let off = 0; ; off += 1000) {
    const r = await fetch(
      `${base}/rest/v1/shared_dictionary?select=word,inflected_forms&order=word&limit=1000&offset=${off}`,
      { headers: H },
    )
    if (!r.ok) throw new Error(`사전 조회 실패 ${r.status}`)
    const rows = await r.json()
    for (const row of rows) {
      if (row.word) words.add(String(row.word).toLowerCase())
      const inf = row.inflected_forms
      if (Array.isArray(inf)) {
        for (const x of inf) if (typeof x === 'string') words.add(x.toLowerCase())
      } else if (inf && typeof inf === 'object') {
        for (const v of Object.values(inf)) {
          if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') words.add(x.toLowerCase())
        }
      }
    }
    if (rows.length < 1000) break
  }

  const list = [...words].filter((w) => /^[a-z'-]+$/.test(w)).sort()
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, list.join('\n'))
  console.log(`단어 ${list.length} → ${path.relative(REPO, out)} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)}MB)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1 })
}
