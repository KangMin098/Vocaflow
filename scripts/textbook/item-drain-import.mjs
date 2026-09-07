// scripts/textbook/item-drain-import.mjs
//
// **문항 제작 드레인 ③/③ — Claude Code 가 쓴 선택지를 `csat_dcp_items` 에 넣는다.**
//
// ── 넣지 않는 것 ─────────────────────────────────────────────────────
// 선택지가 다섯이 아닌 것 · 정답 번호가 1~5 밖인 것 · **선택지가 서로 겹치는 것** ·
// 너무 짧은 것은 넣지 않는다. 겹치는 선택지는 답이 둘이 되어 **문항 자체가 틀린다** —
// 그런 것이 교재에 실리면 학습자가 자기 탓을 한다. 건너뛴 수와 이유를 반드시 찍는다.
//
// ⚠️ **빈칸(blank)은 지문에 `____` 가 있어야 한다.** 없으면 빈칸 없는 빈칸 문항이 된다.
//    요약(summary)은 `(A)`·`(B)` 가 든 요약문이, 함의(implication)는 지문에 그대로 있는
//    밑줄 구절이 있어야 한다. 유형마다 다른 이 조건을 여기서 막는다.
//
// 재실행 안전: 유일키가 `(kind, ref_id, type, paragraph_idx)` 다. 이미 있으면 건너뛴다 —
// 몇 번 돌려도 결과가 같다.
//
// ⚠️ 이 유형들은 **교재용**이다. `prescribe_today` 허용 목록(order·insert)에 넣지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/item-drain-import.mjs --type topic --band 3
//   pnpm dlx tsx scripts/textbook/item-drain-import.mjs --type topic --band 3 --commit

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, fetchAllIn } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const commit = process.argv.includes('--commit')
// ⚠️ **--dir 만 주면 유형·학년이 기본값으로 들어간다.** 실제로 --dir .../main_point-v6
// 만 주고 돌렸다가 요지 9문항이 'topic'/V3 로 적혔다(2026-08-31). 중복 검사도 기본값
// 기준이라 "이미 있음 0" 을 내며 조용히 통과했다 — 잘못 꽂힌 줄은 아무도 안 본다.
// 그래서 **폴더 이름을 정본으로 삼는다.** <유형>-v<학년> 을 파싱해 채우고, 명시한
// 값과 어긋나면 넣기 전에 멈춘다.
const dirArg = arg('dir')
const dirName = dirArg ? path.basename(path.resolve(dirArg)) : null
const fromDir = dirName ? /^(.+)-v([0-9]+)$/.exec(dirName) : null
if (dirArg && !fromDir) {
  console.error('❌ 폴더 이름이 <유형>-v<학년> 형태가 아니다: ' + dirName)
  console.error('   폴더에서 읽을 수 없으면 --type 과 --band 를 직접 준다.')
  process.exit(1)
}
const TYPE = arg('type') ?? fromDir?.[1] ?? 'topic'
const BAND = Number(arg('band') ?? fromDir?.[2] ?? 3)
if (fromDir && (fromDir[1] !== TYPE || Number(fromDir[2]) !== BAND)) {
  console.error('❌ 폴더와 인자가 어긋난다 — 폴더 ' + fromDir[1] + '/V' + fromDir[2] + ' vs 인자 ' + TYPE + '/V' + BAND)
  console.error('   둘 중 하나가 오타다. 맞춰서 다시 돌린다.')
  process.exit(1)
}
const DIR = path.resolve(dirArg ?? ('scripts/textbook/item-drain/' + TYPE + '-v' + BAND))
console.log('유형 ' + TYPE + ' · V' + BAND + ' · ' + path.basename(DIR))

// ⚠️ **관문 규칙은 여기 없다 — `item-gate.ts` 한 벌이다.**
//   DB 없이도 돌릴 수 있어야 집필 도중에 미리 잴 수 있고(`item-selfcheck.mjs`),
//   사본을 두면 둘이 갈린다. 실제로 갈렸다 — 손으로 짠 검사기가 "선택지 최소/최대
//   길이 비 ≥ 0.85" 라는 없는 규칙을 써서 멀쩡한 요약 문항 넷을 다시 쓰게 만들었다.

const { createClient } = await import('@supabase/supabase-js')
const { checkDrainItem, answerLengthBias, LONGEST_ANSWER_MAX } =
  await import('@vocaflow/library-pipeline')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

if (!fs.existsSync(DIR)) {
  console.log(`청크 디렉터리가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}
const outFiles = fs.readdirSync(DIR).filter((f) => f.endsWith('.out.json')).sort()
if (!outFiles.length) {
  console.log(`채워진 청크(.out.json)가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}
const rows = []
for (const f of outFiles) rows.push(...JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
console.log(`청크 ${outFiles.length}개 · 문항 ${rows.length}건`)

const skipped = []
const ok = []
for (const r of rows) {
  // 관문 한 벌. 밴드를 함께 넘긴다 — 안 넘기면 초등 몫을 고등 창으로 재게 된다.
  const v = checkDrainItem(r, TYPE, BAND)
  if (!v.ok) skipped.push([r.source_title ?? r.article_id, v.reason])
  else ok.push({ ...r, choices: v.choices, answer: v.answer, passage: v.passage })
}
console.log(`  넣을 수 있는 것 ${ok.length} · **건너뛴 것 ${skipped.length}**`)
for (const [who, m] of skipped) console.log(`    · ${String(who).slice(0, 40)}: ${m}`)

// ── 배치 단위 길이 편향 ─────────────────────────────────────────────
// 문항마다 임계를 넘지 않아도 **한쪽으로 쏠려 있으면** 학습자는 그 규칙을 배운다.
// ⚠️ **양쪽을 다 본다.** 처음에는 "정답이 길다" 만 봤는데, 재작성 배치가 초안에서 정답이
//   **유일한 최단**이 된 문항을 스스로 잡아냈다. 짧은 쪽도 똑같이 단서다 — 학습자는
//   "가장 긴 것" 이든 "가장 짧은 것" 이든 규칙이 있으면 그것을 배운다.
const bias = answerLengthBias(ok)
if (bias.enough) {
  const show = (n, label) =>
    console.log(`  정답이 유일한 ${label} ${n}/${bias.n} = ${((100 * n) / bias.n).toFixed(1)}%  (우연이면 20%)`)
  show(bias.longest, '최장')
  show(bias.shortest, '최단')
  if (bias.worst > LONGEST_ANSWER_MAX) {
    console.log(
      `\n❌ **적재를 거부한다.** 길이 편향이 ${(100 * LONGEST_ANSWER_MAX).toFixed(0)}% 를 넘었다 —\n` +
        `   지문을 안 읽고 길이로 고르면 상당수가 맞는다. 문항이 아니라 길이 맞히기가 된다.\n` +
        `   선택지 길이를 고르게 다시 쓴 뒤 이 스크립트를 다시 돌린다.`,
    )
    process.exit(1)
  }
}

// ── 이미 있는 것 ────────────────────────────────────────────────────
const existing = new Set(
  (await fetchAllIn(db, 'csat_dcp_items', 'id, ref_id, type, kind', 'ref_id', ok.map((r) => r.article_id), ['ref_id', 'id'], (q) => q.eq('kind', 'article')))
    .filter((r) => r.kind === 'article' && r.type === TYPE)
    .map((r) => r.ref_id),
)
const fresh = ok.filter((r) => !existing.has(r.article_id))

// ── 배치 단위 **정답 번호** 쏠림 ────────────────────────────────────
// ⚠️ **길이 편향은 막으면서 번호 편향은 열어 두고 있었다** (실측 2026-08-31).
//   초등 집필분을 다 넣고 나서 세어 보니 정답 1번이 이랬다:
//
//     topic 13/32 = 40.6%  ·  blank 11/31 = 35.5%  ·  title 8/24 = 33.3%   (우연이면 20%)
//
//   사람이 쓰면 근거를 먼저 적고 그것을 1번에 놓는 습관이 붙는다 — 길이 편향과 똑같이
//   **구조적**이라 지침만으로는 안 잡힌다. 그리고 이 쏠림은 길이보다 **더 싸게 악용된다**:
//   "모르면 1번" 하나로 3분의 1이 맞는다.
//
//   `item-health-report.mjs` 가 사후에 카이제곱으로 보긴 했지만, **넣고 나서 아는 것은
//   늦다** — 이미 재고에 들어간 뒤라 되돌리려면 번호를 다시 섞어야 한다. 그래서 길이
//   게이트와 **대칭으로** 여기서 막는다. 상한은 길이 쪽과 같은 40% 를 쓴다.
//
// ⚠️ **`ok` 가 아니라 `fresh` 를 본다 — 이번에 넣는 것만 판단한다.**
//   처음에는 `ok`(청크 파일 전부)로 쟀다. 그런데 import 는 폴더의 `.out.json` 을 **모두**
//   훑으므로, 이미 넣은 옛 청크의 번호가 통계를 지배한다. 실제로 DB 쪽 쏠림을 이미
//   풀어 놓은 뒤에도 옛 청크 파일의 값 때문에 45.0% 가 나와 새 4문항이 막혔다
//   (그 4문항은 1·1·1·1 로 고른 것이었다). **고칠 수 없는 것으로 막으면 게이트가 아니라
//   벽이다** — 청크 파일은 이미 적재된 과거의 기록이라 지금 와서 고칠 대상이 아니다.
const ANSWER_POS_MAX = 0.4
if (fresh.length >= 8) {
  const byPos = [1, 2, 3, 4, 5].map((p) => fresh.filter((r) => r.answer === p).length)
  const worstPos = Math.max(...byPos) / fresh.length
  console.log(
    `  정답 번호 분포 ${byPos.join(' · ')} — 최다 ${(100 * worstPos).toFixed(1)}%  (우연이면 20%)`,
  )
  if (worstPos > ANSWER_POS_MAX) {
    console.log(
      `\n❌ **적재를 거부한다.** 정답 번호가 한쪽으로 ${(100 * ANSWER_POS_MAX).toFixed(0)}% 넘게 쏠렸다 —\n` +
        `   "모르면 그 번호" 하나로 상당수가 맞는다. 선택지 **순서만** 섞고 answer 를 맞춰 고친 뒤\n` +
        `   다시 돌린다(내용은 그대로여도 된다).`,
    )
    process.exit(1)
  }
}

console.log(`  이미 있음 ${ok.length - fresh.length} · **새로 넣을 것 ${fresh.length}**`)

if (!commit) {
  console.log('\n--commit 을 붙이면 적재한다.')
  process.exit(0)
}

let inserted = 0
for (let i = 0; i < fresh.length; i += 100) {
  const chunk = fresh.slice(i, i + 100).map((r) => ({
    kind: 'article',
    ref_id: r.article_id,
    type: TYPE,
    item_role: 'practice',
    // 유형이 열이어도 모양은 하나다 — 렌더러·검사기를 공용으로 쓰기 위해서다.
    payload: {
      passage: r.passage,
      choices: r.choices,
      stem_ko: r.stem_ko ?? null,
      choice_language: r.choice_language ?? null,
      // 유형별로만 쓰는 것 — 없으면 null 로 남는다.
      underline: r.underline ?? null,
      summary_sentence: r.summary_sentence ?? null,
    },
    answer_key: { answer: r.answer, rationale_ko: String(r.rationale_ko).trim() },
    paragraph_idx: 0,
    v_level: BAND,
  }))
  const { error } = await db.from('csat_dcp_items').insert(chunk)
  if (error) {
    console.log(`  ✗ ${error.message}`)
    break
  }
  inserted += chunk.length
}

console.log(`\n적재 완료 ${inserted}건`)
console.log('이어서 확인할 것:')
console.log('  pnpm dlx tsx scripts/textbook/coverage.mjs        (유형 커버리지)')
console.log('  pnpm dlx tsx scripts/textbook/item-health-report.mjs  (정답 번호 쏠림)')
