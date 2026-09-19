// scripts/audit/reader-articles.mts — READ ONLY.
// library_articles(발행분) 본문이 학습자에게 어떻게 보이는지 측정.
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/audit/reader-articles.mts

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(): { url: string; key: string } {
  const raw = readFileSync('apps/web/.env.local', 'utf8')
  const pick = (n: string): string => {
    const m = raw.match(new RegExp('^' + n + '\\s*=\\s*"?([^"\\r\\n]+)"?\\s*$', 'm'))
    if (!m) throw new Error('missing ' + n)
    return m[1]!.trim()
  }
  return { url: pick('NEXT_PUBLIC_SUPABASE_URL'), key: pick('SUPABASE_SERVICE_ROLE_KEY') }
}

async function retry<T>(fn: () => PromiseLike<T>, label: string, tries = 6): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fn()
      const err = (r as { error?: { message?: string } | null })?.error
      if (err && /fetch failed|network|ETIMEDOUT|ECONNRESET|socket/i.test(err.message ?? '')) throw new Error(err.message)
      return r
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 700 * (i + 1)))
    }
  }
  throw new Error(label + ': ' + String(last))
}

function countWords(c: string): number {
  return (c.match(/\b[a-zA-Z][a-zA-Z'-]*\b/g) ?? []).length
}

type Art = {
  id: string
  title: string
  content: string | null
  word_count: number | null
  source: string | null
  cefr_level: string | null
}

async function main(): Promise<void> {
  const { url, key } = loadEnv()
  const db = createClient(url, key, { auth: { persistSession: false } })

  const arts: Art[] = []
  for (let from = 0; ; from += 100) {
    const { data, error } = await retry(
      () =>
        db
          .from('library_articles')
          .select('id, title, content, word_count, source, cefr_level')
          .eq('status', 'published')
          .order('id')
          .range(from, from + 99),
      'articles',
    )
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Art[]
    arts.push(...rows)
    if (rows.length < 100) break
  }
  console.log(`발행 글 전수 ${arts.length}편 (표본 아님)\n`)

  // ── 학습자가 보는 것: texts.content 로 그대로 복사되어 Workspace 가 문단 분리해 렌더한다.
  //    paragraph_offsets 는 NULL 이라 buildParagraphsFromContent 의 개행 fallback 을 탄다.
  const byCat = new Map<string, { n: number; samples: string[]; sources: Map<string, number> }>()
  const hit = (cat: string, a: Art, detail: string): void => {
    const e = byCat.get(cat) ?? { n: 0, samples: [], sources: new Map() }
    e.n++
    e.sources.set(a.source ?? '?', (e.sources.get(a.source ?? '?') ?? 0) + 1)
    if (e.samples.length < 4) e.samples.push(`    "${a.title.slice(0, 46)}" (${a.source}) ${detail}`)
    byCat.set(cat, e)
  }

  // 글 끝에 붙은 사이트 부속물 (태그 나열 · 용어집 · 크레딧) — 본문이 아닌데 본문으로 읽힌다.
  const TAIL_BLOCKS: Array<[string, RegExp]> = [
    ['VOA 용어집 (Words in This Story)', /_{5,}\s*\n|Words in This Story/i],
    ['출처/저작권 크레딧', /\b(This (article|story) (was )?(first )?(originally )?(published|appeared)|Republished from|Creative Commons license|CC BY|Retrieved from)\b/i],
    ['뉴스레터·구독 권유', /\b(sign up for|subscribe to our|newsletter)\b/i],
    ['개인정보·쿠키 고지', /\b(privacy policy|cookie policy|terms of use)\b/i],
    ['카테고리/태그 나열', /\bcategories\s*:/i],
  ]

  let noTerminal = 0
  let noTerminalRealTrunc = 0
  const trailWords: Array<[string, string]> = []

  for (const a of arts) {
    const c = a.content
    if (!c) continue
    const t = c.replace(/\s+$/, '')

    // ① 끝이 문장 종결 부호가 아닌 글
    if (/[A-Za-z,;:]$/.test(t)) {
      noTerminal++
      // 마지막 줄이 짧은 목록/태그성인가(단어 6개 이하 · 마침표 없음) vs 문장 한복판인가
      const lastLine = t.split(/\n/).pop() ?? ''
      const isTagLine = countWords(lastLine) <= 8 && !/[.!?]/.test(lastLine)
      if (!isTagLine) {
        noTerminalRealTrunc++
        if (trailWords.length < 6) trailWords.push([a.title.slice(0, 46) + ' (' + a.source + ')', t.slice(-90)])
      } else {
        hit('끝에 태그/링크 줄', a, `→ ${JSON.stringify(lastLine.slice(-60))}`)
      }
    }

    for (const [name, re] of TAIL_BLOCKS) {
      const m = c.match(re)
      if (m) {
        const at = c.search(re)
        hit(name, a, `@${at}/${c.length} (${Math.round((100 * at) / c.length)}%) "${m[0].slice(0, 30).replace(/\n/g, '\\n')}"`)
      }
    }

    // ② 같은 문단/문장이 통째로 반복 (수집기 중복 append)
    const paras = c.split(/\n{2,}/).map((p) => p.trim()).filter((p) => countWords(p) >= 12)
    const seen = new Set<string>()
    let dup = 0
    for (const p of paras) {
      const k = p.slice(0, 120)
      if (seen.has(k)) dup++
      seen.add(k)
    }
    if (dup > 0) hit('문단 통째 중복', a, `중복 ${dup} / 문단 ${paras.length}`)

    // ③ 제목이 본문 첫 줄에 그대로 다시 (리더가 제목을 따로 그리므로 두 번 보인다)
    const firstLine = (c.split(/\n/)[0] ?? '').trim()
    if (firstLine && a.title && firstLine.toLowerCase() === a.title.trim().toLowerCase()) {
      hit('제목이 본문 첫 줄에 중복', a, '')
    }

    // ④ 문단 구조가 전혀 없다 — 개행 0 → Workspace 가 한 덩어리로 렌더
    if (!c.includes('\n')) hit('개행 0 (한 덩어리 렌더)', a, `${countWords(c)}단어`)

    // ⑤ 이미지 캡션/저작자 표기가 본문 첫머리에
    if (/^(image|photo|credit|source)\s*[:|]/i.test(c.trim())) hit('첫머리 이미지 크레딧', a, '')
  }

  console.log(`끝이 문장부호 아님            ${noTerminal}/${arts.length}`)
  console.log(`  └ 그중 태그줄 아닌 실제 중단 ${noTerminalRealTrunc}`)
  trailWords.forEach(([t, s]) => console.log(`    "${t}" …${JSON.stringify(s)}`))
  console.log('')
  for (const [cat, e] of [...byCat.entries()].sort((a, b) => b[1].n - a[1].n)) {
    const src = [...e.sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s, n]) => `${s}:${n}`).join(' ')
    console.log(`${cat}  ${e.n}/${arts.length}   [${src}]`)
    e.samples.forEach((s) => console.log(s))
  }

  // ⑥ 소스별 발행 편수 (누가 얼마나 학습자에게 닿는지)
  const bySrc = new Map<string, number>()
  for (const a of arts) bySrc.set(a.source ?? '?', (bySrc.get(a.source ?? '?') ?? 0) + 1)
  console.log('\n소스별 발행 편수: ' + [...bySrc.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(' · '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
