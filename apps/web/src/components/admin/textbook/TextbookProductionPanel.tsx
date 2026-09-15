// apps/web/src/components/admin/textbook/TextbookProductionPanel.tsx
//
// **교재 제작 단계 콘솔 — 권마다 어디까지 왔고 지금 누구 차례인가.**
//
// ── 왜 이 화면이 생겼나 (실측 2026-09-07) ───────────────────────────
// 교재에는 상업 출판 8단계 대응표가 있는데 **읽는 것이 스크립트뿐**이었다 —
// grep 으로 확인한 소비처가 전부 `scripts/` 다. 단어장(VCB)에는 같은 성격의 콘솔이 있는데
// (`VcbProductionPanel`) 교재에는 없었다. 그래서 "지금 어느 권의 무엇을 돌려야 하는가" 를
// 알려면 SQL 을 쳐야 했다. 이 저장소가 반복해서 지적받은 형태다.
//
// ── 무엇을 먼저 말하나 ──────────────────────────────────────────────
// ① **지금 누구 차례인가** — 콘솔이 먼저 답해야 하는 질문이다. 사람 차례가 아니면
//    관리자는 창을 닫아도 된다.
// ② 단계별로 몇 권이 됐나 — 그리고 **못 잰 권을 따로** 센다.
// ③ 권마다 어디서 막혔나 — 개수만 세면 무엇을 고칠지 알 수 없다.
//
// ⚠️ **"못 쟀다" 를 "0" 으로 그리지 않는다.** 판정 불가 칸은 빈 칸도 채운 칸도 아닌
//    제3의 표시를 쓴다 — 미완료로 그리면 관리자가 없는 일을 하러 간다.
// ⚠️ 색만으로 상태를 가르지 않는다(색맹 대응) — 칸마다 기호와 `title` 이 붙는다.

import { Check, Minus, Terminal, User, Wrench } from 'lucide-react'

import {
  ACTOR_LABEL,
  PRODUCTION_STAGES,
  type ProductionReport,
  type StageActor,
  type StageState,
} from '@/lib/textbook/production-stages'

const ACTOR_ICON: Record<StageActor, typeof User> = {
  script: Wrench,
  'claude-code': Terminal,
  user: User,
}

/** 칸 하나 — 색 + 기호 + 읽어 주는 이름 세 겹으로 말한다. */
function Cell({ state, label }: { state: StageState; label: string }) {
  const look =
    state === 'done'
      ? { bg: '#2E7D5A', fg: 'var(--bg)', mark: <Check size={11} strokeWidth={2.5} aria-hidden /> }
      : state === 'unmeasured'
        ? { bg: 'var(--bg3)', fg: 'var(--t3)', mark: <Minus size={11} strokeWidth={2.5} aria-hidden /> }
        : { bg: 'var(--bg2)', fg: 'var(--t3)', mark: null }
  const says = state === 'done' ? '됨' : state === 'unmeasured' ? '못 잼' : '아직'
  return (
    <span
      title={`${label} — ${says}`}
      aria-label={`${label} ${says}`}
      className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)] border border-[var(--bd)]"
      style={{ background: look.bg, color: look.fg }}
    >
      {look.mark}
    </span>
  )
}

export function TextbookProductionPanel({ report }: { report: ProductionReport }) {
  const TurnIcon = report.turn ? ACTOR_ICON[report.turn] : null

  return (
    <section
      aria-label="교재 제작 단계"
      className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">제작 단계</h3>
        {/* ① 지금 누구 차례인가 — 이 화면에서 가장 중요한 한 줄 */}
        {report.turnStage && TurnIcon ? (
          <p className="flex items-center gap-1.5 font-body text-[12px] text-[var(--t2)]">
            <TurnIcon size={13} strokeWidth={1.75} className="text-[#8B5CF6]" aria-hidden />
            <span className="font-display font-[700] text-[var(--t1)]">
              {ACTOR_LABEL[report.turnStage.actor]} 차례
            </span>
            <span className="text-[var(--t3)]">· {report.turnStage.label}</span>
          </p>
        ) : (
          <p className="font-body text-[12px] text-[#2E7D5A]">전 권이 모든 단계를 넘었다</p>
        )}
      </header>

      {report.turnStage ? (
        <p className="break-keep rounded-[var(--r-sm)] bg-[var(--bg2)] p-2.5 font-body text-[12px] leading-snug text-[var(--t2)]">
          <span className="text-[var(--t3)]">다음 한 걸음 · </span>
          {report.turnStage.next}
        </p>
      ) : null}

      {/* ② 단계별 요약 — 못 잰 권을 따로 적는다 */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {PRODUCTION_STAGES.map((s, i) => {
          const Icon = ACTOR_ICON[s.actor]
          const unmeasured = report.unmeasuredByStage[i] ?? 0
          return (
            <li key={s.id} className="flex items-center gap-1.5">
              <Icon size={11} strokeWidth={1.75} className="text-[var(--t3)]" aria-hidden />
              <span className="font-body text-[12px] text-[var(--t2)]">{s.label}</span>
              <span className="font-mono text-[12px] tabular-nums text-[var(--t1)]">
                {report.doneByStage[i] ?? 0}/{report.volumes.length}
              </span>
              {unmeasured > 0 ? (
                <span className="font-mono text-[11px] tabular-nums text-[#B5803A]">
                  못 잼 {unmeasured}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>

      {/* ③ 권마다 어디서 막혔나 */}
      {report.volumes.length === 0 ? (
        <p className="font-body text-[12px] text-[var(--t3)]">아직 권이 없다.</p>
      ) : (
        <table className="w-full border-collapse">
          <caption className="sr-only">권별 제작 단계 진행</caption>
          <thead>
            <tr>
              <th scope="col" className="pb-1 text-left font-body text-[11px] font-[400] text-[var(--t3)]">
                권
              </th>
              {PRODUCTION_STAGES.map((s) => (
                <th
                  key={s.id}
                  scope="col"
                  title={s.says}
                  className="pb-1 text-center font-body text-[11px] font-[400] text-[var(--t3)]"
                >
                  {s.label}
                </th>
              ))}
              <th scope="col" className="pb-1 text-left font-body text-[11px] font-[400] text-[var(--t3)]">
                막힌 곳
              </th>
            </tr>
          </thead>
          <tbody>
            {report.volumes.map((v) => (
              <tr key={v.step} className="border-t border-[var(--bd)]">
                <th
                  scope="row"
                  className="py-1.5 pr-3 text-left font-body text-[12px] font-[400] text-[var(--t1)]"
                >
                  {v.title}
                  <span className="ml-1.5 font-mono text-[11px] text-[var(--t3)]">
                    {v.schoolBand}
                  </span>
                </th>
                {v.states.map((st, i) => (
                  <td key={PRODUCTION_STAGES[i]!.id} className="py-1.5 text-center">
                    <Cell state={st} label={PRODUCTION_STAGES[i]!.label} />
                  </td>
                ))}
                <td className="py-1.5 pl-3 font-body text-[11.5px] text-[var(--t2)]">
                  {v.blockedAt ? (
                    <>
                      {v.blockedAt.label}
                      <span className="ml-1 text-[var(--t3)]">
                        ({ACTOR_LABEL[v.blockedAt.actor]})
                      </span>
                    </>
                  ) : (
                    <span className="text-[#2E7D5A]">다 됨</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
