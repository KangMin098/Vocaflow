// 독립 검토 A·B 를 sidecar 에 합친다 — 원본 대본은 읽기만 한다.
// 사용: node review-merge.mjs <repo dir> <git ref>   (이 파일이 있는 cue-audit 폴더 기준)
//
// 규칙:
//  · 결속 — 검토 출력의 source_hash 가 sidecar 와 같고, sidecar 의 file blob 이 <git ref> 의 현재 blob 과 같아야 반영한다
//  · 일치(local 같음) → reviewed_agree, 최종 local = 그 값. 불일치 → reviewed_conflict, 최종 UNKNOWN
//  · 누적(cumulative) 은 공개 전 구간 안에서 단조. 둘이 다르면 더 낮은 값을 하한으로만 두고 최종 UNKNOWN
//  · 제품 적용 후보(promoted) = 결속 통과 + local·cumulative 모두 일치 + 두 검토자 confidence high
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [repo, ref] = process.argv.slice(2)
const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 })
const L = ['NONE', 'HINT', 'DECISIVE', 'ANSWER']
const r = (x) => L.indexOf(x)
const valid = (x) => r(x) >= 0

const reviews = {}
const missing = []
for (let g = 1; g <= 5; g++) {
  for (const who of ['A', 'B']) {
    const p = path.join(here, 'review', `group-${g}.${who}.json`)
    if (!fs.existsSync(p)) { missing.push(`group-${g}.${who}`); continue }
    const o = JSON.parse(fs.readFileSync(p, 'utf8'))
    for (const it of o.items) for (const c of it.cues) (reviews[`${it.lecture_id}|${c.cue_id}`] ??= {})[who] = c
  }
}

const stats = {
  missing_review_files: missing,
  binding: { files_checked: 0, blob_mismatch: [], cue_hash_mismatch: 0, review_hash_mismatch: 0 },
  pre_answer_cues: 0, reviewed_by_both: 0, reviewed_by_one: 0, unreviewed: 0,
  agree_local: 0, conflict_local: 0, agree_cumulative: 0, promoted: 0, invalid_labels: 0,
  confusion_local: {}, final_local: { NONE: 0, HINT: 0, DECISIVE: 0, ANSWER: 0, UNKNOWN: 0 },
  auto_vs_consensus: { false_positive: 0, false_negative: 0, match: 0, by_rule_fp: {}, by_rule_fn: {} },
  first_occurrence: { hint: {}, decisive: {}, answer_certain: {} },
  lectures: 0, lectures_with_conflict: 0,
}
const kappaPairs = []

const outDir = path.join(here, 'sidecar-reviewed')
fs.mkdirSync(outDir, { recursive: true })
for (const f of fs.readdirSync(path.join(here, 'sidecar')).filter((x) => x.endsWith('.disclosure.json')).sort()) {
  const sc = JSON.parse(fs.readFileSync(path.join(here, 'sidecar', f), 'utf8'))
  stats.binding.files_checked++
  const blobNow = git('rev-parse', `${ref}:${sc.source.repo_path}`).trim()
  const blobOk = blobNow === sc.source.blob
  if (!blobOk) stats.binding.blob_mismatch.push(sc.source.repo_path)
  const src = JSON.parse(git('show', `${ref}:${sc.source.repo_path}`))
  for (const l of sc.lectures) {
    stats.lectures++
    let conflictHere = false
    let cumFinal = 'NONE'
    let cumUnknown = false
    for (const c of l.cues) {
      const live = src.lectures[l.lecture_id]?.cues[c.index]
      const liveHash = live ? 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(live)).digest('hex') : null
      const hashOk = liveHash === c.source_hash
      if (!hashOk) stats.binding.cue_hash_mismatch++
      if (c.cumulative_lower_bound === 'ANSWER') {
        // 확정 공개 이후 — 누적 ANSWER(규칙 확정). 지역 수준은 검수 범위 밖이라 그대로 둔다
        c.cumulative_disclosure_level = 'ANSWER'
        continue
      }
      stats.pre_answer_cues++
      const rv = reviews[`${l.lecture_id}|${c.cue_id}`] ?? {}
      const A = rv.A
      const B = rv.B
      for (const x of [A, B]) if (x && x.source_hash !== c.source_hash) stats.binding.review_hash_mismatch++
      const okA = A && valid(A.local) && valid(A.cumulative) && A.source_hash === c.source_hash
      const okB = B && valid(B.local) && valid(B.cumulative) && B.source_hash === c.source_hash
      if ((A && !okA) || (B && !okB)) stats.invalid_labels++
      c.review = { status: 'needs_review', reviewers: [], conflict: false }
      if (okA) c.review.reviewers.push({ id: 'A', local: A.local, cumulative: A.cumulative, channels: A.channels, confidence: A.confidence, quote: A.quote, why: A.why })
      if (okB) c.review.reviewers.push({ id: 'B', local: B.local, cumulative: B.cumulative, channels: B.channels, confidence: B.confidence, quote: B.quote, why: B.why })
      if (okA && okB) {
        stats.reviewed_by_both++
        kappaPairs.push([A.local, B.local])
        const k = `${A.local}/${B.local}`
        stats.confusion_local[k] = (stats.confusion_local[k] ?? 0) + 1
        const agree = A.local === B.local
        const agreeCum = A.cumulative === B.cumulative
        if (agreeCum) stats.agree_cumulative++
        if (agree) {
          stats.agree_local++
          c.review.status = 'reviewed_agree'
          // 자동 확정(오답 소거 HINT)과 검토 합의가 다르면 합의를 따르되 충돌로 남긴다
          c.local_disclosure_level = A.local
          // 자동 제안과 비교(오탐 = 자동이 더 높게, 누락 = 자동이 더 낮게)
          const auto = c.auto.local_suggestion
          const rule = c.auto.rules.find((x) => x !== 'R0_NO_RULE') ?? 'R0_NO_RULE'
          if (r(auto) > r(A.local)) { stats.auto_vs_consensus.false_positive++; stats.auto_vs_consensus.by_rule_fp[rule] = (stats.auto_vs_consensus.by_rule_fp[rule] ?? 0) + 1 }
          else if (r(auto) < r(A.local)) { stats.auto_vs_consensus.false_negative++; stats.auto_vs_consensus.by_rule_fn[rule] = (stats.auto_vs_consensus.by_rule_fn[rule] ?? 0) + 1 }
          else stats.auto_vs_consensus.match++
        } else {
          stats.conflict_local++
          conflictHere = true
          c.review.status = 'reviewed_conflict'
          c.review.conflict = true
          c.local_disclosure_level = 'UNKNOWN'
        }
        // 누적: 앞 누적과 둘의 판단 중 확실한 하한
        const lo = L[Math.max(r(cumFinal), Math.min(r(A.cumulative), r(B.cumulative)))]
        if (agreeCum && !cumUnknown) cumFinal = L[Math.max(r(cumFinal), r(A.cumulative))]
        else { cumUnknown = true; cumFinal = lo }
        c.cumulative_lower_bound = cumFinal
        c.cumulative_disclosure_level = cumUnknown ? 'UNKNOWN' : cumFinal
        c.review.promoted = Boolean(blobOk && hashOk && agree && agreeCum && !cumUnknown && A.confidence === 'high' && B.confidence === 'high')
        if (c.review.promoted) stats.promoted++
      } else {
        if (okA || okB) stats.reviewed_by_one++
        else stats.unreviewed++
        c.local_disclosure_level = 'UNKNOWN'
        cumUnknown = true
        c.cumulative_disclosure_level = 'UNKNOWN'
        c.review.promoted = false
      }
      stats.final_local[c.local_disclosure_level]++
    }
    if (conflictHere) stats.lectures_with_conflict++
    // 최초 발생 — 합의된 누적 기준(하한). 확정 공개는 규칙 기준
    const firstAt = (pred) => l.cues.find(pred)?.index ?? 'none'
    const h = firstAt((c) => r(c.cumulative_lower_bound) >= 1)
    const dd = firstAt((c) => r(c.cumulative_lower_bound) >= 2)
    const a = firstAt((c) => c.cumulative_lower_bound === 'ANSWER')
    for (const [k, v] of [['hint', h], ['decisive', dd], ['answer_certain', a]]) stats.first_occurrence[k][v] = (stats.first_occurrence[k][v] ?? 0) + 1
  }
  sc.review_merge = { merged_at_ref: ref, blob_ok: blobOk }
  fs.writeFileSync(path.join(outDir, f), JSON.stringify(sc, null, 1))
}

// Cohen's kappa(local)
const n = kappaPairs.length
if (n) {
  const po = kappaPairs.filter(([a, b]) => a === b).length / n
  const pa = Object.fromEntries(L.map((x) => [x, kappaPairs.filter(([a]) => a === x).length / n]))
  const pb = Object.fromEntries(L.map((x) => [x, kappaPairs.filter(([, b]) => b === x).length / n]))
  const pe = L.reduce((s, x) => s + pa[x] * pb[x], 0)
  stats.agreement = { observed: Number(po.toFixed(3)), kappa: Number(((po - pe) / (1 - pe)).toFixed(3)), pairs: n }
}
fs.writeFileSync(path.join(here, 'review-summary.json'), JSON.stringify(stats, null, 1))
console.log(JSON.stringify({ ...stats, confusion_local: undefined }, null, 1))
