// scripts/textbook/build-volume.mjs
//
// **한 권을 조합해 콘솔에 요약한다.** 책 자체가 필요하면 `render-volume.mjs` 를 쓴다.
//
// ── 이 파일이 왜 이렇게 얇은가 (실측 2026-08-31) ──────────────────────
// 이 스크립트는 원래 자기 풀을 직접 만들었고, 그 사본이 **order·insert 두 유형만**
// 알고 있었다. 나머지 유형은 지문이 `payload.passage`(생성형) · `payload.sentences`
// (어법·어휘 선택형) · `payload.context`(단문 드릴)에 있는데 사본은 `presented`/
// `remaining` 만 읽어, 낱말 수가 0 으로 잡히고 **전부 "짧음" 으로 버려졌다.**
//
//   구판 이 파일   원글 190편 · 문항 풀 11,361 · 인쇄 80문항 (order/insert 뿐)
//   정본 loadVolume 원글 3,443편 · 문항 풀 109,135 · 인쇄 120문항 (12유형)
//
// 어느 지표도 깨지지 않았다 — 자동 검수는 9/9 로 통과했고 단원도 20개가 나왔다.
// 그래서 이 값을 근거로 "재료가 모자라다 · 발행이 병목이다" 라는 **틀린 진단이 나왔다.**
//
// `volume-drift.test.ts` 가 정확히 이 드리프트를 막으려고 있었는데, 감시 목록
// `VOLUME_SCRIPTS` 에 이 파일만 빠져 있었다. 목록도 같이 고쳤다 —
// **가드는 목록이 빠지면 조용히 통과한다.**
//
// 재실행 안전: 읽기만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/build-volume.mjs --band 6
//   pnpm dlx tsx scripts/textbook/build-volume.mjs --band 6 --units 20

import { loadEnv, loadVolume } from './volume-pool.mjs'

loadEnv()

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = Number(arg('band') ?? 6)
const UNITS = Number(arg('units') ?? 20)

const { createClient } = await import('@supabase/supabase-js')
const { scoreVolume, rungMix, typeMixFit } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// **풀을 다시 만들지 않는다.** 조판(`render-volume.mjs`)·해설 드레인과 같은 한 벌을 쓴다.
const { units, stoppedBecause, rejected, pool, articles, mix } = await loadVolume(db, {
  band: BAND,
  unitCount: UNITS,
  // 재고가 큰 밴드는 전부 받으면 statement timeout 이 난다(V6 원글 11,831편 · 문항 228,832건).
  // 한 권은 서로 다른 글 120편이면 되므로 고르게 흩어 자를 수 있다 — 기본은 무제한이다.
  maxArticles: arg('articles') ? Number(arg('articles')) : null,
})

console.log(`V${BAND} — 원글 ${articles.size}편 · 문항 풀 ${pool.length}`)
if (rejected) {
  console.log(
    `거른 문항: 짧음 ${rejected.tooShort} · 김 ${rejected.tooLong} · 수능형식불가 ${rejected.wrongFormat} · 인용잔해 ${rejected.residue}`,
  )
}
console.log(`\n**조합된 단원 ${units.length} / 목표 ${UNITS}**`)
if (stoppedBecause) console.log(`  ${stoppedBecause}`)

if (units.length) {
  // 유형은 권마다 다르다 — 열을 고정하면 새 유형이 또 조용히 안 보인다.
  const types = [...new Set(units.flatMap((u) => u.items.map((i) => i.type)))].sort()
  console.log(`\n${['#', '분', ...types.map((t) => t.slice(0, 8)), '어휘', '출처(글)'].join('  ')}`)
  for (const u of units) {
    console.log(
      [
        String(u.no).padStart(2),
        String(u.estimated_minutes).padStart(3),
        ...types.map((t) =>
          String(u.items.filter((i) => i.type === t).length).padStart(Math.min(8, t.length)),
        ),
        String(u.vocabulary.length).padStart(4),
        u.sources.map((s) => s.slice(0, 14)).join(' · ').slice(0, 60),
      ].join('  '),
    )
  }

  const byType = {}
  for (const u of units) for (const i of u.items) byType[i.type] = (byType[i.type] ?? 0) + 1
  const total = Object.values(byType).reduce((a, b) => a + b, 0)
  console.log(
    `\n유형 구성 (${total}문항): ` +
      Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `${t} ${n}`)
        .join(' · '),
  )
  // 시장 밀도와의 거리. ⚠️ **분모를 시장 전체로 둔다** — `mix.targetShare` 는 "우리가 가진
  //   유형" 안에서 재정규화된 목표라, 재고가 0 인 유형이 많을수록 적합도가 후하게 나온다
  //   (`render-volume.mjs` 의 같은 자리 주석 참조: V1 이 초등 3유형 0개인데 100.0% 였다).
  //   계산은 라이브러리 함수를 그대로 부른다 — 사본을 두면 이 파일이 또 드리프트한다.
  if (mix) {
    const actual = {}
    for (const u of units) for (const it of u.items) actual[it.type] = (actual[it.type] ?? 0) + 1
    const marketTarget = rungMix(BAND).targetShare
    const closed = Object.keys(marketTarget).filter((t) => !pool.some((it) => it.type === t))
    console.log(
      `시장 유형 적합도 ${(100 * typeMixFit(actual, mix.targetShare)).toFixed(1)}% (가진 유형 안에서) · ` +
        `**시장 전체 기준 ${(100 * typeMixFit(actual, marketTarget)).toFixed(1)}%**` +
        (closed.length ? ` — 재고 0 인 유형 ${closed.length}종: ${closed.join(', ')}` : ''),
    )
  }
}

// ── 3관점 채점 ──────────────────────────────────────────────────────
if (units.length) {
  const sc = scoreVolume(units)
  console.log(`
${'─'.repeat(74)}
채점 — 자동 ${sc.auto.filter((c) => c.pass).length}/${sc.auto.length} 통과
`)
  for (const a of ['learner', 'teacher', 'parent']) {
    const label = { learner: '학습자', teacher: '교사', parent: '학부모' }[a]
    for (const c of sc.auto.filter((x) => x.audience === a)) {
      console.log(`  ${c.pass ? '✅' : '❌'} [${label}] ${c.label.padEnd(30)} ${c.detail}`)
    }
  }
  console.log('\n사람이 봐야 하는 것 (점수 없음):')
  for (const h of sc.human) {
    const label = { learner: '학습자', teacher: '교사', parent: '학부모' }[h.audience]
    console.log(`  ? [${label}] ${h.label} — ${h.question}`)
  }
}

console.log('\n문항을 펼쳐 보려면 조판을 쓴다: render-volume.mjs --band N --out volume.html')
