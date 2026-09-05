// apps/web/src/app/admin/csat/sourcing/SourceClient.tsx
//
// **④ 소재 — 각 칸에 쓸 지문이 있는가.**
//
// 시중 출판사가 원고를 쓰기 전에 하는 일이 지문 섭외다. 우리는 공개 도메인·개방 접근에서
// 수확하므로 섭외비 대신 **수율**이 든다 — 수확한 것 중 그 밴드 규격에 드는 것만 쓸 수 있다.
//
// 이 화면이 지목하는 것 하나: **게이트가 정의된 단계 밴드인데 지문이 0편인 자리.** 그 단계는
// 합격선을 정해 놓고 재료가 없는 상태이고, 그 밴드의 책은 지금 못 만든다.

'use client'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { emptyGateBands, type SourceView } from '@/lib/csat/factory-line-model'

import { BandStrip } from './BandStrip'

const BAND_KO: Record<string, string> = {
  S1: 'S1 입문 다독',
  S2: 'S2 자동화 다독',
  S3: 'S3 논증 정독',
  S4: 'S4 킬러 정독',
  S5: 'S5 병행 듣기',
  미분류: '미분류',
}

export function SourceClient({ rows, gateBands, loadError }: SourceView) {
  const empty = emptyGateBands({ rows, gateBands })
  const total = rows.reduce((n, r) => n + r.count, 0)
  const displayOnly = rows.reduce((n, r) => n + r.displayOnly, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">④ 소재 — 지문 재고</h2>
          <p className="font-body text-[12px] text-[var(--t2)]">시중: 지문 섭외 · 저작권 검토</p>
        </div>
        <AdminScreenHelp screen="csat-sourcing" />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[#9C3A30] bg-[var(--bg)] p-3 font-body text-[13px] text-[#9C3A30]"
        >
          {loadError}
        </p>
      ) : null}

      {/*
        판정 한 줄 + 띠. 예전에는 여기서 빈 밴드 이름을 **글로 열거**하고 아래에 띠를 또 그렸는데,
        같은 것을 두 번 말하는 것이라 밀집도 예산이 잡았다(덩어리 62 → 101). 띠가 「0편」과
        「얇다」를 둘 다 보이므로 열거는 지웠다 — 띠가 못 하는 말(그래서 뭘 해야 하나)만 남긴다.
      */}
      <section className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <p className="break-keep font-display text-[15px] font-[700]" style={{ color: empty.length ? '#9C3A30' : '#2E7D5A' }}>
          {empty.length
            ? `${empty.length}단계는 지금 책을 못 만든다 — 문항을 더 만들어도 안 된다`
            : `게이트가 있는 ${gateBands.length}단계에 모두 지문이 있다`}
          <span className="ml-2 font-body text-[12px] font-[400] text-[var(--t3)]">
            지문 {total.toLocaleString()}편 · 화면 전용 {displayOnly.toLocaleString()}편은 문항으로 못 쓴다
          </span>
        </p>
        <BandStrip rows={rows} gateBands={gateBands} />
      </section>

      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="mb-3 font-display text-[13px] font-[700] text-[var(--t1)]">
          단계 밴드 × 수준별 재고
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                <th className="py-2 pr-3 font-[500]">단계</th>
                <th className="py-2 pr-3 font-[500]">수준</th>
                <th className="py-2 pr-3 font-[500]">지문</th>
                <th className="py-2 pr-3 font-[500]">쓸 수 있는 것</th>
                <th className="py-2 pr-3 font-[500]">라이선스</th>
                <th className="py-2 font-[500]">CEFR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.band}-${r.vLevel}`} className="border-b border-[var(--bd)] last:border-0">
                  <td className="py-2 pr-3 text-[var(--t1)]">{BAND_KO[r.band] ?? r.band}</td>
                  <td className="py-2 pr-3 font-mono text-[var(--t2)]">
                    {r.vLevel == null ? '—' : `V${r.vLevel}`}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t1)]">
                    {r.count.toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t2)]">
                    {(r.count - r.displayOnly).toLocaleString()}
                    {r.displayOnly ? (
                      <span className="ml-1 text-[10.5px] text-[#B5803A]">(−{r.displayOnly})</span>
                    ) : null}
                  </td>
                  <td className="break-keep py-2 pr-3 text-[var(--t3)]">
                    {r.licenseClasses.join(' · ') || '—'}
                  </td>
                  <td className="break-keep py-2 text-[var(--t3)]">{r.cefrLevels.join(' · ') || '—'}</td>
                </tr>
              ))}
              {gateBands
                .filter((b) => !rows.some((r) => r.band === b))
                .map((b) => (
                  <tr key={`empty-${b}`} className="border-b border-[var(--bd)] last:border-0">
                    <td className="py-2 pr-3 text-[#9C3A30]">{BAND_KO[b] ?? b}</td>
                    <td className="py-2 pr-3 text-[var(--t3)]">—</td>
                    <td className="py-2 pr-3 font-mono text-[#9C3A30]">0</td>
                    <td colSpan={3} className="break-keep py-2 text-[var(--t3)]">
                      게이트는 있는데 지문이 없다
                    </td>
                  </tr>
                ))}
              {!rows.length && !gateBands.length ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-[var(--t3)]">
                    재고를 못 읽었다
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">더 수확하는 법</h3>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          node scripts/csat/harvest-plos.mjs
        </code>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          node scripts/textbook/harvest-gutenberg-kid.mjs
        </code>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/graded-source-probe.mjs
        </code>
        <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
          수확은 커서를 남기므로 다시 돌려도 같은 것을 두 번 안 가져온다. 마지막 것은 읽기만 하며,
          수확한 글이 그 밴드 규격(어휘 커버리지 · 문장 수)에 드는지 먼저 잰다 — 규격 밖 글을 적재하면
          문항이 안 나오고 재고만 불어난다.
        </p>
      </section>
    </div>
  )
}
