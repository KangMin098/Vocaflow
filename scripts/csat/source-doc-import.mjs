// scripts/csat/source-doc-import.mjs
//
// **내용 점검을 통과한 원문을 `library_articles` 에 적재한다.**
//
// 입력: `docs/reports/data/source-doc-register.json` 의 `read_verdict === 'keep'` 행
//       + 스크래치패드의 본문(`ft-*-samples.json`)
//
// ── 이 스크립트가 지키는 것 ───────────────────────────────────────────
// · **재실행 안전** — `source_id` 로 이미 있는 것을 먼저 세고 건너뛴다. 건너뛴 수를 출력한다.
// · **빈 본문은 넣지 않는다** — 빈 값이 들어가면 구멍이 영영 남는다.
//   ⚠️ **길이로는 버리지 않는다**(2026-09-24). 예전에는 300어 미만을 건너뛰었다 — AGENTS.md 의 드레인 규칙
//   (「LLM 이 채운 빈 값·너무 짧은 값」)을 원문 길이에 잘못 옮긴 것이었다. 짧은 원문은 적재하고 편수만 따로 센다.
// · **`--commit` 없이는 아무것도 쓰지 않는다.**
// · **`count ?? 0` 을 쓰지 않는다** — 없는 테이블도 head 요청엔 count=null 이다.
//   오류를 0 으로 삼키면 「이미 있음 0」으로 읽혀 전량 중복 적재된다.
//
// 사용:
//   node --tls-max-v1.2 scripts/csat/source-doc-import.mjs            (dry-run)
//   node --tls-max-v1.2 scripts/csat/source-doc-import.mjs --commit
//   node --tls-max-v1.2 scripts/csat/source-doc-import.mjs --commit --limit 1   (제약 확인용)

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const COMMIT = process.argv.includes('--commit')
const LIMIT = Number(arg('limit') ?? '0')
const SCRATCH = arg('dir') ?? 'C:/Users/ADMINI~1/AppData/Local/Temp/claude/d--workspace-Vocaflow/f7470252-d57c-43e3-a7d6-7baede72261d/scratchpad'

/**
 * 원천별 적재 메타.
 *
 * `license` 는 **사람이 읽는 원문 표기**다 — 등급 슬러그를 넣으면 DB 트리거
 * `acp_classify_license` 가 다시 파싱해 엉뚱한 등급을 찍는다(2026-09-23 재고 80편 사고).
 */
const META = {
  olh: { source: 'olh', file: 'ft-olh-samples.json', idKey: 'pk', bodyKeys: ['body_prose', 'body_trimmed'], license: 'CC BY 4.0', urlKey: 'xml_url', rightsKeys: ['license_norm'] },
  econstor: { source: 'econstor', file: 'ft-econstor-samples.json', idKey: 'handle', bodyKeys: ['bodyText'], license: null, urlKey: 'pdfUrl', rightsKeys: ['rights'] },
  scielo: { source: 'scielo', file: 'ft-scielo-samples.json', idKey: 'pid', bodyKeys: ['body_text'], license: null, urlKey: 'url', rightsKeys: ['license_v541'] },
  openalex: { source: 'openalex', file: 'ft-openalex-samples.json', idKey: 'idx', bodyKeys: ['extracted_text'], license: 'CC BY 4.0', urlKey: 'host', rightsKeys: [] },
}

/**
 * **개작을 허용하는 라이선스만 적재한다.**
 *
 * `source-policy.test.ts` 의 「SOURCE_SPECS 에 restricted 등급 소스가 없다」가
 * econstor 를 잡았고, 그 판정이 옳았다 — 실측(확보 27편):
 *   CC 병기 15 · **CC 없음 12** · CC 전용 0
 * EconStor 표준 이용약관이 **항상 병기**되므로 원천 단위로 CC 를 선언할 수 없다.
 * 그래서 **행 단위로 거른다.**
 *
 * SciELO 도 같다 — 확보 30편 중 `BY-NC-ND/4.0` 3 · `BY-NC/4.0` 2 (저널 단위 `v541`).
 * NC·ND 는 DD-75 의 R3·R4(사실·논지만 취해 재저작) 입력이지 **그대로 싣는 원문이 아니다.**
 *
 * 통과: CC BY · CC BY-SA · CC0 · PD.  탈락: NC 계열 · ND 계열 · 라이선스 없음.
 */
function derivationAllowed(raw, m) {
  const parts = []
  for (const k of m.rightsKeys ?? []) {
    const v = raw?.[k]
    if (typeof v === 'string') parts.push(v)
    else if (Array.isArray(v)) parts.push(...v.filter((x) => typeof x === 'string'))
  }
  // rightsKeys 가 없는 원천(openalex)은 질의 필터가 곧 라이선스다.
  if (!parts.length) return { ok: (m.rightsKeys ?? []).length === 0, license: m.license }
  const joined = parts.join(' | ')
  const lower = joined.toLowerCase()
  if (/-nc|noncommercial|non-commercial/.test(lower)) return { ok: false, license: joined }
  if (/-nd\b|noderiv/.test(lower)) return { ok: false, license: joined }
  if (/\bcc0\b|public domain/.test(lower)) return { ok: true, license: 'CC0 1.0' }
  // ⚠️ 원천마다 표기가 다르다 — 셋을 다 봐야 한다. 처음엔 앞의 둘만 봐서
  //    SciELO 30편이 **전부** 막혔다(그 원천은 `BY/4.0` 처럼 `cc` 없이 적는다).
  //    NC·ND 는 위에서 먼저 떨어뜨리므로 여기 오는 `by-…` 는 순수 BY/BY-SA 다.
  if (
    /creativecommons\.org\/licenses\/by(-sa)?\//.test(lower) || // URL 꼴 (OLH·EconStor)
    /\bcc[ -]by(-sa)?\b/.test(lower) ||                          // 「CC BY」 꼴
    /^by(-sa)?\/[\d.]+$/.test(lower.trim())                      // 「BY/4.0」 꼴 (SciELO v541)
  ) {
    return { ok: true, license: /-sa/.test(lower) ? 'CC BY-SA 4.0' : 'CC BY 4.0' }
  }
  return { ok: false, license: joined }
}

const W = (t) => (String(t ?? '').match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length

// ── 정제 — 점검 때 쓴 것과 같은 규칙 ─────────────────────────────────
const STRIP = [
  /\([A-Z][A-Za-z'’-]+(?:\s+(?:et al\.?|and|&)\s+[A-Z][A-Za-z'’-]+)?[,\s]+\d{4}[a-z]?(?::\s*[\d–-]+)?\)/g,
  /\([^)]{0,40}(?:et al\.?|,\s*\d{4})[^)]{0,40}\)/g,
  /\[\d{1,3}(?:[,–-]\s*\d{1,3})*\]/g,
  /\(\s*[,;\s]*\)/g,
  /https?:\/\/\S+/g,
  /&[a-z]+;/g,
]
const DROP_SENTENCE = [
  /\b(?:CRediT|Funding information|Data availability|Competing interests|Acknowledge?ments?|Conflicts? of interest|upon reasonable request|Downloaded from)\b/i,
  /\b(?:Fig(?:ure)?|Table|Panel|Appendix|Equation)\s+\(?[A-Z]?\d/i,
  /\bdoi\.org|\bISSN\b|\bVol\.\s*\d/i,
  /\*{2,}\s*p\s*[<>=]|standard errors|clustered/i,
  /^[A-Z][A-Z\s,&']{12,}$/,
  /[a-z][HB][a-z]{2,}/,
  /[\uFB00-\uFB06]/,
]
const sentencesOf = (t) =>
  String(t).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).map((s) => s.trim())
    .filter((s) => (s.match(/[A-Za-z]+/g) ?? []).length >= 4)

function cleanProse(body) {
  let t = String(body ?? '')
  for (const re of STRIP) t = t.replace(re, ' ')
  return sentencesOf(t).filter((s) => !DROP_SENTENCE.some((re) => re.test(s))).join(' ')
}

// ── 입력 ──────────────────────────────────────────────────────────────
const reg = JSON.parse(fs.readFileSync('docs/reports/data/source-doc-register.json', 'utf8'))
const keep = reg.docs.filter((d) => d.read_verdict === 'keep')
console.log(`등록부 ${reg.docs.length}행 · 확보 ${keep.length}편`)

const bodies = new Map()
const meta = new Map()
for (const [name, m] of Object.entries(META)) {
  const p = path.join(SCRATCH, m.file)
  if (!fs.existsSync(p)) { console.log(`  ⚠️ ${m.file} 없음 — ${name} 건너뜀`); continue }
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  const arr = Array.isArray(j) ? j : (j.samples ?? Object.values(j).find(Array.isArray) ?? [])
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i]
    const id = `${name}:${String(x?.[m.idKey] ?? i)}`
    const body = m.bodyKeys.map((k) => x?.[k]).find((v) => typeof v === 'string' && v.length > 500)
    if (body) { bodies.set(id, body); meta.set(id, { ...m, raw: x }) }
  }
}

// ── 이미 있는 것 ──────────────────────────────────────────────────────
const wanted = keep.filter((d) => bodies.has(d.id))
console.log(`본문 보유 ${wanted.length}편 · 본문 없음 ${keep.length - wanted.length}편`)

const sourceIds = wanted.map((d) => `${d.source}:${d.id.split(':').slice(1).join(':')}`)
const existing = new Set()
for (let i = 0; i < sourceIds.length; i += 200) {
  const { data, error } = await db.from('library_articles').select('source_id').in('source_id', sourceIds.slice(i, i + 200))
  // ⚠️ 오류를 빈 배열로 삼키면 「이미 있음 0」이 되어 전량 중복 적재된다.
  if (error) throw new Error(`기존 조회 실패 — ${error.message}`)
  for (const r of data ?? []) existing.add(r.source_id)
}
console.log(`이미 있음 ${existing.size}편`)

// ── 적재 ──────────────────────────────────────────────────────────────
let inserted = 0, skipped = 0, empty = 0, short = 0, blockedByLicense = 0
const byLicenseSource = {}
const failures = []
let n = 0
for (const d of wanted) {
  if (LIMIT && n >= LIMIT) break
  const m = meta.get(d.id)
  const suffix = d.id.split(':').slice(1).join(':')
  const source_id = `${d.source}:${suffix}`
  if (existing.has(source_id)) { skipped++; continue }

  const prose = cleanProse(bodies.get(d.id))
  if (!prose.trim()) { empty++; continue } // 빈 본문만 건너뛴다 — 길이 기준이 아니다
  if (W(prose) < 300) short++ // 기록만 한다(300어는 기출 지문 규격보다 길다 — 버릴 이유가 아니다)

  const raw = m.raw ?? {}
  // 개작 불가·라이선스 없음은 **그대로 싣는 원문이 아니다**(R3·R4 재저작 입력이다).
  const lic = derivationAllowed(raw, m)
  if (!lic.ok) { blockedByLicense++; byLicenseSource[d.source] = (byLicenseSource[d.source] ?? 0) + 1; continue }
  const row = {
    source: d.source,
    source_id,
    title: String(raw.title ?? d.topic_ko ?? suffix).slice(0, 500),
    author: null,
    source_url: raw[m.urlKey] ? String(raw[m.urlKey]) : null,
    published_at: null,
    // 원천이 준 값이 있으면 그것, 없으면 META 의 사람 읽는 표기. 슬러그를 넣지 않는다.
    // 정규화된 사람 읽는 표기 — 등급 슬러그를 넣으면 트리거가 재파싱한다.
    license: lic.license,
    content: prose,
    audio_url: null,
    feed_id: null,
    status: 'queued',
  }
  n++
  if (!COMMIT) { inserted++; continue }
  const { error } = await db.from('library_articles').insert(row)
  if (error) failures.push(`${source_id}: [${error.code ?? '?'}] ${error.message}`)
  else inserted++
}

console.log(`
${COMMIT ? '적재' : 'dry-run'}   ${inserted}편
건너뜀(이미 있음) ${skipped}편
건너뜀(빈 본문) ${empty}편
적재 중 300어 미만 ${short}편 (버리지 않음 · 기록용)
건너뜀(개작 불가·라이선스 없음) ${blockedByLicense}편  ${JSON.stringify(byLicenseSource)}
실패        ${failures.length}편`)
for (const f of failures.slice(0, 10)) console.log('  ' + f)
if (failures.length > 10) console.log(`  … 외 ${failures.length - 10}건`)
if (!COMMIT) console.log('\n※ dry-run 이다. 실제로 쓰려면 --commit')
