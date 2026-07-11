// scripts/calibrate-book-difficulty-claude.mjs
//
// 도서 난이도 v2.3 — Claude 전문가 판정 편입 캘리브레이션.
// 배경: v2.2 텍스트 앙상블이 못 보는 사각지대(방언·화려체·철학추상·아동운문)를 Claude가
//   문학지식+본문샘플로 한 권씩 큐레이션 평가 → 강추정기로 편입해 정확도 고도화.
//   (docs/proposals/book-difficulty-multiaxis.md · Tier 1.5)
//
//   final_v = round(0.65·claude_v + 0.35·ensemble_v2)   # Claude 전문판정 우위, 지표로 접지
//   전권 book_v_level = final_v 반영 + difficulty_v2.{claude_v, claude_note, v3} 감사저장.
//   book_v_level_v1(원본) 보존.
//
// ⚠ CLAUDE_JUDGMENTS 는 이 23권에 대한 Claude 의 개별 전문 평가(2026-07-12). 신규 도서는
//    Claude 재평가 필요(자동 도출 아님). 사각지대 감지 프록시(방언 orthography 비율 등)는 별도 잔여.
//
// 사용: node scripts/calibrate-book-difficulty-claude.mjs [--dry-run]

import { makeClient } from './dict-common.mjs'

const sb = makeClient()
const dryRun = process.argv.includes('--dry-run')
const clamp = (x, lo = 0, hi = 11) => Math.max(lo, Math.min(hi, x))

// ── Claude 전문가 판정 (title 부분매칭 → {v, note=핵심 난이도 동인}) ──
const J = [
  [/decline and fall/i, 11, '18C 기념비 만연체·라틴계 — 영어산문 최난이도'],
  [/dialogues/i, 9, 'Plato 철학 대화·추상 논증 밀도 (번역)'],
  [/les mis[eé]rables/i, 8, 'Hugo 번역 대작·사회사·argot 삽화 (극장편)'],
  [/pride and prejudice/i, 8, 'Austen 아이러니 복문'],
  [/great expectations/i, 8, 'Victorian 표준 고전'],
  [/jane eyre/i, 8, 'Victorian 내성적'],
  [/introduction to sociology/i, 8, '학술 교재 전문어'],
  [/foundational observations/i, 8, '학술 정책 nominalization 밀도 (지표 과소였음)'],
  [/twenty years after/i, 8, 'Dumas 번역 모험 장편'],
  [/huckleberry finn/i, 8, '방언(eye-dialect) — 텍스트지표 최대 사각지대'],
  [/wind in the willows/i, 7, '서정 묘사 (아동문학치곤 고급)'],
  [/just so stories/i, 7, 'Kipling 조어·율문 화려체 (지표 과소였음)'],
  [/book of tea/i, 7, '선·미학 철학 추상 (지표 과소였음)'],
  [/sherlock/i, 7, 'Victorian 명료 추리'],
  [/alice adams/i, 6, '읽기 쉬운 20C 사실주의 (CEFR-J C1 과대였음)'],
  [/alice.s adventures in wonderland/i, 6, '어휘 쉬우나 말장난·논리퍼즐 화용 난이도'],
  [/pinocchio/i, 6, '번역 아동 서사'],
  [/marvelous land of oz/i, 6, '아동 판타지'],
  [/\bfables\b/i, 6, '단순 서사+교훈 register'],
  [/wonderful wizard of oz/i, 5, '단순 아동 판타지'],
  [/railway children/i, 5, '에드워디안 아동'],
  [/just so|short fiction/i, 5, 'Potter 아동'], // Short Fiction (Potter)
  [/\bpoetry\b/i, 5, "Child's Garden 아동 운문 (지표 과대였음)"],
  [/drone/i, 2, '픽처북'],
  [/ammachi/i, 2, '픽처북'],
]
// Short Fiction 우선(Just So 는 위에서 이미 매칭되므로 별도)
function judge(title) {
  if (/short fiction/i.test(title)) return [5, 'Potter 아동']
  for (const [re, v, note] of J) if (re.test(title)) return [v, note]
  return [null, null]
}

// 전체 대상: 발행 + ready(발행 timeout 대작 포함). archived dupe·queued(미처리)는 제외.
const { data } = await sb.from('library_books').select('id,title,book_v_level,vrl_components').in('status', ['published', 'ready'])
const B = data ?? []
let applied = 0, noJudge = 0
const rep = []
for (const b of B) {
  const c = b.vrl_components || {}
  const ens = c.difficulty_v2?.v ?? b.book_v_level
  const [cv, note] = judge(b.title ?? '')
  if (cv == null) { noJudge++; rep.push({ t: (b.title ?? '').slice(0, 24), ens, cv: '·', v3: b.book_v_level, d: 0 }); continue }
  const v3 = Math.round(clamp(0.65 * cv + 0.35 * ens))
  const v1 = c.book_v_level_v1 ?? b.book_v_level
  if (!dryRun) {
    const vc = { ...c, book_v_level_v1: v1, difficulty_v2: { ...(c.difficulty_v2 || {}), claude_v: cv, claude_note: note, v3, method: 'v2.3_claude_calibrated' } }
    await sb.from('library_books').update({ vrl_components: vc, book_v_level: v3 }).eq('id', b.id)
  }
  applied++
  rep.push({ t: (b.title ?? '').slice(0, 24), ens, cv, v3, d: v3 - b.book_v_level, note })
}
rep.sort((a, b) => (b.v3 ?? 0) - (a.v3 ?? 0))
console.log(`v2.3 Claude 캘리브레이션 ${dryRun ? '(DRY-RUN)' : ''}\n` + 'title'.padEnd(25) + 'ens Claude v3  Δcur  note')
for (const r of rep) console.log(`${r.t.padEnd(25)}${String(r.ens).padStart(4)}${String(r.cv).padStart(7)}${String(r.v3).padStart(4)}${(r.d > 0 ? '  +' : r.d < 0 ? '  ' : '   ') + r.d}   ${r.note ?? ''}`)
console.log(`\n적용 ${applied} · 판정없음 ${noJudge}`)
