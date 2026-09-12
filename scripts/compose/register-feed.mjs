// scripts/compose/register-feed.mjs
//
// ACP §20 — **피드 한 개를 검증하고 등록한다.**
//
// 왜 스크립트로 두는가: 사이클마다 후보 피드를 등록할 때 그때그때 일회용 코드를 썼는데,
// 그러면 화면(Admin ② 피드)이 하는 검증(robots · 실제 파싱 · 최신성)을 빠뜨리기 쉽다.
// 경로가 갈리면 **화면으로 등록한 피드와 배치로 등록한 피드의 신뢰도가 달라진다.**
// 여기서는 화면과 같은 `verifyFeedUrl` 을 쓴다.
//
// 새 피드는 **꺼진 채로** 들어간다 — 등록만으로 수집이 시작되지 않는다는 규칙 그대로다.
//   켤 때는 `--enable` 을 명시한다.
//
// 재실행 안전: url 유일키 upsert. 이미 있으면 라벨만 갱신하고 활성 상태는 건드리지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/compose/register-feed.mjs --source koreatimes \
//     --url https://feed.koreatimes.co.kr/k/lifestyle.xml --label '코리아타임스 라이프스타일' [--enable]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : null
}

const sourceKey = arg('source')
const url = arg('url')
const label = arg('label')
const enable = process.argv.includes('--enable')
if (!sourceKey || !url || !label) {
  console.error('사용법: --source <키> --url <주소> --label <이름> [--enable]')
  process.exit(2)
}

const { createClient } = await import('@supabase/supabase-js')
const { COMPOSE_USER_AGENT, CrawlGate, FACT_SOURCES, verifyFeedUrl } =
  await import('@vocaflow/library-pipeline')

const spec = FACT_SOURCES[sourceKey]
if (!spec) {
  console.error(`알 수 없는 소스 키: ${sourceKey}`)
  process.exit(2)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const deps = {
  async fetchText(u, headers) {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 15_000)
    try {
      const r = await fetch(u, {
        headers: { 'User-Agent': COMPOSE_USER_AGENT, ...headers },
        signal: c.signal,
        redirect: 'follow',
      })
      return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' }
    } catch {
      return { ok: false, status: 0, text: '' }
    } finally {
      clearTimeout(t)
    }
  },
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

// 화면과 같은 게이트를 쓴다 — robots 기본값이 "차단" 이라 손으로 만든 객체로는 대체할 수 없다.
const gate = new CrawlGate()
const result = await verifyFeedUrl(spec, url, gate, deps)
if ('fail' in result) {
  console.error(`검증 실패 — ${result.fail.reason}`)
  process.exit(1)
}

console.log(`검증 통과 · 항목 ${result.feed.itemCount ?? '?'} · ${url}`)

const { error } = await db.from('article_compose_feeds').upsert(
  { source_key: sourceKey, url, label, enabled: enable },
  { onConflict: 'url', ignoreDuplicates: false },
)
if (error) throw new Error('등록 실패: ' + error.message)

console.log(`등록 완료 — ${label} (${enable ? '켬' : '꺼진 채로 등록'})`)
