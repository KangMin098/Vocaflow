// scripts/csat/source-triage-packets.mts
//
// **전문 청크 → 요약 판정(B) 청크 — 읽기 전용(DB 를 읽어 사전만 받는다).**
//
// 입력: 보관 판정 청크 디렉터리(`chunk-<source>.json`, 항목마다 `content` 전문).
// 출력: 같은 이름의 청크를 `--out` 에 — `content` 대신 `windows`(첫 창 + 쉬운 창 2개 · lib-triage-packet)와
//       `basis: 'windows'`, 전문 어수. 식별자(id·revision·본문 해시)는 그대로 옮긴다 — 적재기가 전문 해시로 묶는다.
// **짧은 글(창 두 개 분량 이하)은 그대로 둔다**(`basis:'full'` + `content`) — 창이 곧 전문이라 줄일 것이 없고,
//   창 판정으로 보내면 보관이 아닐 때 같은 전문을 한 번 더 읽는다. 그래서 한 청크에 두 방식이 섞일 수 있다.
// 이미 있는 출력 파일은 건너뛴다(재실행 안전).
//
// 실행: pnpm exec tsx scripts/csat/source-triage-packets.mts --in scripts/csat/source-round/round-4 --out scripts/csat/source-round/round-4-lite

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

import { loadRuler } from './lib-cefr-ruler.mts'
import { pickWindows } from './lib-triage-packet.mts'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '')
}
const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const IN = arg('in')
const OUT = arg('out')
if (!IN || !OUT) throw new Error('--in <청크 디렉터리> --out <출력 디렉터리>')

const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!, { auth: { persistSession: false } })
const ruler = await loadRuler(db)
fs.mkdirSync(OUT, { recursive: true })

let files = 0
let items = 0
let fullWords = 0
let packetWords = 0
let whole = 0
for (const f of fs.readdirSync(IN).filter((f) => /^chunk-[^.]+\.json$/.test(f))) {
  const dest = path.join(OUT, f)
  if (fs.existsSync(dest)) continue
  const chunk = JSON.parse(fs.readFileSync(path.join(IN, f), 'utf8')) as Array<Record<string, unknown>>
  const lite = chunk.map((x) => {
    const content = String(x.content ?? '')
    const picked = pickWindows(content, ruler)
    const total = content.split(/\s+/).filter(Boolean).length
    fullWords += total
    if (picked.length === 1 && picked[0]!.why === 'whole') {
      packetWords += total
      whole++
      return { ...x, basis: 'full' }
    }
    const windows = picked.map(({ s, e, ...w }) => ({ ...w, span: [s, e] }))
    packetWords += windows.reduce((n, w) => n + w.words, 0)
    const { content: _c, ...rest } = x
    return { ...rest, basis: 'windows', words_total: total, windows }
  })
  fs.writeFileSync(dest, `${JSON.stringify(lite, null, 1)}\n`, { flag: 'wx' })
  files++
  items += lite.length
}
console.log(JSON.stringify({ files, items, whole, windowed: items - whole, fullWords, packetWords, ratio: fullWords ? +(packetWords / fullWords).toFixed(3) : null }))
