// scripts/textbook/item-selfcheck.mjs
//
// **집필한 청크가 적재 관문을 통과하는가 — DB 없이 미리 잰다.**
//
// ── 왜 필요한가 (실측 2026-09-06) ──────────────────────────────────
// 관문은 `item-drain-import.mjs` 를 `--commit` 없이 돌리면 볼 수 있다. 그런데 그것은
// **DB 를 붙잡아야** 하고, 이 프로젝트의 DB 는 여러 세션이 공유해 자주 느리다(같은 날
// 조회가 statement timeout 으로 죽었다). 그래서 문항을 쓰는 도중에는 손으로 검사기를
// 짜게 됐고, **그 검사기가 게이트와 다른 규칙을 썼다** — "선택지 최소/최대 길이 비 ≥
// 0.85" 라는 있지도 않은 규칙으로 멀쩡한 요약 문항 넷을 다시 썼다(진짜 규칙은
// **정답 ÷ 오답 평균 0.8~1.25**).
//
// 이 스크립트는 규칙을 **직접 갖지 않는다.** `@vocaflow/library-pipeline` 의
// `checkDrainItem`·`answerLengthBias` 한 벌을 그대로 부른다 — import 가 부르는 것과
// 같은 함수다. 여기서 통과하면 적재에서도 통과한다(DB 를 봐야 하는 두 가지만 빼고:
// 이미 있는 것인지, 정답 번호 쏠림).
//
// 재실행 안전: 읽기만 한다. 아무것도 쓰지 않고 네트워크도 안 탄다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/item-selfcheck.mjs --type topic --band 7
//   pnpm dlx tsx scripts/textbook/item-selfcheck.mjs --dir scripts/textbook/item-drain/mood-v5
//   pnpm dlx tsx scripts/textbook/item-selfcheck.mjs --file .../chunk-01.out.json --type mood --band 5

import fs from 'node:fs'
import path from 'node:path'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}

const fileArg = arg('file')
const dirArg = arg('dir')
let TYPE = arg('type')
let BAND = arg('band') ? Number(arg('band')) : null

// ⚠️ **폴더 이름이 정본이다.** `--dir` 만 주고 유형·학년을 기본값으로 채웠다가 요지 9문항이
//   'topic'/V3 로 적힌 일이 있었다(2026-08-31). 여기서도 같은 규칙을 쓴다.
const DIR = path.resolve(dirArg ?? (TYPE && BAND ? `scripts/textbook/item-drain/${TYPE}-v${BAND}` : '.'))
const fromDir = path.basename(fileArg ? path.dirname(path.resolve(fileArg)) : DIR).match(/^(.+)-v(\d+)$/)
if (fromDir) {
  if (TYPE && TYPE !== fromDir[1]) {
    console.error(`❌ 폴더와 인자가 어긋난다 — 폴더 ${fromDir[1]} vs 인자 ${TYPE}`)
    process.exit(1)
  }
  if (BAND && BAND !== Number(fromDir[2])) {
    console.error(`❌ 폴더와 인자가 어긋난다 — 폴더 V${fromDir[2]} vs 인자 V${BAND}`)
    process.exit(1)
  }
  TYPE = fromDir[1]
  BAND = Number(fromDir[2])
}
if (!TYPE || !BAND) {
  console.error('❌ 유형과 학년을 알 수 없다 — --type/--band 를 주거나 <유형>-v<학년> 폴더를 가리킬 것.')
  process.exit(1)
}

const files = fileArg
  ? [path.resolve(fileArg)]
  : fs.existsSync(DIR)
    ? fs
        .readdirSync(DIR)
        .filter((f) => f.endsWith('.out.json'))
        .sort()
        .map((f) => path.join(DIR, f))
    : []

if (!files.length) {
  console.log(`채워진 청크(.out.json)가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}

const { checkDrainItem, answerLengthBias, LONGEST_ANSWER_MAX } = await import(
  '@vocaflow/library-pipeline'
)

console.log(`유형 ${TYPE} · V${BAND} · 청크 ${files.length}개\n`)

const passed = []
let failed = 0
for (const f of files) {
  const rows = JSON.parse(fs.readFileSync(f, 'utf8'))
  const name = path.basename(f)
  rows.forEach((r, i) => {
    const v = checkDrainItem(r, TYPE, BAND)
    const who = String(r?.source_title ?? r?.article_id ?? '?').slice(0, 40)
    if (v.ok) {
      passed.push({ choices: v.choices, answer: v.answer })
      console.log(`  ✅ ${name}[${i}] ${who}`)
    } else {
      failed += 1
      console.log(`  ❌ ${name}[${i}] ${who} — ${v.reason}`)
    }
  })
}

console.log(`\n통과 ${passed.length} · 막힘 ${failed}`)

// 배치 편향은 **통과한 것만** 본다 — 막힌 것은 어차피 안 들어간다.
const bias = answerLengthBias(passed)
if (bias.enough) {
  const pct = (n) => `${n}/${bias.n} = ${((100 * n) / bias.n).toFixed(1)}%`
  console.log(`  정답이 유일한 최장 ${pct(bias.longest)} · 최단 ${pct(bias.shortest)}  (우연이면 20%)`)
  if (bias.worst > LONGEST_ANSWER_MAX) {
    console.log(
      `\n❌ 길이 편향이 ${(100 * LONGEST_ANSWER_MAX).toFixed(0)}% 를 넘었다 — 이대로면 import 가 적재를 거부한다.`,
    )
  }
} else {
  console.log(`  (${bias.n}건이라 배치 편향은 안 본다 — 여덟 건부터 뜻을 갖는다)`)
}

// ⚠️ **여기서 통과해도 import 가 막을 수 있는 것이 둘 있다** — 둘 다 DB 를 봐야 안다.
console.log(
  '\n남은 두 관문은 DB 를 본다 — ① 이미 같은 (유형·원글) 이 있는가 ② 이번에 새로 넣는 것의 정답 번호 쏠림.\n' +
    `  pnpm dlx tsx scripts/textbook/item-drain-import.mjs --type ${TYPE} --band ${BAND}`,
)

process.exit(failed ? 1 : 0)
