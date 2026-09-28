// scripts/csat/source-get/_wikinews-shorts.mjs
//
// **Wikinews Shorts(단신 모음)를 꼭지 하나씩 쪼갠다** — 판정 기준 v7 §8(사용자 결정 2026-09-26).
//
// 모음 행은 서로 무관한 단신 두세 개를 한 본문에 묶는다. 한 편으로 판정하면 `mixed` 차단과 `gap` 으로 판정자마다 갈렸고
// (체크리스트 실험 · docs/reports/checklist-exp-20260926.md), 꼭지 하나하나는 대개 혼자 선다. 그래서 수집 단계에서 쪼갠다.
//
// 본문 모양(실측): 꼭지마다 끝에 「Sources」 또는 「Source」 한 줄이 붙는다(출처 목록은 수집 때 이미 걷혔다).
// 순수 함수만 둔다 — DB 를 만지지 않는다. 쓰는 곳: `import.mjs`(새 수집) · `wikinews-shorts-split.mjs`(이미 들어온 행).

// 꼭지 제목도 모음 제목으로 시작한다(`briefTitle`) — 「 — 」 가 붙은 것은 모음이 아니라 꼭지다.
// (첫 적용 뒤 재실행 예행에서 꼭지 449편을 모음으로 다시 쪼개려 했다 · 2026-09-26)
// 모음 제목은 「Wikinews Shorts…」 말고도 「UK Wikinews Shorts: …」 · 「Obituaries: …」(부고 모음) · 「Queensland state election shorts: …」 가 있다 —
// 처음 조건이 이 17행을 놓쳐 모음째 판정에 올라갔다(체크리스트 배치 6에서 「모음」 보류 3편 · 실측 2026-09-27).
const DIGEST_TITLE = /^(?:UK\s+)?Wikinews Shorts\b|^Obituaries\s*:|\bshorts\s*:/i
export const isDigestTitle = (title) => DIGEST_TITLE.test(String(title ?? '')) && !/ — /.test(String(title))

/** 꼭지 행인지 — source_id 끝이 `#brief-N`. */
export const isBriefSourceId = (sid) => /#brief-\d+$/.test(String(sid ?? ''))

// 따옴표가 붙은 「'Sources」 줄도 있다(실측 wikinews:130347 — 이 줄을 못 알아봐 무관한 두 꼭지가 한 행에 남았다).
const SPLIT = /\n[ \t]*['"‘’“”]*Sources?['"‘’“”]*[ \t]*(?:\n|$)/
const words = (s) => (String(s).match(/\S+/g) ?? []).length

// 2012년 1월 모음의 머리말 — 꼭지가 아니라 편집 안내다.
const BOILERPLATE = /^If you believe any of these stories deserves more in-depth coverage\b[^\n]*(?:\n\s*)*/i

// 모음 머리말 문단 — 꼭지가 아니다. 부고 모음(「Deaths in 2008」「The following (were some of the) deaths were reported …:」,
// 앞에 떨어진 조각 「to」)과 단신 모음(「A compilation of brief news reports …」)의 첫머리.
// 실측 2026-09-28: 부고 모음 4행의 첫 꼭지가 머리말을 달고 들어가, 체크리스트가 「목록 머리만 있고 끊겼다」(truncated)로 읽었다.
const HEAD_PARA = /^(?:to|Deaths in \d{4}|The following (?:were some of the )?deaths? (?:were |was )?reported\b[^\n]*:|A compilation of brief news reports\b[^\n]*)$/i

/** 모음 첫머리의 머리말 문단을 걷는다(가운데 문단은 건드리지 않는다). */
export function stripDigestHead(content) {
  const ps = String(content ?? '').trim().split(/\n\s*\n/)
  while (ps.length > 1 && HEAD_PARA.test(ps[0].trim())) ps.shift()
  return ps.join('\n\n')
}

/** 문단 나누기 — 빈 줄 기준. */
export const paragraphs = (content) => String(content ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

/**
 * 「Sources」 줄이 없어 자동으로 못 쪼개는 모음인가 — 2012년 1월 형식(머리말 뒤에 꼭지들이 빈 줄로만 이어진다) ·
 * 2008년 3월 부고 모음(「The following deaths were reported yesterday」 뒤에 한 사람씩) · 선거 단신 모음.
 * 빈 줄은 꼭지 경계가 아니다(한 꼭지가 두세 문단이다) — 이런 모음은 자동으로 쪼개지 않고 사람·에이전트가 경계를 적는다
 * (`wikinews-shorts-resplit.json`). 실측 2026-09-27: 이 형식 6행이 꼭지 하나로 들어가 판정에서 「덜 쪼갠 모음」 보류가 됐다.
 * 모음 제목인 행에만 부른다 — 「Sources」 줄이 없으면 `splitDigest` 는 본문 전체를 꼭지 하나로 돌려준다(쪼갠 것이 아니다).
 */
export const needsManualSplit = (content) => !SPLIT.test(String(content ?? ''))

/**
 * 적어 둔 경계로 쪼갠다. `groups` 는 꼭지마다 문단 번호 배열(0부터) — 모든 문단이 정확히 한 번씩(버릴 문단은 `drop`) 나와야 한다.
 * @returns {{ briefs: string[], problems: string[] }}
 */
export function splitByGroups(content, groups, drop = []) {
  const ps = paragraphs(content)
  const seen = [...groups.flat(), ...drop].sort((a, b) => a - b)
  const problems = []
  if (seen.length !== ps.length || seen.some((x, i) => x !== i)) problems.push(`문단 ${ps.length}개를 정확히 한 번씩 덮지 않는다: ${JSON.stringify(seen)}`)
  const briefs = groups.map((g) => g.map((i) => ps[i]).join('\n\n'))
  for (const b of briefs) if (words(b) < MIN_BRIEF_WORDS) problems.push(`꼭지가 ${MIN_BRIEF_WORDS}낱말 미만: ${b.slice(0, 40)}`)
  return { briefs, problems }
}

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
  const parts = stripDigestHead(String(content ?? '').trim().replace(BOILERPLATE, '')).split(SPLIT).map((p) => p.trim()).filter(Boolean)
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
