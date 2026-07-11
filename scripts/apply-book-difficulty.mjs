// scripts/apply-book-difficulty.mjs
//
// 도서 난이도 v2.4 자동 앙상블 산출 + 적용 (신규/미검토 도서 baseline · 재사용·멱등).
// 검증 짝: verify-book-difficulty.mjs · Claude 캘리(우위): calibrate-book-difficulty-claude.mjs.
//
// 어휘 단축(book_v_level=p75) 왜곡 교정:
//   Lex   = weighted_avg + (1−easeW)·(p75−weighted_avg)     # ease-게이트: 쉬우면 중심값(희귀어 탈부풀림)
//   Syn   = max(V_fk, clauseBump)                            # F-K(학술 포착)+심층 종속절 보너스. score 포화 회피
//   covBump = f(미매칭 어휘율)                                # v2.4 — 방언·외래(Huck "ain't"=미매칭)를 p75가 못 봄 → 보정
//   Overall = 0.75·max(LexC,Syn) + 0.25·mean + 0.6·covBump   # 병목 지배 + hidden-difficulty
//   conf  = (0.5·축일치 + 0.5·CEFR-J 교차확증) × 저커버리지 감쇠  # 미매칭≥20% → 확신↓(Claude 검토 유도)
//   고확신(conf≥0.7)만 book_v_level 자동 갱신 + book_v_level_v1 원본 보존.
//
// ⚠ Claude 검토 완료(difficulty_v2.claude_v) 도서는 v3 권위 → 자동값으로 덮지 않음(가드).
//    p75 재평가(2026-07-12): token-커버리지(cov85/90/95) 노이지(MAE 1.4-2.0), p75 최선(1.17) → 유지.
//
// 사용: node scripts/apply-book-difficulty.mjs [--dry-run]

import { makeClient, arg } from './dict-common.mjs'

const sb = makeClient()
const dryRun = process.argv.includes('--dry-run')
const clamp = (x, lo = 0, hi = 11) => Math.max(lo, Math.min(hi, x))
const CJ = { preA1: 0, 'A1.1': 1, 'A1.2': 1, 'A1.3': 2, 'A2.1': 3, 'A2.2': 4, 'B1.1': 5, 'B1.2': 6, 'B2.1': 7, 'B2.2': 8, C1: 9, C2: 11 }
const fkV = (fk) => clamp((fk - 2) * 0.62)

const { data } = await sb
  .from('library_books')
  .select('id,title,book_v_level,vrl_components,flesch_kincaid_grade,flesch_reading_ease,syntax_score,cefrj_level')
  .eq('status', 'published')
const B = data ?? []

// pass1: 축 계산 (CEFR-J 앵커 offset 산출)
const pre = B.map((b) => {
  const c = b.vrl_components || {}
  const wavg = c.weighted_avg ?? c.p75 ?? 5
  const p75 = c.p75 ?? b.book_v_level ?? 5
  const easeW = clamp(((b.flesch_reading_ease ?? 60) - 50) / 40, 0, 1)
  const Lex = wavg + (1 - easeW) * (p75 - wavg)
  const Vfk = clamp(((b.flesch_kincaid_grade ?? 8) - 2) * 0.62)
  const cd = b.syntax_score?.clause_depth_p90
  const clauseBump = cd != null ? clamp((cd - 3) * 0.9, 0, 11) : 0
  const Syn = Math.max(Vfk, clauseBump)
  // v2.4 — hidden-difficulty(방언·외래·비표준 orthography) 신호: 미매칭 어휘 비율.
  //   p75 는 matched lemma 만 세므로 방언어(Huck "ain't"=미매칭)를 못 봄 → 커버리지 범프로 보정.
  //   p75 이미 높으면(어려움 노출됨) 중복 회피 위해 감쇠.
  const unm = 100 - (c.lemma_coverage_pct ?? 90)
  const covBump = clamp((unm - 15) / 8, 0, 2.5) * (p75 <= 7 ? 1 : 0.3)
  return { b, Lex, Syn, cjv: CJ[b.cefrj_level] ?? null, covBump, unm }
})
const paired = pre.filter((r) => r.cjv != null)
const lexOff = paired.length ? paired.reduce((s, r) => s + (r.cjv - r.Lex), 0) / paired.length : 0

// pass2: 융합 + 확신 + 적용
let applied = 0, flagged = 0, unchanged = 0
const report = []
for (const r of pre) {
  const c = r.b.vrl_components || {}
  const v1 = c.book_v_level_v1 ?? r.b.book_v_level // 원본 보존 (이미 있으면 유지)
  const hasClaude = c.difficulty_v2?.claude_v != null // Claude 검토 완료 = v3 권위 → 자동값으로 덮지 않음
  const LexC = clamp(r.Lex + lexOff)
  const hi = Math.max(LexC, r.Syn)
  const mn = (LexC + r.Syn) / 2
  const nv = Math.round(clamp(0.75 * hi + 0.25 * mn + 0.6 * r.covBump)) // v2.4 커버리지 범프
  const spread = Math.abs(LexC - r.Syn)
  // 저커버리지(≥20% 미매칭 = hidden difficulty)면 확신 감쇠 → 신규 도서 Claude 검토 유도.
  const covPenalty = r.unm >= 20 ? 0.85 : 1
  const conf = +((0.5 * clamp(1 - spread / 6, 0, 1) + 0.5 * (r.cjv != null ? clamp(1 - Math.abs(nv - r.cjv) / 3, 0, 1) : 0.7)) * covPenalty).toFixed(2)
  const doApply = !hasClaude && conf >= 0.7 && nv !== v1

  if (!dryRun) {
    const vc = {
      ...c,
      book_v_level_v1: v1,
      difficulty_v2: { ...(c.difficulty_v2 || {}), v: nv, confidence: conf, lexical: +LexC.toFixed(2), syntactic: +r.Syn.toFixed(2), cov_bump: +r.covBump.toFixed(1), unmatched_pct: +r.unm.toFixed(0), cefrj_v: r.cjv, method: 'v2.4_cov', applied: doApply },
    }
    const upd = { vrl_components: vc }
    if (doApply) upd.book_v_level = nv // Claude 미검토 도서만 자동 적용
    await sb.from('library_books').update(upd).eq('id', r.b.id)
  }
  if (doApply) applied++
  else if (nv !== v1 && !hasClaude) flagged++
  else unchanged++
  report.push({ t: (r.b.title ?? '').slice(0, 24), v1, nv, conf, cj: r.cjv ?? '·', act: hasClaude ? '·claude(v3)' : doApply ? '✓적용' : nv !== v1 ? '⚑검토' : '=유지' })
}

report.sort((a, b) => b.nv - a.nv)
console.log(`lexOffset(CEFR-J 앵커)=${lexOff.toFixed(2)} ${dryRun ? '· DRY-RUN(미기록)' : ''}`)
console.log('title'.padEnd(25) + 'v1 NEW conf CJ  action')
for (const r of report) console.log(`${r.t.padEnd(25)}${String(r.v1).padStart(3)}${String(r.nv).padStart(4)}${String(r.conf).padStart(5)}${String(r.cj).padStart(3)}  ${r.act}`)
console.log(`\n✓ 적용 ${applied} · ⚑ 검토 회부 ${flagged} · = 유지 ${unchanged} (총 ${report.length})`)
if (dryRun) console.log('※ --dry-run: 기록 안 함. 적용하려면 플래그 없이 재실행.')
