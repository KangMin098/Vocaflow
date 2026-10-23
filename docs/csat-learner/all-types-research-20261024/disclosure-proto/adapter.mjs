// 강의 cue 공개 수준 sidecar → 「직접 정답 공개 직전 정지」 경계 어댑터(격리 프로토타입 — 제품 코드 아님).
//
// 계약:
//  · 경계는 「직접 정답 공개」(정답 번호 낭독 · 정답 블록 강조 · 오답 4개 누적 소거) 직전이다. 그 앞에 정답을 좁히는 단서가
//    없다는 뜻이 아니다 — 앞 구간은 HINT/DECISIVE 를 담을 수 있다.
//  · 검증된 경계(VERIFIED)만 정지에 쓴다. 다음 중 하나라도 걸리면 UNVERIFIED — 「정답 직전까지」 경로를 내주지 않는다.
//      1. 결속 실패: 강의 version · cue 수 · cue_id · cue 원문 sha256 이 sidecar 와 다르다
//      2. 경계 앞 cue 중 검수가 끝나지 않은 것(2인 판정 없음)
//      3. 경계 앞 cue 에서 어느 검토자든 ANSWER 를 냈는데 합의(또는 3자 판정)로 정리되지 않았다
//  · 경계 앞 cue 가 합의로 ANSWER 이면 경계를 그 cue 로 당긴다(대본이 규칙보다 먼저 답을 말한 경우).
//
// 입력: lecture(강의 원문 객체, cues[].segments …), side(sidecar 의 lectures[] 원소), sha256(문자열 → 'sha256:<hex>' 를 돌려주는 비동기 함수)

/** @returns {Promise<{status:'VERIFIED'|'UNVERIFIED', stopBefore:number|null, reasons:string[]}>} */
export async function resolveAnswerBoundary(lecture, side, sha256) {
  const reasons = []
  if (!side) return { status: 'UNVERIFIED', stopBefore: null, reasons: ['sidecar 없음'] }
  if ((lecture.version ?? null) !== side.lecture_version) reasons.push(`version 불일치 ${lecture.version} ≠ ${side.lecture_version}`)
  if (lecture.cues.length !== side.cues.length) reasons.push(`cue 수 불일치 ${lecture.cues.length} ≠ ${side.cues.length}`)
  else {
    for (let i = 0; i < lecture.cues.length; i++) {
      const c = lecture.cues[i]
      const s = side.cues[i]
      if (c.id !== s.cue_id) { reasons.push(`cue_id 불일치 @${i}`); break }
      if ((await sha256(JSON.stringify(c))) !== s.source_hash) { reasons.push(`cue 해시 불일치 @${i} ${c.id}`); break }
    }
  }
  if (reasons.length) return { status: 'UNVERIFIED', stopBefore: null, reasons }

  const RULE = /^(R1_DIRECT_OFFICIAL_NUMBER|R2_TARGET_ANSWER_BLOCK|R7_CUMULATIVE_FOUR_ELIMINATED)$/
  const ruleAt = side.cues.findIndex((c) => c.auto.rules.some((r) => RULE.test(r)))
  if (ruleAt < 0) return { status: 'UNVERIFIED', stopBefore: null, reasons: ['규칙 확정 공개 지점 없음'] }

  let stop = ruleAt
  for (const c of side.cues.slice(0, ruleAt)) {
    const rv = c.review ?? {}
    const labels = [...(rv.reviewers ?? []).map((r) => r.local), rv.third?.local, rv.audit?.local].filter(Boolean)
    // 최종값(2인 합의 · 3자 다수결 · 감사 상향 뒤)이 UNKNOWN 이 아니면 정리된 것
    const settled = c.local_disclosure_level !== 'UNKNOWN' && (rv.status === 'reviewed_agree' || rv.final_source) ? c.local_disclosure_level : null
    if ((rv.reviewers ?? []).length < 2) { reasons.push(`검수 안 된 cue ${c.cue_id}`); continue }
    if (settled === 'ANSWER') { stop = Math.min(stop, c.index); continue }
    if (!settled && labels.includes('ANSWER')) reasons.push(`정답 판정 미정리 ${c.cue_id}`)
  }
  if (reasons.length) return { status: 'UNVERIFIED', stopBefore: null, reasons, preStopRisk: 'UNKNOWN' }

  // 정지 지점 앞 구간의 위험 — 「정답 직전 정지」 는 단서가 없다는 뜻이 아니다. 학습자에게 이 수준을 그대로 알린다
  const before = side.cues.slice(0, stop)
  const preStopRisk = before.some((c) => c.local_disclosure_level === 'DECISIVE')
    ? 'DECISIVE_CONFIRMED'
    : before.some((c) => c.local_disclosure_level === 'UNKNOWN' || c.review?.risk_unaudited)
      ? 'DECISIVE_POSSIBLE'
      : before.some((c) => c.local_disclosure_level === 'HINT')
        ? 'HINT_ONLY'
        : 'NONE'
  return {
    status: 'VERIFIED',
    stopBefore: stop,
    preStopRisk,
    reasons: [stop < ruleAt ? `대본이 규칙보다 먼저 답을 말함 → ${side.cues[stop].cue_id} 앞에서 정지` : `규칙 경계 ${side.cues[stop].cue_id} 앞에서 정지`],
  }
}

/** 정지 전 구간 위험 → 학습자 안내 문구(어느 경우에도 「단서 없음」 이라고 하지 않는다) */
export function preStopNotice(risk) {
  if (risk === 'DECISIVE_CONFIRMED') return '정지 지점 앞에서 이미 정답을 사실상 정할 수 있는 단서가 나와요. 정답을 스스로 찾고 싶다면 원문부터 보세요.'
  if (risk === 'DECISIVE_POSSIBLE') return '정지 지점 앞에도 정답을 좁히는 단서가 있고, 정답을 정할 만한 단서인지 아직 다 확인하지 못했어요.'
  if (risk === 'HINT_ONLY') return '정지 지점 앞에도 정답을 좁히는 단서가 있어요. 정답 번호를 직접 말하기 직전에 멈춰요.'
  return '정답 번호를 직접 말하기 직전에 멈춰요.'
}

/** 정지 경계까지만 담은 강의 — 대본 탭 · 강조 · 소거 · 음성이 경계 뒤 cue 를 아예 받지 못하게(단일 공개 정책) */
export function truncateLecture(lecture, stopBefore) {
  return { ...lecture, cues: lecture.cues.slice(0, stopBefore) }
}
