// apps/web/src/lib/seo/og-font.ts
//
// OG 이미지용 한글 폰트 — **필요한 글자만** 서브셋으로 받아 온다.
//
// 왜 필요한가 (2026-08-17 실측):
//   `next/og`(Satori)의 기본 폰트는 **라틴 전용**이다. 한국어가 대부분인 카드를 그리면
//   글자가 빈칸·두부로 나온다 — 타입체크로도 빌드로도 안 잡히고, 실제 미리보기에서만 드러난다.
//   게다가 Windows 개발 환경에서는 기본 폰트 경로 해석이 깨져(`ERR_INVALID_URL`) 500 이 난다.
//   폰트를 **명시 주입**하면 두 문제가 한 번에 사라진다(기본 폰트를 아예 안 건드리게 된다).
//
// 왜 저장소에 폰트를 넣지 않나:
//   한글 폰트는 서브셋 없이 1~5 MB 다. 반면 OG 카드에 쓰이는 글자는 **뻔하고 짧다**
//   (학년 이름 8종 · 판정 문구 몇 개 · 숫자). Google Fonts 의 `text=` 서브셋은 그 글자들만
//   담은 woff2 를 돌려주므로 보통 수 KB 다. 저장소에 메가바이트를 넣을 이유가 없다.
//
// ── 왜 **한글만** 받나 (2026-08-26 실측) ────────────────────────────
//   서브셋 요청에 `Vocaflow`·숫자 같은 라틴이 섞여 있었다. 그래서 이 폰트가 라틴 글리프를
//   **일부만** 갖게 됐고, Satori 는 가진 글자는 이 폰트로, 없는 글자는 기본 폰트로 그렸다.
//   결과가 `A Chr**ist**mas Carol` — 한 단어 안에서 굵기가 갈린다.
//   (`Pr**agu**e` 로 한 번 겪고 "한글 있을 때만 싣기" 로 막았는데, 한글 배지가 하나라도
//    들어가면 다시 실리므로 그 방어는 반쪽이었다.)
//
//   두 폰트의 **글자 범위를 겹치지 않게** 만들면 섞일 수가 없다. 그래서 한글만 받는다 —
//   라틴·숫자·기호는 전부 Satori 기본 폰트가 그린다.
//
// ── 왜 글자 목록을 손으로 안 들고 있나 ─────────────────────────────
//   전에는 `SUBSET_TEXT` 상수에 나올 법한 문구를 적어 뒀다. **빠진 글자는 렌더되지 않고
//   조용히 사라진다** — 문구를 바꾸면서 목록 갱신을 잊으면 카드에 구멍이 난다.
//   지금은 호출부가 **그 카드에 실제로 들어가는 글자**를 넘긴다. 잊을 것이 없다.
//
// 실패해도 이미지는 나와야 한다 — 미리보기가 깨진 링크는 아무도 누르지 않는다.
//   폰트를 못 받으면 `null` 을 돌려주고, 호출부는 폰트 없이 렌더한다(라틴·숫자는 그대로 나온다).



/**
 * 프로세스 캐시 — OG 는 크롤러가 몰아서 치므로 매번 받지 않는다.
 * 글자 집합마다 다른 폰트이므로 그것을 키로 쓴다. 카드의 한글은 대부분 고정 문구라
 * 실제 키 종류는 몇 개뿐이지만, 콘텐츠 제목에 한글이 섞이면 늘 수 있어 상한을 둔다.
 */
const cache = new Map<string, ArrayBuffer | null>()
const CACHE_MAX = 32

/** Google Fonts CSS 에서 woff2(또는 ttf) URL 하나를 뽑는다. */
function firstFontUrl(css: string): string | null {
  const m = /src:\s*url\((https:\/\/[^)]+)\)/.exec(css)
  return m?.[1] ?? null
}

/** 이 문자열에서 한글만 골라 정렬·중복 제거 — 서브셋 요청 키이자 내용이다. */
export function hangulSubset(text: string): string {
  return [...new Set(text.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g) ?? [])].sort().join('')
}

/**
 * 한글 서브셋 폰트를 얻는다. 실패는 `null` — 호출부가 폰트 없이 진행한다.
 *
 * 첫 실패도 캐시한다(`null` 로) — 크롤러가 몰아칠 때 매번 외부 요청을 재시도하면
 * 이미지 응답이 통째로 느려진다. 프로세스가 다시 뜨면 다시 시도한다.
 */
export async function loadKoreanOgFont(text: string): Promise<ArrayBuffer | null> {
  const chars = hangulSubset(text)
  // 한글이 없으면 이 폰트를 실을 이유가 없다 — 실으면 라틴이 섞인다.
  if (!chars) return null
  const hit = cache.get(chars)
  if (hit !== undefined) return hit

  try {
    const cssUrl =
      'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700' +
      `&text=${encodeURIComponent(chars)}`

    // woff2 대신 ttf 를 받으려면 구형 UA 가 필요하다 — Satori 는 ttf/otf/woff 를 읽고
    // **woff2 는 못 읽는다.** UA 를 안 보내면 woff2 가 와서 렌더가 조용히 실패한다.
    const cssRes = await fetch(cssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0' },
      // 폰트는 거의 안 바뀐다 — 하루 캐시.
      next: { revalidate: 86_400 },
    })
    if (!cssRes.ok) throw new Error(`CSS ${cssRes.status}`)

    const fontUrl = firstFontUrl(await cssRes.text())
    if (!fontUrl) throw new Error('폰트 URL 없음')

    const fontRes = await fetch(fontUrl, { next: { revalidate: 86_400 } })
    if (!fontRes.ok) throw new Error(`FONT ${fontRes.status}`)

    const buf = await fontRes.arrayBuffer()
    remember(chars, buf)
    return buf
  } catch (err) {
    console.warn('[og-font] 한글 서브셋 폰트 로드 실패 — 폰트 없이 렌더합니다:', err)
    // 첫 실패도 캐시한다 — 크롤러가 몰아칠 때 매번 재시도하면 이미지 응답이 통째로 느려진다.
    remember(chars, null)
    return null
  }
}

/** 상한을 넘으면 가장 오래된 것부터 버린다(Map 은 삽입 순서를 지킨다). */
function remember(key: string, value: ArrayBuffer | null): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}
