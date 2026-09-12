// scripts/textbook/word-check.mjs
//
// **쓰기 전에 낱말을 확인한다** — 교육과정 등급 · 음절 · V-Level 을 한 번에.
//
// ── 왜 (실측 2026-09-06) ─────────────────────────────────────────────
// 개정 세 사이클의 병목은 지렛대가 아니라 **왕복**이었다. 낱말을 짐작으로 골라 쓰고,
// 자로 재고, 틀린 것을 알고, 다시 고친다. 그래서 배치 하나(5편)에 2~4 패스가 들었다.
//
// 실제로 이렇게 틀렸다:
//   `desert`×6 · `textbooks`×6 을 "소재어니까 밖이겠지" 하고 되풀이 → **둘 다 안**이라
//   값이 21.0 → 23.2 밖에 안 올랐다. `Mojave` 로 바꾸자 23.2 → 39.6.
//
// **짐작을 확인으로 바꾸면 왕복이 사라진다.** 쓰기 전에 후보 낱말을 여기 넣어 본다.
//
// ── 세 열을 함께 보는 이유 ───────────────────────────────────────────
// 하나만 보면 다른 축이 깨진다(실측):
//   · 등급   `밖`이어야 시중 자리가 오른다
//   · 음절   3~4음절 라틴계는 **FK 를 민다** — geometry·alignment 로 자리 65.1 을 냈더니
//            FK 가 9.28 로 튀어 밴드가 초6~중1 → 중3 이 되었다
//   · V-Level 높은 것을 여러 종 넣으면 **p75 가 위 계단으로 튄다**(한 편이 V3→V5)
//
// 고유명사는 원문 목록에 없으므로 **언제나 밖**이다. 짧은 이름(York·Kate·Mojave)이
// 세 축을 동시에 만족하는 이유다 — 시중 초3~4 지문이 실제로 그렇게 쓴다
// ("In New York … George Crum" · 밖 38.6%).
//
// 재실행 안전: 읽기만 한다. DB 는 shared_dictionary 조회만.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/word-check.mjs moisture cavity desert textbooks hare
//   pnpm dlx tsx scripts/textbook/word-check.mjs --file <어떤 텍스트 파일>   # 그 글의 안 낱말을 전부

import fs from 'node:fs'

import { loadEnv, fetchAllIn } from './volume-pool.mjs'
loadEnv()

const args = process.argv.slice(2)
const fileIdx = args.indexOf('--file')
const file = fileIdx >= 0 ? args[fileIdx + 1] : null
// ⚠️ `fileIdx` 가 -1 일 때 `i !== fileIdx + 1` 은 `i !== 0` 이 되어 **첫 낱말을 삼킨다**.
//   실제로 그랬다 — `desert` 를 넣었는데 결과에 없었다. 없을 때는 거르지 않는다.
const words = args.filter((a, i) => !a.startsWith('--') && (fileIdx < 0 || i !== fileIdx + 1))

const { classifyCurriculumWords } =
  await import('../../packages/library-pipeline/src/textbook/curriculum.ts')
const { syllables } = await import('../textbook-corpus/analyze.mjs')

/** 검사할 낱말. `--file` 이면 그 글의 **교육과정 안 내용어**(= 바꿀 후보)를 뽑는다. */
let targets = words
if (file) {
  const text = fs.readFileSync(file, 'utf8')
  const inside = new Map()
  for (const w of classifyCurriculumWords(text)) {
    if (w.tier !== 'outside') inside.set(w.word, (inside.get(w.word) ?? 0) + 1)
  }
  targets = [...inside.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w)
}
if (!targets.length) {
  console.log('낱말을 주거나 --file 을 쓴다.')
  process.exit(0)
}

// V-Level 은 사전에서 온다. 없으면 없다고 말한다 — 모름을 0 으로 바꾸지 않는다.
const { createScriptClient } = await import('../lib/supabase-client.mjs')
const db = createScriptClient({ quiet: true })
const lv = new Map()
for (const d of await fetchAllIn(
  db,
  'shared_dictionary',
  'word, v_level',
  'word',
  targets.map((w) => w.toLowerCase()),
  ['word']
)) {
  if (d.v_level != null) lv.set(d.word, Number(d.v_level))
}

const pad = (s, n) => String(s).padEnd(n)
const lp = (s, n) => String(s).padStart(n)
const TIER_LABEL = {
  outside: '밖  ✓ 값을 올린다',
  star1: '안(초등 별표)',
  star2: '안(중등 별표)',
  plain: '안(3,000 안)',
}

console.log(pad('낱말', 20) + lp('음절', 5) + lp('V', 4) + '  등급')
console.log('─'.repeat(56))
let out = 0
for (const w of targets) {
  // 한 낱말만 넣어도 같은 토큰화·같은 어간 되돌리기를 탄다 — 자가 갈리면 표시를 못 믿는다.
  const c = classifyCurriculumWords(w)
  const tier = c[0]?.tier ?? null
  if (tier === 'outside') out++
  const syl = syllables(w.toLowerCase())
  console.log(
    pad(w, 20) +
      lp(syl, 5) +
      lp(lv.get(w.toLowerCase()) ?? '—', 4) +
      '  ' +
      (tier == null ? '기능어 — 분모 밖이라 바꿔도 값이 안 움직인다' : TIER_LABEL[tier])
  )
}
console.log(
  `\n밖 ${out}/${targets.length}. ` +
    '⚠️ **음절 3 이상은 FK 를 민다** — 밴드를 지키려면 짧은 것을 고른다. ' +
    'V 가 높은 것을 여러 **종** 넣으면 p75 가 튄다(되풀이는 안 튄다).'
)
