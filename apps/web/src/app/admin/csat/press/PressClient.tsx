// apps/web/src/app/admin/csat/press/PressClient.tsx
//
// **⑧ 조판 · 발행 — 권으로 나왔는가.**
//
// 공정의 끝이다. 여기까지 와야 학습자가 손에 쥐는 것이 생긴다 — 그 앞의 모든 수치는 **재고**이지
// 책이 아니다.
//
// 이 화면이 보는 것 셋:
//   ① 계단마다 권이 있는가 — 빈 계단에서 학습자는 다른 출판사로 간다.
//   ② **옛 규격으로 찍힌 권** — 브랜드 지문이 지금 값과 다르면 그 책은 지금 규격이 아니다.
//   ③ **문항이 안 붙은 원글** — 조판이 재고로 세지 않는 글이다. 여기가 크면 집필보다 문항 붙이기가
//      먼저다(실측 2026-08-30 에 V6 은 원글 9,992편 중 8,235편이 그 상태였다).

'use client'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import type { PressView } from '@/lib/csat/factory-line-model'

import { LadderFill } from './LadderFill'

export function PressClient({ volumes, rungs, brandFingerprint, brand, loadError }: PressView) {
  const stale = volumes.filter((v) => !v.brandCurrent)
  const missingExpl = volumes.reduce((n, v) => n + Math.max(0, v.missingExplanations), 0)
  const idle = volumes.filter((v) => v.articlesIdle != null)
  const idleSum = idle.length ? idle.reduce((n, v) => n + (v.articlesIdle ?? 0), 0) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">⑧ 조판 · 발행</h2>
          <p className="font-body text-[12px] text-[var(--t2)]">시중: 조판 · 교정쇄 · 인쇄</p>
        </div>
        <AdminScreenHelp screen="csat-press" />
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[#9C3A30] bg-[var(--bg)] p-3 font-body text-[13px] text-[#9C3A30]"
        >
          {loadError}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
          <p className="font-body text-[11px] text-[var(--t3)]">조판된 계단</p>
          <p className="mt-1 font-mono text-[20px] font-[700] tabular-nums text-[var(--t1)]">
            {new Set(volumes.map((v) => v.band)).size} / {rungs}
          </p>
          <p className="mt-1 break-keep font-body text-[11px] text-[var(--t3)]">
            빈 계단에서 학습자는 다른 출판사로 간다
          </p>
        </div>
        <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
          <p className="font-body text-[11px] text-[var(--t3)]">옛 규격으로 찍힌 권</p>
          <p
            className="mt-1 font-mono text-[20px] font-[700] tabular-nums"
            style={{ color: stale.length ? '#B5803A' : '#2E7D5A' }}
          >
            {stale.length}
          </p>
          <p className="mt-1 break-keep font-body text-[11px] text-[var(--t3)]">
            현재 지문 <code className="font-mono">{brandFingerprint.slice(0, 12)}</code>
          </p>
        </div>
        <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
          <p className="font-body text-[11px] text-[var(--t3)]">해설 안 붙은 문항</p>
          <p
            className="mt-1 font-mono text-[20px] font-[700] tabular-nums"
            style={{ color: missingExpl ? '#9C3A30' : '#2E7D5A' }}
          >
            {missingExpl.toLocaleString()}
          </p>
          <p className="mt-1 break-keep font-body text-[11px] text-[var(--t3)]">
            0 이 아니면 해설 빠진 책이 나간다
          </p>
        </div>
      </section>

      {/* 사다리 — 어느 학령이 비었는지 숫자 대신 계단으로. 브랜드는 채울 수 있는 계단이다. */}
      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="mb-2 font-display text-[13px] font-[700] text-[var(--t1)]">학령 사다리</h3>
        <LadderFill volumes={volumes} rungs={rungs} />
      </section>

      <section className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <h3 className="mb-1 font-display text-[13px] font-[700] text-[var(--t1)]">
          조판 기록 {volumes.length}권
        </h3>
        <p className="mb-3 break-keep font-body text-[11.5px] text-[var(--t3)]">
          수치는 <strong>조판기가 찍은 그 값</strong>이다 — 여기서 다시 계산하지 않는다. 그래야 화면과
          손에 쥔 책이 같은 것을 말한다. 「못 잼」은 그 항목이 없던 시절에 찍힌 권이다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                <th className="py-2 pr-3 font-[500]">권</th>
                <th className="py-2 pr-3 font-[500]">학령</th>
                <th className="py-2 pr-3 font-[500]">단원 · 문항</th>
                <th className="py-2 pr-3 font-[500]">해설 없음</th>
                <th className="py-2 pr-3 font-[500]">유형 구성 적합</th>
                <th className="py-2 pr-3 font-[500]">겹치지 않는 권수</th>
                <th className="py-2 pr-3 font-[500]">문항 없는 원글</th>
                <th className="py-2 font-[500]">규격</th>
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => (
                <tr key={v.band} className="border-b border-[var(--bd)] last:border-0">
                  <td className="py-2 pr-3 text-[var(--t1)]">
                    <span className="font-mono text-[10px] text-[var(--t3)]">V{v.band}</span>{' '}
                    {v.volumeTitle ?? '—'}
                    {v.renderCount > 1 ? (
                      <span className="ml-1 text-[10px] text-[var(--t3)]">×{v.renderCount}</span>
                    ) : null}
                  </td>
                  <td className="break-keep py-2 pr-3 text-[var(--t2)]">{v.schoolBand ?? '—'}</td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t2)]">
                    {v.units} · {v.items}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    <span style={{ color: v.missingExplanations > 0 ? '#9C3A30' : '#2E7D5A' }}>
                      {v.missingExplanations}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {v.typeMixFit == null ? (
                      <span className="text-[#8A8278]">못 잼</span>
                    ) : (
                      <span style={{ color: v.typeMixFit >= 0.8 ? '#2E7D5A' : '#B5803A' }}>
                        {Math.round(v.typeMixFit * 100)}%
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-[var(--t2)]">
                    {v.distinctVolumes ?? <span className="text-[#8A8278]">해당 없음</span>}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums">
                    {v.articlesIdle == null ? (
                      <span className="text-[#8A8278]">못 잼</span>
                    ) : (
                      <span style={{ color: v.articlesIdle > 0 ? '#B5803A' : '#2E7D5A' }}>
                        {v.articlesIdle.toLocaleString()}
                        {v.articlesWithItems != null ? (
                          <span className="ml-1 text-[10.5px] text-[var(--t3)]">
                            /{(v.articlesWithItems + v.articlesIdle).toLocaleString()}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    {v.brandCurrent ? (
                      <span className="text-[11px] text-[#2E7D5A]">최신</span>
                    ) : (
                      <span className="text-[11px] text-[#B5803A]">옛 규격</span>
                    )}
                  </td>
                </tr>
              ))}
              {!volumes.length ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-[var(--t3)]">
                    조판된 권이 없다 — 앞 공정이 다 끝나도 여기까지 와야 책이다
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">다시 찍는 법</h3>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          pnpm dlx tsx scripts/textbook/build-volume.mjs --band 6 --units 20
        </code>
        <code className="break-all font-mono text-[11.5px] text-[var(--t1)]">
          pnpm dlx tsx scripts/textbook/render-volume.mjs --band 6 --units 20 --out volume-v6.html
        </code>
        <p className="break-keep font-body text-[11.5px] leading-snug text-[var(--t3)]">
          첫 명령은 읽기만 하며 3관점 채점표를 낸다. 둘째는 <strong>지정한 파일을 덮어쓴다.</strong>
          {idleSum != null && idleSum > 0
            ? ` 문항 없는 원글이 ${idleSum.toLocaleString()}편이다 — 새 글을 쓰기 전에 store-new-types 로 문항부터 붙인다.`
            : ''}
        </p>
      </section>
      {/*
        브랜드 규격 — TBP 콘솔에 있던 표를 여기로 옮겼다(2026-09-06). 규격은 조판기의 **입력**이라
        조판 공정의 것이다. 별도 관측 화면에 두면 "규격이 바뀌었는데 왜 옛 규격으로 찍혔지" 를
        두 화면을 오가며 맞춰 봐야 한다.
      */}
      <section
        aria-label="브랜드 규격"
        className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
      >
        <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">
          조판 규격 — 이 값으로 찍힌다
        </h3>
        <p className="break-keep font-body text-[11.5px] text-[var(--t3)]">
          값은 디자인 토큰에서 온다 — 조판기가 색을 따로 갖고 있으면 손에 쥔 책이 화면과 달라진다.
          위 사다리에서 <strong>옛 규격</strong>으로 뜨는 권은 이 표가 바뀌기 전에 찍힌 것이다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[11px] text-[var(--t3)]">
                <th className="py-1.5 pr-3 font-[500]">지면에서의 자리</th>
                <th className="py-1.5 pr-3 font-[500]">라이트</th>
                <th className="py-1.5 font-[500]">다크</th>
              </tr>
            </thead>
            <tbody>
              {brand.rows.map((r) => (
                <tr key={r.key} className="border-b border-[var(--bd)] last:border-0">
                  <td className="break-keep py-1.5 pr-3 text-[var(--t2)]">{r.label}</td>
                  <td className="py-1.5 pr-3 font-mono text-[11px] text-[var(--t1)]">
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block h-3 w-3 rounded-[2px] border border-[var(--bd)] align-middle"
                      style={{ background: r.light }}
                    />
                    {r.light}
                  </td>
                  <td className="py-1.5 font-mono text-[11px] text-[var(--t1)]">
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block h-3 w-3 rounded-[2px] border border-[var(--bd)] align-middle"
                      style={{ background: r.dark }}
                    />
                    {r.dark}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 font-body text-[11px] text-[var(--t3)]">
          <span>영문 지문 · {brand.fonts.english}</span>
          <span>한국어 해설 · {brand.fonts.body}</span>
          <span>문항 번호·수치 · {brand.fonts.mono}</span>
        </p>
      </section>

    </div>
  )
}
