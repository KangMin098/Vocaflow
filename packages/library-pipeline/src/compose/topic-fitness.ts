// packages/library-pipeline/src/compose/topic-fitness.ts
//
// ACP §20 — **제목으로 학습 적합성 거르기.**
//
// 왜 필요한가: 수집은 잘 돌지만(하루 300~800 후보) 취재 가능 사건이 사망·사고·정치 쟁점에
// 몰려 학습 지문으로 못 쓴다. 어느 피드가 그러는지, 천장이 어디인지 재려면 분류가 필요하다.
//
// ⚠️ **제목만 보는 거친 분류다.** 순위와 자릿수를 보는 용도이지 개별 글의 게재 여부를
//   판정하는 장치가 아니다. 그 판단은 사람이 한다(발행 화면의 교육적 적합성 확인).
//
// 규칙을 스크립트마다 복사해 두었더니 세 벌이 됐고, 한쪽만 고치면 순위가 갈렸다.
// 그래서 여기 한곳에 둔다.

/**
 * 학습 지문으로 쓸 수 없는 신호.
 *
 * ⚠️ 굴절형을 반드시 포함시킨다 — `\bshoot\b` 는 "shooting" 을 못 잡는다. 실제로 그 때문에
 * 학교 총격 사건이 **적합** 으로 분류돼 천장 측정을 부풀렸다(2026-08-19).
 */
const UNFIT_PATTERNS = [
  // 사건·사고·폭력 — 어미를 열어 둔다
  /\b(kill|shoot|stab|murder|bomb|blast|crash|attack|assault|abuse|rape|arrest|riot|protest|strike)\w*/i,
  /\b(dead|deadly|death|deaths|died|dies|dying|fatal|casualt\w*|victim\w*)\b/i,
  // 분쟁·군사
  /\b(war|wars|troop\w*|missile\w*|airstrike\w*|militant\w*|invasion|ceasefire|hostage\w*)\b/i,
  // 사법·정치 다툼
  /\b(court|trial|lawsuit|prison|jail|scandal|impeach\w*|sanction\w*|tariff\w*|election\w*|referendum)\b/i,
  // 특정 인물·분쟁 지역 (정치 쟁점 신호)
  /(trump|putin|netanyahu|hamas|hezbollah|ukraine|gaza|kremlin)/i,
]

/** 학습 지문으로 쓸 만한 신호 — 경이·자연·과학·생활·배움·운동. */
const FIT_PATTERNS = [
  /\b(animal\w*|bird\w*|whale\w*|dolphin\w*|fish|insect\w*|ant|ants|bee|bees|butterfl\w*|dinosaur\w*|fossil\w*|species)\b/i,
  /\b(volcano\w*|earthquake\w*|ocean\w*|coral|forest\w*|tree|trees|river\w*|lake\w*|glacier\w*|desert)\b/i,
  /\b(climate|weather|storm\w*|rain|rainfall|snow|drought|flood\w*|monsoon)\b/i,
  /\b(space|planet\w*|moon|mars|star|stars|galax\w*|telescope\w*|orbit\w*|rocket\w*|nasa|eclipse\w*|comet\w*|meteor\w*)\b/i,
  /\b(scientist\w*|science|research\w*|study|studies|discover\w*|experiment\w*|invention\w*|robot\w*)\b/i,
  /\b(museum\w*|art|music|film\w*|festival\w*|travel|tourist\w*|recipe\w*|cuisine)\b/i,
  /\b(sleep|exercise|nutrition|vitamin\w*|brain|memory|habit\w*)\b/i,
  /\b(school\w*|student\w*|teacher\w*|universit\w*|classroom\w*|learning|language\w*|reading)\b/i,
  /\b(sport\w*|olympic\w*|football|soccer|marathon\w*|swim\w*|athlet\w*)\b/i,
]

export type TopicFitness = 'fit' | 'unfit' | 'neutral'

/**
 * 제목 → 학습 적합성.
 *
 * **부적합을 먼저 본다.** 사망·분쟁이 들어간 과학 기사는 과학 기사가 아니라 사건 기사이고,
 * 학교에서 난 총격 사건은 '학교' 가 들어갔다고 학습 소재가 되지 않는다.
 */
export function classifyTopic(title: string): TopicFitness {
  const t = title ?? ''
  if (UNFIT_PATTERNS.some((re) => re.test(t))) return 'unfit'
  if (FIT_PATTERNS.some((re) => re.test(t))) return 'fit'
  return 'neutral'
}

/** 제목 묶음의 적합 비율(0~1). 빈 입력은 null — 없는 것을 0% 로 보고하지 않는다. */
export function fitnessRatio(titles: ReadonlyArray<string>): number | null {
  if (titles.length === 0) return null
  return titles.filter((t) => classifyTopic(t) === 'fit').length / titles.length
}
