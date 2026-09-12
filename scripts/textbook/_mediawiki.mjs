// scripts/textbook/_mediawiki.mjs
//
// **MediaWiki 표집·도입부 추출 — 프로브와 적재기가 함께 쓴다.**
//
// ── 왜 따로 빼는가 ───────────────────────────────────────────────────
// 이 두 함수는 `kid-source-probe.mjs` 안에 있었고, 거기서 **두 소스**가 쓴다
// (`simple_wikipedia_lead` 284,760 · `vikidia_en` 6,099 — 조사에서 가장 큰 두 풀).
// 적재기가 같은 일을 다시 쓰면 **프로브가 잰 것과 적재기가 넣는 것이 갈린다** —
// "50% 가 초등 창에 든다" 고 재 놓고 다른 방법으로 가져오면 그 수치는 근거가 아니다.
// 그래서 한 벌로 두고 양쪽이 부른다.
//
// ── 여기 담긴 실측 ───────────────────────────────────────────────────
// · `rnlimit` 상한은 50 이다. `--sample 100` 을 줘도 50건만 오므로 채울 때까지 여러 번 부른다.
// · 무작위 표집은 같은 항목을 다시 준다 — 제목으로 거른다.
// · 429 는 250ms 간격으로 두드리면 16번째부터 온다. 물러서는 것이 예의이자 정확도다.
// · Node(undici) connectTimeout 기본값이 10초이고 **AbortController 로는 못 늘린다** —
//   `timeout` 을 180초로 줘도 연결은 10초에 끊긴다. 그래서 재시도로 넘긴다.

const DEFAULT_UA =
  'Vocaflow-SourceProbe/1.0 (+https://vocaflow.app; educational corpus research; contact killerapp51@empal.com)'

/** 표집·추출이 함께 쓰는 GET. 429·연결 타임아웃만 물러섰다 다시 친다. */
export async function mediawikiGet(
  url,
  { json = false, timeout = 30_000, retry = 2, ua = DEFAULT_UA } = {},
) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeout)
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': ua, accept: json ? 'application/json' : '*/*' },
      signal: ac.signal,
    })
    const body = await res.text()
    if (res.status === 429 && retry > 0) {
      await new Promise((r) => setTimeout(r, 3_000))
      return mediawikiGet(url, { json, timeout, retry: retry - 1, ua })
    }
    if (!res.ok) return { ok: false, status: res.status, body }
    return { ok: true, status: res.status, body, data: json ? JSON.parse(body) : null }
  } catch (e) {
    const cause = String(e.cause?.message ?? '')
    if (/Connect Timeout/i.test(cause) && retry > 0) {
      await new Promise((r) => setTimeout(r, 2_000))
      return mediawikiGet(url, { json, timeout, retry: retry - 1, ua })
    }
    return { ok: false, status: 0, error: `${e.message ?? e}${cause ? ` (${cause})` : ''}`, body: '' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * MediaWiki 무작위 표집 — **`rnlimit` 상한(50)을 넘겨 모은다.**
 *
 * 표본 수가 요청보다 적으면 같이 적은 오차 폭이 거짓이 되므로 채울 때까지 여러 번 부른다.
 * 전체 규모는 짐작하지 않는다 — `siteinfo` 가 스스로 말한다.
 */
export async function mediawikiRandom(api, n, opts = {}) {
  const seen = new Set()
  const items = []
  let total = null
  for (let round = 0; items.length < n && round < 12; round++) {
    const r = await mediawikiGet(
      `${api}?action=query&list=random&rnnamespace=0&rnlimit=${Math.min(n, 50)}` +
        `&meta=siteinfo&siprop=statistics&format=json`,
      { json: true, ...opts },
    )
    if (!r.ok) {
      if (items.length) break
      return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}`, items: [] }
    }
    total ??= r.data?.query?.statistics?.articles ?? null
    for (const p of r.data?.query?.random ?? []) {
      if (seen.has(p.title)) continue
      seen.add(p.title)
      items.push({ id: p.title, title: p.title })
    }
    await new Promise((z) => setTimeout(z, 400))
  }
  return { total, items: items.slice(0, n) }
}

/**
 * 제목 순 표집 — **`apminsize` 로 토막글을 표집 단계에서 잘라낸다.**
 *
 * `list=random` 은 토막글을 그대로 준다: 2026-09-05 실측에서 무작위 150건 중 **81건이
 * 전체 100어 미만**이었다. 받아 놓고 버리면 왕복만 낭비다. `list=allpages` 는
 * 바이트 하한을 서버 쪽에서 걸 수 있어 **못 쓸 것을 애초에 안 받는다.**
 *
 * 다만 제목 순이라 그대로 쓰면 늘 'A…' 만 온다. 그래서 시작 글자를 무작위로 고른다 —
 * 완전한 균등 표집은 아니지만(제목 분포가 균등하지 않다) 같은 것만 반복해 받지는 않는다.
 *
 * @param minSize 바이트 하한. 2,000B ≈ 300어 언저리다(평문 기준, 마크업 포함이라 넉넉히 잡는다).
 */
export async function mediawikiAllpages(api, n, { minSize = 2000, from = null, ...opts } = {}) {
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
  const seen = new Set()
  const items = []
  let total = null
  for (let round = 0; items.length < n && round < 12; round++) {
    const start = from ?? ALPHABET[Math.floor(Math.random() * ALPHABET.length)].toUpperCase()
    const r = await mediawikiGet(
      `${api}?action=query&list=allpages&apnamespace=0&apfilterredir=nonredirects` +
        `&apminsize=${minSize}&aplimit=${Math.min(n, 50)}&apfrom=${encodeURIComponent(start)}` +
        `&meta=siteinfo&siprop=statistics&format=json`,
      { json: true, ...opts },
    )
    if (!r.ok) {
      if (items.length) break
      return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}`, items: [] }
    }
    total ??= r.data?.query?.statistics?.articles ?? null
    for (const p of r.data?.query?.allpages ?? []) {
      if (seen.has(p.title)) continue
      seen.add(p.title)
      items.push({ id: p.title, title: p.title })
    }
    await new Promise((z) => setTimeout(z, 400))
  }
  return { total, items: items.slice(0, n) }
}

/**
 * 평문 추출 질의 URL — **`exsectionformat=plain` 이 여기 있어야 하는 이유.**
 *
 * ⚠️ 이 파라미터가 **여기만 빠져 있었다.** 정규 ingester
 * (`packages/library-pipeline/src/ingest-article/_mediawiki.ts`)는
 * `prop=extracts|info&explaintext=1&exsectionformat=plain&inprop=url` 로 부르는데
 * 이 수확기는 `explaintext=1` 까지만 줬다. `exsectionformat` 의 MediaWiki **기본값은
 * `wiki`** 라, 같은 API·같은 위키인데 이쪽으로만 `== Plot ==` 이 그대로 딸려 왔다.
 *
 * 실측(2026-09-06, 위키 계열 199편 전수): `== X ==` 가 든 글이
 * wikipedia 0편 · wikivoyage 0편 · **simple_wikipedia 35편/74개**.
 * 74개를 전수 확인하니 **전부 절 표제**다(References 16 · Other websites 4 · History 3 ·
 * Track listing 2 · Body 2 · Home 2 · Career 2 · Plot · Programs · Cast …) — 수식·코드 오탐 0.
 * 즉 이 구멍은 "정규 경로가 못 거른 마크업" 이 아니라 **이 경로만 다르게 물어본 결과**다.
 *
 * ⚠️ 그래서 고치는 자리는 **질의**이지 본문이 아니다. 받아 놓고 `==` 를 지우는 규칙은
 * 넣지 않는다 — 같은 규칙을 다른 원천에 걸면 오탐이 난다(plos 250편 표본에서
 * `gene_biotype == 'snoRNA'` 같은 비교 연산자가 1건 걸렸다).
 */
export function mediawikiExtractUrl(api, title, { intro = true } = {}) {
  return (
    `${api}?action=query&prop=extracts&explaintext=1&exsectionformat=plain` +
    `${intro ? '&exintro=1' : ''}` +
    `&titles=${encodeURIComponent(title)}&format=json`
  )
}

/**
 * 추출 본문의 공백 정규화 — **줄바꿈은 살리고 가로 공백만 접는다.**
 *
 * ⚠️ 예전에는 `replace(/\s+/g, ' ')` 였다. 줄바꿈까지 공백으로 뭉개면 **문단 경계가 사라지고,
 * 절 표제가 앞 문장 뒤에 그냥 이어 붙는다** — `…lives in Ohio. Plot The film opens…` 처럼.
 * `exsectionformat=plain` 을 줘도 표제 자체는 **자기 줄에 남아서** 온다(`==` 만 사라진다).
 * 그러니 표제를 문장으로 오독하지 않게 하는 것은 개행이다.
 *
 * 규모: 위키 3원천(wikipedia 92 · simple_wikipedia 99 · wikivoyage 8)에 그런 자리가
 * **941군데**다. 그리고 simple_wikipedia 99편 중 **59편(59.6%)은 줄바꿈이 아예 없다** —
 * 이 함수가 뭉갠 결과가 그대로 DB 에 남은 것이다(이번 변경은 수확기만이다. 이미 저장된
 * 행은 건드리지 않는다).
 *
 * 접는 것: 가로 공백(스페이스·탭·NBSP 등)·줄 끝 공백·CRLF·빈 줄 3연속 이상.
 * 남기는 것: 문단 경계 한 칸(`\n\n`)과 줄 경계(`\n`).
 */
export function normalizeExtract(raw) {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n') // CRLF·CR → LF
    .replace(/[^\S\n]+/g, ' ') // 가로 공백만 접는다 — `\s` 를 쓰면 개행이 같이 죽는다
    .replace(/ *\n */g, '\n') // 줄 앞뒤에 남은 공백 제거
    .replace(/\n{3,}/g, '\n\n') // 빈 줄은 최대 하나 — 문단 경계로 충분하다
    .trim()
}

/** 낱말 수. `\s` 로 갈라도 개행은 낱말을 만들지 않으므로 정규화 전후 값이 같다. */
export const countWords = (s) => String(s ?? '').split(/\s+/).filter(Boolean).length

/**
 * 긴 글을 **앞에서 문장 단위로** 끊어 어수 창에 넣는다.
 *
 * 백과 도입부는 첫 문장이 정의라 앞을 남기는 편이 자립적이다(`standaloneFit` 이 그것을 본다).
 * 창에 못 들면 `null` — 억지로 넣지 않는다. 한 문장이 이미 창을 넘으면 그 글은 이 창의 글이 아니다.
 *
 * ⚠️ **문장 사이의 공백을 그대로 들고 간다.** 예전에는 `split(/(?<=[.!?])\s+/)` 로 갈라
 * `' '` 로 다시 이었는데, 그러면 `normalizeExtract` 가 살려 둔 문단 경계가 **여기서 다시
 * 뭉개진다.** 적재되는 글의 대부분이 이 자르기를 거치므로(전문을 받아 창만큼 뗀다),
 * 이 줄을 안 고치면 위쪽 수정이 사실상 무효가 된다.
 *
 * 이 함수가 수확기 쪽에 있는 이유: 개행 규약을 만든 쪽이 그 규약을 읽는 법도 함께 준다.
 * 규약과 소비자가 다른 파일에 있으면 한쪽만 바뀌어도 조용히 어긋난다.
 */
export function trimToWindow(text, min, max) {
  // 캡처 그룹을 두면 `split` 이 구분자(문장 사이 공백)도 배열에 넣는다 →
  // [문장0, 공백0, 문장1, 공백1, …]. `filter(Boolean)` 을 걸면 짝이 깨지므로 걸지 않는다.
  const parts = String(text ?? '').split(/(?<=[.!?])(\s+)/)
  let out = ''
  for (let i = 0; i < parts.length; i += 2) {
    const s = parts[i]
    if (!s) continue
    const gap = i === 0 ? '' : (parts[i - 1] ?? ' ')
    const next = out ? `${out}${gap}${s}` : s
    if (countWords(next) > max) break
    out = next
    // 최소치를 넘겼으면 거기서 멈춘다 — 길수록 좋은 것이 아니라 창 안이면 된다.
    if (countWords(out) >= min) return out.trim()
  }
  return null
}

/**
 * MediaWiki 평문 추출.
 *
 * `intro: true`(기본)면 도입부(`exintro`)만, `false` 면 본문 전체를 준다.
 *
 * ⚠️ **도입부만으로는 교재 지문 창(100~200어)을 못 채운다.** 2026-09-05 실측 n=100:
 * 도입부의 **65건이 100어 미만**이었다(길어서 걸린 것은 0건). 백과 도입부는 대개
 * 한두 문장이다. 그래서 창을 채우려면 본문 앞부분까지 이어 받아야 한다 —
 * 자르기로는 못 푼다. **없는 문장을 만들 수는 없다.**
 */
export async function mediawikiLead(api, title, { intro = true, ...opts } = {}) {
  const r = await mediawikiGet(mediawikiExtractUrl(api, title, { intro }), { json: true, ...opts })
  if (!r.ok) return { error: r.error ? `연결 실패 — ${r.error}` : `HTTP ${r.status}` }
  const pages = r.data?.query?.pages ?? {}
  const page = Object.values(pages)[0]
  return {
    body: normalizeExtract(page?.extract),
    pageid: page?.pageid ?? null,
  }
}
