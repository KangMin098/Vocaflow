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
  StageFailures,
  StageFrame,
  type FailureRow,
  type StageBlock,
} from '@/components/admin/csat/StageFrame'
import { FACTORY_STAGES, judgeStage } from '@/lib/csat/factory-model'
import {
  INVENTORY_LEVELS,
  TYPE_KO,
  offLadderCount,
  type AuthorView,
} from '@/lib/csat/factory-line-model'

const STAGE = FACTORY_STAGES.find((s) => s.id === 'author')!

/**
 * 재고를 **농도**로 바꾼다 — 숫자를 읽기 전에 어디가 두껍고 어디가 얇은지 보이게.
 *
 * 로그를 쓰는 이유: 이 표의 재고는 3 부터 91,474 까지 **네 자릿수 차이**가 난다. 선형으로
 * 칠하면 큰 칸 몇 개만 진하고 나머지는 전부 흰색이 되어 아무 패턴도 안 보인다.
 *
 * ⚠️ 농도는 **거들 뿐**이다. 칸마다 수를 그대로 적고(색약·흑백 인쇄·스크린리더 대비),
 *   재고 0 과 「못 잼」은 색이 아니라 글자로 가른다 — 둘은 할 일이 정반대다.
 */
function heat(n: number | null | undefined, max: number): number {
  if (n == null || n <= 0 || max <= 0) return 0
  return Math.log10(n + 1) / Math.log10(max + 1)
}

export function AuthorClient({ cells, total, ladderCells, itemState, loadError }: AuthorView) {
  const [onlyLadder, setOnlyLadder] = useState(false)
  /** 농도의 분모. 못 센 칸은 빼고 실제로 있는 최대 재고를 쓴다. */
  const maxCell = cells.reduce((m, c) => Math.max(m, c.count ?? 0), 0)
  const inLadder = new Set(ladderCells.map((c) => `${c.type}|${c.vLevel}`))
  const offLadder = offLadderCount({ cells, ladderCells })

  const types = [...new Set(cells.map((c) => c.type))].sort((a, b) => {
    const sum = (t: string) => cells.filter((c) => c.type === t).reduce((n, c) => n + (c.count ?? 0), 0)
    return sum(b) - sum(a)
  })
  const shown = onlyLadder ? types.filter((t) => ladderCells.some((c) => c.type === t)) : types

  // ── ② 막힌 것 ──────────────────────────────────────────────────────
  // 사다리가 쓰기로 한 칸 중 **재고 0** 인 자리가 이 공정이 막고 있는 것이다.
  // 사다리 밖 재고는 막는 것이 아니라 **낭비**라 따로 센다 — 할 일이 정반대다
  // (전자는 만들고, 후자는 그만 만들거나 규격을 넓힌다).
  const byKey = new Map(cells.map((c) => [`${c.type}|${c.vLevel}`, c]))
  const emptyLadderCells = ladderCells.filter((l) => (byKey.get(`${l.type}|${l.vLevel}`)?.count ?? 0) === 0)
  const unmeasuredCells = cells.filter((c) => c.count == null)

  const blocks: StageBlock[] = [
    {
      what: '사다리가 쓰는데 재고 0 인 칸',
      count: loadError ? null : emptyLadderCells.length,
      unmeasuredReason: loadError ?? undefined,
    },
    {
      // 못 센 칸은 **막힌 것이 아니다** — 조회가 빈손으로 온 것이고 새로고침하면 대개 맞는다.
      what: '못 센 칸 (조회가 빈손으로 왔다)',
      count: unmeasuredCells.length,
    },
    {
      // ⚠️ 재고 매트릭스는 「몇 개 있나」만 말한다. 그중 **못 쓰는 것**은 다른 축이고,
      //    그 축이 없던 동안 관리자는 막힌 문항 292개를 재고로 세고 있었다(DD-74).
      what: '검수에서 막힌 문항 — 재고에 있지만 못 쓴다',
      count: itemState.available ? itemState.blocked : null,
      unmeasuredReason: itemState.error ?? '문항 상태 표를 못 읽었다',
    },
    {
      what: '사다리 밖 재고 — 어느 권에도 안 실린다',
      count: loadError ? null : offLadder,
      unmeasuredReason: loadError ?? undefined,
    },
  ]

  const failureRows: FailureRow[] = emptyLadderCells.slice(0, 10).map((c) => ({
    id: `${c.type}|${c.vLevel}`,
    label: `${TYPE_KO[c.type] ?? c.type} · V${c.vLevel}`,
    tags: ['재고 0', '사다리 안'],
    // 「무엇이 비었나」 다음 물음은 늘 「어떻게 채우나」다 — 그 칸의 명령을 그대로 적는다.
    says: `store-new-types --band ${c.vLevel} --commit 로 만들고, 원글이 모자라면 write-drain-export --band ${c.vLevel}`,
  }))

  return (
    <StageFrame
      stage={STAGE}
      status={judgeStage([
        {
          label: '사다리 칸 중 재고 있음',
          num: loadError ? null : ladderCells.length - emptyLadderCells.length,
          den: ladderCells.length,
          unit: 'ratio',
          unmeasuredReason: loadError ?? undefined,
        },
      ])}
      help={<AdminScreenHelp screen="csat-authoring" />}
      blocks={blocks}
      commands={[
        {
          cmd: 'pnpm dlx tsx scripts/textbook/store-new-types.mjs',
          why: '인자 없이 돌리면 아무것도 쓰지 않고 세기만 한다',
        },
        {
          cmd: 'pnpm dlx tsx scripts/textbook/store-new-types.mjs --band 5 --commit',
          why: '이미 있는 글에 문항을 붙인다 — 새 글보다 이것이 먼저다',
          writes: true,
        },
        {
          cmd: 'pnpm dlx tsx scripts/textbook/write-drain-export.mjs --band 3 --size 6',
          why: '원글 자체가 모자란 밴드에서 슬롯을 뽑는다. 읽기만 한다',
          claudeCode: true,
        },
        {
          cmd: 'pnpm dlx tsx scripts/textbook/item-drain-import.mjs --type purpose --band 5 --commit',
          why: '에이전트가 쓴 선택지를 적재한다. 재실행 안전 · 건너뛴 수를 출력한다',
          writes: true,
        },
      ]}
      approvalNote={
        '밴드 하나에 대량 적재하기 전에 소량으로 먼저 확인한다 — 규격 밖 문항이 들어가면 재고만 불고 조판이 안 고른다. 적재 자체는 재실행 안전이지만 지우는 길은 없다.'
      }
      failures={
        <StageFailures
          title="재고 0 인 칸 — 사다리가 쓰는 자리"
          total={loadError ? null : emptyLadderCells.length}
          rows={failureRows}
          emptyNote={
            loadError
              ? '집계표를 못 읽었다 — 0건이 아니다.'
              : '사다리가 쓰는 칸에 빈 자리가 없다. 사다리 밖 재고는 위 「막힌 것」에서 따로 센다.'
          }
        />
      }
    >

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[var(--memory-risk)] bg-[var(--bg)] p-3 font-body text-[13px] text-[var(--memory-risk)]"
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
            className={`min-h-[44px] rounded-[var(--r-md)] border px-3 font-display text-[13px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] ${
              onlyLadder === v
                ? 'border-[var(--p)] bg-[color-mix(in_srgb,var(--p)_10%,transparent)] font-[600] text-[var(--t1)]'
                : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)] active:bg-[var(--bd)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-body text-[11px] text-[var(--t3)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-4 rounded-[var(--r-sm)] border border-[color-mix(in_srgb,var(--p)_50%,transparent)]"
              aria-hidden
            />
            사다리가 쓰는 칸
          </span>
          <span className="inline-flex items-center gap-1">
            재고
            {[0.06, 0.2, 0.36, 0.56].map((a) => (
              <span
                key={a}
                className="inline-block h-3 w-4"
                style={{ background: `color-mix(in srgb, var(--p) ${a * 100}%, transparent)` }}
                aria-hidden
              />
            ))}
            <span className="ml-0.5">적음 → 많음 (로그)</span>
          </span>
          <span>
            <strong className="text-[var(--memory-risk)]">—</strong> 재고 0 · <strong>?</strong> 못 셈
          </span>
        </div>
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
                // 못 잰 칸을 0 으로 세면 합계가 **실제보다 작게** 나오는데 화면은 그 사실을
                // 말하지 않는다 — 관리자는 "이 유형은 재고가 적다" 고 잘못 읽는다.
                // 그래서 합계와 함께 "몇 칸을 못 쟀는지" 를 들고 다닌다.
                const sum = row.reduce((n, r) => n + (r.cell?.count ?? 0), 0)
                const unmeasured = row.filter((r) => r.cell?.count == null).length
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
                              ladder ? 'border border-[color-mix(in_srgb,var(--p)_50%,transparent)]' : ''
                            }`}
                            style={{
                              // 한 가지 색의 농도만 쓴다(발산·무지개 금지). 진할수록 재고가 많다.
                              background: n
                                ? `color-mix(in srgb, var(--p) ${((0.06 + 0.5 * heat(n, maxCell)) * 100).toFixed(1)}%, transparent)`
                                : undefined,
                              color:
                                n == null
                                  ? 'var(--memory-new)'
                                  : n === 0
                                    ? ladder
                                      ? 'var(--memory-risk)'
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
                      {unmeasured > 0 && (
                        <span
                          className="ml-1 text-[10px] text-[var(--memory-new)]"
                          title={`${unmeasured}칸을 못 쟀다 — 실제 합계는 이보다 크다`}
                        >
                          +?
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

    </StageFrame>
  )
}
