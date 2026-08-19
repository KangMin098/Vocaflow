// scripts/compose/section-probe.mjs
//
// ACP §20 — **실제 섹션 페이지에서 기사가 잡히는지 눈으로 본다.**
//
// 단위 테스트는 우리가 상상한 HTML 만 검증한다. 발행사가 실제로 쓰는 마크업과 어긋나 있어도
// 초록불이 뜬다 — 이 세션에서 두 번 겪었다(중복 피드를 "발견" 이라 보고 · 추출이 관련기사를
// 본문으로 걷음). 등록하기 전에 실물로 세어 본다.
//
// ⚠️ 발행사 서버에 요청이 나간다. 목록 페이지만 읽고 본문은 읽지 않는다.
//
// 실행: pnpm dlx tsx scripts/compose/section-probe.mjs <섹션주소> [<섹션주소> ...]

const urls = process.argv.slice(2).filter((a) => a.startsWith('http'))
if (!urls.length) {
  console.error('사용법: section-probe.mjs <섹션주소> [...]')
  process.exit(2)
}

const { COMPOSE_USER_AGENT, classifyTopic, inspectSectionPage, parseSectionPage } = await import(
  '@vocaflow/library-pipeline'
)

for (const url of urls) {
  let res
  try {
    res = await fetch(url, { headers: { 'User-Agent': COMPOSE_USER_AGENT }, redirect: 'follow' })
  } catch (e) {
    console.log(`\n■ ${url}\n  요청 실패: ${e.name}`)
    continue
  }
  if (!res.ok) {
    console.log(`\n■ ${url}\n  열지 못했다 (${res.status})`)
    continue
  }
  const html = await res.text()
  const check = inspectSectionPage(html, url)
  const items = parseSectionPage(html, url)
  const fit = items.filter((i) => classifyTopic(i.title) === 'fit').length
  const unfit = items.filter((i) => classifyTopic(i.title) === 'unfit').length
  const n = items.length || 1
  console.log(`\n■ ${url}`)
  console.log(
    check.ok
      ? `  기사 ${items.length} · 적합 ${((100 * fit) / n).toFixed(0)}% · 부적합 ${((100 * unfit) / n).toFixed(0)}%`
      : `  쓸 수 없다 — ${check.reason}`,
  )
  for (const i of items.slice(0, 4)) {
    const c = classifyTopic(i.title)
    console.log(`   ${c === 'fit' ? '★' : c === 'unfit' ? '✗' : '·'} ${i.title.slice(0, 70)}`)
  }
}
