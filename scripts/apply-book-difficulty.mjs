// scripts/apply-book-difficulty.mjs
//
// 도서 난이도 v2.2 앙상블 산출 + 적용 (재사용·멱등). 설계: docs/proposals/book-difficulty-multiaxis.md.
// 검증 짝: scripts/verify-book-difficulty.mjs.
//
// 어휘 단축(book_v_level=p75) 왜곡 교정:
//   Lex   = weighted_avg + (1−easeW)·(p75−weighted_avg)     # ease-게이트: 쉬우면 중심값(희귀어 탈부풀림)
//   Syn   = max(V_fk, clauseBump)                            # F-K(학술 포착)+심층 종속절 보너스. score 포화 회피
//   Overall = 0.75·max(LexC,Syn) + 0.25·mean                # 병목(더 어려운 축) 지배
//   conf  = 0.5·축일치 + 0.5·CEFR-J 교차확증
//   고확신(conf≥0.7)만 book_v_level 갱신, 저확신은 검토 회부(값 유지·제안 저장).
//   전권 vrl_components.difficulty_v2 저장 + book_v_level_v1 원본 보존(되돌리기 가능).
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
  return { b, Lex, Syn, cjv: CJ[b.cefrj_level] ?? null }
})
const paired = pre.filter((r) => r.cjv != null)
const lexOff = paired.length ? paired.reduce((s, r) => s + (r.cjv - r.Lex), 0) / paired.length : 0

// pass2: 융합 + 확신 + 적용
let applied = 0, flagged = 0, unchanged = 0
const report = []
for (const r of pre) {
  const c = r.b.vrl_components || {}
  const v1 = c.book_v_level_v1 ?? r.b.book_v_level // 원본 보존 (이미 있으면 유지)
  const LexC = clamp(r.Lex + lexOff)
  const hi = Math.max(LexC, r.Syn)
  const mn = (LexC + r.Syn) / 2
  const nv = Math.round(clamp(0.75 * hi + 0.25 * mn))
  const spread = Math.abs(LexC - r.Syn)
  const conf = +(0.5 * clamp(1 - spread / 6, 0, 1) + 0.5 * (r.cjv != null ? clamp(1 - Math.abs(nv - r.cjv) / 3, 0, 1) : 0.7)).toFixed(2)
  const doApply = conf >= 0.7 && nv !== v1

  if (!dryRun) {
    const vc = {
      ...c,
      book_v_level_v1: v1,
      difficulty_v2: { v: nv, confidence: conf, lexical: +LexC.toFixed(2), syntactic: +r.Syn.toFixed(2), cefrj_v: r.cjv, method: 'v2.2_fk+clause_bump', applied: doApply },
    }
    const upd = { vrl_components: vc }
    if (doApply) upd.book_v_level = nv
    await sb.from('library_books').update(upd).eq('id', r.b.id)
  }
  if (doApply) applied++
  else if (nv !== v1) flagged++
  else unchanged++
  report.push({ t: (r.b.title ?? '').slice(0, 24), v1, nv, conf, cj: r.cjv ?? '·', act: doApply ? '✓적용' : nv !== v1 ? '⚑검토' : '=유지' })
}

report.sort((a, b) => b.nv - a.nv)
console.log(`lexOffset(CEFR-J 앵커)=${lexOff.toFixed(2)} ${dryRun ? '· DRY-RUN(미기록)' : ''}`)
console.log('title'.padEnd(25) + 'v1 NEW conf CJ  action')
for (const r of report) console.log(`${r.t.padEnd(25)}${String(r.v1).padStart(3)}${String(r.nv).padStart(4)}${String(r.conf).padStart(5)}${String(r.cj).padStart(3)}  ${r.act}`)
console.log(`\n✓ 적용 ${applied} · ⚑ 검토 회부 ${flagged} · = 유지 ${unchanged} (총 ${report.length})`)
if (dryRun) console.log('※ --dry-run: 기록 안 함. 적용하려면 플래그 없이 재실행.')
