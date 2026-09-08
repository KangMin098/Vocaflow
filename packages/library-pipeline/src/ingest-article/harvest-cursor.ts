// packages/library-pipeline/src/ingest-article/harvest-cursor.ts
//
// **증분 커서의 저장 위치·형식 규약.**
//
// ── 왜 (실측 2026-09-07) ────────────────────────────────────────────────
// 커서가 지금 이렇게 흩어져 있다:
//
//   scripts/csat/data/plos-harvest-cursor.json   { "<주제>|until:<날짜>": "<토큰>" }
//   scripts/csat/data/gutenberg-cursor.json      { "done": ["75883", …] }
//   scripts/csat/data/plos-extract-cursor.json   { "id": "<uuid>" }
//   FrYM · VOA · Wikipedia                       **없다**
//
// 형식이 셋이면 "이 소스는 어디까지 봤나" 를 물을 공통 방법이 없고, 없는 소스는
// **매 실행이 최신 창만 보고 조용히 정상 종료한다** — FrYM 이 그랬다(미방문 1,667편).
// 오류가 안 나는 것이 문제다. 그래서 규약을 코드로 두고 회귀로 잠근다.
//
// ── 규약 ────────────────────────────────────────────────────────────────
//   위치  scripts/<pipeline>/data/<source>-cursor.json   (기존 plos-harvest-cursor.json 자리)
//   형식  { version, source, feed, updated_at, token, seen[], exhausted }
//
//   token     소스가 준 다음-페이지 토큰을 **그대로** 보관한다(Crossref next-cursor ·
//             MediaWiki continue 를 JSON 직렬화한 문자열). 우리가 만든 offset 은 넣지
//             않는다 — 정렬 없는 offset 페이징이 2026-08-16 IA 사고(214건 중복 + 동수
//             누락)를 만든 그 방식이다.
//   seen      **이미 판정한 안정 식별자**(접두어 없는 뒷부분). 적재한 것만이 아니라
//             거절한 것도 넣는다 — 그래야 "최적합 제외"를 다시 GET 하지 않는다.
//   exhausted 소스가 끝을 말했을 때만 true. 항목 0 을 끝으로 오인하지 않기 위해 분리한다.
//
// ⚠️ **커서는 판정 뒤에 쓴다.** 받자마자 쓰면 중간에 죽었을 때 안 본 것을 본 것으로 센다.

import fs from 'node:fs'
import path from 'node:path'

export const HARVEST_CURSOR_VERSION = 1 as const

export interface HarvestCursor {
  version: typeof HARVEST_CURSOR_VERSION
  /** SourceKey (`voa` · `frym` · `wikipedia` …) */
  source: string
  /** 피드 id — 같은 소스라도 피드마다 진행이 다르다 */
  feed: string
  /** 마지막 저장 시각 (ISO) */
  updated_at: string
  /** 소스가 준 다음-페이지 토큰. null = 아직 첫 페이지 */
  token: string | null
  /** 이미 판정한 안정 식별자 (적재 + 거절 둘 다) */
  seen: string[]
  /** 소스가 "끝" 이라고 말했다 */
  exhausted: boolean
}

/**
 * `scripts/<pipeline>/data/<source>[-<feed>]-cursor.json` — 기존 `plos-harvest-cursor.json` 과 같은 자리.
 *
 * **피드를 파일 이름에 넣는다.** 같은 소스라도 피드마다 진행이 다른데 한 파일에 담으면
 * 한 피드의 전진이 다른 피드의 위치를 덮는다(위키백과 featured/good 이 정확히 그 꼴이다).
 */
export function harvestCursorPath(
  pipeline: string,
  source: string,
  feed?: string | null,
  repoRoot = process.cwd(),
): string {
  const name = feed ? `${source}-${feed}` : source
  return path.join(repoRoot, 'scripts', pipeline, 'data', `${name.replace(/[^A-Za-z0-9_-]+/g, '-')}-cursor.json`)
}

export function emptyHarvestCursor(source: string, feed: string): HarvestCursor {
  return {
    version: HARVEST_CURSOR_VERSION,
    source,
    feed,
    updated_at: new Date(0).toISOString(),
    token: null,
    seen: [],
    exhausted: false,
  }
}

/**
 * 커서를 읽는다. 파일이 없으면 빈 커서 — **없는 것과 못 읽은 것을 구분한다.**
 * 깨진 JSON 은 던진다(빈 커서로 물러서면 전량 재수확이 조용히 일어난다).
 */
export function readHarvestCursor(file: string, source: string, feed: string): HarvestCursor {
  if (!fs.existsSync(file)) return emptyHarvestCursor(source, feed)
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<HarvestCursor>
  if (parsed.version !== HARVEST_CURSOR_VERSION) {
    throw new Error(
      `커서 형식이 다르다: ${file} (version=${String(parsed.version)}, 기대 ${HARVEST_CURSOR_VERSION}) — ` +
        `손으로 옮기거나 지우고 다시 시작할 것`,
    )
  }
  return {
    ...emptyHarvestCursor(source, feed),
    ...parsed,
    seen: Array.isArray(parsed.seen) ? parsed.seen : [],
  } as HarvestCursor
}

/** 커서를 쓴다. `seen` 은 중복을 제거하고 순서를 유지한다(diff 가 읽히도록). */
export function writeHarvestCursor(file: string, cursor: HarvestCursor): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const out: HarvestCursor = {
    ...cursor,
    version: HARVEST_CURSOR_VERSION,
    updated_at: new Date().toISOString(),
    seen: [...new Set(cursor.seen)],
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf8')
}

/** `seen` 에 더한다(제자리 갱신 아님 — 새 객체를 돌려준다). */
export function markSeen(cursor: HarvestCursor, ids: Iterable<string>): HarvestCursor {
  return { ...cursor, seen: [...new Set([...cursor.seen, ...ids])] }
}

// ── 수확기 등록부 ────────────────────────────────────────────────────────
//
// **여기 없는 목록기는 회귀가 잡는다**(`harvest-cursor-contract.test.ts`).
// 깊은 페이징을 하면서 `cursorFile: null` 이려면 `reason` 을 적어야 한다 —
// 커서 없는 수확기를 새로 붙이는 일이 **말없이는 안 되게** 하는 것이 이 표의 목적이다.

export interface HarvestRegistryEntry {
  /** 첫 페이지 너머를 보는가 */
  deepPaged: boolean
  /** 규약 위치의 커서 파일 (repo 상대). 깊은 페이징인데 null 이면 reason 필수 */
  cursorFile: string | null
  /** cursorFile 이 null 인 이유 — 없으면 회귀가 실패한다 */
  reason?: string
}

export const HARVEST_CURSOR_REGISTRY: Record<string, HarvestRegistryEntry> = {
  frym: {
    deepPaged: true,
    cursorFile: 'scripts/textbook/data/frym-<feed>-cursor.json',
  },
  frontiers: {
    deepPaged: true,
    // 저널마다 따로 훑는다 — 한 저널의 전진이 다른 저널의 자리를 덮으면 안 된다.
    //   피드 id = DOI 약칭(`feduc` · `fcomm` …)이라 파일 이름만 보고 어디까지 봤는지 안다.
    cursorFile: 'scripts/csat/data/frontiers-<feed>-cursor.json',
  },
  wikipedia: {
    deepPaged: true,
    // `scripts/acp/collect-daily.mjs` 가 `--pages` 로 카테고리를 훑을 때 남긴다
    //   (피드마다 `wikipedia-<feed>-cursor.json`).
    cursorFile: 'scripts/acp/data/wikipedia-<feed>-cursor.json',
  },
  voa: {
    // RSS 는 `?count=200` 한 방이라 페이지가 없었다 — 그래서 오래 `deepPaged: false` 였고,
    //   그 값이 아카이브 98.6%(66,000편)를 못 본다는 사실을 가리고 있었다.
    //   2026-09-07 `scripts/acp/harvest-voa-sitemap.mjs` 가 붙으면서 이 줄이 바뀌었다.
    //   사이트맵은 페이지가 아니라 **전수 열거**이므로 커서가 담는 것은 다음-페이지 토큰이
    //   아니라 `seen`(이미 판정한 article id — 적재분 + 전문 없는 45%)이다.
    deepPaged: true,
    cursorFile: 'scripts/acp/data/voa-sitemap-cursor.json',
  },
  worldbank: {
    deepPaged: true,
    // OAI-PMH `resumptionToken` — 404쪽(40,363 레코드 ÷ 100)을 여러 날에 나눠 훑는다.
    //   ⚠️ `datestamp` 는 발행일이 아니라 **수정일**이라 같은 글이 다시 온다. 그래서
    //   `seen`(handle)이 커서보다 중요하다 — 토큰만 믿으면 재수확 때 중복을 다시 받는다.
    cursorFile: 'scripts/csat/data/worldbank-<feed>-cursor.json',
  },
  nist: {
    // 사이트맵 **전수 열거**다 — 색인이 말하는 56쪽을 매 실행 전부 읽는다(약 11MB · 1분).
    //   그래서 커서가 담는 것은 다음-쪽 토큰이 아니라 `seen`(이미 판정한 URL 경로 —
    //   적재분 + 짧아서 버린 것 + 게이트 탈락분)이다. VOA 사이트맵과 같은 성질.
    // ⚠️ 쪽 번호로 범위를 좁히지 않는다: 실측에서 뉴스 1편이 13쪽에 있었고, 「1~5쪽만」으로
    //   줄였다면 그 1편은 오류 없이 영영 안 보였다.
    deepPaged: true,
    cursorFile: 'scripts/csat/data/nist-<feed>-cursor.json',
  },
  gutenberg: {
    // 목록기가 `.ts` 어댑터가 아니라 스크립트다(`scripts/csat/harvest-gutenberg.mjs`).
    //   그런 목록기는 파일 안에 `@harvest-source: <키>` 를 적어 등록부 검사에 들어온다 —
    //   적지 않으면 이 표에 없는 채로 조용히 깊이 캘 수 있고, 그것이 FrYM 이 겪은 일이다.
    // 2026-09-07 이전에는 검색 결과를 `start_index` 로 넘기며 `{done,offset}` 을 남겼다.
    //   정렬 없는 offset 페이징이라 IA 사고(214건 중복+누락)와 같은 방식이었고, 그 파일이
    //   867권을 적는 동안 DB 에는 1,631권이 있었다. 지금은 카탈로그를 책 번호 오름차순으로
    //   훑고 피드(부족한 칸)마다 커서를 따로 둔다.
    deepPaged: true,
    cursorFile: 'scripts/csat/data/gutenberg-catalog-<bin>-cursor.json',
  },
  plos: {
    deepPaged: true,
    cursorFile: 'scripts/csat/data/plos-harvest-cursor.json',
    reason:
      '형식이 규약 이전({주제|until:날짜 → 토큰}). 동작하므로 건드리지 않는다 — 옮길 때 이 줄을 지울 것',
  },
  usgs: {
    deepPaged: true,
    cursorFile: null,
    reason:
      '?page=N 로 넘기지만 목록이 ~수백 편이고 매 실행 전량 열거가 싸다. 늘어나면 커서를 붙일 것',
  },
  noaa: {
    deepPaged: true,
    cursorFile: null,
    reason: 'usgs 와 동형(Drupal ?page=N). 피드 확장(+2,200편) 시 커서 필요',
  },
  elife: { deepPaged: true, cursorFile: null, reason: '목록 API 가 최신순 창만 쓰고 있다 — 확장 시 커서 필요' },
  simple_wikipedia: {
    deepPaged: false,
    cursorFile: null,
    reason: '첫 페이지만 본다. 열쇠가 3갈래라(source-key.ts §미이관) 확장 전 열쇠부터 정리할 것',
  },
  nasa: { deepPaged: false, cursorFile: null, reason: 'RSS 창(전체 열거가 없다)' },
  nih: { deepPaged: false, cursorFile: null, reason: 'RSS 창' },
  wikinews: { deepPaged: false, cursorFile: null, reason: 'RSS 창' },
  wikivoyage: { deepPaged: false, cursorFile: null, reason: 'RSS 창' },
  the_conversation: { deepPaged: false, cursorFile: null, reason: 'RSS 창 (ND — 수확 대상 아님)' },
  owid: { deepPaged: false, cursorFile: null, reason: 'RSS 창' },
  futurity: { deepPaged: false, cursorFile: null, reason: 'RSS 창' },
  factbook: { deepPaged: false, cursorFile: null, reason: '국가 코드 고정 목록 — 끝이 있다' },
  ocean_facts: { deepPaged: false, cursorFile: null, reason: '고정 목록' },
  space_place: { deepPaged: false, cursorFile: null, reason: '고정 목록' },
  storyweaver: { deepPaged: false, cursorFile: null, reason: 'API 창 — 확장 시 커서 필요' },
}
