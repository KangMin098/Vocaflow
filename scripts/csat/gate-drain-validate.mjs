// scripts/csat/gate-drain-validate.mjs
//
// **적재 전에 판정 청크를 검사한다 — 읽기 전용.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// `gate-import.mjs` 에는 **어휘 검증이 하나도 없다.** 청크에 적힌 `verdict`·`genre` 문자열을
// 그대로 받아 `decide()` 에 넘긴다. 대부분의 오타는 안전한 쪽으로 실패하지만
// (`verdict: 'usable'` → `blockedBy: 'verdict:usable'` 로 차단) **정반대인 경우가 하나 있다**:
//
//     verdict: 'use' + genre: 'bias'
//
// `decide()` 는 genre 를 **`verdict === 'reject'` 일 때만** 본다. 그래서 이 조합은
// 통과한다 — 편향 서술이 교재 지문 후보로 들어간다. 판정자가 "쓸 만한데 편향이 좀 있다"
// 는 뜻으로 적으면 그대로 새 나가고, **차단 집계에도 안 잡혀서 아무도 모른다.**
//
// 청크를 여러 판정자가 나눠 채우면 어휘가 갈릴 확률이 그만큼 는다. 그래서 적재 전에 센다.
//
// ⚠️ **정본을 다시 적지 않는다.** 차단 어휘는 `gate-rules.mjs` 의 `HARMFUL`·`UNFIT` 이고
//   여기서는 읽기만 한다 — 두 벌이 되면 규칙을 고쳐도 검사가 옛 값으로 통과시킨다.
//
// 재실행 안전: 읽기만 한다. DB 도 안 본다.
//
// 실행: node scripts/csat/gate-drain-validate.mjs

import fs from 'node:fs'
import path from 'node:path'

import { HARMFUL, UNFIT } from './gate-rules.mjs'

const DRAIN = path.resolve('scripts/csat/gate-drain')
const VERDICTS = new Set(['use', 'narrative', 'reject'])
/** `reject` 사유로 쓸 수 있는 것 — 해로운 것 + 지문이 될 수 없는 것 + 운문. */
const BLOCK_GENRES = new Set([...HARMFUL, ...UNFIT, 'poetry-drama'])

const errors = []
const warns = []
const seen = new Map() // book → { verdict, file }
let books = 0
let files = 0

const outs = fs.readdirSync(DRAIN).filter((f) => f.endsWith('.out.json')).sort()
if (!outs.length) {
  console.error('  ❌ 채운 청크가 없다. gate-book-export.mjs 로 뽑고 채울 것.')
  process.exit(1)
}

console.log('판정 청크 검사 — 읽기 전용')
console.log('='.repeat(78))

for (const f of outs) {
  files += 1
  const inPath = path.join(DRAIN, f.replace(/\.out\.json$/, '.json'))
  // ⚠️ 판정이 병렬로 돌고 있으면 **반쯤 쓰인 파일**을 읽을 수 있다. 스택 트레이스로 죽으면
  //   "무엇이 잘못됐는지" 대신 "어디서 죽었는지" 만 남는다 — 파일 이름을 들고 오류로 센다.
  let out
  try {
    out = JSON.parse(fs.readFileSync(path.join(DRAIN, f), 'utf8'))
  } catch (e) {
    errors.push(`${f}: JSON 을 못 읽는다 — ${String(e.message).slice(0, 80)} (아직 쓰는 중일 수 있다)`)
    continue
  }
  if (!Array.isArray(out)) {
    errors.push(`${f}: 배열이 아니다 — 적재기가 for…of 로 훑는다`)
    continue
  }

  // ── 입력과 개수·제목이 맞는가 ────────────────────────────────────
  // 적재기는 `book` 문자열로 대조한다. 제목이 한 글자라도 바뀌면 그 책은 **조용히 빠진다**
  // — 오류도 안 나고 판정도 안 붙는다. 그래서 원본과 대조한다.
  if (fs.existsSync(inPath)) {
    const inp = JSON.parse(fs.readFileSync(inPath, 'utf8'))
    if (inp.length !== out.length) {
      errors.push(`${f}: 항목 수 ${out.length} ≠ 입력 ${inp.length}`)
    }
    const inTitles = new Set(inp.map((x) => x.book))
    for (const it of out) {
      if (!inTitles.has(it.book)) errors.push(`${f}: 입력에 없는 제목 — ${String(it.book).slice(0, 60)}`)
    }
  } else {
    warns.push(`${f}: 대응 입력 파일이 없다 — 개수·제목 대조를 못 한다`)
  }

  for (const it of out) {
    books += 1
    const where = `${f} · ${String(it.book ?? '(제목 없음)').slice(0, 50)}`

    if (!it.verdict) {
      errors.push(`${where}: verdict 없음 — 적재기가 이 책을 건너뛴다`)
      continue
    }
    if (!VERDICTS.has(it.verdict)) {
      errors.push(`${where}: 모르는 verdict "${it.verdict}" — 적재되면 verdict:… 로 차단된다`)
    }

    // ⚠️ **이것이 이 검사의 이유다.** `use`/`narrative` + 해로운 genre 는 통과한다.
    if (it.verdict !== 'reject' && BLOCK_GENRES.has(it.genre)) {
      errors.push(
        `${where}: "${it.verdict}" 인데 genre 가 "${it.genre}" 다 — ` +
          `decide() 는 reject 일 때만 genre 를 보므로 **그대로 통과한다**`,
      )
    }
    if (it.verdict === 'reject' && !BLOCK_GENRES.has(it.genre)) {
      // 차단은 되지만(blockedBy = genre) 사유가 목록 밖이라 집계가 흩어진다.
      warns.push(`${where}: reject 사유가 목록 밖 — "${it.genre ?? '(없음)'}"`)
    }
    if (!it.genre) warns.push(`${where}: genre 비어 있음`)
    if (!it.why || String(it.why).trim().length < 4) {
      warns.push(`${where}: why 가 비었거나 너무 짧다 — 왜 그렇게 판정했는지 남지 않는다`)
    }

    // 같은 책이 두 청크에 있고 판정이 다르면 **나중 파일이 이긴다**(적재기가 Map 에 덮어쓴다).
    const prev = seen.get(it.book)
    if (prev && prev.verdict !== it.verdict) {
      errors.push(
        `${where}: 같은 책이 ${prev.file} 에서는 "${prev.verdict}" — ` +
          `적재기는 파일 이름 순으로 나중 것이 이긴다`,
      )
    }
    seen.set(it.book, { verdict: it.verdict, file: f })
  }
}

const tally = {}
for (const { verdict } of seen.values()) tally[verdict] = (tally[verdict] ?? 0) + 1

console.log(`  파일 ${files}개 · 항목 ${books.toLocaleString()} · 고유 책 ${seen.size.toLocaleString()}권`)
console.log(`  판정 분포  ${Object.entries(tally).map(([k, v]) => `${k} ${v.toLocaleString()}`).join(' · ')}\n`)

if (warns.length) {
  console.log(`  ⚠ 경고 ${warns.length}건 (적재는 되지만 봐 둘 것)`)
  for (const w of warns.slice(0, 20)) console.log(`    · ${w}`)
  if (warns.length > 20) console.log(`    … 그리고 ${warns.length - 20}건 더`)
  console.log()
}

if (errors.length) {
  console.error(`  ❌ 오류 ${errors.length}건 — **고치기 전에 적재하지 말 것**`)
  for (const e of errors.slice(0, 30)) console.error(`    · ${e}`)
  if (errors.length > 30) console.error(`    … 그리고 ${errors.length - 30}건 더`)
  process.exit(1)
}

console.log('  ✅ 오류 없음 — gate-import.mjs 로 적재해도 된다.')
