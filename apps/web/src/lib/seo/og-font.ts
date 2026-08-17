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
// 실패해도 이미지는 나와야 한다 — 미리보기가 깨진 링크는 아무도 누르지 않는다.
//   폰트를 못 받으면 `null` 을 돌려주고, 호출부는 폰트 없이 렌더한다(라틴·숫자는 그대로 나온다).



/** 프로세스 캐시 — OG 는 크롤러가 몰아서 치므로 매번 받지 않는다. */
let cached: ArrayBuffer | null | undefined

/** Google Fonts CSS 에서 woff2(또는 ttf) URL 하나를 뽑는다. */
function firstFontUrl(css: string): string | null {
  const m = /src:\s*url\((https:\/\/[^)]+)\)/.exec(css)
  return m?.[1] ?? null
}

/**
 * 카드에 나올 수 있는 글자 집합.
 *
 * 서브셋 요청에 넣을 문자열이라 **화면 문구가 바뀌면 여기도 바뀌어야 한다**.
 * 빠진 글자는 렌더되지 않고 조용히 사라지므로, 새 문구를 넣을 땐 이 문자열을 함께 늘린다.
 */
const SUBSET_TEXT =
  '지문난이도진단이수준이면편하게읽혀요영어를붙여넣으면학년별로몇가읽히는지바로나옵니다' +
  '교과서든수업프린트붙여넣기됩니다가입도설치도필요없어요기준편하게읽히는구간' +
  '초등고학년중고수능기본심화실무공인영어토익학술원서' +
  '이글은교육과정범위를넘어섭니다분석할단어가아직없어요' +
  '저장하지않고로그인없이' +
  '0123456789.%·—&()' +
  'VocaflowHuNation'

/**
 * 한글 서브셋 폰트를 얻는다. 실패는 `null` — 호출부가 폰트 없이 진행한다.
 *
 * 첫 실패도 캐시한다(`null` 로) — 크롤러가 몰아칠 때 매번 외부 요청을 재시도하면
 * 이미지 응답이 통째로 느려진다. 프로세스가 다시 뜨면 다시 시도한다.
 */
export async function loadKoreanOgFont(): Promise<ArrayBuffer | null> {
  if (cached !== undefined) return cached

  try {
    const cssUrl =
      'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700' +
      `&text=${encodeURIComponent(SUBSET_TEXT)}`

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

    cached = await fontRes.arrayBuffer()
    return cached
  } catch (err) {
    console.warn('[og-font] 한글 서브셋 폰트 로드 실패 — 폰트 없이 렌더합니다:', err)
    cached = null
    return null
  }
}
