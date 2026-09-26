// scripts/csat/source-get/_wikinews-shorts.mjs
//
// **Wikinews Shorts(단신 모음)를 꼭지 하나씩 쪼갠다** — 판정 기준 v7 §8(사용자 결정 2026-09-26).
//
// 모음 행은 서로 무관한 단신 두세 개를 한 본문에 묶는다. 한 편으로 판정하면 `mixed` 차단과 `gap` 으로 판정자마다 갈렸고
// (체크리스트 실험 · docs/reports/checklist-exp-20260926.md), 꼭지 하나하나는 대개 혼자 선다. 그래서 수집 단계에서 쪼갠다.
//
// 본문 모양(실측): 꼭지마다 끝에 「Sources」 또는 「Source」 한 줄이 붙는다(출처 목록은 수집 때 이미 걷혔다).
// 순수 함수만 둔다 — DB 를 만지지 않는다. 쓰는 곳: `import.mjs`(새 수집) · `wikinews-shorts-split.mjs`(이미 들어온 행).

export const isDigestTitle = (title) => /^Wikinews Shorts\b/i.test(String(title ?? ''))

const SPLIT = /\n[ \t]*Sources?[ \t]*(?:\n|$)/
const words = (s) => (String(s).match(/\S+/g) ?? []).length

/**
 * 모음 본문 → 꼭지 배열. 길이로 버리지 않는다(기준 §0) — 다만 낱말 5개 미만 조각(「Related news」 같은 꼬리)은
 * 꼭지가 아니라서 빼고 `dropped` 로 센다.
 * @returns {{ briefs: string[], dropped: string[] }}
 */
export function splitDigest(content) {
  const parts = String(content ?? '').split(SPLIT).map((p) => p.trim()).filter(Boolean)
  const briefs = []
  const dropped = []
  for (const p of parts) (words(p) >= 5 ? briefs : dropped).push(p)
  return { briefs, dropped }
}

/** 꼭지 제목 — 모음 제목 + 첫 문장(120자에서 자른다). 판정자가 제목만 보고 꼭지를 알아보게. */
export function briefTitle(digestTitle, brief) {
  const first = String(brief).split(/(?<=[.!?])\s+/)[0].slice(0, 120)
  return `${String(digestTitle).trim()} — ${first}`.slice(0, 500)
}

/** 꼭지 source_id — 모음 source_id 뒤에 `#brief-N`(1부터). 파생물 표지(`#lead` · `#pN-N`)와 겹치지 않아 원천으로 판정된다. */
export const briefSourceId = (digestSourceId, i) => `${digestSourceId}#brief-${i + 1}`
