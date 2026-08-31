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

/** 선택지 하나의 최소 길이. "yes" 같은 것을 막는다. */
const MIN_CHOICE = 8

/**
 * **길이 단서 차단** — 정답이 오답보다 길면 지문을 안 읽고도 풀린다.
 *
 * 실측(2026-08-21, 첫 파일럿 64문항): 정답이 최장인 비율이 우연(20%)의 세 배였다.
 *   main_point **16/16 = 100%**(정답이 평균보다 19자 김) · topic 68.8% · blank 50% · title 37.5%
 * 요지 문항은 **가장 긴 것을 고르면 다 맞았다.** 그건 문항이 아니다.
 *
 * 사람이 쓰면 정답을 정확히 적으려다 길어지고 오답은 대충 짧아진다 — 구조적인 편향이라
 * 지침만으로는 안 잡힌다. 그래서 두 겹으로 막는다:
 *   ① 문항 단위 — 정답이 오답 평균의 1.25배를 넘으면 그 문항을 버린다.
 *   ② 배치 단위 — 정답이 최장인 비율이 40% 를 넘으면 **적재를 거부한다.**
 *      우연이면 20% 다. 40% 는 "몇 개는 그럴 수 있다" 와 "체계적이다" 를 가르는 자리로 잡았다.
 *
 * ⚠️ **①만 한쪽을 보고 있었다** (2026-08-30 추가). ②는 처음부터 최장·최단을 **둘 다**
 *   보는데(`Math.max(longest, shortest)`), ①은 "정답이 길다" 만 막았다. 정답이 오답보다
 *   눈에 띄게 **짧아도** 지문을 안 읽고 풀린다 — "제일 짧은 게 정답" 은 길이 단서의
 *   거울상이다. 그래서 ①에도 상한과 대칭인 하한을 둔다(1/1.25 = 0.8).
 *   배치가 8건 미만이면 ②가 아예 안 돌므로, 작은 배치에서는 ①이 유일한 방어다.
 *
 * ⚠️ 문항 단위로 "정답이 유일한 최장" 을 버리지는 **않는다.** 5지선다에서 정답이 최장일
 *   확률은 원래 20% 라, 문항마다 버리면 멀쩡한 문항의 5분의 1을 버린다. 그건 배치 비율로
 *   봐야 하는 것이고 ②가 그 자리다. (집필 보조 스크립트에서 그렇게 버리도록 짰다가 되돌렸다.)
 */
const ANSWER_LEN_RATIO = 1.25
const ANSWER_LEN_RATIO_MIN = 0.8
const LONGEST_ANSWER_MAX = 0.4
/** 근거의 최소 길이. 빈 근거는 검수할 수 없다. */
const MIN_RATIONALE = 20

const { createClient } = await import('@supabase/supabase-js')
const { hasArticleChrome, itemWordSpec } = await import('@vocaflow/library-pipeline')
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

/** 선택지 비교용 정규화 — 대소문자·구두점·공백 차이는 "다른 선택지" 가 아니다. */
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim()

const skipped = []
const ok = []
for (const r of rows) {
  const id = r.article_id
  const choices = Array.isArray(r.choices) ? r.choices.map((c) => String(c ?? '').trim()) : []
  const answer = Number(r.answer)
  // ⚠️ 장문 어휘(42번)는 **낱말 하나를 바꿔 놓은 지문**이 학습자가 보는 판이다.
  //   원본을 저장하면 바꾼 낱말이 지문에 없어 선택지를 찾을 수 없고, 문항이 성립하지 않는다.
  const passage = String(r.passage_edited ?? r.passage ?? "").trim()
  /** 빈 줄로 가른 문단 수. 장문은 넷이어야 한다. */
  const parasCount = (t) => t.split(/\n\s*\n+/).filter((s) => s.trim()).length
  /** 인쇄될 지문의 낱말 수와 그 유형의 창. 자는 `itemWordSpec` 이 유형별로 안다. */
  const PASSAGE_WORDS = passage.split(/\s+/).filter(Boolean).length
  // ⚠️ **밴드를 함께 넘긴다.** 안 넘기면 초등 몫도 고등 창(90~200어)으로 재서,
  //   집필 몫을 뽑을 때(export)·권을 조립할 때와 **다른 자**가 된다. 실측 2026-08-31:
  //   초6 은 시중 규격이 44~125 라 교차 창이 90~125 인데 여기만 200 까지 통과시켰다.
  //   (같은 결함이 이 저장소에서 다섯 번째다 — 조립기·채점기·밀도표·집필 export·여기.)
  const WORD_SPEC = itemWordSpec(TYPE, BAND)
  const why = (m) => skipped.push([r.source_title ?? id, m])

  if (!id) why('article_id 가 없다')
  else if (choices.length !== 5) why(`선택지가 ${choices.length}개 — 다섯이어야 한다`)
  else if (choices.some((c) => c.length < MIN_CHOICE)) why('너무 짧은 선택지가 있다')
  else if (new Set(choices.map(norm)).size !== 5) why('**선택지가 서로 겹친다 — 답이 둘이 된다**')
  else if (!Number.isInteger(answer) || answer < 1 || answer > 5) why(`정답 번호가 ${r.answer} — 1~5 여야 한다`)
  else if (String(r.rationale_ko ?? '').trim().length < MIN_RATIONALE) why('근거가 비었거나 너무 짧다')
  else if (!passage) why('지문이 비었다')
  // ⚠️ **export 게이트는 과거에 뽑아 둔 청크를 되돌아보지 않는다.**
  //   2026-08-30 에 기사 껍데기 게이트를 넣었는데, 그보다 먼저(8/22) 채워 둔
  //   `blank-v5/chunk-01.out.json` 이 그대로 남아 있었고 import 가 전 청크를 훑으므로
  //   NASA 기사 머리말이 든 문항 3건이 그대로 적재됐다. **게이트는 뽑을 때가 아니라
  //   넣을 때도 봐야 한다** — 청크 파일은 게이트보다 오래 산다.
  //   `isPrintablePassage` 가 아니라 `hasArticleChrome` 인 이유: 전자의 비산문 규칙에
  //   `_{4,}` 가 있어 빈칸 유형의 `____` 를 전부 껍데기로 센다.
  else if (hasArticleChrome(String(r.passage ?? '')) || hasArticleChrome(passage))
    why('기사 껍데기가 지문에 있다 — 게이트가 생기기 전에 채운 청크다')
  // ⚠️ **지문 길이가 유형의 창 안에 들어야 한다.** 이 관문이 없던 동안 원글이 **통째로**
  //   지문 자리에 들어간 문항이 16건 쌓였다(실측 2026-08-31: `title` 8 · `topic` 8,
  //   3,721어 · 14,420어짜리 Wikivoyage 여행 안내문 등). 조합기가 인쇄 단계에서 걸러
  //   학습자에게 나가지는 않았지만, 재고에 죽은 채로 남아 검수 리포트를 계속 울린다.
  //   자는 유형이 정한다 — 장문은 260~400어라 단문 자로 재면 전량이 걸린다.
  else if (WORD_SPEC.max > 0 && (PASSAGE_WORDS < WORD_SPEC.min || PASSAGE_WORDS > WORD_SPEC.max))
    why(`지문이 ${PASSAGE_WORDS}어 — 규격 ${WORD_SPEC.min}~${WORD_SPEC.max}어 밖이라 인쇄할 수 없다`)
  // 유형별 추가 조건 — 없으면 문항이 성립하지 않는다.
  else if (TYPE === 'blank' && !passage.includes('____')) why('빈칸 유형인데 지문에 `____` 가 없다')
  else if (TYPE === 'summary' && !/\(A\)[\s\S]*\(B\)/.test(String(r.summary_sentence ?? '')))
    why('요약 유형인데 `(A)`·`(B)` 가 든 요약문이 없다')
  else if (TYPE === 'implication' && !passage.includes(String(r.underline ?? '\0')))
    why('함의 유형인데 밑줄 구절이 지문에 그대로 있지 않다')
  // ── 장문 묶음(43~45) ────────────────────────────────────────────────
  // 지문이 (A)(B)(C)(D) 네 문단이어야 순서 문항이 성립한다. 문단이 합쳐진 채 들어오면
  // "(B)-(D)-(C)" 를 물을 대상이 없다 — 적재는 되는데 학습자는 못 푸는 문항이 된다.
  else if (TYPE.startsWith('long_') && parasCount(passage) !== 4)
    why(`장문인데 문단이 ${parasCount(passage)}개 — 넷이어야 (A)(B)(C)(D) 가 선다`)
  // 순서 선택지는 **다섯이 같은 모양**이어야 한다. 정답만 토막 수가 다르면 그것만 보고 고른다.
  else if (TYPE === 'long_order' && choices.some((c) => (c.match(/\([B-D]\)/g) ?? []).length !== 3))
    why('순서 유형인데 (B)(C)(D) 세 토막이 아닌 선택지가 있다 — 형식이 단서가 된다')
  // 지칭 선택지는 지문에서 **그대로 따온 구절**이어야 학습자가 찾을 수 있다.
  else if (TYPE === 'long_reference' && choices.some((c) => !passage.includes(c)))
    why('지칭 유형인데 지문에 그대로 없는 구절이 있다 — 학습자가 찾을 수 없다')
  // 어휘 유형도 같은 이유로 구절이 지문에 그대로 있어야 한다 — 바꾼 낱말이 든 채로.
  else if (TYPE === 'long_vocab' && choices.some((c) => !passage.includes(c)))
    why('어휘 유형인데 지문에 그대로 없는 구절이 있다 — passage_edited 를 안 냈거나 구절을 다듬었다')
  // 바꾼 낱말이 정답 구절 안에 실제로 들어 있어야 한다. 없으면 무엇을 묻는지 알 수 없다.
  else if (TYPE === 'long_vocab' && !String(choices[answer - 1] ?? '').includes(String(r.swapped?.to ?? '\u0000')))
    why('어휘 유형인데 정답 구절에 바꾼 낱말이 없다')
  else {
    // 길이 단서 — 정답이 오답 평균보다 눈에 띄게 길면 읽지 않고도 풀린다.
    const others = choices.filter((_, i) => i !== answer - 1).map((c) => c.length)
    const avgOther = others.reduce((a, b) => a + b, 0) / others.length
    const ratio = choices[answer - 1].length / avgOther
    if (ratio > ANSWER_LEN_RATIO) {
      why(`정답이 오답 평균의 ${ratio.toFixed(2)}배 — 길이만 보고 풀린다`)
      continue
    }
    if (ratio < ANSWER_LEN_RATIO_MIN) {
      why(`정답이 오답 평균의 ${ratio.toFixed(2)}배로 짧다 — 짧은 것만 골라도 풀린다`)
      continue
    }
    ok.push({ ...r, choices, answer, passage })
  }
}
console.log(`  넣을 수 있는 것 ${ok.length} · **건너뛴 것 ${skipped.length}**`)
for (const [who, m] of skipped) console.log(`    · ${String(who).slice(0, 40)}: ${m}`)

// ── 배치 단위 길이 편향 ─────────────────────────────────────────────
// 문항마다 임계를 넘지 않아도 **한쪽으로 쏠려 있으면** 학습자는 그 규칙을 배운다.
// ⚠️ **양쪽을 다 본다.** 처음에는 "정답이 길다" 만 봤는데, 재작성 배치가 초안에서 정답이
//   **유일한 최단**이 된 문항을 스스로 잡아냈다. 짧은 쪽도 똑같이 단서다 — 학습자는
//   "가장 긴 것" 이든 "가장 짧은 것" 이든 규칙이 있으면 그것을 배운다.
if (ok.length >= 8) {
  const extreme = (pick) =>
    ok.filter((r) => {
      const lens = r.choices.map((c) => c.length)
      const target = pick(lens)
      // **유일해야** 단서가 된다 — 공동 최장/최단은 고르는 근거가 못 된다.
      return r.choices[r.answer - 1].length === target && lens.filter((v) => v === target).length === 1
    }).length
  const longest = extreme((l) => Math.max(...l))
  const shortest = extreme((l) => Math.min(...l))
  const show = (n, label) =>
    console.log(`  정답이 유일한 ${label} ${n}/${ok.length} = ${((100 * n) / ok.length).toFixed(1)}%  (우연이면 20%)`)
  show(longest, '최장')
  show(shortest, '최단')
  const worst = Math.max(longest, shortest) / ok.length
  if (worst > LONGEST_ANSWER_MAX) {
    console.log(
      `\n❌ **적재를 거부한다.** 길이 편향이 ${(100 * LONGEST_ANSWER_MAX).toFixed(0)}% 를 넘었다 —\n` +
        `   지문을 안 읽고 길이로 고르면 상당수가 맞는다. 문항이 아니라 길이 맞히기가 된다.\n` +
        `   선택지 길이를 고르게 다시 쓴 뒤 이 스크립트를 다시 돌린다.`,
    )
    process.exit(1)
  }
}

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
const ANSWER_POS_MAX = 0.4
if (ok.length >= 8) {
  const byPos = [1, 2, 3, 4, 5].map((p) => ok.filter((r) => r.answer === p).length)
  const worstPos = Math.max(...byPos) / ok.length
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

// ── 이미 있는 것 ────────────────────────────────────────────────────
const existing = new Set(
  (await fetchAllIn(db, 'csat_dcp_items', 'ref_id, type, kind', 'ref_id', ok.map((r) => r.article_id), ['ref_id']))
    .filter((r) => r.kind === 'article' && r.type === TYPE)
    .map((r) => r.ref_id),
)
const fresh = ok.filter((r) => !existing.has(r.article_id))
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
