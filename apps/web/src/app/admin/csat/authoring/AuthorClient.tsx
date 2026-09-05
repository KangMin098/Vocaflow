// apps/web/src/app/admin/csat/authoring/AuthorClient.tsx
//
// **⑤ 집필 — 유형 × 수준 재고 전량.**
//
// 설계 화면(③)이 **사다리가 쓰기로 한 칸**만 보여 준다면, 여기는 **DB 에 있는 것 전부**다.
// 둘의 차이가 이 화면의 요점이다: 사다리 밖 재고는 만들어 두긴 했으나 **어느 권에도 안 실린다.**
// 창고 숫자는 커지는데 학습자에게 가는 것은 하나도 안 늘어난다 — 이 저장소의 상시 실패 모드
// (「공급망 비대 / 수요 검증 0」)가 문항 층에서 나타나는 자리다.

'use client'

import { useState } from 'react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  INVENTORY_LEVELS,
  TYPE_KO,
  offLadderCount,
  type AuthorView,
} from '@/lib/csat/factory-line-model'

export function AuthorClient({ cells, total, ladderCells, loadError }: AuthorView) {
  const [onlyLadder, setOnlyLadder] = useState(false)
  const inLadder = new Set(ladderCells.map((c) => `${c.type}|${c.vLevel}`))
  const offLadder = offLadderCount({ cells, ladderCells })

  const types = [...new Set(cells.map((c) => c.type))].sort((a, b) => {
    const sum = (t: string) => cells.filter((c) => c.type === t).reduce((n, c) => n + (c.count ?? 0), 0)
    return sum(b) - sum(a)
  })
  const shown = onlyLadder ? types.filter((t) => ladderCells.some((c) => c.type === t)) : types

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            ⑤ 집필 — 유형 × 수준 재고
          </h2>
          <p className="font-body text-[12px] text-[var(--t2)]">시중: 원고 집필 (문항)</p>
        </div>
        <AdminScreenHelp screen="csat-authoring" />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[#9C3A30] bg-[var(--bg)] p-3 font-body text-[13px] text-[#9C3A30]"
        >
          {loadError}
        </p>
      ) : null}

      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <p className="font-body text-[12px] text-[var(--t3)]">사다리 밖 재고</p>
        <p className="mt-1 break-keep font-display text-[18px] font-[800] text-[var(--t1)]">
          {offLadder.toLocaleString()}
          <span className="ml-2 font-body text-[13px] font-[400] text-[var(--t2)]">
            / 전체 {total?.toLocaleString() ?? '못 잼'}
            {total ? ` (${Math.round((100 * offLadder) / total)}%)` : ''}
          </span>
        </p>
        <p className="mt-1.5 break-keep font-body text-[12px] text-[var(--t3)]">
          만들어 뒀지만 <strong>어느 권에도 안 실리는</strong> 문항이다. 사다리가 그 (유형, 수준)
          조합을 안 쓰기 때문이다 — 창고는 커지는데 학습자에게 가는 것은 안 는다. 규격을 넓히든지,
          그 유형을 그만 만들든지 둘 중 하나를 골라야 한다.
        </p>
      </section>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            [false, '전부 (25유형)'],
            [true, '사다리가 쓰는 유형만'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => setOnlyLadder(v)}
            aria-pressed={onlyLadder === v}
            className={`min-h-[44px] rounded-[var(--r-md)] border px-3 font-display text-[13px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] ${
              onlyLadder === v
                ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 font-[600] text-[var(--t1)]'
                : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)] active:bg-[var(--bd)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <p className="mb-3 break-keep font-body text-[11.5px] text-[var(--t3)]">
          보라 테두리는 <strong>사다리가 실제로 쓰는 칸</strong>이다. 테두리 없는 칸의 재고는 지금
          어느 권에도 안 실린다. 「—」은 재고 0, 「?」는 못 센 것이다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                <th className="sticky left-0 z-10 bg-[var(--bg)] py-2 pr-3 text-left font-[500]">유형</th>
                {INVENTORY_LEVELS.map((v) => (
                  <th key={v} className="px-1.5 py-2 text-center font-mono font-[500]">
                    V{v}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-[500]">합</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const row = INVENTORY_LEVELS.map((v) => ({
                  v,
                  cell: cells.find((c) => c.type === t && c.vLevel === v),
                  ladder: inLadder.has(`${t}|${v}`),
                }))
                const sum = row.reduce((n, r) => n + (r.cell?.count ?? 0), 0)
                return (
                  <tr key={t} className="border-b border-[var(--bd)] last:border-0">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-[var(--bg)] py-2 pr-3 text-left font-[500] text-[var(--t1)]"
                    >
                      {TYPE_KO[t] ?? t}
                      <code className="ml-1.5 font-mono text-[10px] font-[400] text-[var(--t3)]">{t}</code>
                    </th>
                    {row.map(({ v, cell, ladder }) => {
                      const n = cell?.count
                      return (
                        <td key={v} className="px-1.5 py-2 text-center">
                          <span
                            title={
                              ladder
                                ? '사다리가 쓰는 칸 — 여기가 비면 그 권이 반쪽이다'
                                : '사다리 밖 — 만들어도 어느 권에도 안 실린다'
                            }
                            className={`inline-block min-w-[52px] rounded-[var(--r-sm)] px-1 py-1 font-mono text-[11px] tabular-nums ${
                              ladder ? 'border border-[#8B5CF6]/50' : ''
                            }`}
                            style={{
                              color:
                                n == null
                                  ? '#8A8278'
                                  : n === 0
                                    ? ladder
                                      ? '#9C3A30'
                                      : 'var(--t3)'
                                    : 'var(--t1)',
                            }}
                          >
                            {n == null ? '?' : n === 0 ? '—' : n.toLocaleString()}
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--t2)]">
                      {sum.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">빈 칸을 채우는 순서</h3>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          pnpm dlx tsx scripts/textbook/store-new-types.mjs
        </code>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          pnpm dlx tsx scripts/textbook/store-new-types.mjs --band 5 --commit
        </code>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          pnpm dlx tsx scripts/textbook/write-drain-export.mjs --band 3 --size 6
        </code>
        <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
          <strong>글을 새로 쓰기 전에 이미 있는 글에 문항을 붙이는 것이 먼저다.</strong> 문항이 안 붙은
          원글은 조판이 재고로 세지 않으므로, 그 상태에서 새 글을 써 봐야 같은 자리에 쌓인다 (실측
          2026-08-30 에 그런 원글이 11,246편이었다). 첫 명령은 인자 없이 돌리면 아무것도 쓰지 않고
          세기만 한다. 마지막 것은 원글 자체가 모자란 밴드에서 슬롯을 뽑아 Claude Code 가 쓴다.
        </p>
      </section>
    </div>
  )
}
