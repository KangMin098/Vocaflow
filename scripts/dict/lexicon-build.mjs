// scripts/dict/lexicon-build.mjs
// 청정 lexicon_clean 구축 — WordNet 정의 + Webster 1913(정제) → 통합 gloss 맵 → DB 적재 + CMUdict ipa + Tier1 재사용.
//   목적: kaikki(CC BY-SA) 대체. 설계: docs/proposals/lexicon-coverage-clean-architecture.md
//   런타임 DB 조회 전용(LLM 오프라인). meaning_ko 는 Tier1(검증 재사용)만 채우고 나머지는 LLM 사전작업.
//
// 입력(gitignore, scripts/dict/data/):
//   wordnet/data.{noun,verb,adj,adv}   Princeton WordNet 3.1 WNDB (퍼미시브)
//   webster/webster.json               Webster 1913 (PD) {word: definition}
//   cmudict/cmudict-enrich.json        cmudict-enrich.mjs extract 산출 {word:{ipa}}
//
// 실행:
//   node scripts/dict/lexicon-build.mjs gloss        # 통합 청정 gloss 맵 생성 → data/lexicon/clean-gloss.json
//   node scripts/dict/lexicon-build.mjs load [--commit]      # lexicon_clean 적재(gloss+ipa)
//   node scripts/dict/lexicon-build.mjs reuse-tier1 [--commit] # coverage_lexicon Tier1 한국어 재귀속

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '../..')
const envPath = path.join(ROOT, 'apps/web/.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }

const D = path.join(ROOT, 'scripts/dict/data')
const WNDB = path.join(D, 'wordnet')
const WEB = path.join(D, 'webster/webster.json')
const CMU = path.join(D, 'cmudict/cmudict-enrich.json')
const OUT = path.join(D, 'lexicon'); fs.mkdirSync(OUT, { recursive: true })
const MAP = path.join(OUT, 'clean-gloss.json')
const MODE = process.argv[2] || ''
const COMMIT = process.argv.includes('--commit')

const STOP = new Set(['the', 'act', 'and', 'that', 'which', 'with', 'for', 'any', 'such', 'one', 'from', 'who', 'use', 'used', 'having', 'being'])
const toks = (s) => new Set((s || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)))
const agree = (k, c) => { const a = toks(k), b = toks(c); if (!a.size) return 0; let n = 0; for (const t of a) if (b.has(t)) n++; return n / a.size }

// Webster 정제: 첫 sense·번호/인용/상호참조/어원 노이즈 제거·길이제한
function cleanWebster(def) {
  if (!def) return null
  let s = def.replace(/\r?\n/g, ' ').trim().replace(/^\d+\.\s*/, '')
  s = s.split(/\s+\d+\.\s+/)[0].replace(/\b[A-Z][A-Z' ]{3,}\b.*$/, '')
  s = s.replace(/Etym:.*$/i, '').replace(/\[.*?\]/g, ' ').replace(/\s+[A-Z][a-z]+\.\s*$/, '').replace(/\s{2,}/g, ' ').trim()
  return s.length < 4 ? null : s.slice(0, 300)
}

async function buildGloss() {
  // WordNet 정의(leaf gloss, 예문 제외)
  const wn = {}
  for (const f of ['data.noun', 'data.verb', 'data.adj', 'data.adv']) {
    const p = path.join(WNDB, f); if (!fs.existsSync(p)) { console.error('✗ WNDB 없음:', p); process.exit(1) }
    const rl = readline.createInterface({ input: fs.createReadStream(p), crlfDelay: Infinity })
    for await (const line of rl) {
      if (!line || line.startsWith('  ')) continue
      const bar = line.indexOf(' | '); if (bar < 0) continue
      const head = line.slice(0, bar).split(/\s+/); const g = line.slice(bar + 3).replace(/;\s*".*$/, '').trim()
      const wc = parseInt(head[3], 16)
      for (let k = 0, i = 4; k < wc; k++, i += 2) { const w = head[i].toLowerCase().replace(/_/g, ' '); if (!(w in wn)) wn[w] = g }
    }
    rl.close()
  }
  const webRaw = JSON.parse(fs.readFileSync(WEB, 'utf8'))
  const merged = {}; let nw = 0, nb = 0
  for (const w in wn) { merged[w] = { g: wn[w], src: 'wordnet' }; nw++ }
  for (const k in webRaw) { const w = k.toLowerCase(); if (merged[w]) continue; const c = cleanWebster(webRaw[k]); if (c) { merged[w] = { g: c, src: 'webster' }; nb++ } }
  fs.writeFileSync(MAP, JSON.stringify(merged))
  console.log(`통합 청정 gloss: ${Object.keys(merged).length} (WordNet ${nw} + Webster ${nb})`)
}

// REST 배치 upsert
async function upsert(rows, B = 500, CONC = 4) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  const H = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const post = async (b, n = 6) => { let last; for (let i = 0; i < n; i++) { try { const r = await fetch(url + '/rest/v1/lexicon_clean?on_conflict=word', { method: 'POST', headers: H, body: JSON.stringify(b) }); if (r.ok) return true; last = r.status } catch (e) { last = e.message } await sleep(500 * (i + 1)) } console.error('배치실패', last); return false }
  let done = 0
  for (let i = 0; i < rows.length; i += B * CONC) {
    const g = []; for (let j = 0; j < CONC; j++) { const s = rows.slice(i + j * B, i + j * B + B); if (s.length) g.push(post(s)) }
    const res = await Promise.all(g); done += g.filter((_, k) => res[k]).length * B
    if (i % (B * CONC * 10) < B * CONC) console.log('  적재', Math.min(done, rows.length), '/', rows.length)
  }
  return done
}

async function load() {
  const gloss = JSON.parse(fs.readFileSync(MAP, 'utf8'))
  const cmu = fs.existsSync(CMU) ? JSON.parse(fs.readFileSync(CMU, 'utf8')) : {}
  const rows = Object.keys(gloss).map((w) => ({ word: w, gloss_en: gloss[w].g, gloss_source: gloss[w].src, ipa: cmu[w] ? cmu[w].ipa : null, is_valid_word: true }))
  console.log(`적재 대상: ${rows.length}${COMMIT ? '' : ' (dry-run: --commit 없음)'}`)
  if (COMMIT) console.log('완료. upsert', await upsert(rows))
}

async function reuseTier1() {
  const gloss = JSON.parse(fs.readFileSync(MAP, 'utf8'))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  const Hget = { apikey: svc, Authorization: 'Bearer ' + svc }
  const reuse = []; let cur = '', scanned = 0
  for (;;) {
    const r = await fetch(url + '/rest/v1/coverage_lexicon?select=word,gloss_en,meaning_ko&meaning_ko=not.is.null&word=gt.' + encodeURIComponent(cur) + '&order=word&limit=1000', { headers: Hget })
    let rows; try { rows = await r.json() } catch (e) { break }
    if (!Array.isArray(rows) || !rows.length) break
    for (const o of rows) { scanned++; const cg = gloss[o.word]; if (cg && agree(o.gloss_en, cg.g) >= 0.5) reuse.push({ word: o.word, meaning_ko: o.meaning_ko, ko_source: 'verified-' + cg.src }) }
    cur = rows[rows.length - 1].word
  }
  console.log(`Tier1 재사용 대상: ${reuse.length} (스캔 ${scanned})${COMMIT ? '' : ' (dry-run)'}`)
  if (COMMIT) console.log('완료. 재귀속', await upsert(reuse))
}

if (MODE === 'gloss') await buildGloss()
else if (MODE === 'load') await load()
else if (MODE === 'reuse-tier1') await reuseTier1()
else { console.error('usage: lexicon-build.mjs gloss | load [--commit] | reuse-tier1 [--commit]'); process.exit(1) }
