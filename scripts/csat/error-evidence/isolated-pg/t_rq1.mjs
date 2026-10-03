// scripts/csat/error-evidence/isolated-pg/t_rq1.mjs
// rq-1 동치 — 같은 응답 fixture 를 SQL(csat_ec_record_quality_rq1)과 TS(recordQuality)에 넣어 결과를 전수 비교
import { record } from './lib.mjs'
import { EXAM, answerOf } from './seed.mjs'
import { recordQuality } from '../../../../apps/web/src/lib/csat/diagnosis/engine/record-quality.ts'

const spread = (n) => ((n * 7) % 5) + 1
/** 비율 r 을 맞추되 같은 번호 연속을 짧게(maxRun) 끊는다 */
function ratioPattern(answered, same, maxRun = 9) {
  const out = []
  let run = 0, left = same
  for (let i = 0; i < answered; i++) {
    const remainingSlots = answered - i
    const mustSame = left >= remainingSlots
    if (left > 0 && (run < maxRun || mustSame)) { out.push(1); left--; run++ } else { out.push(2 + (i % 4)); run = 0 }
  }
  return out
}
function streakPattern(k) {
  // 45문항 · 같은 번호(5) k 연속 한 번, 나머지는 퍼짐(연속 없음)
  return Array.from({ length: 45 }, (_, i) => (i >= 10 && i < 10 + k ? 5 : (i % 4) + 1))
}

const FIXTURES = {
  'all_2(45)': Array(45).fill(2),
  'all_3(45)': Array(45).fill(3),
  'ratio_90_exact(36/40, 5 무응답)': [...ratioPattern(40, 36), ...Array(5).fill(null)],
  'ratio_just_below(40/45=88.9%)': ratioPattern(45, 40),
  'ratio_above(41/45=91.1%)': ratioPattern(45, 41),
  'streak_15_exact': streakPattern(15),
  'streak_14': streakPattern(14),
  'streak_16': streakPattern(16),
  'answered_19_same': [...Array(19).fill(4), ...Array(26).fill(null)],
  'answered_20_same': [...Array(20).fill(4), ...Array(25).fill(null)],
  'normal_spread': Array.from({ length: 45 }, (_, i) => spread(i + 1)),
  'normal_with_nulls': Array.from({ length: 45 }, (_, i) => (i % 6 === 0 ? null : spread(i + 1))),
  'all_unanswered': Array(45).fill(null),
  'streak_across_null(무응답은 건너뛴다)': Array.from({ length: 45 }, (_, i) => (i >= 5 && i < 25 ? (i === 15 ? null : 3) : (i % 4) + 1)),
}

export default async function rq1(admin) {
  await admin.query(`insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000f9') on conflict do nothing`)
  const mism = []
  for (const [name, choices] of Object.entries(FIXTURES)) {
    const { rows } = await admin.query(`insert into public.csat_dx_session (user_id, exam_id, mode, taken_at, client_key) values ('00000000-0000-4000-8000-0000000000f9', $1, 'live', '2026-10-01', gen_random_uuid()) returning id`, [EXAM])
    const sid = rows[0].id
    for (let i = 0; i < 45; i++) {
      const c = choices[i]
      await admin.query(`insert into public.csat_dx_response (session_id, item_no, item_id, chosen_option, is_correct) values ($1, $2, $3, $4, $5)`, [sid, i + 1, `${EXAM}#${i + 1}`, c, c === answerOf(i + 1)])
    }
    const sql = (await admin.query(`select public.csat_ec_record_quality_rq1($1) s`, [sid])).rows[0].s
    const tq = recordQuality(choices.map((c, i) => ({ no: i + 1, chosen: c })))
    const ts = tq.status
    if (sql !== ts) mism.push({ name, sql, ts })
    // 신호까지 동치(P2-2) — 답한 수 · 최빈 번호 · 최빈 개수 · 최장 연속 · 종류
    const sg = (await admin.query(`select public.csat_ec_record_quality_rq1_signals($1) g`, [sid])).rows[0].g
    const tsSig = { answered: tq.signals.answered, dominant_option: tq.signals.dominantOption, dominant_count: Math.round(tq.signals.dominantRatio * tq.signals.answered), longest_streak: tq.signals.longestStreak, distinct_options: tq.signals.distinctOptions }
    const sqlSig = { answered: sg.answered, dominant_option: sg.dominant_option, dominant_count: sg.dominant_count, longest_streak: sg.longest_streak, distinct_options: sg.distinct_options }
    if (JSON.stringify(tsSig) !== JSON.stringify(sqlSig)) mism.push({ name, tsSig, sqlSig })
    record('rq-1', `${name} → SQL ${sql} · TS ${ts}`, sql === ts)
  }
  record('rq-1', `TS ↔ SQL 불일치 0 / ${Object.keys(FIXTURES).length} fixture`, mism.length === 0, mism)
  let bad
  try {
    const { rows } = await admin.query(`select id from public.csat_dx_session limit 1`)
    await admin.query(`insert into public.csat_dx_response (session_id, item_no, item_id, chosen_option, is_correct) values ($1, 46, null, 7, false)`, [rows[0].id])
    bad = { ok: true }
  } catch (e) { bad = { ok: false, err: e.message } }
  record('rq-1', '비정상 선택값(7) · 문항 번호(46)는 기존 CHECK 가 입력 단계에서 거부', !bad.ok, bad.err)
}
