// scripts/csat/lecture-disclosure-build.mjs
//
// 강의 cue 공개 수준 sidecar → 제품이 읽는 「직접 정답 공개 경계」 데이터(apps/web/src/lib/csat/lecture/disclosure-data.json).
// 원본 강의 JSON 은 읽기만 한다. 검증된 경계만 싣는다 — 실리지 않은 강의는 「정답 직전까지」 경로를 내주지 않는다.
//
//   node scripts/csat/lecture-disclosure-build.mjs <sidecar 폴더(<회차>.disclosure.json)> [--check]
//
// 경계 = 직접 정답 공개(정답 번호 낭독 R1 · 정답 블록 강조 R2 · 오답 4개 누적 소거 R7) 직전. 경계 앞 cue 의 최종 판정이
// ANSWER 이면 그 cue 로 당긴다. 경계 앞에 검수 안 된 cue · 정리 안 된 정답 판정이 있으면 싣지 않는다.
// 결속 = 강의 version · cue 수 · digest(sha256(cue 원문 JSON 을 줄바꿈으로 이은 것)). 서버가 요청마다 다시 계산해 맞춘다.
// 재실행 안전: 같은 입력이면 같은 파일. --check 는 파일을 쓰지 않고 다르면 exit 1.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const [sideDir, flag] = process.argv.slice(2)
if (!sideDir) {
  console.error('사용: node scripts/csat/lecture-disclosure-build.mjs <sidecar 폴더> [--check]')
  process.exit(2)
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
const DATA = path.join(ROOT, 'apps/web/src/lib/csat/lecture-data')
const OUT = path.join(ROOT, 'apps/web/src/lib/csat/lecture/disclosure-data.json')
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const RULE = /^(R1_DIRECT_OFFICIAL_NUMBER|R2_TARGET_ANSWER_BLOCK|R7_CUMULATIVE_FOUR_ELIMINATED)$/

const lectures = {}
const skipped = {}
for (const f of fs.readdirSync(sideDir).filter((x) => x.endsWith('.disclosure.json')).sort()) {
  const side = JSON.parse(fs.readFileSync(path.join(sideDir, f), 'utf8'))
  const src = JSON.parse(fs.readFileSync(path.join(DATA, path.basename(side.source.repo_path)), 'utf8'))
  for (const s of side.lectures) {
    const lec = src.lectures[s.lecture_id]
    const skip = (why) => { skipped[why] = (skipped[why] ?? 0) + 1 }
    if (!lec) { skip('강의 없음'); continue }
    if ((lec.version ?? null) !== s.lecture_version || lec.cues.length !== s.cues.length) { skip('version · cue 수 불일치'); continue }
    if (lec.cues.some((c, i) => c.id !== s.cues[i].cue_id || 'sha256:' + sha(JSON.stringify(c)) !== s.cues[i].source_hash)) { skip('cue 해시 불일치'); continue }
    const ruleAt = s.cues.findIndex((c) => c.auto.rules.some((r) => RULE.test(r)))
    if (ruleAt < 0) { skip('규칙 확정 공개 없음'); continue }
    let stop = ruleAt
    let bad = false
    for (const c of s.cues.slice(0, ruleAt)) {
      const rv = c.review ?? {}
      if ((rv.reviewers ?? []).length < 2) { bad = true; break }
      const settled = c.local_disclosure_level !== 'UNKNOWN' && (rv.status === 'reviewed_agree' || rv.final_source) ? c.local_disclosure_level : null
      const labels = [...(rv.reviewers ?? []).map((r) => r.local), rv.third?.local, rv.audit?.local].filter(Boolean)
      if (settled === 'ANSWER') stop = Math.min(stop, c.index)
      else if (!settled && labels.includes('ANSWER')) { bad = true; break }
    }
    if (bad) { skip('경계 앞 검수 미완 · 정답 판정 미정리'); continue }
    const before = s.cues.slice(0, stop)
    const risk = before.some((c) => c.local_disclosure_level === 'DECISIVE')
      ? 'decisive_confirmed'
      : before.some((c) => c.local_disclosure_level === 'UNKNOWN' || c.review?.risk_unaudited)
        ? 'decisive_possible'
        : before.some((c) => c.local_disclosure_level === 'HINT')
          ? 'hint'
          : 'none'
    lectures[s.lecture_id] = { version: lec.version ?? null, cues: lec.cues.length, digest: sha(lec.cues.map((c) => JSON.stringify(c)).join('\n')), stopBefore: stop, preStopRisk: risk }
  }
}
const body = JSON.stringify({ schema: 'csat-lecture-disclosure/v1', source: 'cue 공개 수준 sidecar(독립 2인 + 3자 판정 · 위험 감사)', lectures }, null, 1) + '\n'
const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null
console.log(`검증 경계 ${Object.keys(lectures).length}강 · 건너뜀 ${JSON.stringify(skipped)}`)
if (flag === '--check') process.exit(prev === body ? 0 : 1)
fs.writeFileSync(OUT, body)
console.log('썼다', path.relative(ROOT, OUT))
