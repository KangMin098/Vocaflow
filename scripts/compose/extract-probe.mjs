// scripts/compose/extract-probe.mjs
//
// ACP §20 — **본문 추출이 실제 기사에서 무엇을 걷는지 눈으로 본다.**
//
// 왜 필요한가 (2026-08-19): 취재 중에 코리아헤럴드 기사 하나에서 45문장이 나왔는데
// **25문장이 본문이 아니었다**(관련 기사 제목·반응 카운터·다른 헤드라인). 단위 테스트는
// 우리가 상상한 꼬리만 검증하므로, 발행사가 실제로 붙이는 것과 어긋나 있어도 초록불이 뜬다.
// 고쳤다고 말하려면 실제 기사로 세어 봐야 한다.
//
// ⚠️ 발행사 서버에 요청이 나간다. 본문은 화면에만 쓰고 저장하지 않는다.
//
// 실행: pnpm dlx tsx scripts/compose/extract-probe.mjs <기사주소> [<기사주소> ...]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const urls = process.argv.slice(2).filter((a) => a.startsWith('http'))
if (!urls.length) {
  console.error('사용법: extract-probe.mjs <기사주소> [<기사주소> ...]')
  process.exit(2)
}

const { COMPOSE_USER_AGENT, extractArticle, splitSentences } = await import(
  '@vocaflow/library-pipeline'
)

for (const url of urls) {
  const res = await fetch(url, { headers: { 'User-Agent': COMPOSE_USER_AGENT }, redirect: 'follow' })
  if (!res.ok) {
    console.log(`\n■ ${url}\n  열지 못했다 (${res.status})`)
    continue
  }
  const html = await res.text()
  const got = extractArticle(html)
  const kept = got.sentences ?? splitSentences(got.text)
  console.log(`\n■ ${url}`)
  console.log(`  경로 ${got.via} · 남긴 문장 ${kept.length} · ${got.text.split(/\s+/).length}어`)
  console.log('  ── 남긴 것의 처음과 끝 ─────────────')
  for (const s of kept.slice(0, 2)) console.log(`   + ${s.slice(0, 88)}`)
  if (kept.length > 4) console.log('     …')
  for (const s of kept.slice(-2)) console.log(`   + ${s.slice(0, 88)}`)
}

console.log('\n마지막 줄이 기사 본문인지 눈으로 확인할 것 — 다른 기사 제목이면 아직 새고 있다.')
