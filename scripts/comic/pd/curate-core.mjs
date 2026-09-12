// scripts/comic/pd/curate-core.mjs
//
// 학습 적합도 큐레이션 — 순수 점수 로직(네트워크·fs 없음). curate.mjs(CLI)와 콘솔 API 가 공유한다.
// "사전 지식 자동화"의 핵심: 사용자가 컬렉션 ID·연도·검색어를 몰라도, 아는 명작 하나만 고르면
// CANON 매칭 + CI 감지 + 페이지수 + PD 위험도로 자동 랭킹된다.

// 그레이디드 리더 정본과 겹치는 고전 canon — Classics Illustrated 가 각색한 대표작(학습 적합·PD 확률↑).
export const CANON = [
  ['ivanhoe', 'Ivanhoe'], ['odyssey', 'The Odyssey'], ['iliad', 'The Iliad'], ['macbeth', 'Macbeth'],
  ['hamlet', 'Hamlet'], ['julius caesar', 'Julius Caesar'], ['monte cristo', 'The Count of Monte Cristo'],
  ['three musketeers', 'The Three Musketeers'], ['moby dick', 'Moby Dick'], ['two cities', 'A Tale of Two Cities'],
  ['robinson crusoe', 'Robinson Crusoe'], ['treasure island', 'Treasure Island'], ['kidnapped', 'Kidnapped'],
  ['leagues', '20,000 Leagues Under the Sea'], ['oliver twist', 'Oliver Twist'], ['copperfield', 'David Copperfield'],
  ['mohicans', 'The Last of the Mohicans'], ['robin hood', 'Robin Hood'], ['gulliver', "Gulliver's Travels"],
  ['tom sawyer', 'Tom Sawyer'], ['huck', 'Huckleberry Finn'], ['frankenstein', 'Frankenstein'],
  ['jekyll', 'Dr. Jekyll and Mr. Hyde'], ['time machine', 'The Time Machine'], ['war of the worlds', 'War of the Worlds'],
  ['first men in the moon', 'First Men in the Moon'], ['around the world', 'Around the World in 80 Days'],
  ['christmas carol', 'A Christmas Carol'], ['don quixote', 'Don Quixote'], ['miserables', 'Les Misérables'],
  ['call of the wild', 'The Call of the Wild'], ['white fang', 'White Fang'], ['the spy', 'The Spy'],
  ['westward ho', 'Westward Ho!'], ['deerslayer', 'The Deerslayer'], ['prince and the pauper', 'The Prince and the Pauper'],
]

export const NOISE = /sacred classics|grammar|rhetoric|antiquit|law restated|cultural history|library of|fine books|roman antiq|explained|great illustrated classics$|acclaim|junior/i
export const CI_RE = /classics?[\s._-]*illustrated|illustrated[\s._-]*classics/i

export const slugify = (s) => String(s || 'issue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'issue'

// 한 후보 점수 — CI 도 canon 도 아니면 null(제외). 학습 부적합 노이즈도 제외.
export function score(it) {
  const hay = `${it.identifier} ${it.title || ''}`.toLowerCase()
  if (NOISE.test(hay)) return null
  const canon = CANON.find(([kw]) => hay.includes(kw))
  const isCI = CI_RE.test(hay)
  if (!isCI && !canon) return null
  const pagesOk = it.pageCount != null && it.pageCount >= 20 && it.pageCount <= 120
  const riskPts = it.pdRisk === 'ok' ? 1 : it.pdRisk === 'caution' ? 0.5 : 0
  const s = (isCI ? 2 : 0) + (canon ? 3 : 0) + (pagesOk ? 1 : 0) + riskPts
  // 점수 근거(콘솔이 "왜 추천"을 보여줄 수 있게)
  const why = [canon ? `명작(${canon[1]})` : null, isCI ? 'Classics Illustrated' : null, pagesOk ? '적정 분량' : null, it.pdRisk === 'ok' ? 'PD확정' : it.pdRisk === 'caution' ? 'PD확인필요' : null].filter(Boolean)
  return { ...it, fit: s, canon: canon?.[1] ?? null, isCI, why }
}

// 검색 결과 → 랭킹. 순수 함수(입력 items 는 어댑터 search 산출).
export function rank(items, top = 8) {
  return (items || []).map(score).filter(Boolean).sort((a, b) => b.fit - a.fit).slice(0, top)
}

// 콘솔 추천 트랙 — 사용자가 아무것도 몰라도 고를 수 있는 출발점(검색어·필터를 자동 주입).
export const CURATE_TRACKS = [
  { key: 'ci-all', label: '고전 각색 전체', query: 'classics illustrated', note: '학습 적합도 최고 — Classics Illustrated 각색 만화 전반' },
  { key: 'ci-alt', label: '고전 각색(확장)', query: 'illustrated classics', note: '다른 표기까지 포함해 더 넓게' },
]
