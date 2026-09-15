// scripts/textbook/health-bundle.mts
//
// **교재 파이프라인의 기계 단계를 한 번에 돈다** — `pnpm tbp:health`
//
// ── 왜 묶는가 (2026-08-26 큐·드레인 자동화 검토) ─────────────────────
// 교재 드레인은 18단계인데, 그중 **판단이 필요 없는 것**이 여럿이다:
//   · `store-new-types.mjs`(인자 없음) — 몇 개 늘고 몇 개 낡았는지만 센다. **아무것도 쓰지 않는다**
//   · `item-health-report.mjs` — 정답 번호 쏠림 · 지문 규격 · 밴드 분포. **읽기만 한다**
//   · `series-report.mjs` — 학령 7단이 다 찼는지. **읽기만 한다**
// 이 셋은 사람이 순서를 기억해 하나씩 치고 있었다. 기억이 자동화의 반대말이다.
//
// ⚠️ **쓰기 단계는 일부러 넣지 않았다.** `--prune`(되돌릴 수 없다) · `--commit`(적재) ·
//    `render-volume`(파일 덮어쓰기)은 여기서 부르지 않는다. 이 묶음의 계약은
//    **"돌려도 아무것도 안 변한다"** 이고, 그래야 스케줄러에 올려도 안전하다.
//
// 종료 코드: 하위 스크립트가 하나라도 실패하면 1 — 스케줄러가 조용한 실패를 성공으로 세지 않게.

import { spawnSync } from 'node:child_process'

interface Step {
  title: string
  argv: string[]
  /** 이 단계가 무엇을 답해 주는가 — 로그에 남겨 다음 사람이 왜 돌렸는지 알게 한다 */
  answers: string
}

const STEPS: Step[] = [
  {
    title: '재고 델타',
    argv: ['scripts/textbook/store-new-types.mjs'],
    answers: '새로 넣을 문항 수 · 지금 규칙으로 낡은 문항 수 (인자 없이 = 쓰기 없음)',
  },
  {
    title: '문항 건강',
    argv: ['scripts/textbook/item-health-report.mjs'],
    answers: '정답 번호 쏠림(χ²) · 지문 규격 · 밴드 분포 · 관측 유무',
  },
  {
    title: '시리즈 사다리',
    argv: ['scripts/textbook/series-report.mjs'],
    answers: '학령 7단이 다 찼는지 — 끊긴 계단이 어디인지',
  },
]

const started = Date.now()
console.log(`[tbp] 기계 단계 ${STEPS.length}종 — 읽기 전용 묶음\n`)

let failed = 0
for (const [i, step] of STEPS.entries()) {
  console.log(`${'─'.repeat(60)}\n[tbp] ${i + 1}/${STEPS.length} ${step.title} — ${step.answers}\n`)
  const r = spawnSync('pnpm', ['dlx', 'tsx', ...step.argv], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (r.status !== 0) {
    failed += 1
    console.error(`[tbp] ✗ ${step.title} 실패 (exit ${r.status})`)
  }
}

const mins = (Date.now() - started) / 60_000
console.log(
  `\n${'─'.repeat(60)}\n[tbp] 끝 — ${STEPS.length}종 중 실패 ${failed} · ${mins.toFixed(1)}분\n` +
    (failed === 0
      ? '[tbp] 쓰기는 하지 않았다. 적재하려면 store-new-types.mjs --commit 을 따로 돌린다.'
      : '[tbp] 실패한 단계의 출력을 먼저 읽을 것.'),
)
process.exit(failed > 0 ? 1 : 0)
