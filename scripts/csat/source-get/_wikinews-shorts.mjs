// scripts/csat/source-get/_wikinews-shorts.mjs
//
// **Wikinews Shorts(단신 모음)를 꼭지 하나씩 쪼갠다** — 판정 기준 v7 §8(사용자 결정 2026-09-26).
//
// 모음 행은 서로 무관한 단신 두세 개를 한 본문에 묶는다. 한 편으로 판정하면 `mixed` 차단과 `gap` 으로 판정자마다 갈렸고
// (체크리스트 실험 · docs/reports/checklist-exp-20260926.md), 꼭지 하나하나는 대개 혼자 선다. 그래서 수집 단계에서 쪼갠다.
//
// 본문 모양(실측): 꼭지마다 끝에 「Sources」 또는 「Source」 한 줄이 붙는다(출처 목록은 수집 때 이미 걷혔다).
// 순수 함수만 둔다 — DB 를 만지지 않는다. 쓰는 곳: `import.mjs`(새 수집) · `wikinews-shorts-split.mjs`(이미 들어온 행).

// 꼭지 제목도 「Wikinews Shorts…」 로 시작한다(`briefTitle`) — 「 — 」 가 붙은 것은 모음이 아니라 꼭지다.
// (첫 적용 뒤 재실행 예행에서 꼭지 449편을 모음으로 다시 쪼개려 했다 · 2026-09-26)
export const isDigestTitle = (title) => /^Wikinews Shorts\b/i.test(String(title ?? '')) && !/ — /.test(String(title))

/** 꼭지 행인지 — source_id 끝이 `#brief-N`. */
export const isBriefSourceId = (sid) => /#brief-\d+$/.test(String(sid ?? ''))

const SPLIT = /\n[ \t]*Sources?[ \t]*(?:\n|$)/
const words = (s) => (String(s).match(/\S+/g) ?? []).length

// 꼭지가 아닌 꼬리 — 링크 안내 · 「전체 기사로 옮겼다」 안내 · 날짜 머리 · 지도 캡션.
// 실측(2026-09-26 첫 적용 449꼭지): 이런 조각 5개가 낱말 5~9개로 꼭지처럼 들어갔다. 진짜 단신은 가장 짧은 것도 23낱말이었다.
const RESIDUE = /^(External links?|Related news|See also)\b|moved to a full article/i
const MIN_BRIEF_WORDS = 10

/**
 * 모음 본문 → 꼭지 배열. 기사 길이로 버리는 것이 아니다(기준 §0) — 쪼갠 조각 가운데 **기사가 아닌 꼬리**
 * (낱말 10개 미만 · 링크·이동 안내)를 꼭지로 세지 않고 `dropped` 로 센다.
 * @returns {{ briefs: string[], dropped: string[] }}
 */
export function splitDigest(content) {
  const parts = String(content ?? '').split(SPLIT).map((p) => p.trim()).filter(Boolean)
  const briefs = []
  const dropped = []
  for (const p of parts) (words(p) >= MIN_BRIEF_WORDS && !RESIDUE.test(p) ? briefs : dropped).push(p)
  return { briefs, dropped }
}

/** 이미 들어간 꼭지가 꼬리였는지 — 첫 적용 때 들어간 5행을 가리는 데 쓴다. */
export const isResidue = (text) => words(text) < MIN_BRIEF_WORDS || RESIDUE.test(String(text).trim())

/** 꼭지 제목 — 모음 제목 + 첫 문장(120자에서 자른다). 판정자가 제목만 보고 꼭지를 알아보게. */
export function briefTitle(digestTitle, brief) {
  const first = String(brief).split(/(?<=[.!?])\s+/)[0].slice(0, 120)
  return `${String(digestTitle).trim()} — ${first}`.slice(0, 500)
}

/** 꼭지 source_id — 모음 source_id 뒤에 `#brief-N`(1부터). 파생물 표지(`#lead` · `#pN-N`)와 겹치지 않아 원천으로 판정된다. */
export const briefSourceId = (digestSourceId, i) => `${digestSourceId}#brief-${i + 1}`
