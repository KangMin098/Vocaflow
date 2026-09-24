// apps/web/src/app/admin/csat/explain/ExplainClient.tsx
//
// **⑥ 해설 — 유형 × 수준 해설 보유.**
//
// ── 이 화면이 없던 동안 무슨 일이 있었나 (DD-69 → DD-74) ────────────
// ⑥ 은 공정 여덟 중 유일하게 **화면이 없는 칸**이었다. 메뉴에는 있었지만 `href` 가 부모를
// 가리켰고 「준비 중」 배지가 붙어 있었다. 그래서 11항목 채점에서 A1(흐름 정합) · A2(계약) ·
// A3(상태 가시성) · B4(실패 목록) · B6(상태·사유)가 전부 0 이었다 — 파이프라인 최저 9/22.
//
// 없어도 된다는 근거는 「전체 보유율은 현황판 눈금, 어느 권이 막혔는지는 카탈로그 칸」이었다.
// 그 둘은 **합계**만 말한다. 실측하면 합계는 99.46%(875,618 / 880,337)로 거의 다 찬 것처럼
// 보이는데, 구멍은 고르게 퍼져 있지 않다:
//
//   vocab_choice   55,237 중 3,800 없음   ← 구멍의 8할이 한 유형에 몰려 있다
//   grammar_choice 17,623 중   857 없음
//   order · insert 각 31
//
// 합계만 보면 「거의 다 됐다」이고, 칸으로 보면 **어휘 유형 하나를 돌리면 끝난다**이다.
// 할 일이 다르다. 그래서 이 화면은 합계를 크게 적지 않고 **칸과 구멍**을 먼저 적는다.
//
// ⚠️ 해설 판정은 집계표 정의를 따른다 —
//   `COALESCE(NULLIF(explanation_ko,''), NULLIF(rationale_ko,''))`.
//   키만 있고 값이 빈 문항을 「해설 있음」으로 세면 구멍이 영영 안 보인다.

'use client'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import {
  StageFailures,
  StageFrame,
  type FailureRow,
  type StageBlock,
} from '@/components/admin/csat/StageFrame'
import {
  TYPE_KO,
  explainGaps,
  explainMissing,
  type ExplainView,
} from '@/lib/csat/factory-line-model'
import { FACTORY_STAGES, judgeStage } from '@/lib/csat/factory-model'

const STAGE = FACTORY_STAGES.find((s) => s.id === 'explain')!

/** 표의 행 — 유형별로 접는다. 225칸을 그대로 펴면 눈이 구멍을 못 찾는다. */
function byType(cells: ExplainView['cells']) {
  const m = new Map<string, { type: string; items: number; explained: number; inLadder: boolean }>()
  for (const c of cells) {
    if (c.items === 0) continue // 없는 칸은 구멍이 아니다
    const cur = m.get(c.type)
    if (cur) {
      cur.items += c.items
      cur.explained += c.explained
      cur.inLadder = cur.inLadder || c.inLadder
    } else {
      m.set(c.type, { type: c.type, items: c.items, explained: c.explained, inLadder: c.inLadder })
    }
  }
  // 구멍이 큰 유형 먼저 — 그것이 다음에 돌릴 것이다.
  return [...m.values()].sort((a, b) => b.items - b.explained - (a.items - a.explained))
}

export function ExplainClient({ cells, items, explained, inventoryNote, loadError }: ExplainView) {
  const missing = explainMissing({ items, explained })
  const gaps = explainGaps({ cells })
  const ladderGaps = gaps.filter((g) => g.inLadder)
  const rows = byType(cells)
  const fresh = inventoryNote

  const status = judgeStage([
    {
      label: '해설 보유',
      num: explained,
      den: items,
      unit: 'ratio',
      unmeasuredReason: loadError ?? undefined,
    },
  ])

  const blocks: StageBlock[] = [
    {
      what: '해설이 없는 문항',
      count: missing,
      unmeasuredReason: loadError ?? '집계표를 못 읽었다',
    },
    {
      // 사다리 밖 구멍은 급하지 않다 — 그 문항은 지금 어느 권에도 안 실린다.
      what: '그중 사다리가 쓰는 칸의 구멍',
      count: loadError ? null : ladderGaps.reduce((n, c) => n + (c.items - c.explained), 0),
      unmeasuredReason: loadError ?? undefined,
    },
    {
      what: '구멍이 있는 (유형 × 수준) 칸',
      count: loadError ? null : gaps.length,
      unmeasuredReason: loadError ?? undefined,
    },
  ]

  const failureRows: FailureRow[] = gaps.slice(0, 10).map((c) => ({
    id: `${c.type}|${c.vLevel}`,
    label: `${TYPE_KO[c.type] ?? c.type} · V${c.vLevel}`,
    tags: [c.inLadder ? '사다리 안' : '사다리 밖', `${c.items - c.explained}건`],
    // 이 칸을 채우는 명령을 그대로 적는다 — 「무엇이 모자란가」 다음 물음이 늘 「어떻게」다.
    says: `해설 ${c.explained.toLocaleString()} / ${c.items.toLocaleString()} — explain-drain-export --band ${c.vLevel} 로 뽑는다`,
  }))

  return (
    <StageFrame
      stage={STAGE}
      status={status}
      help={<AdminScreenHelp screen="csat-explain" />}
      blocks={blocks}
      commands={[
        {
          cmd: 'pnpm dlx tsx scripts/textbook/explain-fill.mjs --commit',
          why: '규칙으로 쓸 수 있는 해설을 먼저 채운다 — 이 단계를 건너뛰면 다음 단계가 「쓸 몫 0」이라고 거짓말한다',
          writes: true,
        },
        {
          cmd: 'pnpm dlx tsx scripts/textbook/explain-drain-export.mjs --band 6 --volume 20 --size 12',
          why: '남은 몫을 청크로 뽑는다. 읽기만 한다',
        },
        {
          cmd: 'Claude Code: chunk-NN.json 을 읽어 chunk-NN.out.json 으로 채운다',
          why: '규칙으로 못 쓰는 해설을 에이전트가 쓴다',
          claudeCode: true,
        },
        {
          cmd: 'pnpm dlx tsx scripts/textbook/explain-drain-import.mjs --band 6 --commit',
          why: '적재한다. 재실행 안전 — 이미 붙은 해설은 건너뛰고 건너뛴 수를 출력한다',
          writes: true,
        },
      ]}
      approvalNote={
        'answer_key 를 통째로 덮지 말고 explanation_ko 키 하나만 더한다 — 덮으면 정답 키가 날아간다. 되돌릴 수 없다.'
      }
      failures={
        <StageFailures
          title="구멍이 큰 칸 — 유형 × 수준"
          total={loadError ? null : gaps.length}
          rows={failureRows}
          emptyNote={
            loadError
              ? '집계표를 못 읽었다 — 0건이 아니다.'
              : '모든 칸에 해설이 붙었다. 새로 만든 문항이 들어오면 여기에 다시 나타난다.'
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

      {/* ③ 상태 매트릭스 — 유형별로 접은 보유율. 구멍이 큰 유형이 위에 온다. */}
      <section
        aria-label="유형별 해설 보유"
        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
      >
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">유형 × 해설 보유</h3>
          <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
            {explained == null || items == null ? (
              <span className="text-[var(--memory-new)]">못 잼</span>
            ) : (
              <>
                {explained.toLocaleString()} / {items.toLocaleString()}
              </>
            )}
          </span>
        </div>
        <p className="mb-3 break-keep font-body text-[11.5px] text-[var(--t3)]">
          합계는 <strong>거의 다 찼다</strong>고 말하지만 구멍은 고르게 퍼져 있지 않다 — 한 유형에
          몰려 있으면 그 유형 하나를 돌려서 끝난다. 합계와 칸은 <strong>할 일이 다르다.</strong>
        </p>
        {fresh ? (
          <p className="mb-3 break-keep font-body text-[11px] text-[var(--t3)]">{fresh}</p>
        ) : null}

        {rows.length === 0 ? (
          <p className="font-body text-[12px] text-[var(--memory-new)]">
            {loadError ? '집계표를 못 읽었다 — 0건이 아니다.' : '재고가 없다.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                  <th className="py-2 pr-3 font-[500]">유형</th>
                  <th className="py-2 pr-3 font-[500]">문항</th>
                  <th className="py-2 pr-3 font-[500]">해설</th>
                  <th className="py-2 pr-3 font-[500]">없음</th>
                  <th className="py-2 font-[500]">보유율</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const gap = r.items - r.explained
                  const pct = Math.round((100 * r.explained) / r.items)
                  return (
                    <tr key={r.type} className="border-b border-[var(--bd)] last:border-0">
                      <td className="py-2 pr-3 text-[var(--t1)]">
                        {TYPE_KO[r.type] ?? r.type}{' '}
                        <span className="font-mono text-[10px] text-[var(--t3)]">{r.type}</span>
                        {!r.inLadder ? (
                          <span className="ml-1 rounded-[var(--r-sm)] bg-[var(--bg2)] px-1 py-0.5 font-display text-[10px] font-[600] text-[var(--t3)]">
                            사다리 밖
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t2)]">
                        {r.items.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t2)]">
                        {r.explained.toLocaleString()}
                      </td>
                      {/* 색만으로 말하지 않는다 — 0 은 글자로도 「없음 0」이다. */}
                      <td
                        className="py-2 pr-3 font-mono tabular-nums"
                        style={{ color: gap > 0 ? 'var(--memory-risk)' : 'var(--memory-stable)' }}
                      >
                        {gap.toLocaleString()}
                      </td>
                      <td className="py-2 font-mono tabular-nums text-[var(--t1)]">
                        {pct}%
                        <span className="ml-2 inline-block h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bd)] align-middle">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: gap > 0 ? 'var(--memory-shaky)' : 'var(--memory-stable)',
                            }}
                          />
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </StageFrame>
  )
}
